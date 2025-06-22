import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock loglevel
vi.mock('loglevel', () => ({
  default: {
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    }))
  }
}));

// Mock VSOMVisualization before importing
const mockVSOMVisualization = {
  init: vi.fn().mockResolvedValue(),
  setVisualizationType: vi.fn().mockResolvedValue(),
  update: vi.fn().mockResolvedValue(),
  handleResize: vi.fn()
};

vi.mock('../../../src/frontend/js/components/vsom/VSOMVisualization.js', () => ({
  VSOMVisualization: vi.fn(() => mockVSOMVisualization)
}));

// Mock VSOMService
const mockVSOMService = {
  getGridState: vi.fn(),
  train: vi.fn(),
  stopTraining: vi.fn(),
  getFeatureMaps: vi.fn(),
  cluster: vi.fn()
};

vi.mock('../../../src/frontend/js/services/VSOMService.js', () => ({
  vsomService: mockVSOMService
}));

// Mock window and document objects
const mockWindow = {
  addEventListener: vi.fn()
};

const createMockElement = (id, extraProps = {}) => ({
  id,
  style: { display: 'none' },
  textContent: '',
  classList: {
    add: vi.fn(),
    remove: vi.fn()
  },
  addEventListener: vi.fn(),
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
  disabled: false,
  ...extraProps
});

const mockElements = {
  'vsom-container': createMockElement('vsom-container'),
  'vsom-loading': createMockElement('vsom-loading'),
  'vsom-error': createMockElement('vsom-error'),
  'start-som-training': createMockElement('start-som-training'),
  'stop-som-training': createMockElement('stop-som-training'),
  'load-som-grid': createMockElement('load-som-grid'),
  'load-som-features': createMockElement('load-som-features'),
  'load-som-clusters': createMockElement('load-som-clusters'),
  'som-grid': createMockElement('som-grid'),
  'som-features': createMockElement('som-features'),
  'som-clusters': createMockElement('som-clusters')
};

const mockDocument = {
  readyState: 'complete',
  addEventListener: vi.fn(),
  getElementById: vi.fn((id) => mockElements[id] || null),
  querySelector: vi.fn((selector) => {
    if (selector === '[data-inner-tab="som-grid"]') {
      const el = createMockElement('tab-som-grid');
      el.getAttribute = vi.fn(() => 'som-grid');
      return el;
    }
    return null;
  }),
  querySelectorAll: vi.fn(() => []),
  createElement: vi.fn(() => createMockElement('div'))
};

// Setup global mocks
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('document', mockDocument);

// Import after mocking
import { VSOMController } from '../../../src/frontend/js/controllers/VSOMController.js';

