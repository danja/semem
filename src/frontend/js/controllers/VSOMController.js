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
      this.logger.error('SOM grid container element not found - tab may not be loaded yet');
      // Try again in a moment
      setTimeout(() => this.init(), 500);
      return;
    }
    
    console.log('VSOM container found, proceeding with initialization');
    
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
    const loadDocQABtn = document.getElementById('load-docqa-data');
    const loadGridBtn = document.getElementById('load-som-grid');
    const loadFeaturesBtn = document.getElementById('load-som-features');
    const loadClustersBtn = document.getElementById('load-som-clusters');
    
    if (loadDataBtn) loadDataBtn.addEventListener('click', this.loadData);
    if (loadDocQABtn) {
      console.log('Found load-docqa-data button, adding event listener');
      loadDocQABtn.addEventListener('click', () => this.loadDocQAData());
    } else {
      console.error('load-docqa-data button not found!');
    }
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
   * Load Document-QA data from SPARQL store
   */
  async loadDocQAData() {
    try {
      console.log('Load Document-QA Data button clicked!');
      this.showLoading('Loading Document-QA data from SPARQL store...');
      
      // Create a dialog for document-qa specific options
      const options = this.createDocQAOptionsDialog();
      if (!options) {
        this.hideLoading();
        return;
      }
      
      // Call the new document-qa endpoint
      const response = await fetch('/api/vsom/load-docqa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'your-api-key'
        },
        body: JSON.stringify(options)
      });
      
      if (!response.ok) {
        // Try to get more details from the response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // Use the original error message if parsing fails
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to load document-qa data');
      }
      
      this.hideLoading();
      
      // Transform document-qa entities to VSOM grid format
      const vsomData = this.transformDocQAToVSOMGrid(result.entities, result.metadata);
      
      // Show success message
      const successMsg = `Document-QA data loaded successfully! Found ${result.entities.length} questions with embeddings`;
      this.logger.info(successMsg);
      
      // Store the data for visualization
      this.vsomData = vsomData;
      
      // Update the visualization with the loaded data and enable labels
      if (this.vsom && vsomData) {
        await this.vsom.setVisualizationType('grid');
        
        // Enable labels for document-qa data
        this.vsom.updateOptions({ 
          showLabels: true,
          nodeSize: 25  // Slightly larger nodes for better label visibility
        });
        
        await this.vsom.update(vsomData);
      }
      
      // Update UI elements
      this.updateDocQADataInfo(result.entities, result.metadata);
      
    } catch (error) {
      this.logger.error('Failed to load document-qa data:', error);
      this.showError('Failed to load document-qa data: ' + (error.message || 'Unknown error'));
    }
  }

  /**
   * Create document-qa options dialog
   */
  createDocQAOptionsDialog() {
    const dialogContent = `
      <div>
        <h3>Load Document-QA Data Options</h3>
        <div style="margin: 10px 0;">
          <label for="graph-uri">Graph URI:</label><br>
          <input type="text" id="graph-uri" value="http://tensegrity.it/semem" style="width: 400px;">
        </div>
        <div style="margin: 10px 0;">
          <label for="limit">Limit (questions):</label><br>
          <input type="number" id="limit" value="100" min="10" max="1000" style="width: 100px;">
        </div>
        <div style="margin: 10px 0;">
          <label for="processing-stage">Processing Stage Filter:</label><br>
          <select id="processing-stage" style="width: 200px;">
            <option value="">All Stages</option>
            <option value="processed">Processed</option>
            <option value="context-retrieved">Context Retrieved</option>
            <option value="answered">Answered</option>
          </select>
        </div>
        <div style="margin: 10px 0;">
          <label for="concept-filter">Concept Filter:</label><br>
          <input type="text" id="concept-filter" placeholder="e.g., artificial intelligence" style="width: 300px;">
        </div>
      </div>
    `;
    
    // Create modal dialog
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 5px; max-width: 500px; width: 90%;">
          ${dialogContent}
          <div style="margin-top: 20px; text-align: right;">
            <button id="dialog-cancel" style="margin-right: 10px;">Cancel</button>
            <button id="dialog-ok" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 3px;">Load Data</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    return new Promise((resolve) => {
      document.getElementById('dialog-ok').addEventListener('click', () => {
        const graphUri = document.getElementById('graph-uri').value;
        const limit = parseInt(document.getElementById('limit').value);
        const processingStage = document.getElementById('processing-stage').value;
        const conceptFilter = document.getElementById('concept-filter').value;
        
        document.body.removeChild(dialog);
        resolve({
          graphUri,
          limit,
          processingStage: processingStage || null,
          conceptFilter: conceptFilter || null
        });
      });
      
      document.getElementById('dialog-cancel').addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(null);
      });
    });
  }

  /**
   * Transform document-qa entities to VSOM grid format
   */
  transformDocQAToVSOMGrid(entities, metadata) {
    const gridSize = Math.ceil(Math.sqrt(entities.length));
    const nodes = [];
    
    entities.forEach((entity, index) => {
      const x = index % gridSize;
      const y = Math.floor(index / gridSize);
      
      // Get the primary concept for labeling
      const primaryConcept = entity.concepts && entity.concepts.length > 0 ? 
        entity.concepts[0] : 'question';
      
      nodes.push({
        id: `docqa-${index}`,
        x: x,
        y: y,
        activation: Math.random(), // Will be calculated during SOM training
        weight: Math.random(), // Will be calculated during SOM training
        bmuCount: 0,
        entity: entity, // Store the full entity data
        metadata: {
          topic: primaryConcept,
          content: entity.content,
          type: entity.type,
          concepts: entity.concepts,
          processingStage: entity.metadata?.processingStage,
          questionLength: entity.metadata?.questionLength,
          created: entity.metadata?.created
        }
      });
    });
    
    return {
      nodes: nodes,
      gridSize: gridSize,
      metadata: {
        nodeCount: entities.length,
        sourceType: 'document-qa',
        graphUri: metadata?.graphUri,
        processingStage: metadata?.processingStage,
        conceptFilter: metadata?.conceptFilter,
        extractedAt: metadata?.extractedAt
      }
    };
  }

  /**
   * Update data info display for document-qa data
   */
  updateDocQADataInfo(entities, metadata) {
    const entityCountEl = document.getElementById('som-entity-count');
    const gridSizeEl = document.getElementById('som-grid-size');
    const trainedStatusEl = document.getElementById('som-trained-status');
    
    if (entityCountEl) {
      entityCountEl.textContent = entities.length;
    }
    
    if (gridSizeEl) {
      const gridSize = Math.ceil(Math.sqrt(entities.length));
      gridSizeEl.textContent = `${gridSize}x${gridSize}`;
    }
    
    if (trainedStatusEl) {
      trainedStatusEl.textContent = 'Ready for Training';
    }
    
    // Show additional document-qa specific info
    const infoEl = document.getElementById('som-data-info');
    if (infoEl) {
      const conceptCounts = {};
      const stageCounts = {};
      
      entities.forEach(entity => {
        // Count concepts
        entity.concepts?.forEach(concept => {
          conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
        });
        
        // Count processing stages
        const stage = entity.metadata?.processingStage || 'unknown';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
      
      const topConcepts = Object.entries(conceptCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([concept, count]) => `${concept} (${count})`)
        .join(', ');
      
      const stageInfo = Object.entries(stageCounts)
        .map(([stage, count]) => `${stage}: ${count}`)
        .join(', ');
      
      infoEl.innerHTML = `
        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px;">
          <h4>Document-QA Data Summary</h4>
          <p><strong>Source:</strong> ${metadata?.graphUri || 'Unknown'}</p>
          <p><strong>Processing Stages:</strong> ${stageInfo}</p>
          <p><strong>Top Concepts:</strong> ${topConcepts || 'None'}</p>
          <p><strong>Loaded:</strong> ${metadata?.extractedAt || 'Unknown'}</p>
        </div>
      `;
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

// Auto-initialization is now handled by the VSOM feature module
// This allows for proper timing when the VSOM tab is accessed
