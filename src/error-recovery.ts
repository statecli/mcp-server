/**
 * Error Recovery - Integration with error detection
 * 
 * Automatically detects errors and suggests rollback actions
 */

import { StateCLI } from './statecli';
import { ReplayResult, ReplayChange } from './types';

export interface ErrorContext {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  affectedEntities: string[];
  timestamp: string;
}

export interface RecoverySuggestion {
  action: 'undo' | 'restore_checkpoint' | 'replay_analyze' | 'manual';
  entity: string;
  steps?: number;
  checkpointName?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  error: ErrorContext;
  recentChanges: ReplayChange[];
  suggestions: RecoverySuggestion[];
  summary: string;
}

export class ErrorRecovery {
  private statecli: StateCLI;
  private errorHistory: ErrorContext[] = [];

  constructor(statecli: StateCLI) {
    this.statecli = statecli;
  }

  /**
   * Analyze an error and suggest recovery actions
   */
  analyzeError(
    error: Error | string,
    affectedEntities: string[] = []
  ): AnalysisResult {
    const errorContext = this.createErrorContext(error, affectedEntities);
    this.errorHistory.push(errorContext);

    // Get recent changes for affected entities
    const recentChanges: ReplayChange[] = [];
    for (const entity of affectedEntities) {
      const replay = this.statecli.replay(entity);
      recentChanges.push(...replay.changes.slice(-5)); // Last 5 changes per entity
    }

    // Generate recovery suggestions
    const suggestions = this.generateSuggestions(errorContext, recentChanges);

    // Create summary
    const summary = this.createSummary(errorContext, recentChanges, suggestions);

    return {
      error: errorContext,
      recentChanges,
      suggestions,
      summary
    };
  }

  /**
   * Auto-recover from an error using the best suggestion
   */
  autoRecover(analysis: AnalysisResult): { success: boolean; action: string; result: any } {
    const bestSuggestion = analysis.suggestions.find(s => s.confidence === 'high');
    
    if (!bestSuggestion) {
      return {
        success: false,
        action: 'none',
        result: 'No high-confidence recovery suggestion available'
      };
    }

    try {
      switch (bestSuggestion.action) {
        case 'undo':
          const undoResult = this.statecli.undo(
            bestSuggestion.entity,
            bestSuggestion.steps || 1
          );
          return {
            success: true,
            action: 'undo',
            result: undoResult
          };

        case 'restore_checkpoint':
          if (bestSuggestion.checkpointName) {
            const restoreResult = this.statecli.restoreCheckpoint(
              bestSuggestion.entity,
              bestSuggestion.checkpointName
            );
            return {
              success: true,
              action: 'restore_checkpoint',
              result: restoreResult
            };
          }
          break;

        case 'replay_analyze':
          const replay = this.statecli.replay(bestSuggestion.entity);
          return {
            success: true,
            action: 'replay_analyze',
            result: replay
          };
      }
    } catch (recoveryError) {
      return {
        success: false,
        action: bestSuggestion.action,
        result: `Recovery failed: ${recoveryError}`
      };
    }

    return {
      success: false,
      action: 'manual',
      result: 'Manual intervention required'
    };
  }

  /**
   * Create checkpoint before risky operation
   */
  safeExecute<T>(
    entityId: string,
    operation: () => T,
    operationName: string = 'risky-operation'
  ): { success: boolean; result?: T; error?: Error; recovered?: boolean } {
    // Create checkpoint before operation
    const checkpointName = `before-${operationName}-${Date.now()}`;
    this.statecli.checkpoint(entityId, checkpointName);

    try {
      const result = operation();
      return { success: true, result };
    } catch (error) {
      // Analyze and attempt recovery
      const analysis = this.analyzeError(
        error instanceof Error ? error : new Error(String(error)),
        [entityId]
      );

      // Try to restore checkpoint
      try {
        this.statecli.restoreCheckpoint(entityId, checkpointName);
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          recovered: true
        };
      } catch (restoreError) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          recovered: false
        };
      }
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(): ErrorContext[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  private createErrorContext(
    error: Error | string,
    affectedEntities: string[]
  ): ErrorContext {
    const isError = error instanceof Error;
    
    return {
      errorType: isError ? error.name : 'Unknown',
      errorMessage: isError ? error.message : String(error),
      stackTrace: isError ? error.stack : undefined,
      affectedEntities,
      timestamp: new Date().toISOString()
    };
  }

  private generateSuggestions(
    errorContext: ErrorContext,
    recentChanges: ReplayChange[]
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // If there are recent changes, suggest undo
    if (recentChanges.length > 0) {
      const mostRecentEntity = recentChanges[recentChanges.length - 1].entity || 'unknown';
      
      suggestions.push({
        action: 'undo',
        entity: mostRecentEntity,
        steps: 1,
        reason: 'Undo the most recent change that may have caused the error',
        confidence: 'medium'
      });

      // If multiple changes, suggest undoing more
      if (recentChanges.length >= 3) {
        suggestions.push({
          action: 'undo',
          entity: mostRecentEntity || 'unknown',
          steps: 3,
          reason: 'Undo the last 3 changes to restore to a known good state',
          confidence: 'low'
        });
      }
    }

    // For each affected entity, suggest replay for analysis
    for (const entity of errorContext.affectedEntities) {
      suggestions.push({
        action: 'replay_analyze',
        entity,
        reason: `Analyze changes to ${entity} to understand what went wrong`,
        confidence: 'high'
      });
    }

    // Check for checkpoints
    for (const entity of errorContext.affectedEntities) {
      // Note: In a real implementation, we'd query for available checkpoints
      suggestions.push({
        action: 'restore_checkpoint',
        entity,
        checkpointName: 'latest',
        reason: 'Restore to the latest checkpoint for this entity',
        confidence: 'medium'
      });
    }

    return suggestions;
  }

  private createSummary(
    errorContext: ErrorContext,
    recentChanges: ReplayChange[],
    suggestions: RecoverySuggestion[]
  ): string {
    const lines: string[] = [];
    
    lines.push(`Error Analysis Summary`);
    lines.push(`======================`);
    lines.push(`Error: ${errorContext.errorType} - ${errorContext.errorMessage}`);
    lines.push(`Time: ${errorContext.timestamp}`);
    lines.push(`Affected entities: ${errorContext.affectedEntities.join(', ') || 'Unknown'}`);
    lines.push(``);
    lines.push(`Recent changes: ${recentChanges.length}`);
    lines.push(`Recovery suggestions: ${suggestions.length}`);
    
    const highConfidence = suggestions.filter(s => s.confidence === 'high');
    if (highConfidence.length > 0) {
      lines.push(``);
      lines.push(`Recommended action: ${highConfidence[0].action} on ${highConfidence[0].entity}`);
      lines.push(`Reason: ${highConfidence[0].reason}`);
    }

    return lines.join('\n');
  }
}
