import log from 'loglevel';
import * as d3 from 'd3';
import { BaseVisualization } from '../BaseVisualization.js';

/**
 * Training Visualization Component
 * Displays training progress and metrics for the SOM
 */
export class TrainingViz extends BaseVisualization {
  constructor(container, options = {}) {
    const defaultOptions = {
      width: 800,
      height: 400,
      margin: { top: 20, right: 30, bottom: 50, left: 60 },
      ...options
    };

    super(container, defaultOptions);
    
    // Initialize state
    this.metrics = {
      error: [],
      learningRate: [],
      neighborhood: []
    };
    
    // Bind methods
    this.updateMetrics = this.updateMetrics.bind(this);
  }
  
  /**
   * Initialize the visualization
   */
  async init() {
    await super.init();
    this.setupSVG();
    this.setupScales();
    this.setupAxes();
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
      
    this.plotGroup = this.svg.append('g')
      .attr('class', 'plot-area');
  }
  
  /**
   * Set up D3 scales
   */
  setupScales() {
    const { width, height, margin } = this.options;
    
    this.xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([margin.left, width - margin.right]);
      
    this.yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([height - margin.bottom, margin.top]);
  }
  
  /**
   * Set up D3 axes
   */
  setupAxes() {
    const { margin, height } = this.options;
    
    // X axis
    this.xAxis = d3.axisBottom(this.xScale);
    this.yAxis = d3.axisLeft(this.yScale);
    
    // Add axes to SVG
    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(this.xAxis);
      
    this.svg.append('g')
      .attr('class', 'y axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(this.yAxis);
  }
  
  /**
   * Update metrics with new training data
   * @param {Object} metrics - Training metrics to update
   */
  updateMetrics(metrics) {
    if (!this.initialized) return;
    
    // Update metrics
    Object.entries(metrics).forEach(([key, value]) => {
      if (this.metrics[key] !== undefined) {
        this.metrics[key].push(value);
      }
    });
    
    // Update visualization
    this.updateScales();
    this.render();
  }
  
  /**
   * Update scales based on current data
   */
  updateScales() {
    // Update domain based on data
    const maxEpoch = Math.max(...Object.values(this.metrics).map(m => m.length), 1);
    const maxError = Math.max(0.1, ...this.metrics.error);
    
    this.xScale.domain([0, maxEpoch]);
    this.yScale.domain([0, maxError]);
    
    // Update axes
    this.svg.select('.x.axis').call(this.xAxis);
    this.svg.select('.y.axis').call(this.yAxis);
  }
  
  /**
   * Render the visualization
   */
  render() {
    if (!this.initialized) return;
    
    const { margin } = this.options;
    const line = d3.line()
      .x((d, i) => this.xScale(i))
      .y(d => this.yScale(d));
    
    // Update error line
    this.plotGroup.selectAll('.error-line')
      .data([this.metrics.error])
      .join('path')
        .attr('class', 'error-line')
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5);
  }
}

export default TrainingViz;
