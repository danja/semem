import log from 'loglevel';
import * as d3 from 'd3';
import { BaseVisualization } from '../BaseVisualization.js';
import { createResponsiveSVG, createTooltip, addTooltip, createColorScale } from '../../../utils/d3-helpers.js';

/**
 * SOM Grid Visualization Component
 * Displays a 2D grid of SOM nodes with optional U-Matrix visualization
 */
export class SOMGrid extends BaseVisualization {
  constructor(container, options = {}) {
    const defaultOptions = {
      nodeSize: 20,
      padding: 2,
      colorScheme: 'interpolateViridis',
      showUMatrix: true,
      showLabels: false,
      showGrid: true,
      ...options
    };

    super(container, defaultOptions);
    
    // Visualization state
    this.nodes = [];
    this.links = [];
    this.simulation = null;
    this.zoom = null;
    this.colorScale = null;
    this.svgElements = {
      nodes: null,
      links: null,
      labels: null,
      uMatrix: null
    };
    
    // Bind methods
    this.handleNodeClick = this.handleNodeClick.bind(this);
    this.handleNodeHover = this.handleNodeHover.bind(this);
  }

  /**
   * Initialize the visualization
   * @param {Object} data - Initial data
   */
  async init(data) {
    this.logger.debug('Initializing SOM Grid visualization');
    await super.init(data);
    
    // Set up the visualization
    this.setupScales();
    this.setupZoom();
    this.renderGrid();
    
    if (data) {
      this.update(data);
    }
    
    return this;
  }

  /**
   * Set up D3 scales
   * @private
   */
  setupScales() {
    this.logger.debug('Setting up scales');
    this.colorScale = createColorScale(this.options.colorScheme, [0, 1]);
  }

