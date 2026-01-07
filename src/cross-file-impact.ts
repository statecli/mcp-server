/**
 * Cross-File Impact - Predict which files will be affected by a change
 * 
 * Analyzes code to predict ripple effects of changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StateCLI } from './statecli';
import { DependencyTracker } from './dependency-tracker';

export interface SymbolReference {
  symbol: string;
  file: string;
  line: number;
  type: 'definition' | 'usage' | 'import' | 'export';
}

export interface ChangeProposal {
  file: string;
  symbol?: string;
  changeType: 'modify' | 'rename' | 'delete' | 'move';
  newValue?: string;
}

export interface ImpactPrediction {
  proposal: ChangeProposal;
  affectedFiles: AffectedFile[];
  totalFilesAffected: number;
  riskScore: number;  // 0-100
  breakingChanges: BreakingChange[];
  suggestions: string[];
}

export interface AffectedFile {
  path: string;
  reason: string;
  references: SymbolReference[];
  changeRequired: boolean;
  suggestedFix?: string;
}

export interface BreakingChange {
  file: string;
  line: number;
  description: string;
  severity: 'error' | 'warning';
}

export class CrossFileImpact {
  private statecli: StateCLI;
  private dependencyTracker: DependencyTracker;
  private projectPath: string;
  private symbolIndex: Map<string, SymbolReference[]> = new Map();

  constructor(statecli: StateCLI, projectPath: string = '.') {
    this.statecli = statecli;
    this.projectPath = path.resolve(projectPath);
    this.dependencyTracker = new DependencyTracker(statecli, projectPath);
  }

  /**
   * Build symbol index for the project
   */
  buildIndex(): void {
    this.symbolIndex.clear();
    this.dependencyTracker.buildGraph();
    this.scanForSymbols(this.projectPath);
    
    this.statecli.track('cross-file', 'index-built', {
      symbolCount: this.symbolIndex.size,
      timestamp: new Date().toISOString()
    }, 'cross-file-impact');
  }

  /**
   * Predict impact of a proposed change
   */
  predictImpact(proposal: ChangeProposal): ImpactPrediction {
    const affectedFiles: AffectedFile[] = [];
    const breakingChanges: BreakingChange[] = [];
    const suggestions: string[] = [];

    // Get dependency impact
    const depImpact = this.dependencyTracker.analyzeImpact(proposal.file);
    
    // Add direct dependents
    for (const dep of depImpact.directDependents) {
      affectedFiles.push({
        path: dep,
        reason: 'Directly imports the changed file',
        references: [],
        changeRequired: proposal.changeType === 'delete' || proposal.changeType === 'move'
      });
    }

    // Add transitive dependents for high-risk changes
    if (proposal.changeType === 'delete' || proposal.changeType === 'rename') {
      for (const dep of depImpact.transitiveDependents) {
        if (!affectedFiles.find(f => f.path === dep)) {
          affectedFiles.push({
            path: dep,
            reason: 'Transitively depends on the changed file',
            references: [],
            changeRequired: false
          });
        }
      }
    }

    // If changing a specific symbol, find all usages
    if (proposal.symbol) {
      const references = this.findSymbolReferences(proposal.symbol);
      
      for (const ref of references) {
        if (ref.file !== proposal.file) {
          let existing = affectedFiles.find(f => f.path === ref.file);
          if (!existing) {
            existing = {
              path: ref.file,
              reason: `Uses symbol "${proposal.symbol}"`,
              references: [],
              changeRequired: proposal.changeType !== 'modify'
            };
            affectedFiles.push(existing);
          }
          existing.references.push(ref);

          // Add breaking change if deleting or renaming
          if (proposal.changeType === 'delete' || proposal.changeType === 'rename') {
            breakingChanges.push({
              file: ref.file,
              line: ref.line,
              description: `Reference to "${proposal.symbol}" will break`,
              severity: 'error'
            });
          }
        }
      }
    }

    // Generate suggestions
    if (proposal.changeType === 'rename' && proposal.newValue) {
      suggestions.push(`Use find-and-replace to rename "${proposal.symbol}" to "${proposal.newValue}" across ${affectedFiles.length} files`);
    }
    if (proposal.changeType === 'delete') {
      suggestions.push(`Remove or replace all ${breakingChanges.length} references before deleting`);
    }
    if (affectedFiles.length > 10) {
      suggestions.push('Consider creating a checkpoint before making this change');
    }
    if (breakingChanges.length === 0 && affectedFiles.length > 0) {
      suggestions.push('No breaking changes detected, but review affected files after change');
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(proposal, affectedFiles, breakingChanges);

    // Track prediction
    this.statecli.track('cross-file', 'impact-prediction', {
      file: proposal.file,
      changeType: proposal.changeType,
      symbol: proposal.symbol,
      affectedCount: affectedFiles.length,
      breakingCount: breakingChanges.length,
      riskScore
    }, 'cross-file-impact');

    return {
      proposal,
      affectedFiles,
      totalFilesAffected: affectedFiles.length,
      riskScore,
      breakingChanges,
      suggestions
    };
  }

  /**
   * Find all references to a symbol
   */
  findSymbolReferences(symbol: string): SymbolReference[] {
    return this.symbolIndex.get(symbol) || [];
  }

  /**
   * Analyze what would break if a file is deleted
   */
  analyzeFileDeletion(filePath: string): ImpactPrediction {
    return this.predictImpact({
      file: filePath,
      changeType: 'delete'
    });
  }

  /**
   * Analyze what would break if a symbol is renamed
   */
  analyzeRename(filePath: string, oldName: string, newName: string): ImpactPrediction {
    return this.predictImpact({
      file: filePath,
      symbol: oldName,
      changeType: 'rename',
      newValue: newName
    });
  }

  /**
   * Get a safe change order for multiple files
   */
  getSafeChangeOrder(files: string[]): {
    order: string[];
    reason: string;
  } {
    // Sort by dependency order - change leaf nodes first
    const scored = files.map(file => {
      const impact = this.dependencyTracker.analyzeImpact(file);
      return {
        file,
        score: impact.transitiveDependents.length
      };
    });

    const order = scored
      .sort((a, b) => a.score - b.score)
      .map(s => s.file);

    return {
      order,
      reason: 'Files sorted by dependency impact - change files with fewer dependents first'
    };
  }

  /**
   * Check if a change is safe to make
   */
  isChangeSafe(proposal: ChangeProposal): {
    safe: boolean;
    reasons: string[];
  } {
    const prediction = this.predictImpact(proposal);
    const reasons: string[] = [];

    if (prediction.breakingChanges.length > 0) {
      reasons.push(`${prediction.breakingChanges.length} breaking changes detected`);
    }
    if (prediction.riskScore > 70) {
      reasons.push(`High risk score: ${prediction.riskScore}`);
    }
    if (prediction.totalFilesAffected > 20) {
      reasons.push(`Too many files affected: ${prediction.totalFilesAffected}`);
    }

    return {
      safe: reasons.length === 0,
      reasons
    };
  }

  private scanForSymbols(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
            this.scanForSymbols(fullPath);
          }
        } else if (entry.isFile() && this.isSourceFile(entry.name)) {
          this.extractSymbols(fullPath);
        }
      }
    } catch (error) {
      // Directory might not be readable
    }
  }

  private extractSymbols(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(this.projectPath, filePath).replace(/\\/g, '/');

      // Patterns for symbol extraction
      const patterns = [
        // Function/class definitions
        { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, type: 'definition' as const },
        { regex: /(?:export\s+)?class\s+(\w+)/g, type: 'definition' as const },
        { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)/g, type: 'definition' as const },
        { regex: /(?:export\s+)?interface\s+(\w+)/g, type: 'definition' as const },
        { regex: /(?:export\s+)?type\s+(\w+)/g, type: 'definition' as const },
        // Python definitions
        { regex: /^def\s+(\w+)/gm, type: 'definition' as const },
        { regex: /^class\s+(\w+)/gm, type: 'definition' as const },
        // Imports
        { regex: /import\s+\{([^}]+)\}/g, type: 'import' as const },
        { regex: /import\s+(\w+)\s+from/g, type: 'import' as const },
      ];

      for (const { regex, type } of patterns) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const symbols = match[1].split(',').map(s => s.trim());
          const lineNumber = content.substring(0, match.index).split('\n').length;
          
          for (const symbol of symbols) {
            if (symbol && symbol.length > 1) {
              const ref: SymbolReference = {
                symbol,
                file: relativePath,
                line: lineNumber,
                type
              };

              if (!this.symbolIndex.has(symbol)) {
                this.symbolIndex.set(symbol, []);
              }
              this.symbolIndex.get(symbol)!.push(ref);
            }
          }
        }
      }

      // Find usages (identifiers that aren't definitions)
      const identifierRegex = /\b([A-Z][a-zA-Z0-9]*)\b/g;
      let match;
      while ((match = identifierRegex.exec(content)) !== null) {
        const symbol = match[1];
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        // Check if this is already tracked as a definition in this file
        const existing = this.symbolIndex.get(symbol);
        const isDefinitionHere = existing?.some(r => 
          r.file === relativePath && r.type === 'definition' && r.line === lineNumber
        );

        if (!isDefinitionHere && existing) {
          existing.push({
            symbol,
            file: relativePath,
            line: lineNumber,
            type: 'usage'
          });
        }
      }
    } catch (error) {
      // File might not be readable
    }
  }

  private isSourceFile(filename: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  private calculateRiskScore(
    proposal: ChangeProposal,
    affectedFiles: AffectedFile[],
    breakingChanges: BreakingChange[]
  ): number {
    let score = 0;

    // Base score by change type
    switch (proposal.changeType) {
      case 'modify': score += 10; break;
      case 'rename': score += 30; break;
      case 'move': score += 40; break;
      case 'delete': score += 50; break;
    }

    // Add for affected files
    score += Math.min(affectedFiles.length * 3, 30);

    // Add for breaking changes
    score += Math.min(breakingChanges.length * 5, 20);

    // Cap at 100
    return Math.min(score, 100);
  }
}
