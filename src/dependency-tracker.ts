/**
 * Dependency Tracker - Understand code dependencies
 * 
 * Analyzes imports/exports to understand what code depends on what.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StateCLI } from './statecli';

export interface Dependency {
  source: string;
  target: string;
  type: 'import' | 'require' | 'export' | 'extends' | 'implements';
  line?: number;
}

export interface FileNode {
  path: string;
  imports: string[];
  exports: string[];
  dependsOn: string[];
  dependedBy: string[];
}

export interface DependencyGraph {
  files: Map<string, FileNode>;
  edges: Dependency[];
}

export interface ImpactAnalysis {
  changedFile: string;
  directDependents: string[];
  transitiveDependents: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export class DependencyTracker {
  private statecli: StateCLI;
  private projectPath: string;
  private graph: DependencyGraph;
  private fileExtensions: string[];

  constructor(
    statecli: StateCLI,
    projectPath: string = '.',
    options?: {
      extensions?: string[];
    }
  ) {
    this.statecli = statecli;
    this.projectPath = path.resolve(projectPath);
    this.fileExtensions = options?.extensions || ['.ts', '.tsx', '.js', '.jsx', '.py', '.java'];
    this.graph = { files: new Map(), edges: [] };
  }

  /**
   * Build dependency graph for the project
   */
  buildGraph(rootDir?: string): DependencyGraph {
    const startDir = rootDir || this.projectPath;
    this.graph = { files: new Map(), edges: [] };
    
    this.scanDirectory(startDir);
    this.buildReverseLinks();
    
    // Track graph build in StateCLI
    this.statecli.track('dependency', 'graph', {
      fileCount: this.graph.files.size,
      edgeCount: this.graph.edges.length,
      timestamp: new Date().toISOString()
    }, 'dependency-tracker');

    return this.graph;
  }

  /**
   * Analyze impact of changing a file
   */
  analyzeImpact(filePath: string): ImpactAnalysis {
    const normalizedPath = this.normalizePath(filePath);
    const node = this.graph.files.get(normalizedPath);
    
    if (!node) {
      // File not in graph, try to rebuild
      this.buildGraph();
    }

    const directDependents = this.getDirectDependents(normalizedPath);
    const transitiveDependents = this.getTransitiveDependents(normalizedPath);
    
    // Calculate risk level
    const totalImpact = transitiveDependents.length;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let recommendation: string;

    if (totalImpact === 0) {
      riskLevel = 'low';
      recommendation = 'No other files depend on this. Safe to modify.';
    } else if (totalImpact <= 3) {
      riskLevel = 'low';
      recommendation = `${totalImpact} files may be affected. Review changes carefully.`;
    } else if (totalImpact <= 10) {
      riskLevel = 'medium';
      recommendation = `${totalImpact} files may be affected. Consider creating a checkpoint first.`;
    } else if (totalImpact <= 25) {
      riskLevel = 'high';
      recommendation = `${totalImpact} files may be affected. Test thoroughly before committing.`;
    } else {
      riskLevel = 'critical';
      recommendation = `${totalImpact} files may be affected. This is a core file - proceed with extreme caution.`;
    }

    // Track analysis
    this.statecli.track('dependency', 'impact-analysis', {
      file: normalizedPath,
      directCount: directDependents.length,
      transitiveCount: transitiveDependents.length,
      riskLevel
    }, 'dependency-tracker');

    return {
      changedFile: normalizedPath,
      directDependents,
      transitiveDependents,
      riskLevel,
      recommendation
    };
  }

  /**
   * Get what a file depends on
   */
  getDependencies(filePath: string): string[] {
    const normalizedPath = this.normalizePath(filePath);
    const node = this.graph.files.get(normalizedPath);
    return node?.dependsOn || [];
  }

  /**
   * Get what depends on a file
   */
  getDependents(filePath: string): string[] {
    const normalizedPath = this.normalizePath(filePath);
    const node = this.graph.files.get(normalizedPath);
    return node?.dependedBy || [];
  }

  /**
   * Find circular dependencies
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (file: string, path: string[]): void => {
      visited.add(file);
      recursionStack.add(file);
      path.push(file);

      const node = this.graph.files.get(file);
      if (node) {
        for (const dep of node.dependsOn) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found cycle
            const cycleStart = path.indexOf(dep);
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      recursionStack.delete(file);
    };

    for (const file of this.graph.files.keys()) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }

    return cycles;
  }

  /**
   * Get dependency tree as a string for display
   */
  getDependencyTree(filePath: string, maxDepth: number = 3): string {
    const normalizedPath = this.normalizePath(filePath);
    const lines: string[] = [normalizedPath];
    
    const buildTree = (file: string, depth: number, prefix: string): void => {
      if (depth >= maxDepth) return;
      
      const node = this.graph.files.get(file);
      if (!node) return;

      const deps = node.dependsOn;
      for (let i = 0; i < deps.length; i++) {
        const isLast = i === deps.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = isLast ? '    ' : '│   ';
        
        lines.push(`${prefix}${connector}${path.basename(deps[i])}`);
        buildTree(deps[i], depth + 1, prefix + newPrefix);
      }
    };

    buildTree(normalizedPath, 0, '');
    return lines.join('\n');
  }

  /**
   * Get most depended-upon files (core files)
   */
  getCoreFiles(limit: number = 10): Array<{ file: string; dependentCount: number }> {
    const counts: Array<{ file: string; dependentCount: number }> = [];
    
    for (const [file, node] of this.graph.files) {
      counts.push({
        file,
        dependentCount: node.dependedBy.length
      });
    }

    return counts
      .sort((a, b) => b.dependentCount - a.dependentCount)
      .slice(0, limit);
  }

  private scanDirectory(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', '.git', 'dist', 'build', '__pycache__', '.next'].includes(entry.name)) {
            this.scanDirectory(fullPath);
          }
        } else if (entry.isFile() && this.fileExtensions.some(ext => entry.name.endsWith(ext))) {
          this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      // Directory might not be readable
    }
  }

  private analyzeFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const normalizedPath = this.normalizePath(filePath);
      const imports: string[] = [];
      const exports: string[] = [];

      // Parse imports/requires
      const importPatterns = [
        /import\s+.*?\s+from\s+['"](.+?)['"]/g,
        /import\s+['"](.+?)['"]/g,
        /require\s*\(\s*['"](.+?)['"]\s*\)/g,
        /from\s+(\S+)\s+import/g  // Python
      ];

      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = this.resolveImportPath(normalizedPath, match[1]);
          if (importPath) {
            imports.push(importPath);
            this.graph.edges.push({
              source: normalizedPath,
              target: importPath,
              type: 'import'
            });
          }
        }
      }

      // Parse exports
      const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        exports.push(match[1]);
      }

      this.graph.files.set(normalizedPath, {
        path: normalizedPath,
        imports,
        exports,
        dependsOn: imports,
        dependedBy: [] // Will be filled by buildReverseLinks
      });
    } catch (error) {
      // File might not be readable
    }
  }

  private buildReverseLinks(): void {
    for (const [file, node] of this.graph.files) {
      for (const dep of node.dependsOn) {
        const depNode = this.graph.files.get(dep);
        if (depNode && !depNode.dependedBy.includes(file)) {
          depNode.dependedBy.push(file);
        }
      }
    }
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      let resolved = path.resolve(dir, importPath);
      
      // Try adding extensions
      for (const ext of this.fileExtensions) {
        if (fs.existsSync(resolved + ext)) {
          return this.normalizePath(resolved + ext);
        }
        // Try index file
        const indexPath = path.join(resolved, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return this.normalizePath(indexPath);
        }
      }
      
      // Check if it exists as-is
      if (fs.existsSync(resolved)) {
        return this.normalizePath(resolved);
      }
    }
    
    // Non-relative imports (node_modules, etc.) - skip
    return null;
  }

  private normalizePath(filePath: string): string {
    return path.relative(this.projectPath, filePath).replace(/\\/g, '/');
  }

  private getDirectDependents(filePath: string): string[] {
    const node = this.graph.files.get(filePath);
    return node?.dependedBy || [];
  }

  private getTransitiveDependents(filePath: string, visited: Set<string> = new Set()): string[] {
    if (visited.has(filePath)) return [];
    visited.add(filePath);

    const direct = this.getDirectDependents(filePath);
    const transitive: string[] = [...direct];

    for (const dep of direct) {
      const nested = this.getTransitiveDependents(dep, visited);
      for (const n of nested) {
        if (!transitive.includes(n)) {
          transitive.push(n);
        }
      }
    }

    return transitive;
  }
}
