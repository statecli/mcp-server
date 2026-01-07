import { StateCLI } from './statecli';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

describe('StateCLI', () => {
  let cli: StateCLI;
  let testDbPath: string;
  let testDir: string;

  beforeEach(() => {
    const uniqueId = uuidv4().slice(0, 8);
    testDir = `.statecli-test-cli-${uniqueId}`;
    testDbPath = `${testDir}/state.db`;
    
    cli = new StateCLI({
      storage: { type: 'local', path: testDbPath }
    });
  });

  afterEach(() => {
    try {
      cli.close();
    } catch (e) { /* ignore */ }
    
    setTimeout(() => {
      try {
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      } catch (e) { /* ignore cleanup errors */ }
    }, 100);
  });

  describe('track', () => {
    it('should track state and return result', () => {
      const result = cli.track('order', '7421', { status: 'pending', amount: 49.99 });
      
      expect(result.entity).toBe('order:7421');
      expect(result.id).toBeDefined();
      expect(result.summary).toContain('State tracked');
    });
  });

  describe('replay', () => {
    it('should replay empty changes', () => {
      const result = cli.replay('order:7421');
      
      expect(result.changes).toHaveLength(0);
      expect(result.summary).toBe('0 state changes found');
      expect(result.suggestedNextActions).toContain('track initial state for this entity');
    });

    it('should replay state changes with steps', () => {
      cli.track('order', '7421', { status: 'pending' });
      cli.track('order', '7421', { status: 'processing' });
      cli.track('order', '7421', { status: 'paid' });
      
      const result = cli.replay('order:7421');
      
      expect(result.changes).toHaveLength(3);
      expect(result.changes[0].step).toBe(1);
      expect(result.changes[1].step).toBe(2);
      expect(result.changes[2].step).toBe(3);
      expect(result.summary).toBe('3 state changes found');
    });

    it('should filter replay by actor', () => {
      cli.track('order', '7421', { status: 'pending' }, 'agent-a');
      cli.track('order', '7421', { status: 'processing' }, 'agent-b');
      cli.track('order', '7421', { status: 'paid' }, 'agent-a');
      
      const result = cli.replay('order:7421', { actor: 'agent-a' });
      
      expect(result.changes).toHaveLength(2);
    });
  });

  describe('undo', () => {
    it('should undo last change', () => {
      cli.track('order', '7421', { status: 'pending' });
      cli.track('order', '7421', { status: 'processing' });
      
      const result = cli.undo('order:7421');
      
      expect(result.stepsUndone).toBe(1);
      expect(result.restoredState).toEqual({ status: 'pending' });
      expect(result.summary).toContain('Undid 1 step');
    });

    it('should undo multiple steps', () => {
      cli.track('order', '7421', { status: 'pending' });
      cli.track('order', '7421', { status: 'processing' });
      cli.track('order', '7421', { status: 'paid' });
      
      const result = cli.undo('order:7421', 2);
      
      expect(result.stepsUndone).toBe(2);
      expect(result.restoredState).toEqual({ status: 'pending' });
    });

    it('should handle undo with no changes', () => {
      const result = cli.undo('order:7421');
      
      expect(result.stepsUndone).toBe(0);
      expect(result.summary).toBe('No changes to undo.');
    });
  });

  describe('checkpoint', () => {
    it('should create a checkpoint', () => {
      cli.track('order', '7421', { status: 'pending' });
      
      const result = cli.checkpoint('order:7421', 'before-payment');
      
      expect(result.entity).toBe('order:7421');
      expect(result.name).toBe('before-payment');
      expect(result.id).toBeDefined();
      expect(result.summary).toContain('Checkpoint "before-payment" created');
    });
  });

  describe('restoreCheckpoint', () => {
    it('should restore to a checkpoint', () => {
      cli.track('order', '7421', { status: 'pending' });
      cli.checkpoint('order:7421', 'initial');
      cli.track('order', '7421', { status: 'processing' });
      cli.track('order', '7421', { status: 'paid' });
      
      const result = cli.restoreCheckpoint('order:7421', 'initial');
      
      expect(result.success).toBe(true);
      expect(result.summary).toContain('Restored to checkpoint "initial"');
    });

    it('should handle missing checkpoint', () => {
      const result = cli.restoreCheckpoint('order:7421', 'nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.summary).toContain('not found');
    });
  });

  describe('log', () => {
    it('should return log of changes', () => {
      cli.track('order', '7421', { status: 'pending' }, 'agent-a');
      cli.track('order', '7421', { status: 'paid' }, 'agent-b');
      
      const result = cli.log('order:7421');
      
      expect(result.changes).toHaveLength(2);
      expect(result.summary).toBe('2 changes in log');
    });

    it('should filter by actor', () => {
      cli.track('order', '7421', { status: 'pending' }, 'agent-a');
      cli.track('order', '7421', { status: 'paid' }, 'agent-b');
      
      const result = cli.log('order:7421', { actor: 'agent-a' });
      
      expect(result.changes).toHaveLength(1);
    });

    it('should support wildcard patterns', () => {
      cli.track('order', '111', { status: 'pending' });
      cli.track('order', '222', { status: 'paid' });
      cli.track('user', '333', { name: 'John' });
      
      const result = cli.log('order:*');
      
      expect(result.changes).toHaveLength(2);
    });
  });

  describe('getCurrentState', () => {
    it('should return current state', () => {
      cli.track('order', '7421', { status: 'pending' });
      cli.track('order', '7421', { status: 'paid' });
      
      const state = cli.getCurrentState('order:7421');
      
      expect(state).toEqual({ status: 'paid' });
    });

    it('should return null for unknown entity', () => {
      const state = cli.getCurrentState('unknown:entity');
      
      expect(state).toBeNull();
    });
  });

  describe('listEntities', () => {
    it('should list all tracked entities', () => {
      cli.track('order', '123', { status: 'pending' });
      cli.track('user', '456', { name: 'John' });
      
      const entities = cli.listEntities();
      
      expect(entities).toContain('order:123');
      expect(entities).toContain('user:456');
    });
  });
});
