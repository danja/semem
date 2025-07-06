import log from 'loglevel';
import * as d3 from 'd3';

/**
 * Base class for all VSOM visualizations
 * Provides common functionality and lifecycle methods
 */
export class BaseVisualization {
  constructor(container, options = {}) {
    this.logger = log.getLogger(`vsom:${this.constructor.name}`);
    this.container = container;
    this.options = {
      logLevel: 'debug',
      ...options
    };
    
    this.logger.setLevel(this.options.logLevel);
    this.logger.debug('Initializing visualization with options:', this.options);
    
    this.initialized = false;
    this.svg = null;
    this.width = 0;
    this.height = 0;
  }

  /**
   * Initialize the visualization
   * @param {Object} data - Initial data for the visualization
   */
  init(data) {
    this.logger.debug('Initializing visualization');
    this.setupContainer();
    this.setupSVG();
    this.initialized = true;
    this.logger.info('Visualization initialized');
  }

  /**
   * Setup the container element
   * @private
   */
  setupContainer() {
    if (!this.container) {
      const error = new Error('No container element provided');
      this.logger.error('Failed to setup container:', error);
      throw error;
    }
    
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.logger.debug(`Container dimensions: ${this.width}x${this.height}`);
  }

  /**
   * Setup the SVG element
   * @private
   */
  setupSVG() {
    this.logger.debug('Setting up SVG');
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
  }

  /**
   * Update the visualization with new data
   * @param {Object} data - New data to visualize
   */
  update(data) {
    if (!this.initialized) {
      this.logger.warn('Visualization not initialized, calling init() first');
      this.init(data);
      return;
    }
    this.logger.debug('Updating visualization with data:', data);
  }

  /**
   * Update visualization options
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.logger.debug('Updating options:', newOptions);
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Handle window resize events
   */
  handleResize() {
    if (!this.initialized) return;
    
    const newWidth = this.container.clientWidth;
    const newHeight = this.container.clientHeight;
    
    if (newWidth !== this.width || newHeight !== this.height) {
      this.logger.debug(`Resizing from ${this.width}x${this.height} to ${newWidth}x${newHeight}`);
      this.width = newWidth;
      this.height = newHeight;
      this.onResize();
    }
  }

  /**
   * Handle resize events (to be implemented by subclasses)
   * @protected
   */
  onResize() {
    this.logger.debug('Handling resize in base class');
    if (this.svg) {
      this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    }
  }

  /**
   * Clean up the visualization
   */
  destroy() {
    this.logger.debug('Destroying visualization');
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    this.initialized = false;
  }

  /**
   * Log performance metrics
   * @param {string} name - Name of the operation
   * @param {Function} fn - Function to measure
   * @returns {*} The result of the function
   */
  withPerformanceLogging(name, fn) {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.logger.debug(`[PERF] ${name} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.logger.error(`[PERF] ${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}
