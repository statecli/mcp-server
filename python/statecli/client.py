"""
StateCLI Python Client

Provides a Python interface to the StateCLI MCP Server.
Can be used standalone with SQLite or as an MCP client.
"""

import json
import sqlite3
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pathlib import Path

from .types import (
    StateChange, 
    Checkpoint, 
    ReplayResult, 
    UndoResult, 
    LogResult, 
    TrackResult,
    CheckpointResult
)


class StateCLI:
    """
    StateCLI client for state replay and self-debugging.
    
    Example:
        cli = StateCLI()
        
        # Track a state change
        cli.track("order", "7421", {"status": "pending"})
        
        # Replay to see what happened
        replay = cli.replay("order:7421")
        
        # Undo if needed
        cli.undo("order:7421")
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize StateCLI.
        
        Args:
            db_path: Path to SQLite database. Defaults to .statecli/state.db
        """
        if db_path is None:
            statecli_dir = Path.home() / ".statecli"
            statecli_dir.mkdir(exist_ok=True)
            db_path = str(statecli_dir / "state.db")
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()
    
    def _init_schema(self):
        """Initialize database schema."""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS state_changes (
                id TEXT PRIMARY KEY,
                entity TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                before_state TEXT,
                after_state TEXT NOT NULL,
                actor TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                undone INTEGER DEFAULT 0
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS checkpoints (
                id TEXT PRIMARY KEY,
                entity TEXT NOT NULL,
                name TEXT NOT NULL,
                state TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_entity ON state_changes(entity)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON state_changes(timestamp)
        """)
        
        self.conn.commit()
    
    def track(
        self, 
        entity_type: str, 
        entity_id: str, 
        state: Dict[str, Any],
        actor: str = "ai-agent"
    ) -> TrackResult:
        """
        Track a state change.
        
        Args:
            entity_type: Type of entity (e.g., "order", "user", "task")
            entity_id: Unique identifier for the entity
            state: The new state (any JSON-serializable dict)
            actor: Who is making this change (default: "ai-agent")
            
        Returns:
            TrackResult with confirmation
        """
        entity = f"{entity_type}:{entity_id}"
        change_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Get previous state
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT after_state FROM state_changes 
            WHERE entity = ? AND undone = 0
            ORDER BY timestamp DESC LIMIT 1
        """, (entity,))
        
        row = cursor.fetchone()
        before_state = row["after_state"] if row else None
        
        # Insert new state change
        cursor.execute("""
            INSERT INTO state_changes 
            (id, entity, entity_type, entity_id, before_state, after_state, actor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            change_id, 
            entity, 
            entity_type, 
            entity_id,
            before_state,
            json.dumps(state),
            actor,
            timestamp
        ))
        
        self.conn.commit()
        
        return TrackResult(
            id=change_id,
            entity=entity,
            timestamp=timestamp,
            summary=f"Tracked state change for {entity}"
        )
    
    def replay(
        self, 
        entity: str, 
        actor: Optional[str] = None
    ) -> ReplayResult:
        """
        Replay state changes for an entity.
        
        Args:
            entity: Entity identifier (e.g., "order:7421")
            actor: Optional filter by actor
            
        Returns:
            ReplayResult with step-by-step changes
        """
        cursor = self.conn.cursor()
        
        query = """
            SELECT * FROM state_changes 
            WHERE entity = ? AND undone = 0
        """
        params: List[Any] = [entity]
        
        if actor:
            query += " AND actor = ?"
            params.append(actor)
        
        query += " ORDER BY timestamp ASC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        changes = []
        for i, row in enumerate(rows, 1):
            changes.append(StateChange(
                id=row["id"],
                entity=row["entity"],
                timestamp=row["timestamp"],
                before=json.loads(row["before_state"]) if row["before_state"] else None,
                after=json.loads(row["after_state"]),
                actor=row["actor"],
                step=i
            ))
        
        suggested_actions = []
        if len(changes) > 0:
            suggested_actions.append(f"investigate step {len(changes)}")
            suggested_actions.append("check for errors")
        
        return ReplayResult(
            entity=entity,
            changes=changes,
            summary=f"{len(changes)} state changes found",
            suggested_next_actions=suggested_actions
        )
    
    def undo(self, entity: str, steps: int = 1) -> UndoResult:
        """
        Undo state changes.
        
        Args:
            entity: Entity identifier (e.g., "order:7421")
            steps: Number of steps to undo (default: 1)
            
        Returns:
            UndoResult with restored state
        """
        cursor = self.conn.cursor()
        
        # Get the last N changes
        cursor.execute("""
            SELECT id, before_state FROM state_changes 
            WHERE entity = ? AND undone = 0
            ORDER BY timestamp DESC LIMIT ?
        """, (entity, steps))
        
        rows = cursor.fetchall()
        undone_count = 0
        restored_state = None
        
        for row in rows:
            cursor.execute("""
                UPDATE state_changes SET undone = 1 WHERE id = ?
            """, (row["id"],))
            undone_count += 1
            
            if row["before_state"]:
                restored_state = json.loads(row["before_state"])
        
        self.conn.commit()
        
        return UndoResult(
            entity=entity,
            steps_undone=undone_count,
            restored_state=restored_state,
            summary=f"Undid {undone_count} step(s) for {entity}"
        )
    
    def checkpoint(self, entity: str, name: str) -> CheckpointResult:
        """
        Create a checkpoint.
        
        Args:
            entity: Entity identifier (e.g., "order:7421")
            name: Checkpoint name (e.g., "before-refund")
            
        Returns:
            CheckpointResult with checkpoint details
        """
        checkpoint_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
        # Get current state
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT after_state FROM state_changes 
            WHERE entity = ? AND undone = 0
            ORDER BY timestamp DESC LIMIT 1
        """, (entity,))
        
        row = cursor.fetchone()
        current_state = row["after_state"] if row else None
        
        # Save checkpoint
        cursor.execute("""
            INSERT INTO checkpoints (id, entity, name, state, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (checkpoint_id, entity, name, current_state, timestamp))
        
        self.conn.commit()
        
        return CheckpointResult(
            id=checkpoint_id,
            entity=entity,
            name=name,
            timestamp=timestamp,
            summary=f"Checkpoint '{name}' created for {entity}"
        )
    
    def log(
        self, 
        entity: str, 
        since: Optional[str] = None,
        actor: Optional[str] = None
    ) -> LogResult:
        """
        View state change history.
        
        Args:
            entity: Entity identifier or pattern (e.g., "order:7421", "order:*")
            since: Optional time filter (e.g., "1h ago", "24h ago")
            actor: Optional filter by actor
            
        Returns:
            LogResult with all changes
        """
        cursor = self.conn.cursor()
        
        # Handle wildcard patterns
        if "*" in entity:
            entity_pattern = entity.replace("*", "%")
            query = "SELECT * FROM state_changes WHERE entity LIKE ? AND undone = 0"
            params: List[Any] = [entity_pattern]
        else:
            query = "SELECT * FROM state_changes WHERE entity = ? AND undone = 0"
            params = [entity]
        
        if actor:
            query += " AND actor = ?"
            params.append(actor)
        
        query += " ORDER BY timestamp DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        changes = []
        for row in rows:
            changes.append(StateChange(
                id=row["id"],
                entity=row["entity"],
                timestamp=row["timestamp"],
                before=json.loads(row["before_state"]) if row["before_state"] else None,
                after=json.loads(row["after_state"]),
                actor=row["actor"]
            ))
        
        return LogResult(
            entity=entity,
            changes=changes,
            summary=f"{len(changes)} changes found"
        )
    
    def get_current_state(self, entity: str) -> Optional[Dict[str, Any]]:
        """
        Get the current state of an entity.
        
        Args:
            entity: Entity identifier (e.g., "order:7421")
            
        Returns:
            Current state dict or None if not found
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT after_state FROM state_changes 
            WHERE entity = ? AND undone = 0
            ORDER BY timestamp DESC LIMIT 1
        """, (entity,))
        
        row = cursor.fetchone()
        if row and row["after_state"]:
            return json.loads(row["after_state"])
        return None
    
    def restore_checkpoint(self, entity: str, name: str) -> UndoResult:
        """
        Restore to a named checkpoint.
        
        Args:
            entity: Entity identifier
            name: Checkpoint name to restore
            
        Returns:
            UndoResult with restored state
        """
        cursor = self.conn.cursor()
        
        # Get checkpoint
        cursor.execute("""
            SELECT * FROM checkpoints 
            WHERE entity = ? AND name = ?
            ORDER BY timestamp DESC LIMIT 1
        """, (entity, name))
        
        row = cursor.fetchone()
        if not row:
            return UndoResult(
                entity=entity,
                steps_undone=0,
                restored_state=None,
                summary=f"Checkpoint '{name}' not found for {entity}"
            )
        
        checkpoint_timestamp = row["timestamp"]
        checkpoint_state = json.loads(row["state"]) if row["state"] else None
        
        # Mark all changes after checkpoint as undone
        cursor.execute("""
            UPDATE state_changes 
            SET undone = 1 
            WHERE entity = ? AND timestamp > ? AND undone = 0
        """, (entity, checkpoint_timestamp))
        
        undone_count = cursor.rowcount
        self.conn.commit()
        
        return UndoResult(
            entity=entity,
            steps_undone=undone_count,
            restored_state=checkpoint_state,
            summary=f"Restored to checkpoint '{name}', undid {undone_count} changes"
        )
    
    def close(self):
        """Close database connection."""
        self.conn.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    # ─── Web Knowledge Tools (parity with statecli_search_web / statecli_read_url) ─────

    def search_web(self, query: str, num_results: int = 5) -> dict:
        """Search the web via DuckDuckGo — mirrors statecli_search_web."""
        from .knowledge import search_web as _search
        result = _search(query, num_results)
        return {"query": query, "results": result}

    def read_url(self, url: str, query: Optional[str] = None) -> dict:
        """Fetch and read a URL — mirrors statecli_read_url."""
        from .knowledge import read_url as _read
        result = _read(url, query)
        return {"url": url, "content": result}

    # ─── Memory Tools ────────────────────────────────────────────────────────────

    def memory_query(self, q: str, limit: int = 10) -> dict:
        """Query history for past actions matching a search term."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM state_changes
            WHERE (entity LIKE ? OR actor LIKE ?)
            AND undone = 0
            ORDER BY timestamp DESC LIMIT ?
        """, (f"%{q}%", f"%{q}%", limit))
        rows = cursor.fetchall()
        return {"query": q, "results": [dict(r) for r in rows], "count": len(rows)}

    def recent_activity(self, limit: int = 20) -> dict:
        """Return the most recent agent actions across all entities."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT entity, actor, timestamp, after_state
            FROM state_changes WHERE undone = 0
            ORDER BY timestamp DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return {"events": [dict(r) for r in rows]}

    def session_info(self) -> dict:
        """Return metadata about the current session."""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM state_changes WHERE undone = 0")
        total = cursor.fetchone()["total"]
        cursor.execute("SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM state_changes")
        row = cursor.fetchone()
        return {"total_events": total, "first_event": row["first"], "last_event": row["last"], "db_path": self.db_path}

    # ─── Git Tools ───────────────────────────────────────────────────────────────

    def git_status(self) -> dict:
        """Get current git branch and uncommitted changes."""
        import subprocess
        try:
            branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True).strip()
            status = subprocess.check_output(["git", "status", "--short"], text=True).strip()
            return {"branch": branch, "changes": status.splitlines()}
        except Exception as e:
            return {"error": str(e)}

    def git_history(self, n: int = 10) -> dict:
        """Return the last N git commits."""
        import subprocess
        try:
            log = subprocess.check_output(
                ["git", "log", f"-{n}", "--oneline", "--format=%H|%s|%an|%ar"], text=True
            ).strip()
            commits = []
            for line in log.splitlines():
                parts = line.split("|", 3)
                if len(parts) == 4:
                    commits.append({"hash": parts[0], "message": parts[1], "author": parts[2], "when": parts[3]})
            return {"commits": commits}
        except Exception as e:
            return {"error": str(e)}

    def git_checkpoint(self, name: str) -> dict:
        """Create a checkpoint anchored to current git HEAD."""
        import subprocess
        try:
            head = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
            result = self.checkpoint("git:HEAD", f"{name}@{head[:8]}")
            return {"git_hash": head, "checkpoint": result.id, "name": name}
        except Exception as e:
            return {"error": str(e)}

    # ─── Impact & Safety Tools ───────────────────────────────────────────────────

    def predict_impact(self, entity: str) -> dict:
        """Predict which other entities may be affected by changing this one."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT entity FROM state_changes
            WHERE actor IN (SELECT actor FROM state_changes WHERE entity = ? AND undone = 0)
            AND entity != ? AND undone = 0
            LIMIT 10
        """, (entity, entity))
        related = [r["entity"] for r in cursor.fetchall()]
        return {"entity": entity, "possibly_affected": related, "risk_score": min(len(related) * 10, 100)}

    def is_safe(self, entity: str, change_type: str = "modify") -> dict:
        """Quick safety check — should you checkpoint before touching this entity?"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM state_changes WHERE entity = ? AND undone = 0", (entity,))
        count = cursor.fetchone()["cnt"]
        safe = count == 0
        return {
            "safe": safe,
            "entity": entity,
            "change_type": change_type,
            "reason": "No existing changes — safe to proceed." if safe else f"{count} existing changes found — checkpoint first!",
            "recommendation": "proceed" if safe else "call checkpoint() first"
        }

    def simulate_undo(self, entity: str, steps: int = 1) -> dict:
        """Preview what would be undone without actually undoing it."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, before_state, after_state, timestamp FROM state_changes
            WHERE entity = ? AND undone = 0
            ORDER BY timestamp DESC LIMIT ?
        """, (entity, steps))
        rows = cursor.fetchall()
        return {
            "entity": entity,
            "would_undo": [{"id": r["id"], "timestamp": r["timestamp"]} for r in rows],
            "would_restore_to": json.loads(rows[-1]["before_state"]) if rows and rows[-1]["before_state"] else None
        }

    def safe_change_order(self, entities: List[str]) -> dict:
        """Get the recommended order for changing multiple entities safely."""
        scored = []
        for entity in entities:
            cursor = self.conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM state_changes WHERE entity = ? AND undone = 0", (entity,))
            dep_count = cursor.fetchone()["cnt"]
            scored.append((entity, dep_count))
        scored.sort(key=lambda x: x[1])
        return {"recommended_order": [e for e, _ in scored], "rationale": "Entities with fewer existing changes should be modified first."}

    # ─── Shared Sessions ─────────────────────────────────────────────────────────

    def join_session(self, namespace: str) -> dict:
        """Join a shared multi-agent session namespace."""
        from .shared import SharedSession
        self._shared_session = SharedSession(namespace)
        member = self._shared_session.join()
        return {"namespace": namespace, "agent_id": member["agent_id"], "members": self._shared_session.list_members()}

    def leave_session(self) -> dict:
        """Leave the current shared session."""
        if hasattr(self, "_shared_session"):
            self._shared_session.leave()
            ns = self._shared_session.namespace
            del self._shared_session
            return {"left": True, "namespace": ns}
        return {"left": False, "reason": "Not in a shared session"}

