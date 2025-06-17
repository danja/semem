import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock loglevel
vi.mock('loglevel', () => ({
  default: {
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }))
  }
}));

// Mock BaseVisualization
const mockBaseVisualization = {
  init: vi.fn().mockResolvedValue(),
  handleResize: vi.fn(),
  destroy: vi.fn()
};

vi.mock('../../../../../src/frontend/js/components/vsom/BaseVisualization.js', () => ({
  BaseVisualization: vi.fn(() => mockBaseVisualization)
}));

// Mock visualization modules
const mockSOMGrid = {
  init: vi.fn().mockResolvedValue(),
  update: vi.fn(),
  handleResize: vi.fn(),
  destroy: vi.fn()
};

const mockTrainingViz = {
  init: vi.fn().mockResolvedValue(),
  update: vi.fn(),
  handleResize: vi.fn(),
  destroy: vi.fn()
};

const mockFeatureMaps = {
  init: vi.fn().mockResolvedValue(),
  update: vi.fn(),
  handleResize: vi.fn(),
  destroy: vi.fn()
};

const mockClustering = {
  init: vi.fn().mockResolvedValue(),
  update: vi.fn(),
  handleResize: vi.fn(),
  destroy: vi.fn()
};

// Mock dynamic imports
vi.mock('../../../../../src/frontend/js/components/vsom/SOMGrid/SOMGrid.js', () => ({
  SOMGrid: vi.fn(() => mockSOMGrid)
}));

vi.mock('../../../../../src/frontend/js/components/vsom/TrainingViz/TrainingViz.js', () => ({
  TrainingViz: vi.fn(() => mockTrainingViz)
}));

vi.mock('../../../../../src/frontend/js/components/vsom/FeatureMaps/FeatureMaps.js', () => ({
  FeatureMaps: vi.fn(() => mockFeatureMaps)
}));

vi.mock('../../../../../src/frontend/js/components/vsom/Clustering/Clustering.js', () => ({
  Clustering: vi.fn(() => mockClustering)
}));

import { VSOMVisualization } from '../../../../../src/frontend/js/components/vsom/VSOMVisualization.js';

