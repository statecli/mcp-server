"""
Git Integration - Track changes between commits

Integrates with git to provide commit-level state tracking.
"""

import subprocess
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

from .client import StateCLI


@dataclass
class GitCommit:
    """Represents a git commit."""
    hash: str
    short_hash: str
    message: str
    author: str
    date: str
    files: List[str]


@dataclass
class GitDiff:
    """Represents a diff for a file."""
    file: str
    additions: int
    deletions: int
    changes: List[str]


@dataclass
class CommitComparison:
    """Comparison between two commits."""
    from_commit: str
    to_commit: str
    files: List[GitDiff]
    summary: str


class GitIntegration:
    """
    Integrates with git for commit-level state tracking.
    
    Example:
        cli = StateCLI()
        git = GitIntegration(cli)
        
        # Get current status
        print(git.get_current_branch())
        
        # Compare commits
        comparison = git.compare_commits("abc123", "HEAD")
    """
    
    def __init__(self, statecli: StateCLI, repo_path: str = "."):
        self.statecli = statecli
        self.repo_path = os.path.abspath(repo_path)
    
    def is_git_repo(self) -> bool:
        """Check if current directory is a git repository."""
        try:
            self._exec_git("rev-parse --git-dir")
            return True
        except:
            return False
    
    def get_current_branch(self) -> str:
        """Get current branch name."""
        return self._exec_git("rev-parse --abbrev-ref HEAD").strip()
    
    def get_current_commit(self) -> str:
        """Get current commit hash."""
        return self._exec_git("rev-parse HEAD").strip()
    
    def get_recent_commits(self, count: int = 10) -> List[GitCommit]:
        """Get recent commits."""
        format_str = "%H|%h|%s|%an|%ai"
        try:
            log = self._exec_git(f'log -{count} --pretty=format:"{format_str}"')
            commits = []
            
            for line in log.strip().split('\n'):
                if line:
                    parts = line.split('|')
                    if len(parts) >= 5:
                        hash_, short, msg, author, date = parts[:5]
                        files = self.get_commit_files(hash_)
                        commits.append(GitCommit(
                            hash=hash_,
                            short_hash=short,
                            message=msg,
                            author=author,
                            date=date,
                            files=files
                        ))
            return commits
        except:
            return []
    
    def get_commit_files(self, commit_hash: str) -> List[str]:
        """Get files changed in a commit."""
        try:
            output = self._exec_git(f"diff-tree --no-commit-id --name-only -r {commit_hash}")
            return [f.strip() for f in output.split('\n') if f.strip()]
        except:
            return []
    
    def compare_commits(self, from_commit: str, to_commit: str) -> CommitComparison:
        """Compare two commits."""
        try:
            diff_output = self._exec_git(f"diff --stat {from_commit}..{to_commit}")
            files = []
            
            for line in diff_output.split('\n'):
                # Parse diff stat output
                if '|' in line:
                    parts = line.split('|')
                    if len(parts) >= 2:
                        file_name = parts[0].strip()
                        stats = parts[1].strip()
                        additions = stats.count('+')
                        deletions = stats.count('-')
                        
                        changes = self._get_file_diff(from_commit, to_commit, file_name)
                        files.append(GitDiff(
                            file=file_name,
                            additions=additions,
                            deletions=deletions,
                            changes=changes
                        ))
            
            summary = f"Comparing {from_commit[:7]} to {to_commit[:7]}: {len(files)} files changed"
            return CommitComparison(
                from_commit=from_commit,
                to_commit=to_commit,
                files=files,
                summary=summary
            )
        except Exception as e:
            return CommitComparison(
                from_commit=from_commit,
                to_commit=to_commit,
                files=[],
                summary=f"Error comparing commits: {e}"
            )
    
    def track_git_state(self, actor: str = "git-integration"):
        """Track current git state in StateCLI."""
        branch = self.get_current_branch()
        commit = self.get_current_commit()
        recent = self.get_recent_commits(5)
        
        self.statecli.track("git", "state", {
            "branch": branch,
            "commit": commit,
            "short_commit": commit[:7],
            "recent_commits": [{"hash": c.short_hash, "message": c.message} for c in recent],
            "timestamp": datetime.now().isoformat()
        }, actor)
    
    def create_git_checkpoint(self, name: Optional[str] = None) -> Dict[str, str]:
        """Create a checkpoint at current git state."""
        commit = self.get_current_commit()
        checkpoint_name = name or f"git-{commit[:7]}"
        
        result = self.statecli.checkpoint("git:state", checkpoint_name)
        
        return {
            "checkpoint_id": result.id,
            "commit": commit,
            "name": checkpoint_name
        }
    
    def get_uncommitted_changes(self) -> Dict[str, List[str]]:
        """Get uncommitted changes."""
        try:
            staged = self._exec_git("diff --cached --name-only").split('\n')
            unstaged = self._exec_git("diff --name-only").split('\n')
            untracked = self._exec_git("ls-files --others --exclude-standard").split('\n')
            
            return {
                "staged": [f for f in staged if f.strip()],
                "unstaged": [f for f in unstaged if f.strip()],
                "untracked": [f for f in untracked if f.strip()]
            }
        except:
            return {"staged": [], "unstaged": [], "untracked": []}
    
    def _get_file_diff(self, from_commit: str, to_commit: str, file_path: str) -> List[str]:
        """Get diff for a specific file between commits."""
        try:
            diff = self._exec_git(f'diff {from_commit}..{to_commit} -- "{file_path}"')
            return diff.split('\n')[:100]  # Limit to 100 lines
        except:
            return []
    
    def _exec_git(self, command: str) -> str:
        """Execute a git command."""
        try:
            result = subprocess.run(
                f"git {command}",
                shell=True,
                cwd=self.repo_path,
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                raise Exception(result.stderr)
            return result.stdout
        except Exception as e:
            raise Exception(f"Git command failed: {e}")
