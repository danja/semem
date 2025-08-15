/**
 * Integration tests for Inspect functionality
 * Tests the complete flow from API to UI display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock modules
const mockConsoleService = {
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn()
};

const mockApiService = {
  inspectSession: vi.fn(),
  inspectConcepts: vi.fn(),
  inspectAllData: vi.fn(),
  getErrorMessage: vi.fn((error) => error.message)
};

const mockDomUtils = {
  $$: vi.fn(),
  $: vi.fn(),
  removeClass: vi.fn(),
  addClass: vi.fn(),
  setButtonLoading: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  showToast: vi.fn()
};

// Mock WorkbenchApp with inspect functionality
class MockWorkbenchApp {
  constructor() {
    this.apiService = mockApiService;
    this.consoleService = mockConsoleService;
    this.DomUtils = mockDomUtils;
  }

  async handleInspectAction(event) {
    const button = { dataset: { inspect: event.inspectType }, textContent: 'Test Button' };
    const inspectType = event.inspectType;
    
    if (!inspectType) return;
    
    // Clear previous active states
    this.DomUtils.$$('.inspect-button').forEach(btn => {
      this.DomUtils.removeClass(btn, 'active');
    });
    
    // Set current button as active
    this.DomUtils.addClass(button, 'active');
    
    const startTime = Date.now();
    this.consoleService.info(`Starting inspect operation: ${inspectType}`, {
      action: inspectType,
      buttonElement: button.textContent.trim(),
      timestamp: new Date().toISOString()
    });
    
    try {
      this.DomUtils.setButtonLoading(button, true);
      
      let result;
      switch (inspectType) {
        case 'session':
          result = await this.apiService.inspectSession();
          break;
        case 'concepts':
          result = await this.apiService.inspectConcepts();
          break;
        case 'all':
          result = await this.apiService.inspectAllData();
          break;
        default:
          throw new Error(`Unknown inspect type: ${inspectType}`);
      }
      
      const duration = Date.now() - startTime;
      this.consoleService.success(`Inspect ${inspectType} completed`, {
        action: inspectType,
        dataKeys: Object.keys(result),
        recordCount: this.getRecordCount(result),
        duration
      });
      
      // Display results
      this.displayInspectResults(inspectType, result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.consoleService.error(`Inspect ${inspectType} failed`, {
        action: inspectType,
        duration,
        error: error.message
      });
      
      this.DomUtils.showToast(`Failed to inspect ${inspectType}: ${this.apiService.getErrorMessage(error)}`, 'error');
    } finally {
      this.DomUtils.setButtonLoading(button, false);
    }
  }

  displayInspectResults(inspectType, result) {
    const resultsContainer = this.DomUtils.$('#inspect-results-modal');
    const titleElement = this.DomUtils.$('#inspect-results-title');
    const contentElement = this.DomUtils.$('#inspect-results-content');
    
    if (!resultsContainer || !titleElement || !contentElement) {
      // Fallback to showing in inline results container
      const fallbackContainer = this.DomUtils.$('#inspect-results');
      if (fallbackContainer) {
        this.displayInspectResultsFallback(fallbackContainer, inspectType, result);
      }
      return;
    }
    
    if (titleElement) titleElement.textContent = `${inspectType.charAt(0).toUpperCase() + inspectType.slice(1)} Inspection`;
    
    let html = '';
    switch (inspectType) {
      case 'session':
        html = this.formatSessionResults(result);
        break;
      case 'concepts':
        html = this.formatConceptsResults(result);
        break;
      case 'all':
        html = this.formatAllDataResults(result);
        break;
      default:
        html = this.formatGenericResults(result);
    }
    
    if (contentElement) contentElement.innerHTML = html;
    this.DomUtils.show(resultsContainer);
  }

  formatSessionResults(result) {
    const sessionInfo = result.zptState || result.sessionCache || result;
    return `<div class="session-info">${JSON.stringify(sessionInfo)}</div>`;
  }

  formatConceptsResults(result) {
    return `<div class="concepts-summary">${JSON.stringify(result)}</div>`;
  }

  formatAllDataResults(result) {
    return `<div class="all-data-summary">${JSON.stringify(result)}</div>`;
  }

  formatGenericResults(result) {
    return `<div class="generic-results">${JSON.stringify(result)}</div>`;
  }

  getRecordCount(result) {
    if (result.conceptCount) return result.conceptCount;
    if (result.concepts?.length) return result.concepts.length;
    if (result.sessionCache?.interactions) return result.sessionCache.interactions;
    if (Array.isArray(result)) return result.length;
    return Object.keys(result).length;
  }

  displayInspectResultsFallback(container, inspectType, result) {
    // Mock fallback display
    return { container, inspectType, result };
  }
}

describe('Inspect Integration Tests', () => {
  let workbench;
  let dom;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="inspect-results-modal">
            <div id="inspect-results-title"></div>
            <div id="inspect-results-content"></div>
          </div>
          <div id="inspect-results"></div>
        </body>
      </html>
    `);
    global.document = dom.window.document;
    global.window = dom.window;

    workbench = new MockWorkbenchApp();
    
    // Setup DomUtils mocks
    mockDomUtils.$('#inspect-results-modal').mockReturnValue(dom.window.document.getElementById('inspect-results-modal'));
    mockDomUtils.$('#inspect-results-title').mockReturnValue(dom.window.document.getElementById('inspect-results-title'));
    mockDomUtils.$('#inspect-results-content').mockReturnValue(dom.window.document.getElementById('inspect-results-content'));
    mockDomUtils.$('#inspect-results').mockReturnValue(dom.window.document.getElementById('inspect-results'));
    mockDomUtils.$$('.inspect-button').mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Inspect Flow', () => {
    it('should handle successful session inspect operation', async () => {
      const mockSessionData = {
        success: true,
        zptState: { 
          sessionId: 'test-session-123',
          zoom: 'entity',
          tilt: 'keywords'
        },
        sessionCache: { 
          interactions: 5,
          concepts: 10
        }
      };

      mockApiService.inspectSession.mockResolvedValue(mockSessionData);

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      // Verify API call
      expect(mockApiService.inspectSession).toHaveBeenCalled();

      // Verify console logging
      expect(mockConsoleService.info).toHaveBeenCalledWith(
        'Starting inspect operation: session',
        expect.objectContaining({
          action: 'session',
          buttonElement: 'Test Button'
        })
      );

      expect(mockConsoleService.success).toHaveBeenCalledWith(
        'Inspect session completed',
        expect.objectContaining({
          action: 'session',
          dataKeys: ['success', 'zptState', 'sessionCache'],
          recordCount: 5,
          duration: expect.any(Number)
        })
      );

      // Verify UI updates
      expect(mockDomUtils.setButtonLoading).toHaveBeenCalledWith(expect.any(Object), true);
      expect(mockDomUtils.setButtonLoading).toHaveBeenCalledWith(expect.any(Object), false);
      expect(mockDomUtils.show).toHaveBeenCalled();
    });

    it('should handle failed session inspect operation', async () => {
      const error = new Error('MCP service unavailable');
      mockApiService.inspectSession.mockRejectedValue(error);

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      // Verify error handling
      expect(mockConsoleService.error).toHaveBeenCalledWith(
        'Inspect session failed',
        expect.objectContaining({
          action: 'session',
          error: 'MCP service unavailable'
        })
      );

      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        'Failed to inspect session: MCP service unavailable',
        'error'
      );

      // Verify cleanup
      expect(mockDomUtils.setButtonLoading).toHaveBeenCalledWith(expect.any(Object), false);
    });
  });

  describe('Concepts Inspect Flow', () => {
    it('should handle successful concepts inspect operation', async () => {
      const mockConceptsData = {
        success: true,
        conceptCount: 25,
        concepts: ['artificial intelligence', 'machine learning', 'data science'],
        storageType: 'sparql'
      };

      mockApiService.inspectConcepts.mockResolvedValue(mockConceptsData);

      const mockEvent = { inspectType: 'concepts' };
      await workbench.handleInspectAction(mockEvent);

      expect(mockApiService.inspectConcepts).toHaveBeenCalled();
      expect(mockConsoleService.success).toHaveBeenCalledWith(
        'Inspect concepts completed',
        expect.objectContaining({
          action: 'concepts',
          recordCount: 25
        })
      );
    });
  });

  describe('All Data Inspect Flow', () => {
    it('should handle successful all data inspect operation', async () => {
      const mockAllData = {
        success: true,
        sessionCache: { interactions: 10 },
        zptState: { zoom: 'entity', tilt: 'keywords' },
        systemInfo: { uptime: '2h 15m', status: 'healthy' }
      };

      mockApiService.inspectAllData.mockResolvedValue(mockAllData);

      const mockEvent = { inspectType: 'all' };
      await workbench.handleInspectAction(mockEvent);

      expect(mockApiService.inspectAllData).toHaveBeenCalled();
      expect(mockConsoleService.success).toHaveBeenCalledWith(
        'Inspect all completed',
        expect.objectContaining({
          action: 'all',
          recordCount: 10
        })
      );
    });
  });

  describe('UI State Management', () => {
    it('should manage button active states correctly', async () => {
      const mockButtons = [
        { id: 'btn1' },
        { id: 'btn2' },
        { id: 'btn3' }
      ];
      
      mockDomUtils.$$('.inspect-button').mockReturnValue(mockButtons);
      mockApiService.inspectSession.mockResolvedValue({ success: true });

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      // Verify all buttons have active class removed
      mockButtons.forEach(btn => {
        expect(mockDomUtils.removeClass).toHaveBeenCalledWith(btn, 'active');
      });

      // Verify current button gets active class
      expect(mockDomUtils.addClass).toHaveBeenCalledWith(
        expect.any(Object),
        'active'
      );
    });

    it('should handle missing modal elements gracefully', async () => {
      // Mock missing modal elements
      mockDomUtils.$('#inspect-results-modal').mockReturnValue(null);
      mockDomUtils.$('#inspect-results-title').mockReturnValue(null);
      mockDomUtils.$('#inspect-results-content').mockReturnValue(null);
      
      const fallbackContainer = { id: 'fallback' };
      mockDomUtils.$('#inspect-results').mockReturnValue(fallbackContainer);

      mockApiService.inspectSession.mockResolvedValue({ success: true });

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      // Should fallback to inline display
      expect(mockApiService.inspectSession).toHaveBeenCalled();
      expect(mockConsoleService.success).toHaveBeenCalled();
    });
  });

  describe('Data Display Integration', () => {
    it('should format and display session data correctly', async () => {
      const sessionData = {
        zptState: { sessionId: 'test-123', zoom: 'entity' },
        sessionCache: { interactions: 5 }
      };

      mockApiService.inspectSession.mockResolvedValue(sessionData);

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      // Verify title is set
      const titleElement = dom.window.document.getElementById('inspect-results-title');
      expect(titleElement.textContent).toBe('Session Inspection');

      // Verify content is populated
      const contentElement = dom.window.document.getElementById('inspect-results-content');
      expect(contentElement.innerHTML).toContain('session-info');
      expect(contentElement.innerHTML).toContain('test-123');
    });

    it('should handle different inspect types with appropriate formatting', async () => {
      const testCases = [
        {
          type: 'concepts',
          data: { conceptCount: 15, storageType: 'sparql' },
          expectedClass: 'concepts-summary'
        },
        {
          type: 'all',
          data: { sessionInfo: {}, systemHealth: {} },
          expectedClass: 'all-data-summary'
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        if (testCase.type === 'concepts') {
          mockApiService.inspectConcepts.mockResolvedValue(testCase.data);
        } else {
          mockApiService.inspectAllData.mockResolvedValue(testCase.data);
        }

        const mockEvent = { inspectType: testCase.type };
        await workbench.handleInspectAction(mockEvent);

        const contentElement = dom.window.document.getElementById('inspect-results-content');
        expect(contentElement.innerHTML).toContain(testCase.expectedClass);
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle unknown inspect types', async () => {
      const mockEvent = { inspectType: 'unknown' };
      await workbench.handleInspectAction(mockEvent);

      expect(mockConsoleService.error).toHaveBeenCalledWith(
        'Inspect unknown failed',
        expect.objectContaining({
          error: 'Unknown inspect type: unknown'
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network connection failed');
      mockApiService.inspectSession.mockRejectedValue(networkError);

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      expect(mockConsoleService.error).toHaveBeenCalledWith(
        'Inspect session failed',
        expect.objectContaining({
          error: 'Network connection failed'
        })
      );

      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        'Failed to inspect session: Network connection failed',
        'error'
      );
    });
  });

  describe('Performance and Timing', () => {
    it('should track and report operation duration', async () => {
      // Mock a slow API response
      mockApiService.inspectSession.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), 100)
        )
      );

      const mockEvent = { inspectType: 'session' };
      await workbench.handleInspectAction(mockEvent);

      expect(mockConsoleService.success).toHaveBeenCalledWith(
        'Inspect session completed',
        expect.objectContaining({
          duration: expect.any(Number)
        })
      );

      // Duration should be at least 100ms
      const successCall = mockConsoleService.success.mock.calls[0];
      const duration = successCall[1].duration;
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});