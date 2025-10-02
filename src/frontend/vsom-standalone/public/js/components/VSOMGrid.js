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
            gridSpacing: 120,
            showLabels: true,
            showGrid: true,
            showConnections: true,
            showSemanticClusters: true,
            showQualityIndicators: true,
            showTemporalFlow: true,
            enableZoom: true,
            enablePan: true,
            animationDuration: 300,
            onNodeClick: null,
            onNodeHover: null,
            ...options
        };

        this.svg = null;
        this.mainGroup = null;
        this.backgroundGroup = null;
        this.connectionGroup = null;
        this.clusterGroup = null;
        this.gridGroup = null;
        this.nodesGroup = null;
        this.labelsGroup = null;
        this.overlayGroup = null;
        this.tooltip = null;

        this.data = null;
        this.selectedNode = null;
        this.hoveredNode = null;

        // Enhanced visualization layers
        this.semanticClusters = [];
        this.nodeConnections = [];
        this.qualityMetrics = null;
        this.temporalFlow = [];

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

        // Background effects group (lowest layer)
        this.backgroundGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-background-group'
        });

        // Semantic cluster regions group
        this.clusterGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-cluster-group'
        });

        // Node connections group
        this.connectionGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-connection-group'
        });

        // Grid lines group
        this.gridGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-grid-group'
        });

        // Nodes group (main visualization elements)
        this.nodesGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-nodes-group'
        });

        // Labels group
        this.labelsGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-labels-group'
        });

        // Overlay group (highest layer for tooltips, etc.)
        this.overlayGroup = VSOMUtils.createSVGElement('g', {
            class: 'vsom-overlay-group'
        });

        // Add groups to main group in correct order (back to front)
        this.mainGroup.appendChild(this.backgroundGroup);
        this.mainGroup.appendChild(this.clusterGroup);
        this.mainGroup.appendChild(this.connectionGroup);
        this.mainGroup.appendChild(this.gridGroup);
        this.mainGroup.appendChild(this.nodesGroup);
        this.mainGroup.appendChild(this.labelsGroup);
        this.mainGroup.appendChild(this.overlayGroup);

        // Add main group to SVG
        this.svg.appendChild(this.mainGroup);

        // Create tooltip div
        this.createTooltip();
    }

    setupEventListeners() {
        // Resize observer
        const resizeObserver = new ResizeObserver(this.handleResize);
        resizeObserver.observe(this.container);

        // Mouse events for global tooltip cleanup (only when moving away from visualization)
        document.addEventListener('mousemove', (event) => {
            // Only hide tooltips if mouse is completely outside the SVG container
            if (!event.target.closest('svg') && !event.target.closest('.vsom-tooltip')) {
                VSOMUtils.hideTooltip();
                this.hideTooltip();
            }
        });

        // Setup zoom and pan if enabled
        if (this.options.enableZoom || this.options.enablePan) {
            this.setupZoomAndPan();
        }
    }

    setupZoomAndPan() {
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let startTransformX = 0;
        let startTransformY = 0;

        // Mouse wheel zoom
        this.svg.addEventListener('wheel', (event) => {
            if (!this.options.enableZoom) return;

            event.preventDefault();

            const delta = -event.deltaY;
            const scaleAmount = delta > 0 ? 1.1 : 0.9;
            const newScale = Math.max(0.1, Math.min(10, this.transform.scale * scaleAmount));

            // Get mouse position relative to SVG
            const rect = this.svg.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Calculate zoom point in transformed coordinates
            const worldX = (mouseX - this.transform.x) / this.transform.scale;
            const worldY = (mouseY - this.transform.y) / this.transform.scale;

            // Update transform
            this.transform.scale = newScale;
            this.transform.x = mouseX - worldX * newScale;
            this.transform.y = mouseY - worldY * newScale;

            this.applyTransform();
        });

        // Pan with mouse drag
        this.svg.addEventListener('mousedown', (event) => {
            if (!this.options.enablePan) return;

            // Only pan on middle mouse button or space+left click
            if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
                event.preventDefault();
                isPanning = true;
                startX = event.clientX;
                startY = event.clientY;
                startTransformX = this.transform.x;
                startTransformY = this.transform.y;
                this.svg.style.cursor = 'grabbing';
            }
        });

        this.svg.addEventListener('mousemove', (event) => {
            if (!isPanning) return;

            event.preventDefault();
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            this.transform.x = startTransformX + dx;
            this.transform.y = startTransformY + dy;

            this.applyTransform();
        });

        this.svg.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                this.svg.style.cursor = 'default';
            }
        });

        this.svg.addEventListener('mouseleave', () => {
            if (isPanning) {
                isPanning = false;
                this.svg.style.cursor = 'default';
            }
        });

        // Double-click to reset zoom
        this.svg.addEventListener('dblclick', (event) => {
            if (!this.options.enableZoom) return;

            event.preventDefault();
            this.resetTransform();
        });
    }

    applyTransform() {
        if (this.mainGroup) {
            this.mainGroup.setAttribute(
                'transform',
                `translate(${this.transform.x}, ${this.transform.y}) scale(${this.transform.scale})`
            );
        }
    }

    resetTransform() {
        this.transform.x = 0;
        this.transform.y = 0;
        this.transform.scale = 1;
        this.applyTransform();
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

        console.log('Rendering enhanced VSOM visualization with', this.data.nodes.length, 'nodes');

        // Pre-process data for enhanced visualizations
        this.preprocessData();

        // Calculate visualization bounds
        const bounds = this.calculateBounds();

        // Render background effects
        this.renderBackgroundEffects(bounds);

        // Render semantic clusters if enabled
        if (this.options.showSemanticClusters) {
            this.renderSemanticClusters(bounds);
        }

        // Render connections between related nodes
        if (this.options.showConnections) {
            this.renderNodeConnections();
        }

        // Render grid if enabled
        if (this.options.showGrid) {
            this.renderEnhancedGrid(bounds);
        }

        // Render temporal flow indicators
        if (this.options.showTemporalFlow) {
            this.renderTemporalFlow();
        }

        // Render enhanced nodes with rich information
        this.renderEnhancedNodes();

        // Render enhanced labels with semantic information
        if (this.options.showLabels) {
            this.renderEnhancedLabels();
        }

        // Render quality indicators
        if (this.options.showQualityIndicators) {
            this.renderQualityIndicators();
        }

        // Center the visualization
        this.centerVisualization(bounds);
    }

    calculateBounds() {
        if (!this.data.nodes || this.data.nodes.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const positions = this.data.nodes.map(node => ({
            x: (node.x || 0) * this.options.gridSpacing,
            y: (node.y || 0) * this.options.gridSpacing
        }));

        const minX = Math.min(...positions.map(p => p.x)) - this.options.gridSpacing;
        const maxX = Math.max(...positions.map(p => p.x)) + this.options.gridSpacing;
        const minY = Math.min(...positions.map(p => p.y)) - this.options.gridSpacing;
        const maxY = Math.max(...positions.map(p => p.y)) + this.options.gridSpacing;

        // Ensure minimum bounds to prevent issues with single nodes at origin
        const width = Math.max(maxX - minX, this.options.gridSpacing * 2);
        const height = Math.max(maxY - minY, this.options.gridSpacing * 2);

        return {
            minX,
            maxX: minX + width,
            minY,
            maxY: minY + height,
            width,
            height
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

        // Handle empty bounds
        if (bounds.width === 0 || bounds.height === 0) {
            this.setTransform(centerX, centerY, 1);
            return;
        }

        const boundsCenterX = bounds.minX + bounds.width / 2;
        const boundsCenterY = bounds.minY + bounds.height / 2;

        // Calculate scale to fit content with padding
        const padding = 0.8; // 20% padding
        const scaleX = (containerRect.width * padding) / bounds.width;
        const scaleY = (containerRect.height * padding) / bounds.height;
        const scale = Math.min(scaleX, scaleY, 2); // Allow scaling up to 2x for small content

        // Calculate translation to center the bounds
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

    // Enhanced rendering methods

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'vsom-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            max-width: 300px;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(this.tooltip);
    }

    preprocessData() {
        if (!this.data || !this.data.nodes) return;

        // Identify semantic clusters
        this.semanticClusters = this.identifySemanticClusters(this.data.nodes);
        this.clusterData = this.buildClusterData(this.semanticClusters);

        // Calculate node connections based on semantic similarity
        this.nodeConnections = this.calculateNodeConnections(this.data.nodes);
        this.connections = this.nodeConnections; // For test compatibility

        // Extract quality metrics for visualization
        this.qualityMetrics = this.extractQualityMetrics(this.data.nodes);

        // Build temporal flow information
        this.temporalFlow = this.buildTemporalFlow(this.data.nodes);
        this.temporalData = this.data.nodes.filter(node => node.timestamp || node.temporalOrder);
    }

    buildClusterData(clusters) {
        const clusterData = {};
        clusters.forEach((cluster, index) => {
            clusterData[`cluster_${index}`] = {
                nodes: cluster.nodes,
                centroid: cluster.centroid,
                concepts: cluster.concepts
            };
        });
        return clusterData;
    }

    identifySemanticClusters(nodes) {
        const clusters = [];
        const visited = new Set();

        // Simple clustering based on concept similarity
        for (const node of nodes) {
            if (visited.has(node.id)) continue;

            const cluster = {
                id: `cluster_${clusters.length}`,
                centerNode: node,
                nodes: [node],
                concepts: [...(node.concepts || [])],
                category: node.semanticInfo?.categories?.[0] || 'general',
                color: node.color,
                bounds: { minX: node.x, maxX: node.x, minY: node.y, maxY: node.y }
            };

            visited.add(node.id);

            // Find similar nodes
            for (const otherNode of nodes) {
                if (visited.has(otherNode.id)) continue;

                const similarity = this.calculateConceptSimilarity(node, otherNode);
                if (similarity > 0.3) {
                    cluster.nodes.push(otherNode);
                    cluster.concepts = [...new Set([...cluster.concepts, ...(otherNode.concepts || [])])];

                    // Update bounds
                    cluster.bounds.minX = Math.min(cluster.bounds.minX, otherNode.x);
                    cluster.bounds.maxX = Math.max(cluster.bounds.maxX, otherNode.x);
                    cluster.bounds.minY = Math.min(cluster.bounds.minY, otherNode.y);
                    cluster.bounds.maxY = Math.max(cluster.bounds.maxY, otherNode.y);

                    visited.add(otherNode.id);
                }
            }

            if (cluster.nodes.length > 1) {
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    calculateNodeConnections(nodes) {
        const connections = [];

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                const similarity = this.calculateConceptSimilarity(nodeA, nodeB);
                const temporalDistance = Math.abs(nodeA.timestamp - nodeB.timestamp) / (1000 * 60 * 60); // hours

                // Create connection if nodes are semantically similar or temporally close
                if (similarity > 0.4 || temporalDistance < 2) {
                    connections.push({
                        from: nodeA,
                        to: nodeB,
                        strength: similarity,
                        type: similarity > temporalDistance ? 'semantic' : 'temporal',
                        distance: Math.sqrt(Math.pow(nodeB.x - nodeA.x, 2) + Math.pow(nodeB.y - nodeA.y, 2))
                    });
                }
            }
        }

        return connections.sort((a, b) => b.strength - a.strength).slice(0, 20); // Limit to top connections
    }

    extractQualityMetrics(nodes) {
        const totalQuality = nodes.reduce((sum, node) => {
            const quality = node.qualityMetrics || {};
            return sum + (quality.importance || 0);
        }, 0);

        const avgQuality = totalQuality / nodes.length;
        const qualityDistribution = nodes.map(node => ({
            nodeId: node.id,
            quality: (node.qualityMetrics?.importance || 0),
            relative: (node.qualityMetrics?.importance || 0) / Math.max(avgQuality, 0.1)
        }));

        return {
            average: avgQuality,
            total: totalQuality,
            distribution: qualityDistribution,
            categories: this.categorizeQuality(qualityDistribution)
        };
    }

    buildTemporalFlow(nodes) {
        const sortedNodes = [...nodes].sort((a, b) => a.timestamp - b.timestamp);
        const flow = [];

        for (let i = 0; i < sortedNodes.length - 1; i++) {
            const current = sortedNodes[i];
            const next = sortedNodes[i + 1];

            const timeDiff = next.timestamp - current.timestamp;
            const spatialDistance = Math.sqrt(
                Math.pow(next.x - current.x, 2) +
                Math.pow(next.y - current.y, 2)
            );

            flow.push({
                from: current,
                to: next,
                timeDiff,
                spatialDistance,
                intensity: Math.min(1 / (timeDiff / 60000), 1) // Intensity based on time proximity
            });
        }

        return flow;
    }

    renderBackgroundEffects(bounds) {
        // Clear previous background effects
        this.backgroundGroup.innerHTML = '';

        // Create gradient background based on node density
        const gradient = VSOMUtils.createSVGElement('defs');
        const radialGradient = VSOMUtils.createSVGElement('radialGradient', {
            id: 'background-gradient',
            cx: '50%',
            cy: '50%',
            r: '50%'
        });

        radialGradient.appendChild(VSOMUtils.createSVGElement('stop', {
            offset: '0%',
            'stop-color': 'rgba(100, 150, 255, 0.05)'
        }));
        radialGradient.appendChild(VSOMUtils.createSVGElement('stop', {
            offset: '100%',
            'stop-color': 'rgba(100, 150, 255, 0.01)'
        }));

        gradient.appendChild(radialGradient);
        this.backgroundGroup.appendChild(gradient);

        // Apply gradient background
        const bgRect = VSOMUtils.createSVGElement('rect', {
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
            fill: 'url(#background-gradient)'
        });

        this.backgroundGroup.appendChild(bgRect);
    }

    renderSemanticClusters(bounds) {
        // Clear previous clusters
        this.clusterGroup.innerHTML = '';

        for (const cluster of this.semanticClusters) {
            // Calculate cluster region
            const padding = this.options.gridSpacing * 0.5;
            const x = (cluster.bounds.minX * this.options.gridSpacing) - padding;
            const y = (cluster.bounds.minY * this.options.gridSpacing) - padding;
            const width = ((cluster.bounds.maxX - cluster.bounds.minX) * this.options.gridSpacing) + (2 * padding);
            const height = ((cluster.bounds.maxY - cluster.bounds.minY) * this.options.gridSpacing) + (2 * padding);

            // Create cluster background
            const clusterBg = VSOMUtils.createSVGElement('rect', {
                x,
                y,
                width,
                height,
                rx: 12,
                ry: 12,
                fill: cluster.color,
                'fill-opacity': '0.08',
                stroke: cluster.color,
                'stroke-opacity': '0.2',
                'stroke-width': '2',
                'stroke-dasharray': '5,5',
                class: 'semantic-cluster'
            });

            this.clusterGroup.appendChild(clusterBg);

            // Add cluster label
            const labelX = x + width / 2;
            const labelY = y + 15;

            const clusterLabel = VSOMUtils.createSVGElement('text', {
                x: labelX,
                y: labelY,
                'text-anchor': 'middle',
                fill: cluster.color,
                'font-size': '11px',
                'font-weight': 'bold',
                opacity: '0.7',
                class: 'cluster-label'
            });

            clusterLabel.textContent = `${cluster.category.toUpperCase()} (${cluster.nodes.length})`;
            this.clusterGroup.appendChild(clusterLabel);
        }
    }

    renderNodeConnections() {
        // Clear previous connections
        this.connectionGroup.innerHTML = '';

        for (const connection of this.nodeConnections) {
            const x1 = connection.from.x * this.options.gridSpacing;
            const y1 = connection.from.y * this.options.gridSpacing;
            const x2 = connection.to.x * this.options.gridSpacing;
            const y2 = connection.to.y * this.options.gridSpacing;

            const line = VSOMUtils.createSVGElement('line', {
                x1,
                y1,
                x2,
                y2,
                stroke: connection.type === 'semantic' ? '#4285f4' : '#ff9800',
                'stroke-width': Math.max(1, connection.strength * 3),
                'stroke-opacity': Math.min(0.6, connection.strength),
                'stroke-dasharray': connection.type === 'temporal' ? '3,3' : 'none',
                class: `connection connection-${connection.type}`
            });

            this.connectionGroup.appendChild(line);
        }
    }

    renderEnhancedGrid(bounds) {
        // Clear previous grid
        this.gridGroup.innerHTML = '';

        const gridSpacing = this.options.gridSpacing;
        const startX = Math.floor(bounds.minX / gridSpacing) * gridSpacing;
        const startY = Math.floor(bounds.minY / gridSpacing) * gridSpacing;
        const endX = Math.ceil(bounds.maxX / gridSpacing) * gridSpacing;
        const endY = Math.ceil(bounds.maxY / gridSpacing) * gridSpacing;

        // Vertical grid lines
        for (let x = startX; x <= endX; x += gridSpacing) {
            const line = VSOMUtils.createSVGElement('line', {
                x1: x,
                y1: startY,
                x2: x,
                y2: endY,
                stroke: '#e0e0e0',
                'stroke-width': '1',
                'stroke-opacity': '0.3',
                class: 'grid-line'
            });
            this.gridGroup.appendChild(line);
        }

        // Horizontal grid lines
        for (let y = startY; y <= endY; y += gridSpacing) {
            const line = VSOMUtils.createSVGElement('line', {
                x1: startX,
                y1: y,
                x2: endX,
                y2: y,
                stroke: '#e0e0e0',
                'stroke-width': '1',
                'stroke-opacity': '0.3',
                class: 'grid-line'
            });
            this.gridGroup.appendChild(line);
        }
    }

    renderTemporalFlow() {
        for (const flowItem of this.temporalFlow) {
            if (flowItem.intensity < 0.3) continue; // Only show strong temporal connections

            const x1 = flowItem.from.x * this.options.gridSpacing;
            const y1 = flowItem.from.y * this.options.gridSpacing;
            const x2 = flowItem.to.x * this.options.gridSpacing;
            const y2 = flowItem.to.y * this.options.gridSpacing;

            // Create curved path for temporal flow
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const controlOffset = 20;

            const path = VSOMUtils.createSVGElement('path', {
                d: `M ${x1},${y1} Q ${midX + controlOffset},${midY - controlOffset} ${x2},${y2}`,
                stroke: '#9c27b0',
                'stroke-width': Math.max(1, flowItem.intensity * 2),
                'stroke-opacity': flowItem.intensity * 0.4,
                fill: 'none',
                'stroke-dasharray': '2,2',
                class: 'temporal-flow'
            });

            this.connectionGroup.appendChild(path);

            // Add flow direction indicator
            if (flowItem.intensity > 0.7) {
                const arrowX = x2 - (x2 - x1) * 0.15;
                const arrowY = y2 - (y2 - y1) * 0.15;

                const arrow = VSOMUtils.createSVGElement('circle', {
                    cx: arrowX,
                    cy: arrowY,
                    r: 2,
                    fill: '#9c27b0',
                    opacity: flowItem.intensity * 0.6,
                    class: 'flow-indicator'
                });

                this.connectionGroup.appendChild(arrow);
            }
        }
    }

    renderEnhancedNodes() {
        // Clear previous nodes
        this.nodesGroup.innerHTML = '';

        for (const node of this.data.nodes) {
            const x = node.x * this.options.gridSpacing;
            const y = node.y * this.options.gridSpacing;

            // Create node group
            const nodeGroup = VSOMUtils.createSVGElement('g', {
                class: 'vsom-node-group',
                'data-node-id': node.id,
                transform: `translate(${x}, ${y})`
            });

            // Main node circle
            const circle = VSOMUtils.createSVGElement('circle', {
                cx: 0,
                cy: 0,
                r: node.size,
                fill: node.color,
                stroke: this.getNodeStroke(node),
                'stroke-width': this.getNodeStrokeWidth(node),
                opacity: node.opacity,
                class: 'node-circle',
                'data-interaction-type': node.type,
                'data-quality': node.quality || (node.metadata && node.metadata.quality) || '0',
                'data-tooltip-type': 'enhanced'
            });

            nodeGroup.appendChild(circle);

            // Add quality indicator ring
            if (node.qualityMetrics && node.qualityMetrics.importance > 0.7) {
                const qualityRing = VSOMUtils.createSVGElement('circle', {
                    cx: 0,
                    cy: 0,
                    r: node.size + 3,
                    fill: 'none',
                    stroke: '#ffd700',
                    'stroke-width': '2',
                    opacity: '0.6',
                    class: 'quality-ring'
                });
                nodeGroup.appendChild(qualityRing);
            }

            // Add processing indicator
            if (node.processingSteps && node.processingSteps.length > 2) {
                const processRing = VSOMUtils.createSVGElement('circle', {
                    cx: 0,
                    cy: 0,
                    r: node.size + 1.5,
                    fill: 'none',
                    stroke: '#00bcd4',
                    'stroke-width': '1',
                    'stroke-dasharray': '2,1',
                    opacity: '0.7',
                    class: 'process-ring'
                });
                nodeGroup.appendChild(processRing);
            }

            // Add node icon if available
            if (node.icon) {
                const iconText = VSOMUtils.createSVGElement('text', {
                    x: 0,
                    y: 2,
                    'text-anchor': 'middle',
                    'font-size': Math.max(8, node.size * 0.7),
                    fill: 'white',
                    class: 'node-icon'
                });
                iconText.textContent = node.icon;
                nodeGroup.appendChild(iconText);
            }

            // Add concept count indicator
            if (node.concepts && node.concepts.length > 0) {
                const conceptBadge = VSOMUtils.createSVGElement('circle', {
                    cx: node.size * 0.7,
                    cy: -node.size * 0.7,
                    r: Math.min(6, node.concepts.length + 3),
                    fill: '#4caf50',
                    stroke: 'white',
                    'stroke-width': '1',
                    class: 'concept-badge'
                });
                nodeGroup.appendChild(conceptBadge);

                const conceptCount = VSOMUtils.createSVGElement('text', {
                    x: node.size * 0.7,
                    y: -node.size * 0.7 + 2,
                    'text-anchor': 'middle',
                    'font-size': '8px',
                    fill: 'white',
                    'font-weight': 'bold',
                    class: 'concept-count'
                });
                conceptCount.textContent = Math.min(node.concepts.length, 9);
                nodeGroup.appendChild(conceptCount);
            }

            // Event handlers
            nodeGroup.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleNodeClick(node, nodeGroup);
            });

            nodeGroup.addEventListener('mouseenter', (e) => {
                this.handleNodeMouseEnter(node, nodeGroup, e);
                this.showEnhancedTooltip(node, e);
            });

            nodeGroup.addEventListener('mouseleave', (e) => {
                this.handleNodeMouseLeave(node, nodeGroup);
                this.hideTooltip();
            });

            this.nodesGroup.appendChild(nodeGroup);
        }
    }

    renderEnhancedLabels() {
        // Clear previous labels
        this.labelsGroup.innerHTML = '';

        for (const node of this.data.nodes) {
            const x = node.x * this.options.gridSpacing;
            const y = node.y * this.options.gridSpacing;

            // Primary label (interaction type and brief content)
            const primaryLabel = this.createNodeLabel(node, x, y + node.size + 8);
            this.labelsGroup.appendChild(primaryLabel);

            // Secondary label (concepts)
            if (node.concepts && Array.isArray(node.concepts) && node.concepts.length > 0) {
                let conceptsText = node.concepts.slice(0, 3).join(', ');
                if (conceptsText.length > 30) {
                    conceptsText = conceptsText.substring(0, 30) + '...';
                }

                const secondaryLabel = VSOMUtils.createSVGElement('text', {
                    x: x,
                    y: y + node.size + 20,
                    'text-anchor': 'middle',
                    'font-size': '9px',
                    fill: '#666',
                    opacity: '0.8',
                    class: 'node-label-secondary',
                    'data-node-id': node.id
                });
                secondaryLabel.textContent = conceptsText;
                this.labelsGroup.appendChild(secondaryLabel);
            }
        }
    }

    renderQualityIndicators() {
        if (!this.qualityMetrics) return;

        // Render quality legend
        const legend = this.createQualityLegend();
        this.overlayGroup.appendChild(legend);

        // Add quality-based visual enhancements to existing nodes
        for (const node of this.data.nodes) {
            const nodeElement = this.nodesGroup.querySelector(`[data-node-id="${node.id}"]`);
            if (!nodeElement) continue;

            const quality = node.qualityMetrics?.importance || 0;

            // Add pulsing animation for high-quality nodes
            if (quality > 0.8) {
                nodeElement.style.animation = 'pulse 2s infinite';
            }
        }
    }

    // Helper methods for enhanced features

    calculateConceptSimilarity(nodeA, nodeB) {
        const conceptsA = new Set(nodeA.concepts || []);
        const conceptsB = new Set(nodeB.concepts || []);

        const intersection = new Set([...conceptsA].filter(c => conceptsB.has(c)));
        const union = new Set([...conceptsA, ...conceptsB]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    categorizeQuality(distribution) {
        return {
            high: distribution.filter(d => d.quality > 0.7).length,
            medium: distribution.filter(d => d.quality > 0.4 && d.quality <= 0.7).length,
            low: distribution.filter(d => d.quality <= 0.4).length
        };
    }

    getNodeStroke(node) {
        if (node.qualityMetrics?.importance > 0.8) return '#ffd700';
        if (node.embeddingDimensions > 0) return '#4285f4';
        if (node.chunked) return '#9c27b0';
        return '#ccc';
    }

    getNodeStrokeWidth(node) {
        if (node.qualityMetrics?.importance > 0.8) return '3';
        if (node.memoryImportance > 0.5) return '2';
        return '1';
    }

    createNodeLabel(node, x, y) {
        let labelText = `${node.type}: ${node.content.substring(0, 20)}`;
        if (node.content.length > 20) labelText += '...';

        const label = VSOMUtils.createSVGElement('text', {
            x: x,
            y: y,
            'text-anchor': 'middle',
            'font-size': '10px',
            fill: node.color,
            'font-weight': 'bold',
            class: 'node-label-primary',
            'data-node-id': node.id
        });

        label.textContent = labelText;
        return label;
    }

    showEnhancedTooltip(node, event) {
        if (!this.tooltip) return;

        const tooltipContent = this.generateTooltipContent(node);
        this.tooltip.innerHTML = tooltipContent;

        this.tooltip.style.left = (event.pageX + 10) + 'px';
        this.tooltip.style.top = (event.pageY - 10) + 'px';
        this.tooltip.style.opacity = '1';

        // Update position on mouse move
        const updateTooltipPosition = (e) => {
            this.tooltip.style.left = (e.pageX + 10) + 'px';
            this.tooltip.style.top = (e.pageY - 10) + 'px';
        };

        document.addEventListener('mousemove', updateTooltipPosition);

        // Store cleanup function
        this.tooltipCleanup = () => {
            document.removeEventListener('mousemove', updateTooltipPosition);
        };
    }

    hideTooltip() {
        // Hide VSOMGrid's own tooltip
        if (this.tooltip) {
            this.tooltip.style.opacity = '0';
        }

        if (this.tooltipCleanup) {
            this.tooltipCleanup();
            this.tooltipCleanup = null;
        }

        // Also ensure VSOMUtils tooltips are hidden
        VSOMUtils.hideTooltip();
    }

    generateTooltipContent(node) {
        const semantic = node.semanticInfo || {};
        const quality = node.qualityMetrics || {};
        const temporal = node.temporalInfo || {};

        return `
            <div style="margin-bottom: 8px;">
                <strong>${node.icon || ''} ${node.type.toUpperCase()}</strong>
                <span style="float: right; font-size: 10px; opacity: 0.7;">
                    ${temporal.ageCategory || 'unknown'}
                </span>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                ${node.content.substring(0, 100)}${node.content.length > 100 ? '...' : ''}
            </div>

            ${node.concepts && Array.isArray(node.concepts) && node.concepts.length > 0 ? `
                <div style="margin-bottom: 6px;">
                    <strong>Concepts:</strong> ${node.concepts.slice(0, 5).join(', ')}
                    ${node.concepts.length > 5 ? ` (+${node.concepts.length - 5} more)` : ''}
                </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 6px; font-size: 10px;">
                <div><strong>Quality:</strong> ${(quality.importance || 0).toFixed(2)}</div>
                <div><strong>Complexity:</strong> ${(quality.complexity || 0).toFixed(2)}</div>
                <div><strong>Depth:</strong> ${(quality.depth || 0).toFixed(2)}</div>
                <div><strong>Clarity:</strong> ${(quality.clarity || 0).toFixed(2)}</div>
            </div>

            ${semantic.categories && semantic.categories.length > 0 ? `
                <div style="margin-bottom: 4px; font-size: 10px;">
                    <strong>Categories:</strong> ${semantic.categories.join(', ')}
                </div>
            ` : ''}

            ${node.processingSteps && node.processingSteps.length > 0 ? `
                <div style="font-size: 10px;">
                    <strong>Processing:</strong> ${node.processingSteps.join(' → ')}
                </div>
            ` : ''}

            ${node.embeddingDimensions ? `
                <div style="margin-top: 4px; font-size: 10px; opacity: 0.7;">
                    📊 ${node.embeddingDimensions}D embedding
                    ${node.chunkCount ? ` | ${node.chunkCount} chunks` : ''}
                </div>
            ` : ''}
        `;
    }

    createQualityLegend() {
        // Position in bottom-right corner
        const containerWidth = this.width || 800;
        const containerHeight = this.height || 600;
        const legendWidth = 150;
        const legendHeight = 60;
        const margin = 10;

        const x = containerWidth - legendWidth - margin;
        const y = containerHeight - legendHeight - margin;

        const legendGroup = VSOMUtils.createSVGElement('g', {
            class: 'quality-legend',
            transform: `translate(${x}, ${y})`
        });

        // Background
        const bgRect = VSOMUtils.createSVGElement('rect', {
            x: 0,
            y: 0,
            width: 150,
            height: 60,
            fill: 'rgba(255, 255, 255, 0.9)',
            stroke: '#ccc',
            'stroke-width': '1',
            rx: '4'
        });
        legendGroup.appendChild(bgRect);

        // Title
        const title = VSOMUtils.createSVGElement('text', {
            x: 8,
            y: 15,
            'font-size': '12px',
            'font-weight': 'bold',
            fill: '#333'
        });
        title.textContent = 'Quality Indicators';
        legendGroup.appendChild(title);

        // Legend items
        const items = [
            { color: '#ffd700', label: 'High importance', y: 30 },
            { color: '#4285f4', label: 'Has embedding', y: 45 }
        ];

        items.forEach(item => {
            const circle = VSOMUtils.createSVGElement('circle', {
                cx: 15,
                cy: item.y,
                r: 4,
                fill: item.color
            });
            legendGroup.appendChild(circle);

            const text = VSOMUtils.createSVGElement('text', {
                x: 25,
                y: item.y + 3,
                'font-size': '10px',
                fill: '#666'
            });
            text.textContent = item.label;
            legendGroup.appendChild(text);
        });

        return legendGroup;
    }

    cleanup() {
        // Remove event listeners
        this.hideTooltip();

        if (this.tooltip) {
            document.body.removeChild(this.tooltip);
            this.tooltip = null;
        }

        // Clear data
        this.data = null;
        this.selectedNode = null;
        this.hoveredNode = null;
        this.semanticClusters = [];
        this.nodeConnections = [];
        this.qualityMetrics = null;
        this.temporalFlow = [];

        console.log('Enhanced VSOM Grid cleaned up');
    }
}