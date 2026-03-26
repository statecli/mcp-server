"""
StateCLI Python Shared Session
Allows multiple Python agents to coordinate under a shared namespace.
"""
import json
import os
import time
from pathlib import Path
from typing import Optional


class SharedSession:
    def __init__(self, namespace: str, agent_id: Optional[str] = None, data_dir: Optional[str] = None):
        self.namespace = namespace
        self.agent_id = agent_id or f"agent-{int(time.time())}"
        safe = namespace.replace(":", "_").replace("/", "_")
        base = Path(data_dir or (Path.home() / ".statecli" / "shared"))
        self.session_dir = base / safe
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.members_file = self.session_dir / "members.json"
        self.checkpoints_file = self.session_dir / "checkpoints.json"

    def _read(self, f): 
        try: return json.loads(f.read_text())
        except: return []

    def _write(self, f, data): f.write_text(json.dumps(data, indent=2))

    def join(self) -> dict:
        members = self._read(self.members_file)
        member = next((m for m in members if m["agent_id"] == self.agent_id), None)
        if member:
            member["last_seen"] = int(time.time() * 1000)
        else:
            member = {"agent_id": self.agent_id, "joined_at": int(time.time() * 1000), "last_seen": int(time.time() * 1000), "checkpoint_count": 0}
            members.append(member)
        self._write(self.members_file, members)
        return member

    def leave(self):
        members = [m for m in self._read(self.members_file) if m["agent_id"] != self.agent_id]
        self._write(self.members_file, members)

    def list_members(self):
        now = int(time.time() * 1000)
        return [m for m in self._read(self.members_file) if now - m.get("last_seen", 0) < 300_000]

    def save_checkpoint(self, entity: str, name: str, state: dict) -> dict:
        cps = self._read(self.checkpoints_file)
        cp = {"namespace": self.namespace, "agent_id": self.agent_id, "entity": entity, "name": name, "state": state, "timestamp": int(time.time() * 1000)}
        cps.append(cp)
        self._write(self.checkpoints_file, cps)
        return cp

    def list_checkpoints(self, entity: Optional[str] = None):
        cps = self._read(self.checkpoints_file)
        return [c for c in cps if entity is None or c["entity"] == entity]
