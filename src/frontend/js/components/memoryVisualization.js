/**
 * Memory Visualization Components
 * Handles interactive memory graphs, timelines, clusters, and advanced search
 */

// D3.js import - will be loaded via script tag in webpack
import * as d3 from 'd3';

/**
 * Memory Visualization Manager
 * Orchestrates all memory visualization components
 */
class MemoryVisualizationManager {
    constructor() {
        this.memoryGraph = new MemoryGraphViz();
        this.memoryTimeline = new MemoryTimelineViz();
        this.memoryClusters = new MemoryClustersViz();
        this.memorySearch = new MemoryAdvancedSearch();
        
        this.currentMemories = [];
        this.currentConcepts = [];
        this.initialized = false;
    }

    /**
     * Initialize memory visualization components
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize each component
            this.memoryGraph.initialize();
            this.memoryTimeline.initialize();
            this.memoryClusters.initialize();
            this.memorySearch.initialize();

            // Set up event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('Memory visualization manager initialized');
        } catch (error) {
            console.error('Error initializing memory visualization:', error);
        }
    }

    /**
     * Set up event listeners for memory visualization
     */
    setupEventListeners() {
        // Memory Graph Events
        document.getElementById('load-memory-graph')?.addEventListener('click', () => {
            this.loadMemoryGraph();
        });

        document.getElementById('refresh-memory-graph')?.addEventListener('click', () => {
            this.refreshMemoryGraph();
        });

        // Timeline Events
        document.getElementById('load-memory-timeline')?.addEventListener('click', () => {
            this.loadMemoryTimeline();
        });

        // Clusters Events
        document.getElementById('load-memory-clusters')?.addEventListener('click', () => {
            this.loadMemoryClusters();
        });

        document.getElementById('recalculate-clusters')?.addEventListener('click', () => {
            this.recalculateClusters();
        });

        // Advanced Search Events
        document.getElementById('execute-memory-search')?.addEventListener('click', () => {
            this.executeAdvancedSearch();
        });

        document.getElementById('clear-filters')?.addEventListener('click', () => {
            this.clearSearchFilters();
        });

        // Threshold slider updates
        document.getElementById('memory-graph-threshold')?.addEventListener('input', (e) => {
            document.getElementById('memory-graph-threshold-value').textContent = e.target.value;
        });

        document.getElementById('similarity-threshold')?.addEventListener('input', (e) => {
            document.getElementById('similarity-threshold-value').textContent = e.target.value;
        });
    }

    /**
     * Load and display memory graph
     */
    async loadMemoryGraph() {
        try {
            const limit = document.getElementById('memory-graph-limit')?.value || 50;
            const threshold = document.getElementById('memory-graph-threshold')?.value || 0.7;

            // Show loading state
            this.showGraphLoading('memory-graph-container');

            // Fetch memory data
            const memories = await this.fetchMemoryData(limit, threshold);
            const concepts = await this.fetchConceptData();

            // Update data
            this.currentMemories = memories;
            this.currentConcepts = concepts;

            // Render graph
            this.memoryGraph.render(memories, concepts, {
                threshold: parseFloat(threshold),
                container: 'memory-graph-container'
            });

            // Update info stats
            this.updateGraphInfo(memories, concepts);

        } catch (error) {
            console.error('Error loading memory graph:', error);
            this.showGraphError('memory-graph-container', 'Failed to load memory graph');
        }
    }

    /**
     * Refresh memory graph with current data
     */
    async refreshMemoryGraph() {
        await this.loadMemoryGraph();
    }

    /**
     * Load and display memory timeline
     */
    async loadMemoryTimeline() {
        try {
            const period = document.getElementById('timeline-period')?.value || 'week';
            const grouping = document.getElementById('timeline-grouping')?.value || 'day';
            const showAccess = document.getElementById('show-access-patterns')?.checked || true;

            this.showGraphLoading('memory-timeline-container');

            const timelineData = await this.fetchTimelineData(period, grouping, showAccess);

            this.memoryTimeline.render(timelineData, {
                period,
                grouping,
                showAccess,
                container: 'memory-timeline-container'
            });

        } catch (error) {
            console.error('Error loading memory timeline:', error);
            this.showGraphError('memory-timeline-container', 'Failed to load memory timeline');
        }
    }

