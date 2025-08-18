/**
 * Simple integration test for workbench main functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock StateManager and ApiService BEFORE any DOM setup
vi.mock('../../../../src/frontend/workbench/public/js/services/StateManager.js', () => ({
  StateManager: class MockStateManager {
    constructor() {
      this.state = {
        zoom: 'entity',
        pan: { domains: [], keywords: [], entities: [] },
        tilt: 'keywords',
        session: { interactionsCount: 0, conceptsCount: 0 },
        connection: { status: 'connected' }
      };
      this.listeners = new Map();
    }
    
    getState() { return { ...this.state }; }
    setState() {}
    subscribe() { return () => {}; }
    setZoom() { return Promise.resolve(); }
    setPan() { return Promise.resolve(); }
    setTilt() { return Promise.resolve(); }
    updateSessionStats() {}
    getFormattedDuration() { return '0s'; }
    notifyListeners() {}
    destroy() {}
  },
  stateManager: {
    getState: vi.fn(() => ({
      zoom: 'entity',
      pan: { domains: [], keywords: [], entities: [] },
      tilt: 'keywords',
      session: { interactionsCount: 0, conceptsCount: 0 },
      connection: { status: 'connected' }
    })),
    setState: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    setZoom: vi.fn(() => Promise.resolve()),
    setPan: vi.fn(() => Promise.resolve()),
    setTilt: vi.fn(() => Promise.resolve()),
    updateSessionStats: vi.fn(),
    getFormattedDuration: vi.fn(() => '0s'),
    notifyListeners: vi.fn(),
    destroy: vi.fn()
  }
}));

vi.mock('../../../../src/frontend/workbench/public/js/services/ApiService.js', () => {
  const MockApiService = class MockApiService {
    constructor() {
      this.baseUrl = '/api';
      this.defaultHeaders = { 'Content-Type': 'application/json' };
    }
    
    async makeRequest() { return { success: true }; }
    async tell() { return { success: true }; }
    async ask() { return { success: true }; }
    async zoom() { return { success: true }; }
    async pan() { return { success: true }; }
    async tilt() { return { success: true }; }
    async getState() { return { success: true, state: {} }; }
    async testConnection() { return true; }
  };
  
  const mockApiService = {
    makeRequest: vi.fn(() => Promise.resolve({ success: true })),
    tell: vi.fn(() => Promise.resolve({ success: true })),
    ask: vi.fn(() => Promise.resolve({ success: true })),
    zoom: vi.fn(() => Promise.resolve({ success: true })),
    pan: vi.fn(() => Promise.resolve({ success: true })),
    tilt: vi.fn(() => Promise.resolve({ success: true })),
    getState: vi.fn(() => Promise.resolve({ success: true, state: {} })),
    testConnection: vi.fn(() => Promise.resolve(true))
  };
  
  return {
    ApiService: MockApiService,
    apiService: mockApiService,
    default: MockApiService
  };
});

// Mock DOM globals for Node.js environment
const mockElement = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  setAttribute: vi.fn(),
  getAttribute: vi.fn(),
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    contains: vi.fn()
  },
  style: {},
  textContent: '',
  innerHTML: '',
  appendChild: vi.fn(),
  remove: vi.fn()
};

const mockDocument = {
  querySelector: vi.fn(() => mockElement),
  querySelectorAll: vi.fn(() => [mockElement]),
  createElement: vi.fn(() => mockElement),
  addEventListener: vi.fn(),
  body: mockElement
};

const mockWindow = {
  fetch: vi.fn(),
  location: { href: 'http://localhost:8081' }
};

// Setup global mocks
global.document = mockDocument;
global.window = mockWindow;
global.fetch = mockWindow.fetch;

// Mock CSS support
global.CSS = {
  supports: vi.fn(() => true)
};

// Mock Map constructor for headers
global.Headers = class Headers extends Map {
  get(name) {
    return super.get(name.toLowerCase());
  }
  set(name, value) {
    return super.set(name.toLowerCase(), value);
  }
};

describe('Workbench Simple Integration', () => {
  let DomUtils;
  let ApiService;
  let StateManager;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset DOM mock behaviors
    mockDocument.querySelector.mockReturnValue(mockElement);
    mockDocument.querySelectorAll.mockReturnValue([mockElement]);
    
    // Import modules after mocks are set up
    DomUtils = (await import('../../../../src/frontend/workbench/public/js/utils/DomUtils.js')).default;
    const apiModule = await import('../../../../src/frontend/workbench/public/js/services/ApiService.js');
    ApiService = apiModule.ApiService;
    const stateModule = await import('../../../../src/frontend/workbench/public/js/services/StateManager.js');
    StateManager = stateModule.StateManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DomUtils', () => {
    it('should have basic DOM utility methods', () => {
      expect(typeof DomUtils.$).toBe('function');
      expect(typeof DomUtils.$$).toBe('function');
      expect(typeof DomUtils.createElement).toBe('function');
      expect(typeof DomUtils.addListener).toBe('function');
    });

    it('should safely handle element selection', () => {
      mockDocument.querySelector.mockReturnValue(null);
      
      const result = DomUtils.$('#nonexistent');
      expect(result).toBeNull();
      expect(mockDocument.querySelector).toHaveBeenCalledWith('#nonexistent');
    });

    it('should create elements with attributes', () => {
      const element = DomUtils.createElement('div', {
        className: 'test-class',
        textContent: 'Test content'
      });
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(element).toBe(mockElement);
    });

    it('should handle form data extraction', () => {
      // Mock FormData
      global.FormData = vi.fn().mockImplementation(() => ({
        entries: vi.fn().mockReturnValue([
          ['field1', 'value1'],
          ['field2', 'value2']
        ])
      }));

      const mockForm = { ...mockElement };
      const data = DomUtils.getFormData(mockForm);
      
      expect(data).toEqual({
        field1: 'value1',
        field2: 'value2'
      });
    });

    it('should show toast notifications', () => {
      mockDocument.querySelector.mockReturnValue(mockElement);
      
      const toast = DomUtils.showToast('Test message', 'success');
      
      expect(mockDocument.createElement).toHaveBeenCalled();
      expect(mockElement.appendChild).toHaveBeenCalled();
    });
  });

  describe('ApiService', () => {
    let apiService;

    beforeEach(() => {
      apiService = new ApiService('/api');
      
      // Mock successful fetch by default
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Headers([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should initialize with correct base URL', () => {
      expect(apiService.baseUrl).toBe('/api');
    });

    it('should make tell requests', async () => {
      const result = await apiService.tell({
        content: 'Test content',
        type: 'concept'
      });
      
      expect(global.fetch).toHaveBeenCalledWith('/api/tell', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content',
          type: 'concept',
          metadata: {}
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(result).toEqual({ success: true });
    });

    it('should make ask requests', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Headers([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, answer: 'Test answer' })
      });
      
      const result = await apiService.ask({
        question: 'What is testing?'
      });
      
      expect(global.fetch).toHaveBeenCalledWith('/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is testing?',
          mode: 'standard',
          useContext: true
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(result).toEqual({ success: true, answer: 'Test answer' });
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      });
      
      await expect(apiService.tell({ content: 'test' }))
        .rejects
        .toThrow('Server error');
    });

    it('should test connection', async () => {
      // First call succeeds (health check)
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Headers([['content-type', 'application/json']]),
        json: () => Promise.resolve({ status: 'ok' })
      });
      
      const result = await apiService.testConnection();
      expect(result).toBe(true);
      
      // Second call fails
      global.fetch.mockRejectedValue(new Error('Connection failed'));
      
      const result2 = await apiService.testConnection();
      expect(result2).toBe(false);
    });
  });

  describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
      vi.useFakeTimers();
      
      // Mock the apiService import to avoid circular dependency issues
      vi.doMock('../../../../src/frontend/workbench/public/js/services/ApiService.js', () => ({
        apiService: {
          zoom: vi.fn().mockResolvedValue({ success: true }),
          pan: vi.fn().mockResolvedValue({ success: true }),
          tilt: vi.fn().mockResolvedValue({ success: true }),
          getState: vi.fn().mockResolvedValue({ success: true, state: {} }),
          testConnection: vi.fn().mockResolvedValue(true)
        }
      }));
      
      stateManager = new StateManager();
    });

    afterEach(() => {
      if (stateManager) {
        stateManager.destroy();
      }
      vi.useRealTimers();
    });

    it('should initialize with default state', () => {
      const state = stateManager.getState();
      
      expect(state.zoom).toBe('entity');
      expect(state.tilt).toBe('keywords');
      expect(state.pan.domains).toEqual([]);
      expect(state.session.interactionsCount).toBe(0);
      expect(state.connection.status).toBe('connecting');
    });

    it('should update state correctly', () => {
      stateManager.setState({ zoom: 'unit' });
      
      const state = stateManager.getState();
      expect(state.zoom).toBe('unit');
    });

    it('should handle event subscriptions', () => {
      const listener = vi.fn();
      const unsubscribe = stateManager.subscribe('test-event', listener);
      
      stateManager.notifyListeners('test-event', { data: 'test' });
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
      
      unsubscribe();
      listener.mockClear();
      
      stateManager.notifyListeners('test-event', { data: 'test2' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should format ZPT display string', () => {
      const displayString = stateManager.getZptDisplayString();
      expect(displayString).toBe('entity/all/keywords');
      
      stateManager.setState({
        zoom: 'unit',
        pan: { domains: ['AI'], keywords: ['ML'] },
        tilt: 'graph'
      });
      
      const displayString2 = stateManager.getZptDisplayString();
      expect(displayString2).toBe('unit/domains:1,keywords:1/graph');
    });

    it('should manage UI state', () => {
      stateManager.togglePanel('test-panel');
      
      let state = stateManager.getState();
      expect(state.ui.expandedPanels.has('test-panel')).toBe(true);
      
      stateManager.setLoadingState('test-op', true);
      expect(stateManager.isLoading('test-op')).toBe(true);
      
      stateManager.setLoadingState('test-op', false);
      expect(stateManager.isLoading('test-op')).toBe(false);
    });
  });

  describe('Integration', () => {
    it('should work together for basic workflow', async () => {
      // Setup API mock
      global.fetch.mockResolvedValue({
        ok: true,
        headers: new Headers([['content-type', 'application/json']]),
        json: () => Promise.resolve({ success: true, id: 'test-id' })
      });
      
      // Create services
      const apiService = new ApiService('/api');
      
      // Test tell operation
      const tellResult = await apiService.tell({
        content: 'Test integration content',
        type: 'concept'
      });
      
      expect(tellResult).toEqual({ success: true, id: 'test-id' });
      expect(global.fetch).toHaveBeenCalledWith('/api/tell', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Test integration content')
      }));
    });

    it('should handle error scenarios gracefully', async () => {
      // Setup API error
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const apiService = new ApiService('/api');
      
      // Test error handling
      await expect(apiService.tell({ content: 'test' }))
        .rejects
        .toThrow('Network error');
      
      // Test error message formatting
      const errorMsg = apiService.getErrorMessage(new Error('fetch failed'));
      expect(errorMsg).toBe('Unable to connect to server. Please check if the service is running.');
    });
  });
});