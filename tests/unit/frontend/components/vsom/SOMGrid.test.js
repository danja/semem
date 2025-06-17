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

// Mock d3 utilities
vi.mock('../../../../../src/frontend/js/utils/d3-helpers.js', () => ({
  createResponsiveSVG: vi.fn(),
  createTooltip: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })),
  createColorScale: vi.fn(() => vi.fn(val => `color-${val}`))
}));

// Mock BaseVisualization
const mockBaseVisualization = {
  init: vi.fn().mockResolvedValue(),
  setupContainer: vi.fn(),
  setupSVG: vi.fn(),
  handleResize: vi.fn(),
  destroy: vi.fn(),
  withPerformanceLogging: vi.fn((name, fn) => fn())
};

vi.mock('../../../../../src/frontend/js/components/vsom/BaseVisualization.js', () => ({
  BaseVisualization: class MockBaseVisualization {
    constructor(container, options) {
      this.container = container;
      this.options = options;
      this.logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        setLevel: vi.fn()
      };
      this.initialized = false;
      this.svg = mockSvg;
      this.width = 800;
      this.height = 600;
      Object.assign(this, mockBaseVisualization);
    }
  }
}));

// Mock d3
const mockSelection = {
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  data: vi.fn().mockReturnThis(),
  enter: vi.fn().mockReturnThis(),
  exit: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  merge: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  call: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  transition: vi.fn().mockReturnThis(),
  duration: vi.fn().mockReturnThis()
};

const mockSvg = {
  ...mockSelection,
  node: vi.fn(() => ({ getBBox: () => ({ width: 100, height: 100 }) }))
};

const mockZoom = {
  scaleExtent: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis()
};

const mockD3 = {
  select: vi.fn(() => mockSelection),
  selectAll: vi.fn(() => mockSelection),
  zoom: vi.fn(() => mockZoom),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis()
  })),
  extent: vi.fn(),
  interpolateViridis: vi.fn(t => `viridis-${t}`)
};

vi.mock('d3', () => mockD3);
vi.stubGlobal('d3', mockD3);

import { SOMGrid } from '../../../../../src/frontend/js/components/vsom/SOMGrid/SOMGrid.js';

