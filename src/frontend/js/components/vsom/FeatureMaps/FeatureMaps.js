import log from 'loglevel';
import * as d3 from 'd3';
import { BaseVisualization } from '../BaseVisualization.js';

/**
 * Feature Maps Visualization Component
 * Displays component planes for each feature in the SOM
 */
export class FeatureMaps extends BaseVisualization {
  constructor(container, options = {}) {
    const defaultOptions = {
      width: 800,
      height: 600,
      margin: { top: 20, right: 20, bottom: 30, left: 40 },
      colorScheme: 'interpolateViridis',
      ...options
    };

    super(container, defaultOptions);
    
    // Initialize state
    this.features = [];
    this.colorScale = null;
    this.selectedFeature = null;
    
    // Bind methods
    this.updateFeatureMaps = this.updateFeatureMaps.bind(this);
    this.selectFeature = this.selectFeature.bind(this);
  }
  
  /**
   * Initialize the visualization
   */
  async init() {
    await super.init();
    this.setupSVG();
    this.setupScales();
    this.initialized = true;
    return this;
  }
  
  /**
   * Set up the SVG container
   */
  setupSVG() {
    const { width, height } = this.options;
    
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`);
      
    this.mapsGroup = this.svg.append('g')
      .attr('class', 'feature-maps');
      
    this.legendGroup = this.svg.append('g')
      .attr('class', 'legend');
  }
  
  /**
   * Set up D3 scales
   */
  setupScales() {
    // Color scale for feature values
    this.colorScale = d3.scaleSequential(d3[this.options.colorScheme])
      .domain([0, 1]); // Will be updated with actual data
  }
  
  /**
   * Update feature maps with new data
   * @param {Array} features - Array of feature data
   */
  updateFeatureMaps(features) {
    if (!this.initialized || !features || !features.length) return;
    
    this.features = features;
    
    // Update color scale domain based on feature values
    const allValues = features.flatMap(f => f.values);
    this.colorScale.domain(d3.extent(allValues));
    
    // If no feature is selected, select the first one
    if (!this.selectedFeature && features.length > 0) {
      this.selectFeature(features[0].name);
    }
    
    this.render();
  }
  
  /**
   * Select a feature to display
   * @param {string} featureName - Name of the feature to display
   */
  selectFeature(featureName) {
    const feature = this.features.find(f => f.name === featureName);
    if (!feature) return;
    
    this.selectedFeature = feature;
    this.render();
  }
  
  /**
   * Render the visualization
   */
  render() {
    if (!this.initialized || !this.selectedFeature) return;
    
    const { width, height, margin } = this.options;
    const cellSize = 20;
    const padding = 2;
    
    // Calculate grid dimensions
    const gridWidth = Math.floor((width - margin.left - margin.right) / (cellSize + padding));
    const gridHeight = Math.floor((height - margin.top - margin.bottom - 50) / (cellSize + padding));
    
    // Update color legend
    this.renderLegend();
    
    // Clear existing map
    this.mapsGroup.selectAll('*').remove();
    
    // Create feature map
    const mapGroup = this.mapsGroup.append('g')
      .attr('class', 'feature-map')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create cells
    const cells = [];
    const { values } = this.selectedFeature;
    
    for (let i = 0; i < gridHeight; i++) {
      for (let j = 0; j < gridWidth; j++) {
        const idx = i * gridWidth + j;
        if (idx >= values.length) break;
        
        cells.push({
          x: j * (cellSize + padding),
          y: i * (cellSize + padding),
          value: values[idx]
        });
      }
    }
    
    // Draw cells
    mapGroup.selectAll('.cell')
      .data(cells)
      .join('rect')
        .attr('class', 'cell')
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => this.colorScale(d.value))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5);
    
    // Add title
    mapGroup.append('text')
      .attr('class', 'feature-title')
      .attr('x', 0)
      .attr('y', -10)
      .text(this.selectedFeature.name);
  }
  
  /**
   * Render the color legend
   */
  renderLegend() {
    const { width, height, margin } = this.options;
    const legendWidth = 200;
    const legendHeight = 20;
    
    // Clear existing legend
    this.legendGroup.selectAll('*').remove();
    
    // Create gradient for legend
    const defs = this.legendGroup.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    
    // Add gradient stops
    const stops = [0, 0.25, 0.5, 0.75, 1];
    gradient.selectAll('stop')
      .data(stops)
      .join('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => this.colorScale(d));
    
    // Add legend rectangle
    this.legendGroup.append('rect')
      .attr('x', width - margin.right - legendWidth)
      .attr('y', height - margin.bottom / 2)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)');
    
    // Add legend axis
    const legendScale = d3.scaleLinear()
      .domain(this.colorScale.domain())
      .range([width - margin.right - legendWidth, width - margin.right]);
      
    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5);
      
    this.legendGroup.append('g')
      .attr('class', 'legend-axis')
      .attr('transform', `translate(0,${height - margin.bottom / 2 + legendHeight})`)
      .call(legendAxis);
  }
}

export default FeatureMaps;
