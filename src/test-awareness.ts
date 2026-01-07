/**
 * Test Awareness - Track test pass/fail after edits
 * 
 * Monitors test results and correlates them with code changes.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { StateCLI } from './statecli';

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  file?: string;
}

export interface TestRunSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  relatedChanges: string[];
}

export interface TestImpact {
  changedFile: string;
  affectedTests: string[];
  previousStatus: 'passed' | 'failed' | 'unknown';
  currentStatus: 'passed' | 'failed' | 'unknown';
  recommendation: string;
}

export class TestAwareness {
  private statecli: StateCLI;
  private projectPath: string;
  private testHistory: TestRunSummary[] = [];
  private testCommand: string;
  private testFramework: 'jest' | 'mocha' | 'pytest' | 'vitest' | 'custom';

  constructor(
    statecli: StateCLI, 
    projectPath: string = '.',
    options?: {
      testCommand?: string;
      testFramework?: 'jest' | 'mocha' | 'pytest' | 'vitest' | 'custom';
    }
  ) {
    this.statecli = statecli;
    this.projectPath = path.resolve(projectPath);
    this.testFramework = options?.testFramework || this.detectTestFramework();
    this.testCommand = options?.testCommand || this.getDefaultTestCommand();
  }

  /**
   * Run tests and track results
   */
  runTests(options?: { 
    files?: string[]; 
    grep?: string;
    trackChanges?: boolean;
  }): TestRunSummary {
    const startTime = Date.now();
    let results: TestResult[] = [];
    
    try {
      const output = this.executeTests(options?.files, options?.grep);
      results = this.parseTestOutput(output);
    } catch (error: any) {
      // Tests might fail but still produce output
      results = this.parseTestOutput(error.stdout || error.message);
    }

    const summary: TestRunSummary = {
      timestamp: new Date().toISOString(),
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration: Date.now() - startTime,
      results,
      relatedChanges: options?.trackChanges ? this.getRecentChanges() : []
    };

    this.testHistory.push(summary);

    // Track in StateCLI
    this.statecli.track('test', 'run', {
      ...summary,
      results: results.slice(0, 20) // Limit stored results
    }, 'test-awareness');

    return summary;
  }

  /**
   * Get test impact for a changed file
   */
  analyzeTestImpact(changedFile: string): TestImpact {
    const normalizedPath = path.normalize(changedFile);
    const affectedTests = this.findAffectedTests(normalizedPath);
    
    // Get previous test status
    const lastRun = this.testHistory[this.testHistory.length - 1];
    let previousStatus: 'passed' | 'failed' | 'unknown' = 'unknown';
    
    if (lastRun) {
      const relevantTests = lastRun.results.filter(r => 
        affectedTests.includes(r.testName) || r.file === normalizedPath
      );
      if (relevantTests.length > 0) {
        previousStatus = relevantTests.every(t => t.status === 'passed') ? 'passed' : 'failed';
      }
    }

    // Generate recommendation
    let recommendation = '';
    if (affectedTests.length === 0) {
      recommendation = 'No tests found for this file. Consider adding test coverage.';
    } else if (previousStatus === 'failed') {
      recommendation = `${affectedTests.length} tests were already failing. Fix existing issues first.`;
    } else {
      recommendation = `Run ${affectedTests.length} affected tests to verify your changes.`;
    }

    return {
      changedFile: normalizedPath,
      affectedTests,
      previousStatus,
      currentStatus: 'unknown',
      recommendation
    };
  }

  /**
   * Run tests for specific changed files and compare results
   */
  async testAfterChange(changedFiles: string[]): Promise<{
    impacts: TestImpact[];
    summary: TestRunSummary;
    regressions: TestResult[];
  }> {
    // Analyze impact for each file
    const impacts = changedFiles.map(f => this.analyzeTestImpact(f));
    
    // Collect all affected tests
    const allAffectedTests = [...new Set(impacts.flatMap(i => i.affectedTests))];
    
    // Run affected tests
    const summary = this.runTests({ 
      files: allAffectedTests.length > 0 ? allAffectedTests : undefined,
      trackChanges: true 
    });

    // Find regressions (tests that were passing but now fail)
    const regressions = this.findRegressions(summary);

    // Update impact status
    for (const impact of impacts) {
      const relevantResults = summary.results.filter(r => 
        impact.affectedTests.includes(r.testName)
      );
      if (relevantResults.length > 0) {
        impact.currentStatus = relevantResults.every(t => t.status === 'passed') ? 'passed' : 'failed';
      }
    }

    return { impacts, summary, regressions };
  }

  /**
   * Get test history
   */
  getTestHistory(limit: number = 10): TestRunSummary[] {
    return this.testHistory.slice(-limit);
  }

  /**
   * Get failing tests
   */
  getFailingTests(): TestResult[] {
    const lastRun = this.testHistory[this.testHistory.length - 1];
    if (!lastRun) return [];
    return lastRun.results.filter(r => r.status === 'failed');
  }

  /**
   * Suggest which tests to run based on recent changes
   */
  suggestTests(): {
    suggested: string[];
    reason: string;
    coverage: 'full' | 'partial' | 'none';
  } {
    const recentChanges = this.getRecentChanges();
    const suggested: string[] = [];
    
    for (const change of recentChanges) {
      const affected = this.findAffectedTests(change);
      suggested.push(...affected);
    }

    const unique = [...new Set(suggested)];
    
    let coverage: 'full' | 'partial' | 'none' = 'none';
    let reason = '';
    
    if (unique.length === 0) {
      reason = 'No tests found for recent changes. Consider running full test suite.';
    } else if (unique.length < 5) {
      coverage = 'partial';
      reason = `Found ${unique.length} tests related to your changes.`;
    } else {
      coverage = 'full';
      reason = `Found ${unique.length} tests. Consider running full suite.`;
    }

    return { suggested: unique, reason, coverage };
  }

  private detectTestFramework(): 'jest' | 'mocha' | 'pytest' | 'vitest' | 'custom' {
    try {
      const pkg = require(path.join(this.projectPath, 'package.json'));
      if (pkg.devDependencies?.jest || pkg.dependencies?.jest) return 'jest';
      if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) return 'vitest';
      if (pkg.devDependencies?.mocha || pkg.dependencies?.mocha) return 'mocha';
    } catch {}
    
    // Check for Python
    try {
      execSync('python -c "import pytest"', { cwd: this.projectPath, stdio: 'pipe' });
      return 'pytest';
    } catch {}
    
    return 'custom';
  }

  private getDefaultTestCommand(): string {
    switch (this.testFramework) {
      case 'jest': return 'npx jest --json';
      case 'vitest': return 'npx vitest run --reporter=json';
      case 'mocha': return 'npx mocha --reporter json';
      case 'pytest': return 'python -m pytest --tb=short -q';
      default: return 'npm test';
    }
  }

  private executeTests(files?: string[], grep?: string): string {
    let command = this.testCommand;
    
    if (files && files.length > 0) {
      command += ` ${files.join(' ')}`;
    }
    if (grep) {
      command += ` --grep "${grep}"`;
    }

    try {
      return execSync(command, {
        cwd: this.projectPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error: any) {
      return error.stdout || error.stderr || '';
    }
  }

  private parseTestOutput(output: string): TestResult[] {
    const results: TestResult[] = [];
    
    // Try to parse JSON output
    try {
      const json = JSON.parse(output);
      if (json.testResults) {
        // Jest format
        for (const suite of json.testResults) {
          for (const test of suite.assertionResults || []) {
            results.push({
              testName: test.fullName || test.title,
              status: test.status === 'passed' ? 'passed' : 
                     test.status === 'pending' ? 'skipped' : 'failed',
              duration: test.duration || 0,
              errorMessage: test.failureMessages?.join('\n'),
              file: suite.name
            });
          }
        }
        return results;
      }
    } catch {}

    // Fallback: parse text output
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('✓') || line.includes('PASS')) {
        const match = line.match(/[✓√]\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
        if (match) {
          results.push({
            testName: match[1].trim(),
            status: 'passed',
            duration: parseInt(match[2] || '0')
          });
        }
      } else if (line.includes('✗') || line.includes('FAIL') || line.includes('×')) {
        const match = line.match(/[✗×]\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
        if (match) {
          results.push({
            testName: match[1].trim(),
            status: 'failed',
            duration: parseInt(match[2] || '0')
          });
        }
      }
    }

    return results;
  }

  private findAffectedTests(filePath: string): string[] {
    const affected: string[] = [];
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // Common patterns for test files
    const testPatterns = [
      `${baseName}.test`,
      `${baseName}.spec`,
      `${baseName}_test`,
      `test_${baseName}`,
      `${baseName}Test`
    ];

    // Check test history for tests that include the file
    for (const run of this.testHistory) {
      for (const result of run.results) {
        if (result.file?.includes(baseName) || 
            testPatterns.some(p => result.testName.toLowerCase().includes(p.toLowerCase()))) {
          affected.push(result.testName);
        }
      }
    }

    return [...new Set(affected)];
  }

  private findRegressions(currentRun: TestRunSummary): TestResult[] {
    if (this.testHistory.length < 2) return [];
    
    const previousRun = this.testHistory[this.testHistory.length - 2];
    const regressions: TestResult[] = [];

    for (const current of currentRun.results) {
      if (current.status === 'failed') {
        const previous = previousRun.results.find(p => p.testName === current.testName);
        if (previous && previous.status === 'passed') {
          regressions.push(current);
        }
      }
    }

    return regressions;
  }

  private getRecentChanges(): string[] {
    const replay = this.statecli.replay('file:*');
    return replay.changes
      .slice(-10)
      .map(c => c.after?.['filePath'] as string || '')
      .filter(Boolean);
  }
}