  /**
   * Set up zoom behavior
   * @private
   */
  setupZoom() {
    this.logger.debug('Setting up zoom behavior');
    
    const container = d3.select(this.container);
    
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        container.select('.nodes-group')
          .attr('transform', event.transform);
      });
    
    container.call(this.zoom);
  }

  /**
   * Render the SOM grid
   * @private
   */
  renderGrid() {
    this.logger.debug('Rendering SOM grid');
    
    const { svg } = this;
    
    // Clear existing content
    svg.selectAll('*').remove();
    
    // Add groups for different layers
    const defs = svg.append('defs');
    
    // Add pattern for grid
    if (this.options.showGrid) {
      const gridPattern = defs.append('pattern')
        .attr('id', 'grid-pattern')
        .attr('width', this.options.nodeSize + this.options.padding)
        .attr('height', this.options.nodeSize + this.options.padding)
        .attr('patternUnits', 'userSpaceOnUse');
      
      gridPattern.append('rect')
        .attr('width', this.options.nodeSize + this.options.padding)
        .attr('height', this.options.nodeSize + this.options.padding)
        .attr('fill', 'none')
        .attr('stroke', '#eee')
        .attr('stroke-width', 0.5);
    }
    
    // Create groups for different layers
    const layers = {
      uMatrix: svg.append('g').attr('class', 'u-matrix-layer'),
      links: svg.append('g').attr('class', 'links-layer'),
      nodes: svg.append('g').attr('class', 'nodes-group')
    };
    
    this.svgElements = { ...this.svgElements, ...layers };
    
    // Add background grid
    if (this.options.showGrid) {
      svg.insert('rect', ':first-child')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(#grid-pattern)');
    }
  }

  /**
   * Update the visualization with new data
   * @param {Object} data - New data to visualize
   */
  update(data) {
    this.logger.debug('Updating SOM Grid visualization', data);
    
    if (!this.initialized) {
      this.logger.warn('Visualization not initialized, calling init() first');
      this.init(data);
      return;
    }
    
    this.processData(data);
    this.updateNodes();
    this.updateLinks();
    
    if (this.options.showUMatrix) {
      this.updateUMatrix();
    }
    
    if (this.options.showLabels) {
      this.updateLabels();
    }
    
    return this;
  }

  /**
   * Process input data into visualization format
   * @param {Object} data - Input data
   * @private
   */
  processData(data) {
    this.logger.debug('Processing data', data);
    
    // Process nodes
    this.nodes = data.nodes.map((node, i) => ({
      id: node.id || `node-${i}`,
      x: node.x,
      y: node.y,
      weight: node.weight || 0,
      activation: node.activation || 0,
      bmuCount: node.bmuCount || 0,
      metadata: node.metadata || {}
    }));
    
    // Process links (if any)
    this.links = [];
    
    // Calculate grid dimensions if not provided
    if (!this.options.width || !this.options.height) {
      const xExtent = d3.extent(this.nodes, d => d.x);
      const yExtent = d3.extent(this.nodes, d => d.y);
      
      this.options.width = (xExtent[1] - xExtent[0] + 1) * (this.options.nodeSize + this.options.padding);
      this.options.height = (yExtent[1] - yExtent[0] + 1) * (this.options.nodeSize + this.options.padding);
      
      this.logger.debug('Calculated grid dimensions', {
        width: this.options.width,
        height: this.options.height
      });
    }
  }

  /**
   * Update node visualization
   * @private
   */
  updateNodes() {
    this.logger.debug('Updating nodes');
    
    const { nodes } = this.svgElements;
    const nodeSize = this.options.nodeSize;
    
    // Bind data
    const nodeSelection = nodes.selectAll('.node')
      .data(this.nodes, d => d.id);
    
    // Enter
    const nodeEnter = nodeSelection.enter()
      .append('rect')
      .attr('class', 'node')
      .attr('width', nodeSize)
      .attr('height', nodeSize)
      .attr('rx', 2)
      .attr('ry', 2)
      .style('fill', d => this.colorScale(d.activation))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => this.handleNodeClick(event, d))
      .on('mouseover', (event, d) => this.handleNodeHover(event, d, true))
      .on('mouseout', (event, d) => this.handleNodeHover(event, d, false));
    
    // Update
    nodeSelection.merge(nodeEnter)
      .transition()
      .duration(300)
      .attr('x', d => d.x * (nodeSize + this.options.padding))
      .attr('y', d => d.y * (nodeSize + this.options.padding))
      .style('fill', d => this.colorScale(d.activation));
    
    // Exit
    nodeSelection.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();
    
    // Add tooltips
    addTooltip(nodeSelection, d => `
      <div><strong>Node (${d.x}, ${d.y})</strong></div>
      <div>Activation: ${d.activation.toFixed(3)}</div>
      <div>BMU Count: ${d.bmuCount}</div>
      <div>Weight: ${d.weight.toFixed(3)}</div>
    `);
  }

  /**
   * Update links between nodes
   * @private
   */
  updateLinks() {
    // Implement link visualization if needed
    this.logger.debug('Updating links');
  }

  /**
   * Update U-Matrix visualization
   * @private
   */
  updateUMatrix() {
    this.logger.debug('Updating U-Matrix');
    
    // Implement U-Matrix visualization
    // This would show distances between neighboring nodes
  }

  /**
   * Update node labels
   * @private
   */
  updateLabels() {
    this.logger.debug('Updating labels');
    
    // Add or update labels if enabled
  }

  /**
   * Handle node click events
   * @param {Event} event - DOM event
   * @param {Object} node - Clicked node data
   */
  handleNodeClick(event, node) {
    this.logger.debug('Node clicked', node);
    
    // Emit event or call callback
    if (typeof this.options.onNodeClick === 'function') {
      this.options.onNodeClick(node, event);
    }
  }

  /**
   * Handle node hover events
   * @param {Event} event - DOM event
   * @param {Object} node - Hovered node data
   * @param {boolean} isHovered - Whether the node is being hovered
   */
  handleNodeHover(event, node, isHovered) {
    if (isHovered) {
      d3.select(event.currentTarget)
        .style('stroke', '#333')
        .style('stroke-width', 2);
      
      if (typeof this.options.onNodeHover === 'function') {
        this.options.onNodeHover(node, true, event);
      }
    } else {
      d3.select(event.currentTarget)
        .style('stroke', '#fff')
        .style('stroke-width', 1);
      
      if (typeof this.options.onNodeHover === 'function') {
        this.options.onNodeHover(node, false, event);
      }
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    super.handleResize();
    this.logger.debug('Handling resize in SOMGrid');
    
    // Recalculate dimensions and update visualization
    if (this.initialized) {
      this.renderGrid();
      this.update({
        nodes: this.nodes,
        links: this.links
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.logger.debug('Destroying SOM Grid visualization');
    
    // Clean up event listeners, timeouts, etc.
    if (this.simulation) {
      this.simulation.stop();
    }
    
    super.destroy();
  }
}
