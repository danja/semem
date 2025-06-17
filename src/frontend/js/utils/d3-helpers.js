/**
 * D3.js helper utilities for visualizations
 */

/**
 * Create a responsive SVG element
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Configuration options
 * @returns {Object} D3 selection of the SVG element
 */
export function createResponsiveSVG(container, options = {}) {
  const {
    width = 800,
    height = 600,
    margin = { top: 20, right: 20, bottom: 20, left: 20 },
    onResize = null
  } = options;

  // Create SVG with viewBox for responsive scaling
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .classed('d3-svg', true);

  // Handle window resize
  if (onResize) {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length > 0) {
        onResize(entries[0].contentRect);
      }
    });
    
    resizeObserver.observe(container);
    
    // Clean up on container removal
    d3.select(container).on('remove', () => {
      resizeObserver.disconnect();
    });
  }

  return svg;
}

/**
 * Create a tooltip
 * @param {Object} options - Tooltip options
 * @returns {Object} Tooltip functions
 */
export function createTooltip(options = {}) {
  const {
    parent = d3.select('body'),
    offsetX = 10,
    offsetY = 10,
    styles = {
      position: 'absolute',
      padding: '8px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      'border-radius': '4px',
      'pointer-events': 'none',
      'font-size': '12px',
      'z-index': '1000',
      'max-width': '300px',
      'word-wrap': 'break-word'
    }
  } = options;

  const tooltip = parent.append('div')
    .style('opacity', 0)
    .style('position', 'absolute');

  // Apply styles
  Object.entries(styles).forEach(([key, value]) => {
    tooltip.style(key, value);
  });

  /**
   * Show tooltip with content at position [x, y]
   */
  const show = (content, [x, y]) => {
    tooltip
      .style('opacity', 1)
      .html(content)
      .style('left', `${x + offsetX}px`)
      .style('top', `${y + offsetY}px`);
  };

  /**
   * Hide tooltip
   */
  const hide = () => {
    tooltip.style('opacity', 0);
  };

  /**
   * Move tooltip to new position
   */
  const move = ([x, y]) => {
    tooltip
      .style('left', `${x + offsetX}px`)
      .style('top', `${y + offsetY}px`);
  };

  return { show, hide, move, node: tooltip };
}

/**
 * Create a color scale
 * @param {string} scheme - D3 color scheme name
 * @param {Array} domain - Domain values
 * @returns {Function} D3 color scale
 */
export function createColorScale(scheme = 'interpolateViridis', domain = [0, 1]) {
  if (d3[scheme]) {
    return d3.scaleSequential(d3[scheme]).domain(domain);
  }
  return d3.scaleSequential(d3.interpolateViridis).domain(domain);
}

/**
 * Format number with SI prefix
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
export function formatSI(num) {
  return d3.format('.3s')(num)
    .replace('G', 'B')
    .replace('M', 'M')
    .replace('K', 'K')
    .replace('B', 'B');
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Add zoom behavior to a D3 selection
 * @param {Object} selection - D3 selection
 * @param {Object} options - Zoom options
 * @returns {Object} Zoom behavior
 */
export function addZoom(selection, options = {}) {
  const {
    scaleExtent = [0.1, 10],
    onZoom = () => {},
    onEnd = () => {}
  } = options;

  const zoom = d3.zoom()
    .scaleExtent(scaleExtent)
    .on('zoom', (event) => {
      selection.attr('transform', event.transform);
      onZoom(event);
    })
    .on('end', onEnd);

  selection.call(zoom);
  return zoom;
}

/**
 * Create a legend for a color scale
 * @param {Object} svg - D3 SVG selection
 * @param {Object} colorScale - D3 color scale
 * @param {Object} options - Legend options
 * @returns {Object} Legend object with update method
 */
export function createLegend(svg, colorScale, options = {}) {
  const {
    title = '',
    width = 300,
    height = 20,
    margin = { top: 0, right: 0, bottom: 0, left: 0 },
    tickFormat = d3.format('.2f'),
    tickValues = null,
    orientation = 'horizontal'
  } = options;

  const defs = svg.append('defs');
  const legendGroup = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Add gradient
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;
  
  const gradient = defs.append('linearGradient')
    .attr('id', gradientId);

  // Update gradient stops based on color scale
  const update = (domain) => {
    const stops = gradient.selectAll('stop')
      .data(d3.range(0, 1.01, 0.1));

    stops.enter()
      .append('stop')
      .merge(stops)
      .attr('offset', d => `${d * 100}%`)
      .attr('stop-color', d => colorScale(d));

    stops.exit().remove();

    // Update axis
    const xScale = d3.scaleLinear()
      .domain(domain || colorScale.domain())
      .range([0, width]);

    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(tickFormat);

    if (tickValues) {
      xAxis.tickValues(tickValues);
    }

    let axisGroup = legendGroup.select('.axis');
    if (axisGroup.empty()) {
      axisGroup = legendGroup.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`);
    }

    axisGroup.call(xAxis);

    // Update gradient rect
    let rect = legendGroup.select('rect');
    if (rect.empty()) {
      rect = legendGroup.append('rect')
        .attr('width', width)
        .attr('height', height);
    }

    rect.attr('fill', `url(#${gradientId})`);

    // Update title
    if (title) {
      let titleElement = legendGroup.select('.legend-title');
      if (titleElement.empty()) {
        titleElement = legendGroup.append('text')
          .attr('class', 'legend-title')
          .attr('y', -10);
      }
      titleElement.text(title);
    }
  };

  // Initial update
  update(colorScale.domain());

  return { update };
}

// Export all functions
export default {
  createResponsiveSVG,
  createTooltip,
  createColorScale,
  formatSI,
  debounce,
  addZoom,
  createLegend
};
