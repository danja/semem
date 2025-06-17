import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vsomController } from '../../../src/frontend/js/controllers/VSOMController.js';

// Mock VSOMService
vi.mock('../../../src/frontend/js/services/VSOMService.js', () => ({
  vsomService: {
    getGridState: vi.fn(),
    train: vi.fn(),
    stopTraining: vi.fn(),
    getFeatureMaps: vi.fn(),
    cluster: vi.fn()
  }
}));

describe('VSOMController', () => {
  let controller;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create a fresh instance for each test
    controller = new (require('../../../src/frontend/js/controllers/VSOMController.js').VSOMController)();
    
    // Mock DOM elements
    document.body.innerHTML = `
      <div id="vsom-container"></div>
      <div id="vsom-loading"></div>
      <div id="vsom-error"></div>
      <button id="start-som-training"></button>
      <button id="stop-som-training"></button>
      <button id="load-som-grid"></button>
      <button id="load-som-features"></button>
      <button id="load-som-clusters"></button>
    `;
  });

  describe('init', () => {
    it('should initialize the VSOM visualization', async () => {
      // Mock VSOMVisualization
      const mockVSOM = {
        init: vi.fn().mockResolvedValue(),
        setVisualizationType: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue(),
        handleResize: vi.fn()
      };
      
      vi.mock('../../../src/frontend/js/components/vsom/VSOMVisualization.js', () => ({
        VSOMVisualization: vi.fn(() => mockVSOM)
      }));
      
      await controller.init();
      
      expect(mockVSOM.init).toHaveBeenCalled();
    });
  });

  describe('handleTabChange', () => {
    it('should switch between tabs and load appropriate data', async () => {
      // Mock tab elements
      const tab1 = document.createElement('button');
      tab1.setAttribute('data-inner-tab', 'som-grid');
      const tab2 = document.createElement('button');
      tab2.setAttribute('data-inner-tab', 'som-features');
      
      // Mock controller methods
      controller.loadSOMGrid = vi.fn();
      controller.loadFeatureMaps = vi.fn();
      
      // Test tab switching
      await controller.handleTabChange({ target: tab1 });
      expect(controller.loadSOMGrid).toHaveBeenCalled();
      
      await controller.handleTabChange({ target: tab2 });
      expect(controller.loadFeatureMaps).toHaveBeenCalled();
    });
  });

  // Add more test cases for other methods...
});