    /**
     * Load and display memory clusters
     */
    async loadMemoryClusters() {
        try {
            const clusterCount = document.getElementById('cluster-count')?.value || 5;
            const method = document.getElementById('cluster-method')?.value || 'kmeans';

            this.showGraphLoading('memory-clusters-container');

            const clusterData = await this.fetchClusterData(clusterCount, method);

            this.memoryClusters.render(clusterData, {
                clusterCount: parseInt(clusterCount),
                method,
                container: 'memory-clusters-container'
            });

            this.updateClusterStats(clusterData);

        } catch (error) {
            console.error('Error loading memory clusters:', error);
            this.showGraphError('memory-clusters-container', 'Failed to load memory clusters');
        }
    }

    /**
     * Recalculate clusters with new parameters
     */
    async recalculateClusters() {
        await this.loadMemoryClusters();
    }

    /**
     * Execute advanced memory search
     */
    async executeAdvancedSearch() {
        try {
            const filters = this.memorySearch.getSearchFilters();
            const results = await this.searchMemories(filters);
            
            this.memorySearch.displayResults(results);

        } catch (error) {
            console.error('Error executing memory search:', error);
            this.memorySearch.showError('Failed to execute search');
        }
    }

    /**
     * Clear all search filters
     */
    clearSearchFilters() {
        this.memorySearch.clearFilters();
    }

    /**
     * Fetch memory data from API
     */
    async fetchMemoryData(limit = 50, threshold = 0.7) {
        const response = await fetch('/api/memory/graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit, threshold })
        });

        if (!response.ok) {
            // Fallback to mock data for development
            return this.generateMockMemoryData(limit);
        }

