import log from 'loglevel';
import * as d3 from 'd3';
import { BaseVisualization } from '../BaseVisualization.js';

/**
 * Clustering Visualization Component
 * Displays clustering results from the SOM
 */
export class Clustering extends BaseVisualization {
  constructor(container, options = {}) {
    const defaultOptions = {
      width: 800,
      height: 600,
      margin: { top: 20, right: 20, bottom: 30, left: 40 },
      colorScheme: d3.schemeCategory10,
      ...options
    };

    super(container, defaultOptions);
    
    // Initialize state
    this.clusters = [];
    this.selectedCluster = null;
    this.colorScale = null;
    
    // Bind methods
    this.updateClusters = this.updateClusters.bind(this);
    this.selectCluster = this.selectCluster.bind(this);
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
      
    this.clusterGroup = this.svg.append('g')
      .attr('class', 'clusters');
      
    this.legendGroup = this.svg.append('g')
      .attr('class', 'legend');
  }
  
  /**
   * Set up D3 scales
   */
  setupScales() {
    // Color scale for clusters
    this.colorScale = d3.scaleOrdinal(this.options.colorScheme);
  }
  
  /**
   * Update clusters with new data
   * @param {Array} clusters - Array of cluster data
   */
  updateClusters(clusters) {
    if (!this.initialized || !clusters || !clusters.length) return;
    
    this.clusters = clusters;
    this.colorScale.domain(clusters.map((_, i) => i));
    
    // If no cluster is selected, select the first one
    if (this.selectedCluster === null && clusters.length > 0) {
      this.selectCluster(0);
    }
    
    this.render();
  }
  
  /**
   * Select a cluster to display details
   * @param {number} clusterIndex - Index of the cluster to select
   */
  selectCluster(clusterIndex) {
    if (clusterIndex < 0 || clusterIndex >= this.clusters.length) return;
    
    this.selectedCluster = clusterIndex;
    this.render();
  }
  
  /**
   * Render the visualization
   */
  render() {
    if (!this.initialized || !this.clusters.length) return;
    
    const { width, height, margin } = this.options;
    
    // Clear existing clusters
    this.clusterGroup.selectAll('*').remove();
    
    // Create force simulation for cluster layout
    const simulation = d3.forceSimulation()
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.size) * 2));
    
    // Create nodes for each data point in clusters
    const nodes = [];
    this.clusters.forEach((cluster, clusterIndex) => {
      cluster.points.forEach((point, pointIndex) => {
        nodes.push({
          ...point,
          cluster: clusterIndex,
          id: `${clusterIndex}-${pointIndex}`
        });
      });
    });
    
    // Draw clusters
    const node = this.clusterGroup.selectAll('.node')
      .data(nodes, d => d.id)
      .join('circle')
        .attr('class', 'node')
        .attr('r', 5)
        .attr('fill', d => this.colorScale(d.cluster))
        .attr('opacity', 0.7)
        .call(drag(simulation));
    
    // Update simulation with nodes
    simulation.nodes(nodes)
      .on('tick', () => {
        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
      });
    
    // Add legend
    this.renderLegend();
  }
  
  /**
   * Render the cluster legend
   */
  renderLegend() {
    const { width, margin } = this.options;
    const legendItemHeight = 20;
    const legendItemWidth = 100;
    
    // Clear existing legend
    this.legendGroup.selectAll('*').remove();
    
    // Create legend items
    const legend = this.legendGroup.selectAll('.legend-item')
      .data(this.clusters)
      .join('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * (legendItemHeight + 5)})`)
        .on('click', (event, d, i) => this.selectCluster(i));
    
    // Add color swatches
    legend.append('rect')
      .attr('x', width - margin.right - legendItemWidth + 10)
      .attr('width', legendItemHeight)
      .attr('height', legendItemHeight)
      .attr('fill', (_, i) => this.colorScale(i))
      .attr('opacity', (_, i) => i === this.selectedCluster ? 1 : 0.5);
    
    // Add cluster labels
    legend.append('text')
      .attr('x', width - margin.right - legendItemWidth + 40)
      .attr('y', legendItemHeight / 2)
      .attr('dy', '0.32em')
      .text((d, i) => `Cluster ${i + 1} (${d.size} points)`)
      .style('font-size', '12px')
      .style('fill', (_, i) => i === this.selectedCluster ? '#000' : '#666');
  }
}

// Drag behavior for nodes
function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

export default Clustering;
