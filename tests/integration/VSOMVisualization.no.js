import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { VSOMVisualization } from '../../src/frontend/js/components/vsom/VSOMVisualization.js';
import { SOMGrid } from '../../src/frontend/js/components/vsom/SOMGrid/SOMGrid.js';

// Set up JSDOM for testing DOM manipulation
const { window } = new JSDOM('<!DOCTYPE html><div id="test-container"></div>');
global.document = window.document;
global.window = window;

// Mock child components
vi.mock('../../src/frontend/js/components/vsom/SOMGrid/SOMGrid.js', () => ({
  SOMGrid: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(),
    update: vi.fn().mockResolvedValue(),
    destroy: vi.fn(),
    handleResize: vi.fn()
  }))
}));

describe('VSOMVisualization Integration', () => {
  let container;
  let vsom;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Set up container
    container = document.getElementById('test-container');
    container.innerHTML = '';
    
    // Create a new instance for each test
    vsom = new VSOMVisualization(container, {
      logLevel: 'silent',
      onError: vi.fn()
    });
  });
  
  afterEach(() => {
    // Clean up
    if (vsom) {
      vsom.destroy();
    }
  });
  
  describe('Initialization', () => {
    it('should create a container with the correct structure', async () => {
      await vsom.init();
      
      // Check container structure
      const vizContainer = container.firstChild;
      expect(vizContainer.classList.contains('vsom-visualization')).toBe(true);
      
      // Check if loading and error elements are present
      expect(vizContainer.querySelector('.vsom-loading')).not.toBeNull();
      expect(vizContainer.querySelector('.vsom-error')).not.toBeNull();
      
      // Check if the main visualization container is present
      expect(vizContainer.querySelector('.vsom-content')).not.toBeNull();
    });
    
    it('should initialize with the default visualization type', async () => {
      await vsom.init();
      
      // Default visualization should be 'grid'
      expect(SOMGrid).toHaveBeenCalled();
    });
  });
  
  describe('Visualization Switching', () => {
    it('should switch between visualization types', async () => {
      await vsom.init();
      
      // Mock the visualization modules
      const mockTrainingViz = {
        init: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue(),
        destroy: vi.fn()
      };
      
      // Mock dynamic import for the training visualization
      vi.doMock('../../src/frontend/js/components/vsom/TrainingViz/TrainingViz.js', () => ({
        TrainingViz: vi.fn(() => mockTrainingViz)
      }));
      
      // Switch to training visualization
      await vsom.setVisualizationType('training');
      
      // Check if the previous visualization was destroyed
      const somGridInstance = SOMGrid.mock.results[0].value;
      expect(somGridInstance.destroy).toHaveBeenCalled();
      
      // Check if the new visualization was initialized
      expect(mockTrainingViz.init).toHaveBeenCalled();
    });
  });
  
  describe('Data Updates', () => {
    it('should pass data to the current visualization', async () => {
      await vsom.init();
      
      const testData = {
        nodes: [
          { id: 'node1', x: 0, y: 0, activation: 0.5 },
          { id: 'node2', x: 1, y: 0, activation: 0.7 }
        ]
      };
      
      await vsom.update(testData);
      
      const somGridInstance = SOMGrid.mock.results[0].value;
      expect(somGridInstance.update).toHaveBeenCalledWith(testData);
    });
  });
  
  describe('Resize Handling', () => {
    it('should handle window resize events', async () => {
      await vsom.init();
      
      // Trigger resize
      window.dispatchEvent(new Event('resize'));
      
      const somGridInstance = SOMGrid.mock.results[0].value;
      expect(somGridInstance.handleResize).toHaveBeenCalled();
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up resources when destroyed', async () => {
      await vsom.init();
      vsom.destroy();
      
      const somGridInstance = SOMGrid.mock.results[0].value;
      expect(somGridInstance.destroy).toHaveBeenCalled();
      
      // Check if event listeners are removed
      window.dispatchEvent(new Event('resize'));
      expect(somGridInstance.handleResize).toHaveBeenCalledTimes(0);
    });
  });
});