        return await response.json();
    }

    /**
     * Fetch concept data from API
     */
    async fetchConceptData() {
        const response = await fetch('/api/memory/concepts');
        
        if (!response.ok) {
            return this.generateMockConceptData();
        }

        return await response.json();
    }

    /**
     * Fetch timeline data from API
     */
    async fetchTimelineData(period, grouping, showAccess) {
        const response = await fetch('/api/memory/timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period, grouping, showAccess })
        });

        if (!response.ok) {
            return this.generateMockTimelineData(period, grouping);
        }

        return await response.json();
    }

    /**
     * Fetch cluster data from API
     */
    async fetchClusterData(clusterCount, method) {
        const response = await fetch('/api/memory/clusters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clusterCount, method })
        });

        if (!response.ok) {
            return this.generateMockClusterData(clusterCount);
        }

        return await response.json();
    }

    /**
     * Search memories with filters
     */
    async searchMemories(filters) {
        const response = await fetch('/api/memory/search/advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });

        if (!response.ok) {
            return this.generateMockSearchResults(filters);
        }

        return await response.json();
    }

    /**
     * Show loading state in graph container
     */
    showGraphLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="graph-loading">
                    <div class="spinner"></div>
                    <p>Loading visualization...</p>
                </div>
            `;
        }
    }

    /**
     * Show error state in graph container
     */
    showGraphError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="graph-error">
                    <p>❌ ${message}</p>
                    <button class="btn secondary-btn" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }

    /**
     * Update graph info statistics
     */
    updateGraphInfo(memories, concepts) {
        const memoryCount = memories?.length || 0;
        const conceptCount = concepts?.length || 0;
        const connectionCount = this.calculateConnections(memories, concepts);

        document.getElementById('memory-count').textContent = memoryCount;
        document.getElementById('concept-count').textContent = conceptCount;
        document.getElementById('connection-count').textContent = connectionCount;
    }

    /**
     * Update cluster statistics
     */
    updateClusterStats(clusterData) {
        const clusters = clusterData?.clusters || [];
        const totalClusters = clusters.length;
        const largestCluster = Math.max(...clusters.map(c => c.memories?.length || 0));
        const avgClusterSize = totalClusters > 0 ? 
            clusters.reduce((sum, c) => sum + (c.memories?.length || 0), 0) / totalClusters : 0;

        document.getElementById('total-clusters').textContent = totalClusters;
        document.getElementById('largest-cluster').textContent = `${largestCluster} memories`;
        document.getElementById('average-cluster-size').textContent = avgClusterSize.toFixed(1);
    }

    /**
     * Calculate number of connections between memories and concepts
     */
    calculateConnections(memories, concepts) {
        let connections = 0;
        
        memories?.forEach(memory => {
            const memoryConcepts = memory.concepts || [];
            connections += memoryConcepts.length;
        });

        return connections;
    }

    // Mock data generators for development/fallback
    generateMockMemoryData(limit) {
        const memories = [];
        for (let i = 0; i < Math.min(limit, 20); i++) {
            memories.push({
                id: `memory-${i}`,
                prompt: `Sample prompt ${i + 1}`,
                response: `Sample response ${i + 1}`,
                timestamp: Date.now() - (i * 86400000), // Days ago
                concepts: [`concept-${i % 5}`, `concept-${(i + 1) % 5}`],
                accessCount: Math.floor(Math.random() * 10) + 1,
                decayFactor: Math.random(),
                type: i % 2 === 0 ? 'user' : 'assistant'
            });
        }
        return memories;
    }

    generateMockConceptData() {
        return [
            { id: 'concept-0', name: 'Programming', weight: 0.8 },
            { id: 'concept-1', name: 'JavaScript', weight: 0.7 },
            { id: 'concept-2', name: 'API Design', weight: 0.6 },
            { id: 'concept-3', name: 'Database', weight: 0.5 },
            { id: 'concept-4', name: 'Visualization', weight: 0.4 }
        ];
    }

    generateMockTimelineData(period, grouping) {
        const data = [];
        const now = new Date();
        const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 90;
        
        for (let i = 0; i < days; i++) {
            const date = new Date(now - (i * 86400000));
            data.push({
                date,
                memoryCount: Math.floor(Math.random() * 10),
                accessCount: Math.floor(Math.random() * 20)
            });
        }
        
        return data.reverse();
    }

    generateMockClusterData(clusterCount) {
        const clusters = [];
        for (let i = 0; i < clusterCount; i++) {
            const memories = [];
            const size = Math.floor(Math.random() * 8) + 2;
            
            for (let j = 0; j < size; j++) {
                memories.push({
                    id: `cluster-${i}-memory-${j}`,
                    prompt: `Cluster ${i} memory ${j}`,
                    similarity: Math.random()
                });
            }
            
            clusters.push({
                id: i,
                label: `Cluster ${i + 1}`,
                memories,
                centroid: [Math.random() * 100, Math.random() * 100]
            });
        }
        
        return { clusters };
    }

    generateMockSearchResults(filters) {
        return {
            results: this.generateMockMemoryData(10),
            totalCount: 10,
            executionTime: Math.random() * 100 + 50
        };
    }
}

/**
 * Memory Graph Visualization Component
 */
class MemoryGraphViz {
    constructor() {
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
    }

    initialize() {
        console.log('Memory graph visualization initialized');
    }

    render(memories, concepts, options = {}) {
        const container = document.getElementById(options.container || 'memory-graph-container');
        if (!container) return;

        // Clear container
        container.innerHTML = '';

        // Set up dimensions
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;

        // Create SVG
        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Prepare nodes and links
        this.prepareGraphData(memories, concepts, options.threshold);

        // Create force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(50))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2));

        // Draw links
        const link = this.svg.append('g')
            .selectAll('line')
            .data(this.links)
            .enter().append('line')
            .attr('class', 'memory-link')
            .classed('strong', d => d.strength > 0.7);

        // Draw nodes
        const node = this.svg.append('g')
            .selectAll('circle')
            .data(this.nodes)
            .enter().append('circle')
            .attr('r', d => d.type === 'concept' ? 8 : 12)
            .attr('class', d => d.type === 'concept' ? 'concept-node' : 'memory-node')
            .classed('user', d => d.subtype === 'user')
            .classed('assistant', d => d.subtype === 'assistant')
            .call(d3.drag()
                .on('start', (event, d) => this.dragstarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragended(event, d)))
            .on('click', (event, d) => this.nodeClicked(event, d));

        // Add labels
        const label = this.svg.append('g')
            .selectAll('text')
            .data(this.nodes)
            .enter().append('text')
            .attr('class', 'memory-label')
            .attr('dy', '.35em')
            .text(d => d.label.substring(0, 20) + (d.label.length > 20 ? '...' : ''));

        // Update positions on simulation tick
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y + 20);
        });
    }

    prepareGraphData(memories, concepts, threshold) {
        this.nodes = [];
        this.links = [];

        // Add memory nodes
        memories.forEach(memory => {
            this.nodes.push({
                id: memory.id,
                label: memory.prompt || memory.response || 'Memory',
                type: 'memory',
                subtype: memory.type || 'user',
                data: memory
            });
        });

        // Add concept nodes
        concepts.forEach(concept => {
            this.nodes.push({
                id: concept.id,
                label: concept.name || concept.id,
                type: 'concept',
                weight: concept.weight || 0.5,
                data: concept
            });
        });

        // Add links between memories and concepts
        memories.forEach(memory => {
            const memoryConcepts = memory.concepts || [];
            memoryConcepts.forEach(conceptId => {
                if (concepts.find(c => c.id === conceptId)) {
                    this.links.push({
                        source: memory.id,
                        target: conceptId,
                        strength: Math.random() * 0.5 + 0.5
                    });
                }
            });
        });

        // Add links between similar memories (based on threshold)
        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const similarity = this.calculateSimilarity(memories[i], memories[j]);
                if (similarity > threshold) {
                    this.links.push({
                        source: memories[i].id,
                        target: memories[j].id,
                        strength: similarity
                    });
                }
            }
        }
    }

    calculateSimilarity(memory1, memory2) {
        // Simple concept overlap similarity
        const concepts1 = new Set(memory1.concepts || []);
        const concepts2 = new Set(memory2.concepts || []);
        const intersection = new Set([...concepts1].filter(x => concepts2.has(x)));
        const union = new Set([...concepts1, ...concepts2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    dragstarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragended(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    nodeClicked(event, d) {
        // Update selected memory info
        document.getElementById('selected-memory').textContent = d.label;
        
        // Highlight selected node
        this.svg.selectAll('.memory-node, .concept-node').classed('selected', false);
        d3.select(event.target).classed('selected', true);

        // Show memory details if available
        if (d.type === 'memory') {
            this.showMemoryDetails(d.data);
        }
    }

    showMemoryDetails(memory) {
        const detailsPanel = document.getElementById('timeline-memory-details');
        if (detailsPanel) {
            detailsPanel.innerHTML = `
                <h5>Memory Details</h5>
                <p><strong>Prompt:</strong> ${memory.prompt || 'N/A'}</p>
                <p><strong>Response:</strong> ${memory.response || 'N/A'}</p>
                <p><strong>Created:</strong> ${new Date(memory.timestamp).toLocaleString()}</p>
                <p><strong>Access Count:</strong> ${memory.accessCount || 0}</p>
                <p><strong>Concepts:</strong> ${(memory.concepts || []).join(', ') || 'None'}</p>
            `;
        }
    }
}

/**
 * Memory Timeline Visualization Component
 */
class MemoryTimelineViz {
    constructor() {
        this.svg = null;
    }

    initialize() {
        console.log('Memory timeline visualization initialized');
    }

    render(data, options = {}) {
        const container = document.getElementById(options.container || 'memory-timeline-container');
        if (!container) return;

        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };

        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = this.svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date))
            .range([0, width - margin.left - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.memoryCount, d.accessCount))])
            .range([height - margin.top - margin.bottom, 0]);

        // Add axes
        g.append('g')
            .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%m/%d')));

        g.append('g')
            .call(d3.axisLeft(yScale));

        // Add memory creation bars
        g.selectAll('.timeline-bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'timeline-bar')
            .attr('x', d => xScale(d.date) - 5)
            .attr('y', d => yScale(d.memoryCount))
            .attr('width', 10)
            .attr('height', d => height - margin.top - margin.bottom - yScale(d.memoryCount))
            .on('click', (event, d) => this.timelinePointClicked(event, d));

        // Add access pattern line if enabled
        if (options.showAccess) {
            const line = d3.line()
                .x(d => xScale(d.date))
                .y(d => yScale(d.accessCount))
                .curve(d3.curveMonotoneX);

            g.append('path')
                .datum(data)
                .attr('class', 'access-pattern-line')
                .attr('d', line);

            g.selectAll('.timeline-point')
                .data(data)
                .enter().append('circle')
                .attr('class', 'timeline-point')
                .attr('cx', d => xScale(d.date))
                .attr('cy', d => yScale(d.accessCount))
                .attr('r', 3)
                .on('click', (event, d) => this.timelinePointClicked(event, d));
        }
    }

    timelinePointClicked(event, d) {
        const detailsPanel = document.getElementById('timeline-memory-details');
        if (detailsPanel) {
            detailsPanel.innerHTML = `
                <h5>Timeline Point</h5>
                <p><strong>Date:</strong> ${d.date.toLocaleDateString()}</p>
                <p><strong>Memories Created:</strong> ${d.memoryCount}</p>
                <p><strong>Total Accesses:</strong> ${d.accessCount}</p>
            `;
        }
    }
}

/**
 * Memory Clusters Visualization Component
 */
class MemoryClustersViz {
    constructor() {
        this.svg = null;
    }

    initialize() {
        console.log('Memory clusters visualization initialized');
    }

    render(clusterData, options = {}) {
        const container = document.getElementById(options.container || 'memory-clusters-container');
        if (!container) return;

        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;

        this.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const clusters = clusterData.clusters || [];

        // Create cluster groups
        const clusterGroups = this.svg.selectAll('.cluster-group')
            .data(clusters)
            .enter().append('g')
            .attr('class', 'cluster-group');

        // Position clusters in a grid
        const cols = Math.ceil(Math.sqrt(clusters.length));
        const cellWidth = width / cols;
        const cellHeight = height / Math.ceil(clusters.length / cols);

        clusters.forEach((cluster, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const centerX = col * cellWidth + cellWidth / 2;
            const centerY = row * cellHeight + cellHeight / 2;

            const group = d3.select(clusterGroups.nodes()[i]);

            // Draw cluster boundary
            group.append('circle')
                .attr('class', 'cluster-group')
                .attr('cx', centerX)
                .attr('cy', centerY)
                .attr('r', Math.min(cellWidth, cellHeight) / 3);

            // Draw cluster memories as nodes
            const memories = cluster.memories || [];
            const angleStep = (2 * Math.PI) / memories.length;
            const radius = Math.min(cellWidth, cellHeight) / 6;

            memories.forEach((memory, j) => {
                const angle = j * angleStep;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                group.append('circle')
                    .attr('class', `cluster-node cluster-${i}`)
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 4)
                    .on('click', () => this.clusterNodeClicked(memory));
            });

            // Add cluster label
            group.append('text')
                .attr('class', 'cluster-label')
                .attr('x', centerX)
                .attr('y', centerY + Math.min(cellWidth, cellHeight) / 2.5)
                .text(`${cluster.label} (${memories.length})`);
        });
    }

    clusterNodeClicked(memory) {
        console.log('Cluster node clicked:', memory);
        // Could show memory details or navigate to memory
    }
}

/**
 * Advanced Memory Search Component
 */
class MemoryAdvancedSearch {
    constructor() {
        this.currentResults = [];
    }

    initialize() {
        console.log('Memory advanced search initialized');
        this.setupDatePresets();
    }

    setupDatePresets() {
        const presetSelect = document.getElementById('time-preset');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                this.applyDatePreset(e.target.value);
            });
        }
    }

    applyDatePreset(preset) {
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        const now = new Date();
        
        if (!dateFrom || !dateTo) return;

        switch (preset) {
            case 'today':
                dateFrom.value = now.toISOString().split('T')[0];
                dateTo.value = now.toISOString().split('T')[0];
                break;
            case 'yesterday':
                const yesterday = new Date(now - 86400000);
                dateFrom.value = yesterday.toISOString().split('T')[0];
                dateTo.value = yesterday.toISOString().split('T')[0];
                break;
            case 'week':
                const weekAgo = new Date(now - (7 * 86400000));
                dateFrom.value = weekAgo.toISOString().split('T')[0];
                dateTo.value = now.toISOString().split('T')[0];
                break;
            case 'month':
                const monthAgo = new Date(now - (30 * 86400000));
                dateFrom.value = monthAgo.toISOString().split('T')[0];
                dateTo.value = now.toISOString().split('T')[0];
                break;
        }
    }

    getSearchFilters() {
        return {
            query: document.getElementById('search-query')?.value || '',
            searchIn: Array.from(document.getElementById('search-in')?.selectedOptions || [])
                .map(option => option.value),
            dateFrom: document.getElementById('date-from')?.value || null,
            dateTo: document.getElementById('date-to')?.value || null,
            accessCountMin: parseInt(document.getElementById('access-count-min')?.value) || 0,
            similarityThreshold: parseFloat(document.getElementById('similarity-threshold')?.value) || 0.7,
            highFrequencyOnly: document.getElementById('high-frequency-only')?.checked || false,
            recentOnly: document.getElementById('recent-only')?.checked || false
        };
    }

    clearFilters() {
        document.getElementById('search-query').value = '';
        document.getElementById('search-in').selectedIndex = -1;
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.getElementById('access-count-min').value = '0';
        document.getElementById('similarity-threshold').value = '0.7';
        document.getElementById('similarity-threshold-value').textContent = '0.7';
        document.getElementById('high-frequency-only').checked = false;
        document.getElementById('recent-only').checked = false;
        document.getElementById('time-preset').value = '';
    }

    displayResults(results) {
        const resultsContainer = document.getElementById('memory-search-results');
        if (!resultsContainer) return;

        this.currentResults = results.results || [];

        if (this.currentResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="results-placeholder">
                    <p>No memories found matching your criteria</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="search-results-header">
                <h4>Search Results (${this.currentResults.length} found)</h4>
                <p>Execution time: ${results.executionTime?.toFixed(2) || 0}ms</p>
            </div>
            <div class="search-results-list">
                ${this.currentResults.map(memory => this.renderMemoryResult(memory)).join('')}
            </div>
        `;
    }

    renderMemoryResult(memory) {
        return `
            <div class="memory-result-item" data-memory-id="${memory.id}">
                <div class="memory-result-header">
                    <span class="memory-type">${memory.type || 'memory'}</span>
                    <span class="memory-date">${new Date(memory.timestamp).toLocaleDateString()}</span>
                    <span class="memory-score">${(memory.score || 0).toFixed(3)}</span>
                </div>
                <div class="memory-result-content">
                    <p><strong>Prompt:</strong> ${(memory.prompt || '').substring(0, 100)}...</p>
                    <p><strong>Response:</strong> ${(memory.response || '').substring(0, 100)}...</p>
                    <p><strong>Concepts:</strong> ${(memory.concepts || []).join(', ')}</p>
                </div>
                <div class="memory-result-stats">
                    <span>Access Count: ${memory.accessCount || 0}</span>
                    <span>Decay Factor: ${(memory.decayFactor || 0).toFixed(3)}</span>
                </div>
            </div>
        `;
    }

    showError(message) {
        const resultsContainer = document.getElementById('memory-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-error">
                    <p>❌ ${message}</p>
                </div>
            `;
        }
    }
}

// Initialize and export
let memoryVizManager = null;

export function initMemoryVisualization() {
    if (!memoryVizManager) {
        memoryVizManager = new MemoryVisualizationManager();
    }
    return memoryVizManager.initialize();
}

export function getMemoryVisualizationManager() {
    return memoryVizManager;
}