import log from 'loglevel';
import { VSOMVisualization } from '../components/vsom/VSOMVisualization.js';
import { vsomService } from '../services/VSOMService.js';

/**
 * Controller for the VSOM tab
 */
class VSOMController {
  constructor() {
    this.logger = log.getLogger('vsom:controller');
    this.vsom = null;
    this.currentTab = 'som-grid';
    this.initialized = false;
    this.currentInstanceId = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.setupEventListeners = this.setupEventListeners.bind(this);
    this.handleTabChange = this.handleTabChange.bind(this);
    this.loadSOMGrid = this.loadSOMGrid.bind(this);
    this.startTraining = this.startTraining.bind(this);
    this.stopTraining = this.stopTraining.bind(this);
    this.loadFeatureMaps = this.loadFeatureMaps.bind(this);
    this.loadClusters = this.loadClusters.bind(this);
    this.loadData = this.loadData.bind(this);
  }

  /**
   * Initialize the VSOM controller
   */
  async init() {
    if (this.initialized) {
      this.logger.debug('VSOMController already initialized');
      return;
    }
    
    this.logger.debug('Initializing VSOMController');
    
    // Initialize the VSOM visualization - use existing sub-containers
    const container = document.getElementById('som-grid-container');
    if (!container) {
      this.logger.error('SOM grid container element not found');
      return;
    }
    
    try {
      this.vsom = new VSOMVisualization(container, {
        logLevel: 'debug',
        onError: (error) => {
          this.logger.error('VSOM error:', error);
          this.showError(error.message || 'An error occurred');
        }
      });
      
      await this.vsom.init();
      this.setupEventListeners();
      this.initialized = true;
      this.logger.info('VSOMController initialized');
      
      // Load initial tab
      this.handleTabChange({ target: document.querySelector('[data-inner-tab="som-grid"]') });
      
    } catch (error) {
      this.logger.error('Failed to initialize VSOMController:', error);
      this.showError('Failed to initialize VSOM visualization');
    }
  }

