"""
StateCLI - State Replay & Self-Debugging for AI Agents

A Python client for state management, replay, and undo capabilities.
Enhanced with file tracking, error recovery, and git integration.
"""

from .client import StateCLI
from .types import (
    StateChange,
    Checkpoint,
    ReplayResult,
    UndoResult,
    LogResult,
    TrackResult,
    CheckpointResult
)
from .file_tracker import FileTracker, FileChange
from .error_recovery import ErrorRecovery, ErrorContext, RecoverySuggestion, AnalysisResult
from .git_integration import GitIntegration, GitCommit, GitDiff, CommitComparison

# LangChain integration (optional import)
try:
    from .langchain_tools import get_statecli_tools, get_crewai_tools
except ImportError:
    get_statecli_tools = None
    get_crewai_tools = None

__version__ = "0.3.0"
__all__ = [
    "StateCLI",
    "StateChange",
    "Checkpoint", 
    "ReplayResult",
    "UndoResult",
    "LogResult",
    "TrackResult"
]