describe('VSOMController', () => {
  let controller;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    Object.values(mockElements).forEach(el => {
      if (el.style) el.style.display = 'none';
      if (el.textContent !== undefined) el.textContent = '';
      el.disabled = false;
    });
    
    // Create fresh controller instance
    controller = new VSOMController();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(controller.vsom).toBeNull();
      expect(controller.currentTab).toBe('som-grid');
      expect(controller.initialized).toBe(false);
    });
  });

  describe('init', () => {
    it('should initialize the VSOM visualization successfully', async () => {
      await controller.init();
      
      expect(mockDocument.getElementById).toHaveBeenCalledWith('vsom-container');
      expect(mockVSOMVisualization.init).toHaveBeenCalled();
      expect(controller.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      controller.initialized = true;
      
      await controller.init();
      
      expect(mockVSOMVisualization.init).not.toHaveBeenCalled();
    });

    it('should handle missing container element', async () => {
      mockDocument.getElementById.mockReturnValue(null);
      
      await controller.init();
      
      expect(controller.initialized).toBe(false);
    });

    it('should handle VSOM initialization errors', async () => {
      mockVSOMVisualization.init.mockRejectedValue(new Error('Init failed'));
      controller.showError = vi.fn();
      
      await controller.init();
      
      expect(controller.showError).toHaveBeenCalledWith('Failed to initialize VSOM visualization');
    });
  });

  describe('handleTabChange', () => {
    beforeEach(() => {
      controller.loadSOMGrid = vi.fn();
      controller.loadFeatureMaps = vi.fn();
      controller.loadClusters = vi.fn();
      
      // Mock tab elements returned by querySelectorAll
      const mockTabs = [
        createMockElement('tab1'),
        createMockElement('tab2')
      ];
      mockDocument.querySelectorAll.mockImplementation((selector) => {
        if (selector === '.vsom-tabs .tab-inner-btn') return mockTabs;
        if (selector === '.vsom-tabs .inner-tab-content') return [
          createMockElement('content1'),
          createMockElement('content2')
        ];
        return [];
      });
    });

    it('should switch to som-grid tab and load data', () => {
      const mockEvent = {
        target: {
          getAttribute: vi.fn(() => 'som-grid'),
          classList: { add: vi.fn() }
        }
      };

      controller.handleTabChange(mockEvent);

      expect(controller.currentTab).toBe('som-grid');
      expect(controller.loadSOMGrid).toHaveBeenCalled();
    });

    it('should switch to som-features tab and load data', () => {
      const mockEvent = {
        target: {
          getAttribute: vi.fn(() => 'som-features'),
          classList: { add: vi.fn() }
        }
      };

      controller.handleTabChange(mockEvent);

      expect(controller.currentTab).toBe('som-features');
      expect(controller.loadFeatureMaps).toHaveBeenCalled();
    });

    it('should switch to som-clusters tab and load data', () => {
      const mockEvent = {
        target: {
          getAttribute: vi.fn(() => 'som-clusters'),
          classList: { add: vi.fn() }
        }
      };

      controller.handleTabChange(mockEvent);

      expect(controller.currentTab).toBe('som-clusters');
      expect(controller.loadClusters).toHaveBeenCalled();
    });

    it('should handle missing data-inner-tab attribute', () => {
      const mockEvent = {
        target: {
          getAttribute: vi.fn(() => null)
        }
      };

      controller.handleTabChange(mockEvent);

      expect(controller.loadSOMGrid).not.toHaveBeenCalled();
    });
  });

  describe('loadSOMGrid', () => {
    beforeEach(() => {
      controller.vsom = mockVSOMVisualization;
      controller.showLoading = vi.fn();
      controller.hideLoading = vi.fn();
      controller.showError = vi.fn();
    });

    it('should load SOM grid successfully', async () => {
      const mockState = {
        nodes: [
          { id: 1, x: 0, y: 0, activation: 0.5, weight: 0.8 },
          { id: 2, x: 1, y: 0, activation: 0.3, weight: 0.6 }
        ]
      };
      mockVSOMService.getGridState.mockResolvedValue(mockState);

      await controller.loadSOMGrid();

      expect(controller.showLoading).toHaveBeenCalledWith('Loading SOM grid...');
      expect(mockVSOMService.getGridState).toHaveBeenCalled();
      expect(mockVSOMVisualization.setVisualizationType).toHaveBeenCalledWith('grid');
      expect(mockVSOMVisualization.update).toHaveBeenCalledWith({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 1, x: 0, y: 0 }),
          expect.objectContaining({ id: 2, x: 1, y: 0 })
        ])
      });
      expect(controller.hideLoading).toHaveBeenCalled();
    });

    it('should handle loadSOMGrid errors', async () => {
      mockVSOMService.getGridState.mockRejectedValue(new Error('Network error'));

      await controller.loadSOMGrid();

      expect(controller.showError).toHaveBeenCalledWith('Failed to load SOM grid: Network error');
    });

    it('should return early if vsom not initialized', async () => {
      controller.vsom = null;

      await controller.loadSOMGrid();

      expect(mockVSOMService.getGridState).not.toHaveBeenCalled();
    });
  });

  describe('startTraining', () => {
    beforeEach(() => {
      controller.vsom = mockVSOMVisualization;
      controller.showLoading = vi.fn();
      controller.hideLoading = vi.fn();
      controller.showError = vi.fn();
    });

    it('should handle no training data', async () => {
      await controller.startTraining();

      expect(controller.showError).toHaveBeenCalledWith('Failed to start training: No training data available');
    });
  });

  describe('stopTraining', () => {
    beforeEach(() => {
      controller.showLoading = vi.fn();
      controller.hideLoading = vi.fn();
      controller.showError = vi.fn();
    });

    it('should stop training successfully', async () => {
      mockVSOMService.stopTraining.mockResolvedValue();

      await controller.stopTraining();

      expect(controller.showLoading).toHaveBeenCalledWith('Stopping training...');
      expect(mockVSOMService.stopTraining).toHaveBeenCalled();
      expect(mockElements['start-som-training'].disabled).toBe(false);
      expect(mockElements['stop-som-training'].disabled).toBe(true);
      expect(controller.hideLoading).toHaveBeenCalled();
    });

    it('should handle stop training errors', async () => {
      mockVSOMService.stopTraining.mockRejectedValue(new Error('Stop failed'));

      await controller.stopTraining();

      expect(controller.showError).toHaveBeenCalledWith('Failed to stop training: Stop failed');
    });
  });

  describe('loadFeatureMaps', () => {
    beforeEach(() => {
      controller.vsom = mockVSOMVisualization;
      controller.showLoading = vi.fn();
      controller.hideLoading = vi.fn();
      controller.showError = vi.fn();
    });

    it('should load feature maps successfully', async () => {
      const mockFeatureMaps = [{ id: 1, features: [0.1, 0.2, 0.3] }];
      mockVSOMService.getFeatureMaps.mockResolvedValue(mockFeatureMaps);

      await controller.loadFeatureMaps();

      expect(mockVSOMService.getFeatureMaps).toHaveBeenCalled();
      expect(mockVSOMVisualization.setVisualizationType).toHaveBeenCalledWith('featureMaps');
      expect(mockVSOMVisualization.update).toHaveBeenCalledWith({ featureMaps: mockFeatureMaps });
    });
  });

  describe('loadClusters', () => {
    beforeEach(() => {
      controller.vsom = mockVSOMVisualization;
      controller.showLoading = vi.fn();
      controller.hideLoading = vi.fn();
      controller.showError = vi.fn();
    });

    it('should load clusters successfully', async () => {
      const mockClusters = [{ id: 1, centroid: [0.5, 0.5] }];
      mockVSOMService.cluster.mockResolvedValue(mockClusters);

      await controller.loadClusters();

      expect(mockVSOMService.cluster).toHaveBeenCalledWith({
        method: 'kmeans',
        params: { k: 5 }
      });
      expect(mockVSOMVisualization.setVisualizationType).toHaveBeenCalledWith('clustering');
      expect(mockVSOMVisualization.update).toHaveBeenCalledWith({ clusters: mockClusters });
    });
  });

  describe('UI helper methods', () => {
    it('should show loading with message', () => {
      controller.showLoading('Test loading');

      expect(mockElements['vsom-loading'].textContent).toBe('Test loading');
      expect(mockElements['vsom-loading'].style.display).toBe('block');
    });

    it('should hide loading', () => {
      controller.hideLoading();

      expect(mockElements['vsom-loading'].style.display).toBe('none');
    });

    it('should show error message and auto-hide', () => {
      vi.useFakeTimers();
      controller.hideLoading = vi.fn();

      controller.showError('Test error');

      expect(mockElements['vsom-error'].textContent).toBe('Test error');
      expect(mockElements['vsom-error'].style.display).toBe('block');
      expect(controller.hideLoading).toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(5000);
      expect(mockElements['vsom-error'].style.display).toBe('none');

      vi.useRealTimers();
    });
  });
});