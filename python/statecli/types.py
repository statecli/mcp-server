"""
Type definitions for StateCLI.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from datetime import datetime


@dataclass
class StateChange:
    """Represents a single state change."""
    id: str
    entity: str
    timestamp: str
    before: Optional[Dict[str, Any]]
    after: Dict[str, Any]
    actor: str
    step: Optional[int] = None


@dataclass
class Checkpoint:
    """Represents a saved checkpoint."""
    id: str
    entity: str
    name: str
    timestamp: str
    state: Optional[Dict[str, Any]]


@dataclass
class ReplayResult:
    """Result from replaying state changes."""
    entity: str
    changes: List[StateChange]
    summary: str
    suggested_next_actions: List[str]


@dataclass
class UndoResult:
    """Result from undoing state changes."""
    entity: str
    steps_undone: int
    restored_state: Optional[Dict[str, Any]]
    summary: str


@dataclass
class LogResult:
    """Result from viewing state log."""
    entity: str
    changes: List[StateChange]
    summary: str


@dataclass
class TrackResult:
    """Result from tracking a state change."""
    id: str
    entity: str
    timestamp: str
    summary: str


@dataclass 
class CheckpointResult:
    """Result from creating a checkpoint."""
    id: str
    entity: str
    name: str
    timestamp: str
    summary: str
