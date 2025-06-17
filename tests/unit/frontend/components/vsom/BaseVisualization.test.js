import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock loglevel
vi.mock('loglevel', () => ({
  default: {
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setLevel: vi.fn()
    }))
  }
}));

// Mock d3
const mockSvg = {
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  remove: vi.fn()
};

const mockD3 = {
  select: vi.fn(() => mockSvg)
};

vi.stubGlobal('d3', mockD3);

// Mock performance
vi.stubGlobal('performance', {
  now: vi.fn(() => Date.now())
});

import { BaseVisualization } from '../../../../../src/frontend/js/components/vsom/BaseVisualization.js';

describe('BaseVisualization', () => {
  let visualization;
  let mockContainer;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock container
    mockContainer = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: vi.fn(),
      removeChild: vi.fn()
    };

    // Create visualization instance
    visualization = new BaseVisualization(mockContainer, {
      logLevel: 'debug'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(visualization.container).toBe(mockContainer);
      expect(visualization.options.logLevel).toBe('debug');
      expect(visualization.initialized).toBe(false);
      expect(visualization.svg).toBeNull();
      expect(visualization.width).toBe(0);
      expect(visualization.height).toBe(0);
    });

    it('should merge custom options with defaults', () => {
      const customViz = new BaseVisualization(mockContainer, {
        logLevel: 'info',
        customOption: 'test'
      });

      expect(customViz.options.logLevel).toBe('info');
      expect(customViz.options.customOption).toBe('test');
    });
  });

  describe('init', () => {
    it('should initialize visualization successfully', () => {
      const mockData = { nodes: [] };

      visualization.init(mockData);

      expect(visualization.initialized).toBe(true);
      expect(visualization.width).toBe(800);
      expect(visualization.height).toBe(600);
      expect(mockD3.select).toHaveBeenCalledWith(mockContainer);
      expect(mockSvg.append).toHaveBeenCalledWith('svg');
      expect(mockSvg.attr).toHaveBeenCalledWith('width', '100%');
      expect(mockSvg.attr).toHaveBeenCalledWith('height', '100%');
      expect(mockSvg.attr).toHaveBeenCalledWith('viewBox', '0 0 800 600');
    });
  });

  describe('setupContainer', () => {
    it('should setup container with correct dimensions', () => {
      visualization.setupContainer();

      expect(visualization.width).toBe(800);
      expect(visualization.height).toBe(600);
    });

    it('should throw error if no container provided', () => {
      const vizWithoutContainer = new BaseVisualization(null);

      expect(() => {
        vizWithoutContainer.setupContainer();
      }).toThrow('No container element provided');
    });
  });

  describe('setupSVG', () => {
    beforeEach(() => {
      visualization.width = 800;
      visualization.height = 600;
    });

    it('should create SVG element with correct attributes', () => {
      visualization.setupSVG();

      expect(mockD3.select).toHaveBeenCalledWith(mockContainer);
      expect(mockSvg.append).toHaveBeenCalledWith('svg');
      expect(mockSvg.attr).toHaveBeenCalledWith('width', '100%');
      expect(mockSvg.attr).toHaveBeenCalledWith('height', '100%');
      expect(mockSvg.attr).toHaveBeenCalledWith('viewBox', '0 0 800 600');
      expect(visualization.svg).toBe(mockSvg);
    });
  });

  describe('update', () => {
    it('should update initialized visualization', () => {
      visualization.initialized = true;
      const mockData = { nodes: [{ id: 1 }] };

      visualization.update(mockData);

      // Should log update, no errors thrown
    });

    it('should call init if not initialized', () => {
      const initSpy = vi.spyOn(visualization, 'init').mockImplementation(() => {});
      const mockData = { nodes: [] };

      visualization.update(mockData);

      expect(initSpy).toHaveBeenCalledWith(mockData);
    });
  });

  describe('handleResize', () => {
    it('should do nothing if not initialized', () => {
      visualization.handleResize();

      // Should not throw error
    });

    it('should resize when dimensions change', () => {
      visualization.initialized = true;
      visualization.width = 800;
      visualization.height = 600;
      visualization.svg = mockSvg;
      
      // Change container dimensions
      mockContainer.clientWidth = 1000;
      mockContainer.clientHeight = 800;

      const onResizeSpy = vi.spyOn(visualization, 'onResize');

      visualization.handleResize();

      expect(visualization.width).toBe(1000);
      expect(visualization.height).toBe(800);
      expect(onResizeSpy).toHaveBeenCalled();
    });

    it('should not resize when dimensions are the same', () => {
      visualization.initialized = true;
      visualization.width = 800;
      visualization.height = 600;

      const onResizeSpy = vi.spyOn(visualization, 'onResize');

      visualization.handleResize();

      expect(onResizeSpy).not.toHaveBeenCalled();
    });
  });

  describe('onResize', () => {
    it('should update SVG viewBox on resize', () => {
      visualization.svg = mockSvg;
      visualization.width = 1000;
      visualization.height = 800;

      visualization.onResize();

      expect(mockSvg.attr).toHaveBeenCalledWith('viewBox', '0 0 1000 800');
    });

    it('should handle missing SVG gracefully', () => {
      visualization.svg = null;

      expect(() => {
        visualization.onResize();
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should clean up SVG and reset state', () => {
      visualization.svg = mockSvg;
      visualization.initialized = true;

      visualization.destroy();

      expect(mockSvg.remove).toHaveBeenCalled();
      expect(visualization.svg).toBeNull();
      expect(visualization.initialized).toBe(false);
    });

    it('should handle destruction when SVG is null', () => {
      visualization.svg = null;
      visualization.initialized = true;

      expect(() => {
        visualization.destroy();
      }).not.toThrow();

      expect(visualization.initialized).toBe(false);
    });
  });

  describe('withPerformanceLogging', () => {
    it('should measure and log successful function execution', () => {
      const mockFn = vi.fn(() => 'test result');
      const mockPerformance = vi.mocked(performance.now);
      mockPerformance.mockReturnValueOnce(100).mockReturnValueOnce(150);

      const result = visualization.withPerformanceLogging('test operation', mockFn);

      expect(result).toBe('test result');
      expect(mockFn).toHaveBeenCalled();
      expect(mockPerformance).toHaveBeenCalledTimes(2);
    });

    it('should measure and log failed function execution', () => {
      const mockFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const mockPerformance = vi.mocked(performance.now);
      mockPerformance.mockReturnValueOnce(100).mockReturnValueOnce(150);

      expect(() => {
        visualization.withPerformanceLogging('failing operation', mockFn);
      }).toThrow('Test error');

      expect(mockFn).toHaveBeenCalled();
      expect(mockPerformance).toHaveBeenCalledTimes(2);
    });

    it('should handle async functions', () => {
      const mockAsyncFn = vi.fn(() => Promise.resolve('async result'));
      const mockPerformance = vi.mocked(performance.now);
      mockPerformance.mockReturnValueOnce(100).mockReturnValueOnce(150);

      const result = visualization.withPerformanceLogging('async operation', mockAsyncFn);

      expect(result).toBeInstanceOf(Promise);
      expect(mockAsyncFn).toHaveBeenCalled();
    });
  });

  describe('inheritance and subclassing', () => {
    class TestVisualization extends BaseVisualization {
      onResize() {
        super.onResize();
        this.customResizeLogic = true;
      }

      customMethod() {
        return 'custom implementation';
      }
    }

    it('should support inheritance and method overriding', () => {
      const testViz = new TestVisualization(mockContainer);
      testViz.svg = mockSvg;
      testViz.width = 800;
      testViz.height = 600;

      testViz.onResize();

      expect(mockSvg.attr).toHaveBeenCalledWith('viewBox', '0 0 800 600');
      expect(testViz.customResizeLogic).toBe(true);
      expect(testViz.customMethod()).toBe('custom implementation');
    });
  });

  describe('error handling', () => {
    it('should handle errors in setupContainer gracefully', () => {
      // Mock container to throw error
      const badContainer = {
        get clientWidth() {
          throw new Error('DOM access error');
        }
      };

      const badViz = new BaseVisualization(badContainer);

      expect(() => {
        badViz.setupContainer();
      }).toThrow('DOM access error');
    });

    it('should handle d3 selection errors', () => {
      mockD3.select.mockImplementation(() => {
        throw new Error('D3 selection error');
      });

      expect(() => {
        visualization.setupSVG();
      }).toThrow('D3 selection error');
    });
  });
});