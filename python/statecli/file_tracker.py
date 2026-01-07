"""
File Tracker - Auto-tracking of file edits with diffs

Automatically tracks file changes and integrates with StateCLI.
"""

import os
import hashlib
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from .client import StateCLI


@dataclass
class FileChange:
    """Represents a tracked file change."""
    file_path: str
    operation: str  # 'create', 'modify', 'delete'
    before: Optional[str]
    after: Optional[str]
    diff: List[str]
    timestamp: str


class FileTracker:
    """
    Tracks file edits with automatic diff generation.
    
    Example:
        cli = StateCLI()
        tracker = FileTracker(cli)
        
        # Track a file edit
        change = tracker.track_edit(
            "src/index.py",
            before_content="x = 1",
            after_content="x = 2"
        )
        print(change.diff)  # ['-1: x = 1', '+1: x = 2']
    """
    
    def __init__(self, statecli: StateCLI, auto_checkpoint_threshold: int = 10):
        self.statecli = statecli
        self.auto_checkpoint_threshold = auto_checkpoint_threshold
        self._change_count = 0
    
    def track_edit(
        self,
        file_path: str,
        before_content: str,
        after_content: str,
        actor: str = "ai-agent"
    ) -> FileChange:
        """Track a file edit with before/after content."""
        return self._track_change(file_path, "modify", before_content, after_content, actor)
    
    def track_create(
        self,
        file_path: str,
        content: str,
        actor: str = "ai-agent"
    ) -> FileChange:
        """Track a file creation."""
        return self._track_change(file_path, "create", None, content, actor)
    
    def track_delete(
        self,
        file_path: str,
        previous_content: str,
        actor: str = "ai-agent"
    ) -> FileChange:
        """Track a file deletion."""
        return self._track_change(file_path, "delete", previous_content, None, actor)
    
    def get_file_history(self, file_path: str):
        """Get change history for a file."""
        normalized_path = os.path.normpath(file_path)
        return self.statecli.replay(f"file:{normalized_path}")
    
    def _track_change(
        self,
        file_path: str,
        operation: str,
        before: Optional[str],
        after: Optional[str],
        actor: str
    ) -> FileChange:
        """Internal method to track a file change."""
        diff = self._compute_diff(before, after)
        timestamp = datetime.now().isoformat()
        normalized_path = os.path.normpath(file_path)
        
        change = FileChange(
            file_path=normalized_path,
            operation=operation,
            before=before,
            after=after,
            diff=diff,
            timestamp=timestamp
        )
        
        # Track in StateCLI
        self.statecli.track("file", normalized_path, {
            "operation": operation,
            "content_hash": self._hash_content(after) if after else None,
            "line_count": len(after.split('\n')) if after else 0,
            "diff": diff[:50],  # Store first 50 diff lines
            "timestamp": timestamp
        }, actor)
        
        self._change_count += 1
        
        # Auto-checkpoint if threshold reached
        if self._change_count >= self.auto_checkpoint_threshold:
            self._create_auto_checkpoint()
        
        return change
    
    def _compute_diff(self, before: Optional[str], after: Optional[str]) -> List[str]:
        """Compute simple line-by-line diff."""
        diff = []
        
        if before is None and after is not None:
            # New file
            for i, line in enumerate(after.split('\n'), 1):
                diff.append(f"+{i}: {line}")
        elif before is not None and after is None:
            # Deleted file
            for i, line in enumerate(before.split('\n'), 1):
                diff.append(f"-{i}: {line}")
        elif before is not None and after is not None:
            # Modified file
            before_lines = before.split('\n')
            after_lines = after.split('\n')
            max_lines = max(len(before_lines), len(after_lines))
            
            for i in range(max_lines):
                before_line = before_lines[i] if i < len(before_lines) else None
                after_line = after_lines[i] if i < len(after_lines) else None
                
                if before_line != after_line:
                    if before_line is not None:
                        diff.append(f"-{i+1}: {before_line}")
                    if after_line is not None:
                        diff.append(f"+{i+1}: {after_line}")
        
        return diff
    
    def _hash_content(self, content: str) -> str:
        """Create MD5 hash of content."""
        return hashlib.md5(content.encode()).hexdigest()
    
    def _create_auto_checkpoint(self):
        """Create automatic checkpoint."""
        name = f"auto-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.statecli.checkpoint("session:current", name)
        self._change_count = 0
