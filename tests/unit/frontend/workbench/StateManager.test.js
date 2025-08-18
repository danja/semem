/**
 * Unit tests for StateManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the ApiService BEFORE importing StateManager
vi.mock('../../../../src/frontend/workbench/public/js/services/ApiService.js', () => ({
  apiService: {
    zoom: vi.fn(),
    pan: vi.fn(),
    tilt: vi.fn(),
    getState: vi.fn(),
    testConnection: vi.fn()
  }
}));

// Mock the StateManager's initialize method to prevent immediate API calls
vi.mock('../../../../src/frontend/workbench/public/js/services/StateManager.js', async () => {
  const actual = await vi.importActual('../../../../src/frontend/workbench/public/js/services/StateManager.js');
  return {
    ...actual,
    StateManager: class MockedStateManager extends actual.StateManager {
      constructor() {
        super();
        // Clear intervals created in constructor to prevent real API calls
        if (this.connectionCheckInterval) {
          clearInterval(this.connectionCheckInterval);
          this.connectionCheckInterval = null;
        }
        if (this.updateInterval) {
          clearInterval(this.updateInterval);  
          this.updateInterval = null;
        }
      }
      
      // Override initialize to prevent automatic API calls
      async initialize() {
        // Start timers but don't sync with server
        this.startSessionTimer();
        this.startConnectionMonitor();
        // Skip syncWithServer() to avoid real API calls
      }
    }
  };
});

import { StateManager } from '../../../../src/frontend/workbench/public/js/services/StateManager.js';

describe('StateManager', () => {
  let stateManager;
  let mockApiService;

  beforeEach(async () => {
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset the mock
    const { apiService } = await import('../../../../src/frontend/workbench/public/js/services/ApiService.js');
    mockApiService = apiService;
    vi.clearAllMocks();
    
    // Mock testConnection to prevent real network calls
    mockApiService.testConnection.mockResolvedValue(true);
    mockApiService.getState.mockResolvedValue({ success: true, state: {} });
    
    stateManager = new StateManager();
  });

  afterEach(() => {
    if (stateManager) {
      stateManager.destroy();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default state', () => {
      const state = stateManager.getState();
      
      expect(state.zoom).toBe('entity');
      expect(state.tilt).toBe('keywords');
      expect(state.pan).toEqual({
        domains: [],
        keywords: [],
        entities: [],
        temporal: null
      });
      expect(state.session.interactionsCount).toBe(0);
      expect(state.session.conceptsCount).toBe(0);
      // Allow for either 'connecting' or 'error' since connection check runs immediately
      expect(['connecting', 'error']).toContain(state.connection.status);
    });

    it('should start session timer on initialization', () => {
      const state = stateManager.getState();
      const startTime = state.session.startTime;
      
      expect(startTime).toBeCloseTo(Date.now(), -2); // Within 100ms
      expect(stateManager.updateInterval).toBeTruthy();
    });

    it('should start connection monitoring', () => {
      expect(stateManager.connectionCheckInterval).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should get current state as deep copy', () => {
      const state1 = stateManager.getState();
      const state2 = stateManager.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
      expect(state1.pan).not.toBe(state2.pan); // Deep copy
    });

    it('should get state slice by path', () => {
      const zoom = stateManager.getStateSlice('zoom');
      const sessionCount = stateManager.getStateSlice('session.interactionsCount');
      
      expect(zoom).toBe('entity');
      expect(sessionCount).toBe(0);
    });

    it('should handle invalid state slice paths', () => {
      const result = stateManager.getStateSlice('invalid.path.here');
      expect(result).toBeUndefined();
    });

    it('should update state with object', () => {
      const listener = vi.fn();
      stateManager.subscribe('stateChange', listener);
      
      stateManager.setState({ zoom: 'unit' });
      
      const state = stateManager.getState();
      expect(state.zoom).toBe('unit');
      expect(listener).toHaveBeenCalled();
    });

    it('should update state with function', () => {
      const listener = vi.fn();
      stateManager.subscribe('stateChange', listener);
      
      stateManager.setState(prevState => ({
        ...prevState,
        zoom: 'community'
      }));
      
      const state = stateManager.getState();
      expect(state.zoom).toBe('community');
      expect(listener).toHaveBeenCalled();
    });

    it('should not notify listeners when specified', () => {
      const listener = vi.fn();
      stateManager.subscribe('stateChange', listener);
      
      stateManager.setState({ zoom: 'unit' }, false);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('ZPT Navigation', () => {
    beforeEach(() => {
      mockApiService.zoom.mockResolvedValue({ success: true });
      mockApiService.pan.mockResolvedValue({ success: true });
      mockApiService.tilt.mockResolvedValue({ success: true });
    });

    describe('setZoom', () => {
      it('should update zoom level and call API', async () => {
        const listener = vi.fn();
        stateManager.subscribe('zoomChange', listener);
        
        const result = await stateManager.setZoom('unit', 'test query');
        
        expect(mockApiService.zoom).toHaveBeenCalledWith({
          level: 'unit',
          query: 'test query'
        });
        expect(stateManager.getState().zoom).toBe('unit');
        expect(listener).toHaveBeenCalledWith({
          level: 'unit',
          query: 'test query',
          result: { success: true }
        });
      });

      it('should handle zoom API errors', async () => {
        const error = new Error('Zoom failed');
        mockApiService.zoom.mockRejectedValue(error);
        
        const errorListener = vi.fn();
        stateManager.subscribe('error', errorListener);
        
        await expect(stateManager.setZoom('unit')).rejects.toThrow('Zoom failed');
        expect(errorListener).toHaveBeenCalledWith({
          type: 'zoom',
          error
        });
      });

      it('should manage loading state', async () => {
        let loadingState;
        mockApiService.zoom.mockImplementation(() => {
          loadingState = stateManager.isLoading('zoom');
          return Promise.resolve({ success: true });
        });
        
        const promise = stateManager.setZoom('unit');
        expect(stateManager.isLoading('zoom')).toBe(true);
        
        await promise;
        expect(stateManager.isLoading('zoom')).toBe(false);
        expect(loadingState).toBe(true); // Was true during API call
      });
    });

    describe('setPan', () => {
      it('should update pan filters and call API', async () => {
        const panParams = {
          domains: ['AI', 'tech'],
          keywords: ['machine learning']
        };
        
        const listener = vi.fn();
        stateManager.subscribe('panChange', listener);
        
        await stateManager.setPan(panParams, 'test query');
        
        expect(mockApiService.pan).toHaveBeenCalledWith({
          ...panParams,
          query: 'test query'
        });
        
        const state = stateManager.getState();
        expect(state.pan.domains).toEqual(['AI', 'tech']);
        expect(state.pan.keywords).toEqual(['machine learning']);
      });
    });

    describe('setTilt', () => {
      it('should update tilt style and call API', async () => {
        const listener = vi.fn();
        stateManager.subscribe('tiltChange', listener);
        
        await stateManager.setTilt('graph', 'test query');
        
        expect(mockApiService.tilt).toHaveBeenCalledWith({
          style: 'graph',
          query: 'test query'
        });
        expect(stateManager.getState().tilt).toBe('graph');
      });
    });
  });

  describe('ZPT Display', () => {
    it('should generate ZPT display string with no filters', () => {
      const displayString = stateManager.getZptDisplayString();
      expect(displayString).toBe('entity/all/keywords');
    });

    it('should generate ZPT display string with filters', () => {
      stateManager.setState({
        zoom: 'unit',
        pan: {
          domains: ['AI', 'tech'],
          keywords: ['ML'],
          entities: ['GPT']
        },
        tilt: 'graph'
      });
      
      const displayString = stateManager.getZptDisplayString();
      expect(displayString).toBe('unit/domains:2,keywords:1,entities:1/graph');
    });

    it('should generate pan display string', () => {
      stateManager.setState({
        pan: {
          domains: ['AI'],
          keywords: ['ML', 'neural'],
          entities: []
        }
      });
      
      const panDisplay = stateManager.getPanDisplayString();
      expect(panDisplay).toBe('domains:1,keywords:2');
    });

    it('should return "all" for empty pan filters', () => {
      const panDisplay = stateManager.getPanDisplayString();
      expect(panDisplay).toBe('all');
    });
  });

  describe('Session Management', () => {
    it('should update session duration', () => {
      const initialDuration = stateManager.getState().session.duration;
      
      // Advance timer by 2 seconds
      vi.advanceTimersByTime(2000);
      
      const updatedDuration = stateManager.getState().session.duration;
      expect(updatedDuration).toBe(initialDuration + 2);
    });

    it('should update session statistics', () => {
      stateManager.updateSessionStats({
        interactionsCount: 5,
        conceptsCount: 10
      });
      
      const state = stateManager.getState();
      expect(state.session.interactionsCount).toBe(5);
      expect(state.session.conceptsCount).toBe(10);
    });

    it('should format duration correctly', () => {
      // Test seconds
      stateManager.setState({
        session: { duration: 45 }
      });
      expect(stateManager.getFormattedDuration()).toBe('45s');
      
      // Test minutes and seconds
      stateManager.setState({
        session: { duration: 125 }
      });
      expect(stateManager.getFormattedDuration()).toBe('2m 5s');
      
      // Test hours, minutes
      stateManager.setState({
        session: { duration: 3665 }
      });
      expect(stateManager.getFormattedDuration()).toBe('1h 1m');
    });
  });

  describe('Connection Management', () => {
    it('should check connection periodically', async () => {
      mockApiService.testConnection.mockResolvedValue(true);
      
      await stateManager.checkConnection();
      
      expect(mockApiService.testConnection).toHaveBeenCalled();
      expect(stateManager.getState().connection.status).toBe('connected');
    });

    it('should handle connection failures', async () => {
      mockApiService.testConnection.mockResolvedValue(false);
      
      await stateManager.checkConnection();
      
      expect(stateManager.getState().connection.status).toBe('error');
      expect(stateManager.getState().connection.error).toBe('Connection failed');
    });

    it('should handle connection check errors', async () => {
      const error = new Error('Network error');
      mockApiService.testConnection.mockRejectedValue(error);
      
      await stateManager.checkConnection();
      
      expect(stateManager.getState().connection.status).toBe('error');
      expect(stateManager.getState().connection.error).toBe('Network error');
    });
  });

  describe('UI State Management', () => {
    it('should toggle panel expansion', () => {
      stateManager.togglePanel('test-panel');
      
      let state = stateManager.getState();
      expect(state.ui.expandedPanels).toBeInstanceOf(Set);
      expect(state.ui.expandedPanels.has('test-panel')).toBe(true);
      
      stateManager.togglePanel('test-panel');
      
      state = stateManager.getState();
      expect(state.ui.expandedPanels.has('test-panel')).toBe(false);
    });

    it('should set and check loading states', () => {
      stateManager.setLoadingState('test-operation', true);
      expect(stateManager.isLoading('test-operation')).toBe(true);
      
      stateManager.setLoadingState('test-operation', false);
      expect(stateManager.isLoading('test-operation')).toBe(false);
    });

    it('should set active results', () => {
      const results = { answer: 'test answer' };
      stateManager.setActiveResults('ask', results);
      
      const state = stateManager.getState();
      expect(state.ui.activeResults.ask).toEqual(results);
    });
  });

  describe('Event Management', () => {
    it('should subscribe and unsubscribe from events', () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe('test-event', listener);
      
      stateManager.notifyListeners('test-event', { data: 'test' });
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      unsubscribe();
      listener.mockClear();
      
      stateManager.notifyListeners('test-event', { data: 'test2' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      stateManager.subscribe('test-event', errorListener);
      stateManager.subscribe('test-event', goodListener);
      
      // Should not throw
      expect(() => {
        stateManager.notifyListeners('test-event', { data: 'test' });
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Server Sync', () => {
    it('should sync state with server successfully', async () => {
      const serverState = {
        success: true,
        state: {
          zoom: 'community',
          pan: { domains: ['test'] },
          tilt: 'embedding'
        }
      };
      
      mockApiService.getState.mockResolvedValue(serverState);
      
      await stateManager.syncWithServer();
      
      const state = stateManager.getState();
      expect(state.zoom).toBe('community');
      expect(state.pan.domains).toEqual(['test']);
      expect(state.tilt).toBe('embedding');
    });

    it('should handle server sync errors gracefully', async () => {
      mockApiService.getState.mockRejectedValue(new Error('Sync failed'));
      
      // Should not throw
      await expect(stateManager.syncWithServer()).resolves.not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should deep merge objects correctly', () => {
      const target = {
        a: 1,
        b: { c: 2, d: 3 }
      };
      
      const source = {
        b: { c: 4, e: 5 },
        f: 6
      };
      
      const result = stateManager.deepMerge(target, source);
      
      expect(result).toEqual({
        a: 1,
        b: { c: 4, d: 3, e: 5 },
        f: 6
      });
    });

    it('should handle array replacement in deep merge', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      
      const result = stateManager.deepMerge(target, source);
      expect(result.arr).toEqual([4, 5]);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources when destroyed', () => {
      const intervalSpy = vi.spyOn(global, 'clearInterval');
      
      stateManager.destroy();
      
      expect(intervalSpy).toHaveBeenCalledTimes(2); // Both timers
      expect(stateManager.listeners.size).toBe(0);
    });
  });
});