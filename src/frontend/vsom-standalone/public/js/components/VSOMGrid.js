/**
 * VSOM Grid Component
 * Main visualization component for displaying interactions as a self-organizing map
 */

import VSOMUtils from '../utils/VSOMUtils.js';

export default class VSOMGrid {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            nodeSize: 6,
            gridSpacing: 40,
            showLabels: false,
            showGrid: true,
            enableZoom: true,
            enablePan: true,
            animationDuration: 300,
            onNodeClick: null,
            onNodeHover: null,
            ...options
        };
        
        this.svg = null;
        this.mainGroup = null;
        this.gridGroup = null;
        this.nodesGroup = null;
        this.labelsGroup = null;
        
        this.data = null;
        this.selectedNode = null;
        this.hoveredNode = null;
        
        // Transform state
        this.transform = {
            x: 0,
            y: 0,
            scale: 1
        };
        
        this.initialized = false;
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleNodeClick = this.handleNodeClick.bind(this);
        this.handleNodeMouseEnter = this.handleNodeMouseEnter.bind(this);
        this.handleNodeMouseLeave = this.handleNodeMouseLeave.bind(this);
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('Initializing VSOM Grid...');
        
        try {
            this.createSVG();
            this.setupGroups();
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('VSOM Grid initialized');
        } catch (error) {
            console.error('Failed to initialize VSOM Grid:', error);
            throw error;
        }
    }
    
    createSVG() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create SVG element
        this.svg = VSOMUtils.createSVGElement('svg', {
            class: 'vsom-svg',
            width: '100%',
            height: '100%'
        });
        
        // Create background
        const background = VSOMUtils.createSVGElement('rect', {
            class: 'vsom-background',
            width: '100%',
            height: '100%',
            fill: 'var(--gray-50)'
        });
        
        this.svg.appendChild(background);
        this.container.appendChild(this.svg);
    }
    
    setupGroups() {
        // Main group for transformations
        this.mainGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-main-group'
        });
        
        // Grid lines group
        this.gridGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-grid-group'
        });
        
        // Nodes group
        this.nodesGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-nodes-group'
        });
        
        // Labels group
        this.labelsGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-labels-group'
        });
        
        // Add groups to main group
        this.mainGroup.appendChild(this.gridGroup);
        this.mainGroup.appendChild(this.nodesGroup);
        this.mainGroup.appendChild(this.labelsGroup);
        
        // Add main group to SVG
        this.svg.appendChild(this.mainGroup);
    }
    
    setupEventListeners() {
        // Resize observer
        const resizeObserver = new ResizeObserver(this.handleResize);
        resizeObserver.observe(this.container);
        
        // Mouse events for tooltip
        document.addEventListener('mousemove', (event) => {
            if (this.hoveredNode && event.target.closest('.vsom-node')) {
                VSOMUtils.showTooltip(this.hoveredNode, event);
            }
        });
    }
    
    async updateData(data) {
        if (!data || !data.nodes) {
            this.clearVisualization();
            return;
        }

        this.data = data;
        await this.renderVisualization();
    }
    
    async renderVisualization() {
        if (!this.data || !this.data.nodes || this.data.nodes.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        console.log('Rendering VSOM visualization with', this.data.nodes.length, 'nodes');
        
        // Calculate visualization bounds
        const bounds = this.calculateBounds();
        
        // Render grid if enabled
        if (this.options.showGrid) {
            this.renderGrid(bounds);
        }
        
        // Render nodes
        this.renderNodes();
        
        // Render labels if enabled
        if (this.options.showLabels) {
            this.renderLabels();
        }
        
        // Center the visualization - TEMPORARILY DISABLED FOR DEBUGGING
        // this.centerVisualization(bounds);

        // Use simple fixed transform for debugging
        this.setTransform(50, 50, 1);
    }
    
    calculateBounds() {
        if (!this.data.nodes || this.data.nodes.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
        
        const positions = this.data.nodes.map(node => ({
            x: node.x * this.options.gridSpacing,
            y: node.y * this.options.gridSpacing
        }));
        
        const minX = Math.min(...positions.map(p => p.x)) - this.options.gridSpacing;
        const maxX = Math.max(...positions.map(p => p.x)) + this.options.gridSpacing;
        const minY = Math.min(...positions.map(p => p.y)) - this.options.gridSpacing;
        const maxY = Math.max(...positions.map(p => p.y)) + this.options.gridSpacing;
        
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    renderGrid(bounds) {
        // Clear existing grid
        this.gridGroup.innerHTML = '';
        
        if (!this.data.gridSize) return;
        
        const spacing = this.options.gridSpacing;
        
        // Vertical lines
        for (let x = bounds.minX; x <= bounds.maxX; x += spacing) {
            const line = VSOMUtils.createSVGElement('line', {
                class: 'vsom-grid-line',
                x1: x,
                y1: bounds.minY,
                x2: x,
                y2: bounds.maxY
            });
            this.gridGroup.appendChild(line);
        }
        
        // Horizontal lines
        for (let y = bounds.minY; y <= bounds.maxY; y += spacing) {
            const line = VSOMUtils.createSVGElement('line', {
                class: 'vsom-grid-line',
                x1: bounds.minX,
                y1: y,
                x2: bounds.maxX,
                y2: y
            });
            this.gridGroup.appendChild(line);
        }
    }
    
    renderNodes() {
        // Clear existing nodes
        this.nodesGroup.innerHTML = '';

        this.data.nodes.forEach((node, index) => {
            const nodeElement = this.createNodeElement(node, index);
            this.nodesGroup.appendChild(nodeElement);
        });
    }
    
    createNodeElement(node, index) {
        const x = node.x * this.options.gridSpacing;
        const y = node.y * this.options.gridSpacing;
        const size = Math.max(node.size || this.options.nodeSize, 8); // Ensure minimum visible size
        const color = node.color || '#ff0000'; // Use bright red for visibility

        // Create node circle with very visible properties
        const circle = VSOMUtils.createSVGElement('circle', {
            class: `vsom-node ${node.type || 'default'}`,
            cx: x,
            cy: y,
            r: size,
            fill: color,
            'data-node-id': node.id,
            'data-node-index': index,
            'stroke': '#000000',
            'stroke-width': '3',
            'opacity': '1.0'
        });
        
        // Add event listeners
        circle.addEventListener('click', (event) => this.handleNodeClick(node, circle, event));
        circle.addEventListener('mouseenter', (event) => this.handleNodeMouseEnter(node, circle, event));
        circle.addEventListener('mouseleave', (event) => this.handleNodeMouseLeave(node, circle, event));
        
        // Add activation visualization (opacity based on activation)
        if (node.activation !== undefined) {
            const opacity = VSOMUtils.clamp(node.activation, 0.3, 1.0);
            circle.setAttribute('fill-opacity', opacity);
        }
        
        return circle;
    }
    
    renderLabels() {
        // Clear existing labels
        this.labelsGroup.innerHTML = '';
        
        this.data.nodes.forEach((node, index) => {
            if (node.content || node.concepts?.length > 0) {
                const label = this.createLabelElement(node, index);
                this.labelsGroup.appendChild(label);
            }
        });
    }
    
    createLabelElement(node, index) {
        const x = node.x * this.options.gridSpacing;
        const y = node.y * this.options.gridSpacing + this.options.nodeSize + 12;
        
        // Determine label text
        let labelText = '';
        if (node.concepts && node.concepts.length > 0) {
            labelText = node.concepts[0];
        } else if (node.content) {
            labelText = VSOMUtils.truncateText(node.content, 15);
        } else {
            labelText = node.type || 'Node';
        }
        
        const text = VSOMUtils.createSVGElement('text', {
            class: 'vsom-label',
            x: x,
            y: y,
            'text-anchor': 'middle',
            'data-node-id': node.id
        });
        
        text.textContent = labelText;
        
        return text;
    }
    
    renderEmptyState() {
        this.clearVisualization();
        
        // Show placeholder (handled by parent container)
        console.log('Rendering empty VSOM state');
    }
    
    clearVisualization() {
        if (this.gridGroup) this.gridGroup.innerHTML = '';
        if (this.nodesGroup) this.nodesGroup.innerHTML = '';
        if (this.labelsGroup) this.labelsGroup.innerHTML = '';
        
        this.selectedNode = null;
        this.hoveredNode = null;
    }
    
    centerVisualization(bounds) {
        const containerRect = this.container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        const boundsCenterX = bounds.minX + bounds.width / 2;
        const boundsCenterY = bounds.minY + bounds.height / 2;
        
        // Calculate scale to fit content
        const scaleX = (containerRect.width * 0.8) / bounds.width;
        const scaleY = (containerRect.height * 0.8) / bounds.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1
        
        // Calculate translation
        const translateX = centerX - boundsCenterX * scale;
        const translateY = centerY - boundsCenterY * scale;
        
        this.setTransform(translateX, translateY, scale);
    }
    
    setTransform(x, y, scale) {
        this.transform.x = x;
        this.transform.y = y;
        this.transform.scale = scale;
        
        if (this.mainGroup) {
            this.mainGroup.setAttribute('transform', 
                `translate(${x}, ${y}) scale(${scale})`
            );
        }
    }
    
    handleNodeClick(node, element) {
        console.log('Node clicked:', node);
        
        // Update selection
        this.setSelectedNode(node, element);
        
        // Call callback
        if (this.options.onNodeClick) {
            this.options.onNodeClick(node);
        }
    }
    
    handleNodeMouseEnter(node, element, event) {
        this.hoveredNode = node;

        // Add hover class
        VSOMUtils.addClass(element, 'hovered');

        // Show corresponding label
        const label = this.labelsGroup.querySelector(`[data-node-id="${node.id}"]`);
        if (label) {
            VSOMUtils.addClass(label, 'visible');
        }

        // Call callback
        if (this.options.onNodeHover) {
            this.options.onNodeHover(node, event);
        }
    }
    
    handleNodeMouseLeave(node, element) {
        this.hoveredNode = null;
        
        // Remove hover class
        VSOMUtils.removeClass(element, 'hovered');
        
        // Hide corresponding label
        const label = this.labelsGroup.querySelector(`[data-node-id="${node.id}"]`);
        if (label) {
            VSOMUtils.removeClass(label, 'visible');
        }
        
        // Hide tooltip
        VSOMUtils.hideTooltip();
        
        // Call callback
        if (this.options.onNodeHover) {
            this.options.onNodeHover(null);
        }
    }
    
    setSelectedNode(node, element) {
        // Clear previous selection
        if (this.selectedNode) {
            const prevElement = this.nodesGroup.querySelector(`[data-node-id="${this.selectedNode.id}"]`);
            if (prevElement) {
                VSOMUtils.removeClass(prevElement, 'selected');
            }
        }
        
        // Set new selection
        this.selectedNode = node;
        if (element) {
            VSOMUtils.addClass(element, 'selected');
        }
    }
    
    highlightNode(interactionId) {
        // Find node by interaction ID
        const node = this.data?.nodes?.find(n => n.interactionId === interactionId);
        if (!node) return;
        
        const element = this.nodesGroup.querySelector(`[data-node-id="${node.id}"]`);
        if (element) {
            this.setSelectedNode(node, element);
            
            // Scroll to node
            const nodeRect = element.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();
            
            if (!VSOMUtils.isInViewport(element)) {
                // Calculate center position for the node
                const centerX = containerRect.width / 2;
                const centerY = containerRect.height / 2;
                
                const nodeX = node.x * this.options.gridSpacing;
                const nodeY = node.y * this.options.gridSpacing;
                
                const newX = centerX - nodeX * this.transform.scale;
                const newY = centerY - nodeY * this.transform.scale;
                
                this.setTransform(newX, newY, this.transform.scale);
            }
        }
    }
    
    async autoLayout() {
        if (!this.data || !this.data.nodes || this.data.nodes.length === 0) return;
        
        console.log('Applying auto layout...');
        
        // Recalculate bounds and center
        const bounds = this.calculateBounds();
        this.centerVisualization(bounds);
        
        // Apply smooth transition
        if (this.mainGroup) {
            this.mainGroup.style.transition = 'transform 0.5s ease';
            setTimeout(() => {
                this.mainGroup.style.transition = '';
            }, 500);
        }
    }
    
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // Rerender if data exists
        if (this.data) {
            this.renderVisualization();
        }
    }
    
    handleResize() {
        if (this.data) {
            // Recalculate layout on resize
            const bounds = this.calculateBounds();
            this.centerVisualization(bounds);
        }
    }
    
    cleanup() {
        // Remove event listeners
        VSOMUtils.hideTooltip();
        
        // Clear data
        this.data = null;
        this.selectedNode = null;
        this.hoveredNode = null;
        
        console.log('VSOM Grid cleaned up');
    }
}