describe('VSOMVisualization', () => {
  let visualization;
  let mockContainer;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock container
    mockContainer = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      innerHTML: '',
      style: {}
    };

    // Create visualization instance
    visualization = new VSOMVisualization(mockContainer, {
      logLevel: 'debug',
      visualizationType: 'grid'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(visualization.container).toBe(mockContainer);
      expect(visualization.options.visualizationType).toBe('grid');
      expect(visualization.options.logLevel).toBe('debug');
      expect(visualization.visualization).toBeNull();
      expect(visualization.currentVisualizationType).toBeNull();
    });

    it('should register visualization types', () => {
      expect(visualization.visualizationTypes.size).toBe(4);
      expect(visualization.visualizationTypes.has('grid')).toBe(true);
      expect(visualization.visualizationTypes.has('training')).toBe(true);
      expect(visualization.visualizationTypes.has('featureMaps')).toBe(true);
      expect(visualization.visualizationTypes.has('clustering')).toBe(true);
    });
  });

  describe('init', () => {
    it('should initialize with default visualization type', async () => {
      const mockData = { nodes: [] };
      
      await visualization.init(mockData);

      expect(mockBaseVisualization.init).toHaveBeenCalledWith(mockData);
      expect(visualization.currentVisualizationType).toBe('grid');
      expect(mockSOMGrid.init).toHaveBeenCalledWith(mockData);
    });
  });

  describe('setVisualizationType', () => {
    it('should set grid visualization type', async () => {
      const mockData = { nodes: [{ id: 1, x: 0, y: 0 }] };

      await visualization.setVisualizationType('grid', mockData);

      expect(visualization.currentVisualizationType).toBe('grid');
      expect(mockSOMGrid.init).toHaveBeenCalledWith(mockData);
    });

    it('should set training visualization type', async () => {
      const mockData = { epochs: 100 };

      await visualization.setVisualizationType('training', mockData);

      expect(visualization.currentVisualizationType).toBe('training');
      expect(mockTrainingViz.init).toHaveBeenCalledWith(mockData);
    });

    it('should set featureMaps visualization type', async () => {
      const mockData = { features: [[0.1, 0.2, 0.3]] };

      await visualization.setVisualizationType('featureMaps', mockData);

      expect(visualization.currentVisualizationType).toBe('featureMaps');
      expect(mockFeatureMaps.init).toHaveBeenCalledWith(mockData);
    });

    it('should set clustering visualization type', async () => {
      const mockData = { clusters: [{ id: 1, centroid: [0.5, 0.5] }] };

      await visualization.setVisualizationType('clustering', mockData);

      expect(visualization.currentVisualizationType).toBe('clustering');
      expect(mockClustering.init).toHaveBeenCalledWith(mockData);
    });

    it('should not reinitialize if same type is set', async () => {
      // First set the type
      await visualization.setVisualizationType('grid');
      vi.clearAllMocks();

      // Try to set the same type again
      await visualization.setVisualizationType('grid');

      expect(mockSOMGrid.init).not.toHaveBeenCalled();
    });

    it('should destroy current visualization before setting new type', async () => {
      // Set initial visualization
      await visualization.setVisualizationType('grid');
      
      // Set different visualization
      await visualization.setVisualizationType('training');

      expect(mockSOMGrid.destroy).toHaveBeenCalled();
      expect(mockTrainingViz.init).toHaveBeenCalled();
    });

    it('should throw error for unknown visualization type', async () => {
      await expect(
        visualization.setVisualizationType('unknown')
      ).rejects.toThrow('Unknown visualization type: unknown');

      expect(visualization.currentVisualizationType).toBeNull();
    });

    it('should handle visualization initialization errors', async () => {
      mockSOMGrid.init.mockRejectedValue(new Error('Init failed'));

      await expect(
        visualization.setVisualizationType('grid')
      ).rejects.toThrow('Init failed');

      expect(visualization.currentVisualizationType).toBeNull();
    });
  });

  describe('update', () => {
    it('should update current visualization with new data', async () => {
      const mockData = { nodes: [{ id: 1, x: 0, y: 0 }] };
      
      await visualization.setVisualizationType('grid');
      visualization.update(mockData);

      expect(mockSOMGrid.update).toHaveBeenCalledWith(mockData);
    });

    it('should warn if no active visualization to update', () => {
      const mockData = { nodes: [] };
      
      visualization.update(mockData);

      // Should not throw error, just log warning
      expect(mockSOMGrid.update).not.toHaveBeenCalled();
    });
  });

  describe('handleResize', () => {
    it('should call resize on base and current visualization', async () => {
      await visualization.setVisualizationType('grid');
      
      visualization.handleResize();

      expect(mockBaseVisualization.handleResize).toHaveBeenCalled();
      expect(mockSOMGrid.handleResize).toHaveBeenCalled();
    });

    it('should only call base resize if no current visualization', () => {
      visualization.handleResize();

      expect(mockBaseVisualization.handleResize).toHaveBeenCalled();
      expect(mockSOMGrid.handleResize).not.toHaveBeenCalled();
    });

    it('should handle visualization without handleResize method', async () => {
      // Create mock without handleResize
      const mockVizWithoutResize = {
        init: vi.fn().mockResolvedValue(),
        update: vi.fn(),
        destroy: vi.fn()
      };
      
      vi.mocked(mockSOMGrid).mockReturnValue(mockVizWithoutResize);
      await visualization.setVisualizationType('grid');
      
      // Should not throw error
      expect(() => visualization.handleResize()).not.toThrow();
      expect(mockBaseVisualization.handleResize).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy current visualization and call super.destroy', async () => {
      await visualization.setVisualizationType('grid');
      
      visualization.destroy();

      expect(mockSOMGrid.destroy).toHaveBeenCalled();
      expect(visualization.visualization).toBeNull();
      expect(mockBaseVisualization.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when no current visualization', () => {
      expect(() => visualization.destroy()).not.toThrow();
      expect(mockBaseVisualization.destroy).toHaveBeenCalled();
    });
  });

  describe('getter methods', () => {
    it('should return current visualization instance', async () => {
      expect(visualization.getCurrentVisualization()).toBeNull();

      await visualization.setVisualizationType('grid');
      expect(visualization.getCurrentVisualization()).toBe(mockSOMGrid);
    });

    it('should return current visualization type', async () => {
      expect(visualization.getCurrentVisualizationType()).toBeNull();

      await visualization.setVisualizationType('training');
      expect(visualization.getCurrentVisualizationType()).toBe('training');
    });

    it('should return available visualization types', () => {
      const types = visualization.getAvailableVisualizationTypes();
      expect(types).toEqual(['grid', 'training', 'featureMaps', 'clustering']);
    });
  });

  describe('error handling', () => {
    it('should handle module loading errors', async () => {
      // Mock import to fail
      vi.doMock('../../../../../src/frontend/js/components/vsom/SOMGrid/SOMGrid.js', () => {
        throw new Error('Module load failed');
      });

      await expect(
        visualization.setVisualizationType('grid')
      ).rejects.toThrow('Module load failed');
    });

    it('should clean up properly on initialization failure', async () => {
      mockSOMGrid.init.mockRejectedValue(new Error('Init failed'));

      await expect(
        visualization.setVisualizationType('grid')
      ).rejects.toThrow('Init failed');

      expect(visualization.currentVisualizationType).toBeNull();
      expect(visualization.visualization).toBeNull();
    });
  });

  describe('visualization lifecycle', () => {
    it('should support switching between different visualization types', async () => {
      // Start with grid
      await visualization.setVisualizationType('grid', { nodes: [] });
      expect(visualization.currentVisualizationType).toBe('grid');

      // Switch to training
      await visualization.setVisualizationType('training', { epochs: 100 });
      expect(mockSOMGrid.destroy).toHaveBeenCalled();
      expect(visualization.currentVisualizationType).toBe('training');

      // Switch to clustering
      await visualization.setVisualizationType('clustering', { clusters: [] });
      expect(mockTrainingViz.destroy).toHaveBeenCalled();
      expect(visualization.currentVisualizationType).toBe('clustering');
    });

    it('should pass options to child visualizations', async () => {
      const customOptions = {
        logLevel: 'info',
        customOption: 'test'
      };

      const viz = new VSOMVisualization(mockContainer, customOptions);
      await viz.setVisualizationType('grid');

      // Check that the visualization was created with merged options
      expect(mockSOMGrid.init).toHaveBeenCalled();
    });
  });
});