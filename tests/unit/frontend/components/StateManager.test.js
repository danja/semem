import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};

vi.stubGlobal('localStorage', localStorageMock);

// Mock performance
vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now())
});

import { StateManager } from '../../../../src/frontend/workbench/js/managers/StateManager.js';

describe('StateManager', () => {
  let stateManager;
  let eventSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    
    stateManager = new StateManager();
    eventSpy = vi.fn();
  });

  afterEach(() => {
    stateManager.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default state structure', () => {
      expect(stateManager.state).toEqual({
        sessionCache: { interactions: [], concepts: [], embeddings: [] },
        zpt: { zoom: 'entity', pan: {}, tilt: 'keywords', query: null },
        performance: { operations: [], sessionStartTime: expect.any(Number) },
        ui: { activeTab: 'workbench', sidebarCollapsed: false },
        connection: { isConnected: false, lastPing: null, server: null }
      });
    });

    it('should restore state from localStorage if available', () => {
      const savedState = {
        ui: { activeTab: 'settings', sidebarCollapsed: true },
        zpt: { zoom: 'unit', tilt: 'graph' }
      };
      
      localStorageMock.store['semem-workbench-state'] = JSON.stringify(savedState);
      
      const restoredStateManager = new StateManager();
      
      expect(restoredStateManager.get('ui.activeTab')).toBe('settings');
      expect(restoredStateManager.get('ui.sidebarCollapsed')).toBe(true);
      expect(restoredStateManager.get('zpt.zoom')).toBe('unit');
      expect(restoredStateManager.get('zpt.tilt')).toBe('graph');
    });
  });

  describe('get', () => {
    it('should retrieve simple values', () => {
      expect(stateManager.get('ui.activeTab')).toBe('workbench');
      expect(stateManager.get('zpt.zoom')).toBe('entity');
    });

    it('should retrieve nested objects', () => {
      const sessionCache = stateManager.get('sessionCache');
      expect(sessionCache).toEqual({
        interactions: [],
        concepts: [],
        embeddings: []
      });
    });

    it('should return undefined for non-existent paths', () => {
      expect(stateManager.get('non.existent.path')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set simple values and emit events', () => {
      stateManager.on('stateChange', eventSpy);
      
      stateManager.set('ui.activeTab', 'settings');
      
      expect(stateManager.get('ui.activeTab')).toBe('settings');
      expect(eventSpy).toHaveBeenCalledWith({
        path: 'ui.activeTab',
        value: 'settings',
        timestamp: expect.any(Number)
      });
    });

    it('should set nested objects', () => {
      const newZptState = { zoom: 'unit', pan: { domains: ['tech'] }, tilt: 'graph' };
      
      stateManager.set('zpt', newZptState);
      
      expect(stateManager.get('zpt')).toEqual({
        ...newZptState,
        query: null // Should merge with existing
      });
    });

    it('should persist to localStorage', () => {
      stateManager.set('ui.activeTab', 'sparql');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'semem-workbench-state',
        expect.stringContaining('"activeTab":"sparql"')
      );
    });
  });

  describe('updateSessionCache', () => {
    it('should add interactions to cache', () => {
      const interaction = { id: '1', prompt: 'test', response: 'response' };
      
      stateManager.updateSessionCache('interactions', interaction);
      
      const interactions = stateManager.get('sessionCache.interactions');
      expect(interactions).toHaveLength(1);
      expect(interactions[0]).toEqual(interaction);
    });

    it('should add concepts to cache', () => {
      const concept = { id: '1', name: 'Machine Learning', type: 'concept' };
      
      stateManager.updateSessionCache('concepts', concept);
      
      const concepts = stateManager.get('sessionCache.concepts');
      expect(concepts).toHaveLength(1);
      expect(concepts[0]).toEqual(concept);
    });

    it('should emit cacheUpdated event', () => {
      stateManager.on('cacheUpdated', eventSpy);
      
      const interaction = { id: '1', prompt: 'test' };
      stateManager.updateSessionCache('interactions', interaction);
      
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'interactions',
        item: interaction,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('updateZPT', () => {
    it('should update ZPT state', () => {
      stateManager.updateZPT({ zoom: 'unit', tilt: 'graph' });
      
      expect(stateManager.get('zpt.zoom')).toBe('unit');
      expect(stateManager.get('zpt.tilt')).toBe('graph');
    });

    it('should emit zptChanged event', () => {
      stateManager.on('zptChanged', eventSpy);
      
      const zptState = { zoom: 'text', query: 'test query' };
      stateManager.updateZPT(zptState);
      
      expect(eventSpy).toHaveBeenCalledWith({
        zptState: expect.objectContaining(zptState),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('recordPerformance', () => {
    it('should record operation performance', () => {
      const mockPerf = vi.mocked(performance.now);
      mockPerf.mockReturnValueOnce(100).mockReturnValueOnce(150);
      
      stateManager.recordPerformance('test-operation', 50);
      
      const operations = stateManager.get('performance.operations');
      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual({
        operation: 'test-operation',
        duration: 50,
        timestamp: expect.any(Number)
      });
    });

    it('should emit performanceRecorded event', () => {
      stateManager.on('performanceRecorded', eventSpy);
      
      stateManager.recordPerformance('api-call', 100);
      
      expect(eventSpy).toHaveBeenCalledWith({
        operation: 'api-call',
        duration: 100,
        timestamp: expect.any(Number)
      });
    });

    it('should limit performance operations to 100 entries', () => {
      // Add 105 operations
      for (let i = 0; i < 105; i++) {
        stateManager.recordPerformance(`operation-${i}`, 10);
      }
      
      const operations = stateManager.get('performance.operations');
      expect(operations).toHaveLength(100);
      
      // Should keep the most recent operations
      expect(operations[99].operation).toBe('operation-104');
    });
  });

  describe('updateConnection', () => {
    it('should update connection status', () => {
      const connectionInfo = {
        isConnected: true,
        server: 'localhost:3001',
        lastPing: Date.now()
      };
      
      stateManager.updateConnection(connectionInfo);
      
      expect(stateManager.get('connection')).toEqual(connectionInfo);
    });

    it('should emit connectionChanged event', () => {
      stateManager.on('connectionChanged', eventSpy);
      
      const connectionInfo = { isConnected: false, error: 'Connection failed' };
      stateManager.updateConnection(connectionInfo);
      
      expect(eventSpy).toHaveBeenCalledWith({
        connection: connectionInfo,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('getSummary', () => {
    it('should return state summary with statistics', () => {
      // Add some test data
      stateManager.updateSessionCache('interactions', { id: '1' });
      stateManager.updateSessionCache('concepts', { id: '1' });
      stateManager.recordPerformance('test', 50);
      
      const summary = stateManager.getSummary();
      
      expect(summary).toEqual({
        interactionsCount: 1,
        conceptsCount: 1,
        embeddingsCount: 0,
        operationsCount: 1,
        sessionDuration: expect.any(Number),
        currentTab: 'workbench',
        zptState: expect.any(Object),
        isConnected: false
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance statistics', () => {
      // Add performance data
      stateManager.recordPerformance('api-call', 100);
      stateManager.recordPerformance('api-call', 200);
      stateManager.recordPerformance('ui-update', 50);
      
      const metrics = stateManager.getPerformanceMetrics();
      
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.averageDuration).toBe(116.67); // (100+200+50)/3
      expect(metrics.operationsByType).toEqual({
        'api-call': 2,
        'ui-update': 1
      });
    });

    it('should handle empty performance data', () => {
      const metrics = stateManager.getPerformanceMetrics();
      
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(metrics.operationsByType).toEqual({});
    });
  });

  describe('clearSessionCache', () => {
    it('should clear all cache data', () => {
      // Add test data
      stateManager.updateSessionCache('interactions', { id: '1' });
      stateManager.updateSessionCache('concepts', { id: '1' });
      
      stateManager.clearSessionCache();
      
      expect(stateManager.get('sessionCache.interactions')).toHaveLength(0);
      expect(stateManager.get('sessionCache.concepts')).toHaveLength(0);
      expect(stateManager.get('sessionCache.embeddings')).toHaveLength(0);
    });

    it('should emit cacheCleared event', () => {
      stateManager.on('cacheCleared', eventSpy);
      
      stateManager.clearSessionCache();
      
      expect(eventSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Number)
      });
    });
  });

  describe('event system', () => {
    it('should register and trigger event listeners', () => {
      stateManager.on('test-event', eventSpy);
      
      stateManager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support multiple listeners for same event', () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      
      stateManager.on('test-event', spy1);
      stateManager.on('test-event', spy2);
      
      stateManager.emit('test-event', { data: 'test' });
      
      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      stateManager.on('test-event', eventSpy);
      stateManager.off('test-event', eventSpy);
      
      stateManager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should persist state changes to localStorage', () => {
      stateManager.set('ui.activeTab', 'settings');
      stateManager.set('zpt.zoom', 'unit');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'semem-workbench-state',
        expect.stringContaining('"activeTab":"settings"')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'semem-workbench-state',
        expect.stringContaining('"zoom":"unit"')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw
      expect(() => {
        stateManager.set('ui.activeTab', 'settings');
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up resources and remove listeners', () => {
      stateManager.on('test-event', eventSpy);
      
      stateManager.destroy();
      
      // Should clear all listeners
      stateManager.emit('test-event', { data: 'test' });
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});