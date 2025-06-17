import log from 'loglevel';
import { BaseVisualization } from './BaseVisualization';

/**
 * Main VSOM visualization component
 * Manages different visualization types and their lifecycle
 */
export class VSOMVisualization extends BaseVisualization {
  constructor(container, options = {}) {
    const defaultOptions = {
      visualizationType: 'grid', // 'grid', 'training', 'featureMaps', 'clustering'
      logLevel: 'debug',
      apiEndpoint: '/api/vsom',
      ...options
    };
    
    super(container, defaultOptions);
    
    this.visualization = null;
    this.visualizationTypes = new Map();
    this.currentVisualizationType = null;
    
    // Register visualization types (will be lazy-loaded)
    this.registerVisualizationTypes();
  }

  /**
   * Register available visualization types
   * @private
   */
  registerVisualizationTypes() {
    this.visualizationTypes.set('grid', {
      name: 'SOM Grid',
      load: () => import('./SOMGrid/SOMGrid').then(m => m.SOMGrid)
    });
    
    this.visualizationTypes.set('training', {
      name: 'Training',
      load: () => import('./TrainingViz/TrainingViz').then(m => m.TrainingViz)
    });
    
    this.visualizationTypes.set('featureMaps', {
      name: 'Feature Maps',
      load: () => import('./FeatureMaps/FeatureMaps').then(m => m.FeatureMaps)
    });
    
    this.visualizationTypes.set('clustering', {
      name: 'Clustering',
      load: () => import('./Clustering/Clustering').then(m => m.Clustering)
    });
    
    this.logger.debug('Registered visualization types:', [...this.visualizationTypes.keys()]);
  }

  /**
   * Initialize the visualization
   * @param {Object} data - Initial data
   */
  async init(data) {
    this.logger.debug('Initializing VSOM visualization');
    await super.init(data);
    await this.setVisualizationType(this.options.visualizationType, data);
  }

  /**
   * Set the current visualization type
   * @param {string} type - Visualization type to set
   * @param {Object} data - Data for the visualization
   */
  async setVisualizationType(type, data = {}) {
    if (this.currentVisualizationType === type) {
      this.logger.debug(`Visualization type already set to ${type}`);
      return;
    }

    if (!this.visualizationTypes.has(type)) {
      const error = new Error(`Unknown visualization type: ${type}`);
      this.logger.error(error.message, { availableTypes: [...this.visualizationTypes.keys()] });
      throw error;
    }

    this.logger.info(`Setting visualization type to: ${type}`);
    
    // Clean up current visualization
    if (this.visualization) {
      this.logger.debug('Destroying current visualization');
      this.visualization.destroy();
      this.visualization = null;
    }

    try {
      // Load the visualization module
      const visType = this.visualizationTypes.get(type);
      this.logger.debug(`Loading visualization module: ${visType.name}`);
      
      const VisualizationClass = await visType.load();
      this.visualization = new VisualizationClass(this.container, {
        ...this.options,
        logLevel: this.options.logLevel
      });
      
      this.currentVisualizationType = type;
      this.logger.debug(`Initializing ${visType.name} visualization`);
      
      await this.visualization.init(data);
      this.logger.info(`Successfully initialized ${visType.name} visualization`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize visualization type ${type}:`, error);
      this.currentVisualizationType = null;
      throw error;
    }
  }

  /**
   * Update the visualization with new data
   * @param {Object} data - New data
   */
  update(data) {
    if (!this.visualization) {
      this.logger.warn('No active visualization to update');
      return;
    }
    
    this.logger.debug('Updating visualization with new data');
    this.visualization.update(data);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    super.handleResize();
    if (this.visualization && typeof this.visualization.handleResize === 'function') {
      this.visualization.handleResize();
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.logger.debug('Destroying VSOM visualization');
    if (this.visualization) {
      this.visualization.destroy();
      this.visualization = null;
    }
    super.destroy();
  }

  /**
   * Get the current visualization instance
   * @returns {BaseVisualization|null} Current visualization instance
   */
  getCurrentVisualization() {
    return this.visualization;
  }

  /**
   * Get the current visualization type
   * @returns {string|null} Current visualization type
   */
  getCurrentVisualizationType() {
    return this.currentVisualizationType;
  }

  /**
   * Get available visualization types
   * @returns {Array} List of available visualization types
   */
  getAvailableVisualizationTypes() {
    return [...this.visualizationTypes.keys()];
  }
}
