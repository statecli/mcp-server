import { StateStorage } from './storage';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

describe('StateStorage', () => {
  let storage: StateStorage;
  let testDbPath: string;
  let testDir: string;

  beforeEach(() => {
    const uniqueId = uuidv4().slice(0, 8);
    testDir = `.statecli-test-storage-${uniqueId}`;
    testDbPath = `${testDir}/state.db`;
    
    storage = new StateStorage({
      storage: { type: 'local', path: testDbPath }
    });
  });

  afterEach(() => {
    try {
      storage.close();
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
    it('should track a new state change', () => {
      const result = storage.track('order', '123', { status: 'pending' });
      
      expect(result.entity).toBe('order:123');
      expect(result.entityType).toBe('order');
      expect(result.entityId).toBe('123');
      expect(result.after).toEqual({ status: 'pending' });
      expect(result.before).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should track before state from previous change', () => {
      storage.track('order', '123', { status: 'pending' });
      const result = storage.track('order', '123', { status: 'paid' });
      
      expect(result.before).toEqual({ status: 'pending' });
      expect(result.after).toEqual({ status: 'paid' });
    });

    it('should include actor in tracked change', () => {
      const result = storage.track('order', '123', { status: 'pending' }, 'ai-agent');
      
      expect(result.actor).toBe('ai-agent');
    });
  });

  describe('getChanges', () => {
    beforeEach(() => {
      storage.track('order', '123', { status: 'pending' }, 'agent-a');
      storage.track('order', '123', { status: 'paid' }, 'agent-b');
      storage.track('order', '123', { status: 'shipped' }, 'agent-a');
    });

    it('should return all changes for an entity', () => {
      const changes = storage.getChanges('order:123');
      
      expect(changes).toHaveLength(3);
      expect(changes[0].after).toEqual({ status: 'pending' });
      expect(changes[1].after).toEqual({ status: 'paid' });
      expect(changes[2].after).toEqual({ status: 'shipped' });
    });

    it('should filter by actor', () => {
      const changes = storage.getChanges('order:123', { actor: 'agent-a' });
      
      expect(changes).toHaveLength(2);
      expect(changes[0].actor).toBe('agent-a');
      expect(changes[1].actor).toBe('agent-a');
    });

    it('should limit results', () => {
      const changes = storage.getChanges('order:123', { limit: 2 });
      
      expect(changes).toHaveLength(2);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      storage.track('order', '123', { status: 'pending' });
      storage.track('order', '123', { status: 'paid' });
      storage.track('order', '123', { status: 'shipped' });
    });

    it('should undo the last change', () => {
      const { undone, restoredState } = storage.undo('order:123', 1);
      
      expect(undone).toHaveLength(1);
      expect(undone[0].after).toEqual({ status: 'shipped' });
      expect(restoredState).toEqual({ status: 'paid' });
    });

    it('should undo multiple changes', () => {
      const { undone, restoredState } = storage.undo('order:123', 2);
      
      expect(undone).toHaveLength(2);
      expect(restoredState).toEqual({ status: 'pending' });
    });

    it('should handle undoing all changes', () => {
      const { undone, restoredState } = storage.undo('order:123', 10);
      
      expect(undone).toHaveLength(3);
      expect(restoredState).toBeNull();
    });
  });

  describe('checkpoints', () => {
    beforeEach(() => {
      storage.track('order', '123', { status: 'pending' });
      storage.track('order', '123', { status: 'paid' });
    });

    it('should create a checkpoint', () => {
      const checkpoint = storage.createCheckpoint('order:123', 'before-shipping');
      
      expect(checkpoint.entity).toBe('order:123');
      expect(checkpoint.name).toBe('before-shipping');
      expect(checkpoint.state).toEqual({ status: 'paid' });
    });

    it('should get a checkpoint', () => {
      storage.createCheckpoint('order:123', 'before-shipping');
      const checkpoint = storage.getCheckpoint('order:123', 'before-shipping');
      
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.name).toBe('before-shipping');
    });

    it('should restore to a checkpoint', () => {
      storage.createCheckpoint('order:123', 'before-shipping');
      storage.track('order', '123', { status: 'shipped' });
      storage.track('order', '123', { status: 'delivered' });
      
      const { restored, checkpoint } = storage.restoreCheckpoint('order:123', 'before-shipping');
      
      expect(restored).toBe(true);
      expect(checkpoint?.state).toEqual({ status: 'paid' });
      
      const changes = storage.getChanges('order:123');
      expect(changes).toHaveLength(2);
    });
  });

  describe('getCurrentState', () => {
    it('should return null for unknown entity', () => {
      const state = storage.getCurrentState('unknown:123');
      expect(state).toBeNull();
    });

    it('should return current state', () => {
      storage.track('order', '123', { status: 'pending' });
      storage.track('order', '123', { status: 'paid' });
      
      const state = storage.getCurrentState('order:123');
      expect(state).toEqual({ status: 'paid' });
    });
  });

  describe('listEntities', () => {
    it('should list all tracked entities', () => {
      storage.track('order', '123', { status: 'pending' });
      storage.track('user', '456', { name: 'John' });
      storage.track('task', '789', { done: false });
      
      const entities = storage.listEntities();
      
      expect(entities).toContain('order:123');
      expect(entities).toContain('user:456');
      expect(entities).toContain('task:789');
    });
  });

  describe('getChangesByPattern', () => {
    beforeEach(() => {
      storage.track('order', '123', { status: 'pending' });
      storage.track('order', '456', { status: 'paid' });
      storage.track('user', '789', { name: 'John' });
    });

    it('should match entities by pattern', () => {
      const changes = storage.getChangesByPattern('order:*');
      
      expect(changes).toHaveLength(2);
    });
  });
});
