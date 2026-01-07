"""
Error Recovery - Automatic error detection and recovery suggestions

Analyzes errors and suggests rollback actions.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

from .client import StateCLI


@dataclass
class ErrorContext:
    """Context about an error."""
    error_type: str
    error_message: str
    stack_trace: Optional[str]
    affected_entities: List[str]
    timestamp: str


@dataclass
class RecoverySuggestion:
    """A suggested recovery action."""
    action: str  # 'undo', 'restore_checkpoint', 'replay_analyze', 'manual'
    entity: str
    steps: Optional[int] = None
    checkpoint_name: Optional[str] = None
    reason: str = ""
    confidence: str = "medium"  # 'high', 'medium', 'low'


@dataclass
class AnalysisResult:
    """Result of error analysis."""
    error: ErrorContext
    recent_changes: List[Dict[str, Any]]
    suggestions: List[RecoverySuggestion]
    summary: str


class ErrorRecovery:
    """
    Analyzes errors and provides recovery suggestions.
    
    Example:
        cli = StateCLI()
        recovery = ErrorRecovery(cli)
        
        try:
            risky_operation()
        except Exception as e:
            analysis = recovery.analyze_error(e, ["file:src/main.py"])
            print(analysis.summary)
            
            # Auto-recover
            result = recovery.auto_recover(analysis)
    """
    
    def __init__(self, statecli: StateCLI):
        self.statecli = statecli
        self._error_history: List[ErrorContext] = []
    
    def analyze_error(
        self,
        error: Exception,
        affected_entities: Optional[List[str]] = None
    ) -> AnalysisResult:
        """Analyze an error and suggest recovery actions."""
        affected = affected_entities or []
        
        error_context = ErrorContext(
            error_type=type(error).__name__,
            error_message=str(error),
            stack_trace=None,  # Could extract from traceback
            affected_entities=affected,
            timestamp=datetime.now().isoformat()
        )
        self._error_history.append(error_context)
        
        # Get recent changes for affected entities
        recent_changes = []
        for entity in affected:
            replay = self.statecli.replay(entity)
            recent_changes.extend(replay.changes[-5:])  # Last 5 per entity
        
        # Generate suggestions
        suggestions = self._generate_suggestions(error_context, recent_changes)
        
        # Create summary
        summary = self._create_summary(error_context, recent_changes, suggestions)
        
        return AnalysisResult(
            error=error_context,
            recent_changes=recent_changes,
            suggestions=suggestions,
            summary=summary
        )
    
    def auto_recover(self, analysis: AnalysisResult) -> Dict[str, Any]:
        """Automatically recover using the best suggestion."""
        high_confidence = [s for s in analysis.suggestions if s.confidence == "high"]
        
        if not high_confidence:
            return {
                "success": False,
                "action": "none",
                "result": "No high-confidence recovery suggestion available"
            }
        
        suggestion = high_confidence[0]
        
        try:
            if suggestion.action == "undo":
                result = self.statecli.undo(suggestion.entity, suggestion.steps or 1)
                return {"success": True, "action": "undo", "result": result}
            
            elif suggestion.action == "restore_checkpoint" and suggestion.checkpoint_name:
                result = self.statecli.restore_checkpoint(
                    suggestion.entity, 
                    suggestion.checkpoint_name
                )
                return {"success": True, "action": "restore_checkpoint", "result": result}
            
            elif suggestion.action == "replay_analyze":
                result = self.statecli.replay(suggestion.entity)
                return {"success": True, "action": "replay_analyze", "result": result}
        
        except Exception as e:
            return {"success": False, "action": suggestion.action, "result": str(e)}
        
        return {"success": False, "action": "manual", "result": "Manual intervention required"}
    
    def safe_execute(self, entity: str, operation_name: str = "risky-operation"):
        """
        Create a checkpoint before a risky operation.
        Returns the checkpoint info for potential rollback.
        """
        checkpoint_name = f"before-{operation_name}-{int(datetime.now().timestamp())}"
        checkpoint = self.statecli.checkpoint(entity, checkpoint_name)
        
        return {
            "checkpoint_created": True,
            "checkpoint_id": checkpoint.id,
            "checkpoint_name": checkpoint_name,
            "entity": entity,
            "operation": operation_name,
            "message": f"Checkpoint created. Proceed with {operation_name}. Call undo() if it fails."
        }
    
    def get_error_history(self) -> List[ErrorContext]:
        """Get history of analyzed errors."""
        return list(self._error_history)
    
    def clear_error_history(self):
        """Clear error history."""
        self._error_history = []
    
    def _generate_suggestions(
        self,
        error_context: ErrorContext,
        recent_changes: List[Dict[str, Any]]
    ) -> List[RecoverySuggestion]:
        """Generate recovery suggestions based on error and recent changes."""
        suggestions = []
        
        # Suggest undo if there are recent changes
        if recent_changes:
            most_recent = recent_changes[-1]
            entity = most_recent.get("entity", "unknown")
            
            suggestions.append(RecoverySuggestion(
                action="undo",
                entity=entity,
                steps=1,
                reason="Undo the most recent change that may have caused the error",
                confidence="medium"
            ))
            
            if len(recent_changes) >= 3:
                suggestions.append(RecoverySuggestion(
                    action="undo",
                    entity=entity,
                    steps=3,
                    reason="Undo the last 3 changes to restore to a known good state",
                    confidence="low"
                ))
        
        # Suggest replay for each affected entity
        for entity in error_context.affected_entities:
            suggestions.append(RecoverySuggestion(
                action="replay_analyze",
                entity=entity,
                reason=f"Analyze changes to {entity} to understand what went wrong",
                confidence="high"
            ))
        
        return suggestions
    
    def _create_summary(
        self,
        error_context: ErrorContext,
        recent_changes: List[Dict[str, Any]],
        suggestions: List[RecoverySuggestion]
    ) -> str:
        """Create a summary of the error analysis."""
        lines = [
            "Error Analysis Summary",
            "======================",
            f"Error: {error_context.error_type} - {error_context.error_message}",
            f"Time: {error_context.timestamp}",
            f"Affected entities: {', '.join(error_context.affected_entities) or 'Unknown'}",
            "",
            f"Recent changes: {len(recent_changes)}",
            f"Recovery suggestions: {len(suggestions)}"
        ]
        
        high_confidence = [s for s in suggestions if s.confidence == "high"]
        if high_confidence:
            lines.extend([
                "",
                f"Recommended action: {high_confidence[0].action} on {high_confidence[0].entity}",
                f"Reason: {high_confidence[0].reason}"
            ])
        
        return "\n".join(lines)
