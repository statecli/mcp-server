"""
LangChain Integration for StateCLI

Provides LangChain-compatible tools for state management, replay, and undo.

Usage:
    from statecli.langchain_tools import get_statecli_tools
    from langchain.agents import initialize_agent
    
    tools = get_statecli_tools()
    agent = initialize_agent(tools, llm, agent="zero-shot-react-description")
"""

from typing import Optional, Type, List, Any
from pydantic import BaseModel, Field

try:
    from langchain.tools import BaseTool
    from langchain.callbacks.manager import CallbackManagerForToolRun
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    BaseTool = object
    CallbackManagerForToolRun = None

from .client import StateCLI


# Pydantic models for tool inputs
class ReplayInput(BaseModel):
    entity: str = Field(description="Entity identifier (e.g., 'file:src/index.ts', 'order:7421')")


class UndoInput(BaseModel):
    entity: str = Field(description="Entity identifier")
    steps: int = Field(default=1, description="Number of steps to undo")


class CheckpointInput(BaseModel):
    entity: str = Field(description="Entity identifier")
    name: str = Field(description="Checkpoint name (e.g., 'before-refactor')")


class TrackInput(BaseModel):
    entity_type: str = Field(description="Type of entity (e.g., 'file', 'config', 'order')")
    entity_id: str = Field(description="Entity ID")
    state: dict = Field(description="State to track")


class LogInput(BaseModel):
    entity: str = Field(description="Entity identifier or pattern (e.g., 'file:*')")


if LANGCHAIN_AVAILABLE:
    class StateCLIReplayTool(BaseTool):
        """Tool for replaying state changes."""
        name: str = "statecli_replay"
        description: str = """Replay state changes for an entity. Shows step-by-step what happened.
        Use this when you need to:
        - See what changes were made to an entity
        - Debug what went wrong
        - Understand the history of changes
        Input should be an entity identifier like 'file:src/index.ts' or 'order:7421'."""
        args_schema: Type[BaseModel] = ReplayInput
        statecli: StateCLI = None

        def __init__(self, statecli: StateCLI = None):
            super().__init__()
            self.statecli = statecli or StateCLI()

        def _run(self, entity: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
            result = self.statecli.replay(entity)
            return f"Found {len(result.changes)} changes for {entity}:\n{result.summary}"

        async def _arun(self, entity: str) -> str:
            return self._run(entity)


    class StateCLIUndoTool(BaseTool):
        """Tool for undoing state changes."""
        name: str = "statecli_undo"
        description: str = """Undo state changes for an entity. Rollback when something went wrong.
        Use this when you need to:
        - Revert a mistake
        - Restore previous state
        - Rollback failed changes
        Input: entity identifier and optional number of steps to undo."""
        args_schema: Type[BaseModel] = UndoInput
        statecli: StateCLI = None

        def __init__(self, statecli: StateCLI = None):
            super().__init__()
            self.statecli = statecli or StateCLI()

        def _run(self, entity: str, steps: int = 1, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
            result = self.statecli.undo(entity, steps)
            return f"Undid {result.steps_undone} steps for {entity}. {result.summary}"

        async def _arun(self, entity: str, steps: int = 1) -> str:
            return self._run(entity, steps)


    class StateCLICheckpointTool(BaseTool):
        """Tool for creating checkpoints."""
        name: str = "statecli_checkpoint"
        description: str = """Create a named checkpoint before making risky changes.
        Use this when you're about to:
        - Do a major refactor
        - Make breaking changes
        - Try something experimental
        Input: entity identifier and checkpoint name."""
        args_schema: Type[BaseModel] = CheckpointInput
        statecli: StateCLI = None

        def __init__(self, statecli: StateCLI = None):
            super().__init__()
            self.statecli = statecli or StateCLI()

        def _run(self, entity: str, name: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
            result = self.statecli.checkpoint(entity, name)
            return f"Checkpoint '{name}' created for {entity}. {result.summary}"

        async def _arun(self, entity: str, name: str) -> str:
            return self._run(entity, name)


    class StateCLITrackTool(BaseTool):
        """Tool for tracking state changes."""
        name: str = "statecli_track"
        description: str = """Track a state change for an entity.
        Use this when you:
        - Make an important change
        - Want to record state for later replay
        - Need to track modifications
        Input: entity_type, entity_id, and state dict."""
        args_schema: Type[BaseModel] = TrackInput
        statecli: StateCLI = None

        def __init__(self, statecli: StateCLI = None):
            super().__init__()
            self.statecli = statecli or StateCLI()

        def _run(self, entity_type: str, entity_id: str, state: dict, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
            result = self.statecli.track(entity_type, entity_id, state)
            return f"Tracked state for {entity_type}:{entity_id}. {result.summary}"

        async def _arun(self, entity_type: str, entity_id: str, state: dict) -> str:
            return self._run(entity_type, entity_id, state)


    class StateCLILogTool(BaseTool):
        """Tool for viewing state history."""
        name: str = "statecli_log"
        description: str = """View state change history for an entity.
        Use this to see all changes made to an entity over time.
        Input: entity identifier or pattern (e.g., 'file:*' for all files)."""
        args_schema: Type[BaseModel] = LogInput
        statecli: StateCLI = None

        def __init__(self, statecli: StateCLI = None):
            super().__init__()
            self.statecli = statecli or StateCLI()

        def _run(self, entity: str, run_manager: Optional[CallbackManagerForToolRun] = None) -> str:
            result = self.statecli.log(entity)
            return f"Log for {entity}: {len(result.changes)} changes. {result.summary}"

        async def _arun(self, entity: str) -> str:
            return self._run(entity)


def get_statecli_tools(statecli: StateCLI = None) -> List[Any]:
    """
    Get all StateCLI tools for LangChain.
    
    Args:
        statecli: Optional StateCLI instance to share across tools
        
    Returns:
        List of LangChain tools
        
    Example:
        from statecli.langchain_tools import get_statecli_tools
        from langchain.agents import initialize_agent
        
        tools = get_statecli_tools()
        agent = initialize_agent(tools, llm, agent="zero-shot-react-description")
    """
    if not LANGCHAIN_AVAILABLE:
        raise ImportError(
            "LangChain is not installed. Install it with: pip install langchain"
        )
    
    cli = statecli or StateCLI()
    
    return [
        StateCLIReplayTool(cli),
        StateCLIUndoTool(cli),
        StateCLICheckpointTool(cli),
        StateCLITrackTool(cli),
        StateCLILogTool(cli),
    ]


# CrewAI integration
def get_crewai_tools(statecli: StateCLI = None) -> List[Any]:
    """
    Get StateCLI tools formatted for CrewAI.
    
    Example:
        from statecli.langchain_tools import get_crewai_tools
        from crewai import Agent
        
        tools = get_crewai_tools()
        agent = Agent(role="Developer", tools=tools)
    """
    # CrewAI uses LangChain tools, so we can reuse them
    return get_statecli_tools(statecli)
