import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Console from '../../../../src/frontend/js/components/Console/Console.js';

// Mock document and DOM APIs
const mockDOM = () => {
  const mockElements = new Map();
  
  const createElement = vi.fn((tagName) => {
    const element = {
      tagName: tagName.toUpperCase(),
      className: '',
      innerHTML: '',
      textContent: '',
      addEventListener: vi.fn(),
      querySelector: vi.fn((selector) => {
        // Return a mock element for any selector
        return createElement('div');
      }),
      querySelectorAll: vi.fn(() => []),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn()
      },
      style: {},
      scrollTop: 0,
      scrollHeight: 100,
      clientHeight: 50,
      title: ''
    };
    
    // Make querySelector return child elements
    element.querySelector.mockImplementation((selector) => {
      const childElement = createElement('div');
      childElement.className = selector.replace('.', '').replace('#', '');
      return childElement;
    });
    
    return element;
  });

  return {
    createElement,
    body: {
      appendChild: vi.fn()
    },
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  };
};

describe('Console', () => {
  let console;
  let mockDocument;
  let mockNavigator;
  let originalConsole;

  beforeEach(() => {
    // Setup DOM mocks
    mockDocument = mockDOM();
    vi.stubGlobal('document', mockDocument);
    
    // Setup navigator mock
    mockNavigator = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue()
      }
    };
    vi.stubGlobal('navigator', mockNavigator);

    // Store original console methods
    originalConsole = { ...global.console };
    
    // Mock console methods
    global.console = {
      ...originalConsole,
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn()
    };

    // Mock Date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      console = new Console();
      
      expect(console.options.initialLogLevel).toBe('debug');
      expect(console.options.maxLogs).toBe(1000);
      expect(console.isOpen).toBe(false);
      expect(console.searchTerm).toBe('');
      expect(console.logLevel).toBe('debug');
      expect(console.isPaused).toBe(false);
      expect(console.autoScroll).toBe(true);
      // Should have initialization log
      expect(console.logs).toHaveLength(1);
      expect(console.logs[0].message).toBe('Console initialized');
    });

    it('should accept custom options', () => {
      const options = {
        initialLogLevel: 'error',
        maxLogs: 500
      };
      
      console = new Console(options);
      
      expect(console.options.initialLogLevel).toBe('error');
      expect(console.options.maxLogs).toBe(500);
      expect(console.logLevel).toBe('error');
    });
  });

  describe('createDOM', () => {
    it('should create console DOM structure', () => {
      console = new Console();
      
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
      expect(console.container.className).toBe('console-container');
    });
  });

  describe('log', () => {
    beforeEach(() => {
      console = new Console();
      console.renderLogs = vi.fn(); // Mock renderLogs to avoid DOM operations
      console.logs = []; // Clear initialization log
    });

    it('should add log entry with correct properties', () => {
      console.log('Test message', 'info');
      
      expect(console.logs).toHaveLength(1);
      expect(console.logs[0]).toEqual({
        message: 'Test message',
        level: 'info',
        timestamp: '2024-01-01T12:00:00.000Z',
        data: null
      });
      expect(console.renderLogs).toHaveBeenCalled();
    });

    it('should not log when paused', () => {
      console.isPaused = true;
      console.log('Test message', 'info');
      
      expect(console.logs).toHaveLength(0);
      expect(console.renderLogs).not.toHaveBeenCalled();
    });

    it('should maintain max log limit', () => {
      console.options.maxLogs = 2;
      
      console.log('Message 1', 'info');
      console.log('Message 2', 'info');
      console.log('Message 3', 'info');
      
      expect(console.logs).toHaveLength(2);
      expect(console.logs[0].message).toBe('Message 2');
      expect(console.logs[1].message).toBe('Message 3');
    });

    it('should include data when provided', () => {
      const testData = { key: 'value' };
      console.log('Test message', 'info', testData);
      
      expect(console.logs).toHaveLength(1);
      expect(console.logs[0].data).toEqual(testData);
    });
  });

  describe('toggle', () => {
    beforeEach(() => {
      console = new Console();
    });

    it('should toggle console visibility', () => {
      expect(console.isOpen).toBe(false);
      
      console.toggle();
      expect(console.isOpen).toBe(true);
      expect(console.container.classList.toggle).toHaveBeenCalledWith('open');
      
      console.toggle();
      expect(console.isOpen).toBe(false);
    });
  });

  describe('togglePause', () => {
    beforeEach(() => {
      console = new Console();
    });

    it('should toggle pause state', () => {
      expect(console.isPaused).toBe(false);
      
      console.togglePause();
      expect(console.isPaused).toBe(true);
      
      console.togglePause();
      expect(console.isPaused).toBe(false);
    });
  });

  describe('clearLogs', () => {
    beforeEach(() => {
      console = new Console();
      console.renderLogs = vi.fn();
      
      // Add some logs
      console.logs = [
        { message: 'Test 1', level: 'info', timestamp: new Date().toISOString(), data: null },
        { message: 'Test 2', level: 'error', timestamp: new Date().toISOString(), data: null }
      ];
    });

    it('should clear all logs', () => {
      console.clearLogs();
      
      expect(console.logs).toHaveLength(0);
      expect(console.renderLogs).toHaveBeenCalled();
    });
  });

  describe('copyLogs', () => {
    beforeEach(() => {
      console = new Console();
      console.renderLogs = vi.fn();
      console.shouldShowLog = vi.fn().mockReturnValue(true);
      
      // Add some logs
      console.logs = [
        { message: 'Test 1', level: 'info', timestamp: '2024-01-01T12:00:00.000Z', data: null },
        { message: 'Test 2', level: 'error', timestamp: '2024-01-01T12:01:00.000Z', data: null }
      ];
    });

    it('should copy logs to clipboard', async () => {
      await console.copyLogs();
      
      const expectedText = '[2024-01-01T12:00:00.000Z] [info] Test 1\n[2024-01-01T12:01:00.000Z] [error] Test 2';
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith(expectedText);
    });

    it('should handle copy failure gracefully', () => {
      mockNavigator.clipboard.writeText.mockRejectedValue(new Error('Copy failed'));
      
      // Should not throw when copy fails
      expect(() => console.copyLogs()).not.toThrow();
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('shouldShowLog', () => {
    beforeEach(() => {
      console = new Console();
    });

    it('should filter by log level', () => {
      const debugLog = { level: 'debug', message: 'Debug message', data: null };
      const errorLog = { level: 'error', message: 'Error message', data: null };
      
      console.logLevel = 'error';
      
      expect(console.shouldShowLog(debugLog)).toBe(false);
      expect(console.shouldShowLog(errorLog)).toBe(true);
    });

    it('should filter by search term', () => {
      const log1 = { level: 'info', message: 'Test message', data: null };
      const log2 = { level: 'info', message: 'Another log', data: null };
      
      console.searchTerm = 'test';
      
      expect(console.shouldShowLog(log1)).toBe(true);
      expect(console.shouldShowLog(log2)).toBe(false);
    });

    it('should show all logs when no filters applied', () => {
      const log = { level: 'debug', message: 'Any message', data: null };
      
      console.logLevel = 'debug';
      console.searchTerm = '';
      
      expect(console.shouldShowLog(log)).toBe(true);
    });
  });

  describe('escapeHtml', () => {
    beforeEach(() => {
      console = new Console();
    });

    it('should escape HTML special characters', () => {
      const unsafe = '<script>alert("xss")</script>';
      const escaped = console.escapeHtml(unsafe);
      
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });

  describe('escapeRegex', () => {
    beforeEach(() => {
      console = new Console();
    });

    it('should escape regex special characters', () => {
      const regex = '.*+?^${}()|[]\\';
      const escaped = console.escapeRegex(regex);
      
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });
  });
});