  /**
   * Set up event listeners for the VSOM tab
   */
  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.vsom-tabs .tab-inner-btn').forEach(btn => {
      btn.addEventListener('click', this.handleTabChange);
    });
    
    // Training controls
    const startBtn = document.getElementById('start-som-training');
    const stopBtn = document.getElementById('stop-som-training');
    
    if (startBtn) startBtn.addEventListener('click', this.startTraining);
    if (stopBtn) stopBtn.addEventListener('click', this.stopTraining);
    
    // Load buttons
    const loadDataBtn = document.getElementById('load-som-data');
    const loadGridBtn = document.getElementById('load-som-grid');
    const loadFeaturesBtn = document.getElementById('load-som-features');
    const loadClustersBtn = document.getElementById('load-som-clusters');
    
    if (loadDataBtn) loadDataBtn.addEventListener('click', this.loadData);
    if (loadGridBtn) loadGridBtn.addEventListener('click', this.loadSOMGrid);
    if (loadFeaturesBtn) loadFeaturesBtn.addEventListener('click', this.loadFeatureMaps);
    if (loadClustersBtn) loadClustersBtn.addEventListener('click', this.loadClusters);
    
    // Window resize
    window.addEventListener('resize', () => {
      if (this.vsom) {
        this.vsom.handleResize();
      }
    });
  }

  /**
   * Handle tab changes
   * @param {Event} event - The click event
   */
  handleTabChange(event) {
    const tabId = event.target.getAttribute('data-inner-tab');
    if (!tabId) return;
    
    this.logger.debug(`Switching to tab: ${tabId}`);
    
    // Update active tab UI
    document.querySelectorAll('.vsom-tabs .tab-inner-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Hide all tab content
    document.querySelectorAll('.vsom-tabs .inner-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Show selected tab content
    const content = document.getElementById(tabId);
    if (content) {
      content.classList.add('active');
    }
    
    // Load data for the selected tab
    this.currentTab = tabId;
    switch (tabId) {
      case 'som-grid':
        this.loadSOMGrid();
        break;
      case 'som-features':
        this.loadFeatureMaps();
        break;
      case 'som-clusters':
        this.loadClusters();
        break;
    }
  }

  /**
   * Load and display the SOM grid
   */
  async loadSOMGrid() {
    if (!this.vsom) return;
    
    try {
      this.showLoading('Loading SOM grid...');
      
      // Get SOM state from the server
      const state = await vsomService.getGridState();
      
      // Transform data for visualization
      const nodes = state.nodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y,
        activation: node.activation,
        weight: node.weight,
        metadata: node.metadata || {}
      }));
      
      // Update the visualization
      await this.vsom.setVisualizationType('grid');
      await this.vsom.update({ nodes });
      
      this.hideLoading();
    } catch (error) {
      this.logger.error('Failed to load SOM grid:', error);
      this.showError('Failed to load SOM grid: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Start SOM training
   */
  async startTraining() {
    if (!this.vsom) return;
    
    try {
      this.showLoading('Starting training...');
      
      // Get training data (this would come from your application state)
      const trainingData = []; // TODO: Get actual training data
      
      if (!trainingData || trainingData.length === 0) {
        throw new Error('No training data available');
      }
      
      // Start training
      await vsomService.train(trainingData, {
        epochs: 100,
        batchSize: 32,
        learningRateDecay: 0.99,
        radiusDecay: 0.99
      });
      
      // Enable/disable controls
      document.getElementById('start-som-training').disabled = true;
      document.getElementById('stop-som-training').disabled = false;
      
      this.hideLoading();
    } catch (error) {
      this.logger.error('Failed to start training:', error);
      this.showError('Failed to start training: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Stop SOM training
   */
  async stopTraining() {
    try {
      this.showLoading('Stopping training...');
      
      await vsomService.stopTraining();
      
      // Enable/disable controls
      document.getElementById('start-som-training').disabled = false;
      document.getElementById('stop-som-training').disabled = true;
      
      this.hideLoading();
    } catch (error) {
      this.logger.error('Failed to stop training:', error);
      this.showError('Failed to stop training: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Load and display feature maps
   */
  async loadFeatureMaps() {
    if (!this.vsom) return;
    
    try {
      this.showLoading('Loading feature maps...');
      
      // Get feature maps from the server
      const featureMaps = await vsomService.getFeatureMaps();
      
      // Update the visualization
      await this.vsom.setVisualizationType('featureMaps');
      await this.vsom.update({ featureMaps });
      
      this.hideLoading();
    } catch (error) {
      this.logger.error('Failed to load feature maps:', error);
      this.showError('Failed to load feature maps: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Load and display clusters
   */
  async loadClusters() {
    if (!this.vsom) return;
    
    try {
      this.showLoading('Loading clusters...');
      
      // Get clusters from the server
      const clusters = await vsomService.cluster({
        method: 'kmeans',
        params: { k: 5 }
      });
      
      // Update the visualization
      await this.vsom.setVisualizationType('clustering');
      await this.vsom.update({ clusters });
      
      this.hideLoading();
    } catch (error) {
      this.logger.error('Failed to load clusters:', error);
      this.showError('Failed to load clusters: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Show loading indicator
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    const loadingEl = document.getElementById('vsom-loading');
    if (loadingEl) {
      loadingEl.textContent = message;
      loadingEl.style.display = 'block';
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loadingEl = document.getElementById('vsom-loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  /**
   * Load data into VSOM
   */
  async loadData() {
    try {
      this.showLoading('Loading data into VSOM...');
      
      // Create a simple data input dialog
      const dataInput = prompt(
        'Enter data in JSON format:\n\n' +
        'Example formats:\n' +
        '1. Entities: {"type":"entities","entities":[{"uri":"http://example.org/e1","content":"text","type":"concept"}]}\n' +
        '2. SPARQL: {"type":"sparql","endpoint":"http://localhost:3030/dataset/query","query":"SELECT * WHERE {?s ?p ?o} LIMIT 10"}\n' +
        '3. Sample data: {"type":"sample","count":50}'
      );
      
      if (!dataInput) {
        this.hideLoading();
        return;
      }
      
      let data;
      try {
        data = JSON.parse(dataInput);
      } catch (parseError) {
        throw new Error('Invalid JSON format: ' + parseError.message);
      }
      
      // For now, create mock data for testing visualization
      let processedData;
      
      if (data.type === 'sample') {
        // Generate simple mock data for testing
        const count = data.count || 50;
        processedData = this.generateMockSOMData(count);
      } else {
        // For other data types, we'll implement later
        throw new Error('Only sample data is currently supported for VSOM visualization testing');
      }

      // For now, mock a successful result to test the visualization
      const result = {
        success: true,
        message: `Loaded ${processedData.nodes.length} nodes into VSOM grid`,
        data: processedData
      };
      
      this.hideLoading();
      
      // Show success message
      const successMsg = `Data loaded successfully! ${result.message || ''}`;
      this.logger.info(successMsg);
      
      // Store the data for visualization
      this.vsomData = result.data;
      
      // Update the visualization with the loaded data
      if (this.vsom && result.data) {
        await this.vsom.update(result.data);
      }
      
      // Update UI elements
      this.updateDataInfo(result.data);
      
    } catch (error) {
      this.logger.error('Failed to load data:', error);
      this.showError('Failed to load data: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorEl = document.getElementById('vsom-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
    
    this.hideLoading();
  }

  /**
   * Generate mock SOM data for testing visualization
   * @param {number} count - Number of nodes to generate
   * @returns {Object} Mock SOM data with nodes
   */
  generateMockSOMData(count) {
    const nodes = [];
    const gridSize = Math.ceil(Math.sqrt(count));
    
    for (let i = 0; i < count; i++) {
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      
      nodes.push({
        id: `node-${i}`,
        x: x,
        y: y,
        activation: Math.random(),
        weight: Math.random(),
        bmuCount: Math.floor(Math.random() * 10),
        metadata: {
          topic: `Topic ${i % 10}`,
          content: `Sample content for node ${i}`
        }
      });
    }
    
    return {
      nodes: nodes,
      gridSize: gridSize,
      metadata: {
        nodeCount: count,
        generated: new Date().toISOString()
      }
    };
  }

  /**
   * Update data info display
   * @param {Object} data - VSOM data
   */
  updateDataInfo(data) {
    const entityCountEl = document.getElementById('som-entity-count');
    const gridSizeEl = document.getElementById('som-grid-size');
    const trainedStatusEl = document.getElementById('som-trained-status');
    
    if (entityCountEl && data.nodes) {
      entityCountEl.textContent = data.nodes.length;
    }
    
    if (gridSizeEl && data.gridSize) {
      gridSizeEl.textContent = `${data.gridSize}x${data.gridSize}`;
    }
    
    if (trainedStatusEl) {
      trainedStatusEl.textContent = 'No (Mock Data)';
    }
  }
}

// Export class and singleton instance
export { VSOMController };
export const vsomController = new VSOMController();

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => vsomController.init());
} else {
  vsomController.init();
}