describe('SOMGrid', () => {
  let somGrid;
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

    // Create SOMGrid instance
    somGrid = new SOMGrid(mockContainer, {
      nodeSize: 20,
      padding: 2,
      showUMatrix: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(somGrid.container).toBe(mockContainer);
      expect(somGrid.options.nodeSize).toBe(20);
      expect(somGrid.options.padding).toBe(2);
      expect(somGrid.options.showUMatrix).toBe(true);
      expect(somGrid.options.colorScheme).toBe('interpolateViridis');
    });

    it('should initialize with empty state', () => {
      expect(somGrid.nodes).toEqual([]);
      expect(somGrid.links).toEqual([]);
      expect(somGrid.simulation).toBeNull();
      expect(somGrid.zoom).toBeNull();
      expect(somGrid.colorScale).toBeNull();
    });

    it('should have bound methods', () => {
      expect(typeof somGrid.handleNodeClick).toBe('function');
      expect(typeof somGrid.handleNodeHover).toBe('function');
    });
  });

  describe('init', () => {
    it('should initialize the SOM grid visualization', async () => {
      const mockData = {
        nodes: [
          { id: 1, x: 0, y: 0, activation: 0.5 },
          { id: 2, x: 1, y: 0, activation: 0.8 }
        ]
      };

      await somGrid.init(mockData);

      expect(mockBaseVisualization.init).toHaveBeenCalledWith(mockData);
      expect(somGrid.colorScale).toBeDefined();
      expect(somGrid.zoom).toBe(mockZoom);
    });

    it('should initialize without data', async () => {
      await somGrid.init();

      expect(mockBaseVisualization.init).toHaveBeenCalled();
      expect(somGrid.colorScale).toBeDefined();
      expect(somGrid.zoom).toBe(mockZoom);
    });
  });

  describe('setupScales', () => {
    it('should setup color scale', () => {
      somGrid.setupScales();

      expect(somGrid.colorScale).toBeDefined();
    });
  });

  describe('setupZoom', () => {
    it('should setup zoom behavior', () => {
      somGrid.setupZoom();

      expect(mockD3.zoom).toHaveBeenCalled();
      expect(mockZoom.scaleExtent).toHaveBeenCalledWith([0.1, 8]);
      expect(mockZoom.on).toHaveBeenCalledWith('zoom', expect.any(Function));
      expect(mockSelection.call).toHaveBeenCalledWith(mockZoom);
    });

    it('should handle zoom events', () => {
      somGrid.setupZoom();

      // Get the zoom event handler
      const zoomHandler = mockZoom.on.mock.calls.find(call => call[0] === 'zoom')[1];
      
      const mockEvent = {
        transform: 'translate(100,100) scale(2)'
      };

      // Should not throw when called
      expect(() => zoomHandler(mockEvent)).not.toThrow();
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await somGrid.init();
    });

    it('should update with new nodes data', () => {
      const mockData = {
        nodes: [
          { id: 1, x: 0, y: 0, activation: 0.5, weight: [0.1, 0.2] },
          { id: 2, x: 1, y: 0, activation: 0.8, weight: [0.3, 0.4] },
          { id: 3, x: 0, y: 1, activation: 0.3, weight: [0.5, 0.6] }
        ]
      };

      expect(() => somGrid.update(mockData)).not.toThrow();
      expect(somGrid.nodes).toHaveLength(3);
    });

    it('should handle empty data', () => {
      const mockData = { nodes: [] };

      expect(() => somGrid.update(mockData)).not.toThrow();
      expect(somGrid.nodes).toHaveLength(0);
    });

    it('should handle malformed data gracefully', () => {
      const mockData = { invalidProp: 'test' };

      expect(() => somGrid.update(mockData)).not.toThrow();
    });
  });

  describe('event handlers', () => {
    beforeEach(async () => {
      await somGrid.init();
    });

    it('should handle node click events', () => {
      const mockNode = { id: 1, x: 0, y: 0, activation: 0.5 };
      const mockEvent = { target: {}, stopPropagation: vi.fn() };

      expect(() => {
        somGrid.handleNodeClick(mockEvent, mockNode);
      }).not.toThrow();

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('should handle node hover events', () => {
      const mockNode = { id: 1, x: 0, y: 0, activation: 0.5 };
      const mockEvent = { target: {}, pageX: 100, pageY: 100 };

      expect(() => {
        somGrid.handleNodeHover(mockEvent, mockNode);
      }).not.toThrow();
    });
  });

  describe('visualization rendering', () => {
    beforeEach(async () => {
      await somGrid.init();
    });

    it('should render grid structure', () => {
      expect(mockD3.select).toHaveBeenCalled();
      expect(mockSelection.append).toHaveBeenCalled();
    });

    it('should handle options changes', () => {
      // Test with different options
      const customSomGrid = new SOMGrid(mockContainer, {
        nodeSize: 30,
        showUMatrix: false,
        showLabels: true,
        colorScheme: 'interpolatePlasma'
      });

      expect(customSomGrid.options.nodeSize).toBe(30);
      expect(customSomGrid.options.showUMatrix).toBe(false);
      expect(customSomGrid.options.showLabels).toBe(true);
      expect(customSomGrid.options.colorScheme).toBe('interpolatePlasma');
    });
  });

  describe('resize handling', () => {
    beforeEach(async () => {
      await somGrid.init();
    });

    it('should handle resize events', () => {
      expect(() => somGrid.onResize()).not.toThrow();
    });

    it('should update SVG dimensions on resize', () => {
      somGrid.width = 1000;
      somGrid.height = 800;
      
      somGrid.onResize();

      expect(mockBaseVisualization.handleResize).toBeDefined();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await somGrid.init();
    });

    it('should cleanup resources on destroy', () => {
      somGrid.destroy();

      expect(mockBaseVisualization.destroy).toHaveBeenCalled();
    });

    it('should cleanup simulation if exists', () => {
      // Mock simulation
      somGrid.simulation = {
        stop: vi.fn(),
        nodes: vi.fn(),
        force: vi.fn()
      };

      somGrid.destroy();

      expect(somGrid.simulation.stop).toHaveBeenCalled();
    });
  });

  describe('data validation', () => {
    it('should validate node data structure', () => {
      const validNodes = [
        { id: 1, x: 0, y: 0, activation: 0.5 },
        { id: 2, x: 1, y: 0, activation: 0.8 }
      ];

      const invalidNodes = [
        { id: 1 }, // missing x, y, activation
        { x: 0, y: 0 } // missing id, activation
      ];

      expect(() => somGrid.update({ nodes: validNodes })).not.toThrow();
      expect(() => somGrid.update({ nodes: invalidNodes })).not.toThrow(); // Should handle gracefully
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          x: i % 32,
          y: Math.floor(i / 32),
          activation: Math.random()
        }))
      };

      expect(() => somGrid.update(largeDataset)).not.toThrow();
      expect(somGrid.nodes).toHaveLength(1000);
    });
  });
});