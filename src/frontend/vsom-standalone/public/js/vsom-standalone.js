/**
 * VSOM Standalone Application
 * Main entry point for the standalone VSOM page
 */

import VSOMGrid from './components/VSOMGrid.js';
import DataPanel from './components/DataPanel.js';
import ZPTControls from './components/ZPTControls.js';
import VSOMApiService from './services/VSOMApiService.js';
import DataProcessor from './services/DataProcessor.js';
import VSOMUtils from './utils/VSOMUtils.js';

class VSOMStandaloneApp {
    constructor() {
        this.components = {};
        this.services = {};
        this.state = {
            // ZPT State
            zoom: 'entity',
            pan: { domains: '', keywords: '' },
            tilt: 'keywords',
            threshold: 0.3,
            
            // App State
            interactions: [],
            vsomData: null,
            connected: false,
            lastUpdate: null
        };
        
        this.updateInterval = null;
        this.initialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.updateState = this.updateState.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.handleZPTChange = this.handleZPTChange.bind(this);
        this.showToast = this.showToast.bind(this);
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Initializing VSOM Standalone App...');
        
        try {
            // Initialize services
            await this.initializeServices();
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();

            // Clear any existing tooltips from previous sessions
            VSOMUtils.hideTooltip();

            // Initial data load
            await this.refreshData();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            this.initialized = true;
            console.log('✅ VSOM Standalone App initialized successfully');
            
            this.showToast('VSOM Navigation Ready', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize VSOM Standalone App:', error);
            this.showToast('Failed to initialize: ' + error.message, 'error');
        }
    }
    
    async initializeServices() {
        this.services.api = new VSOMApiService();
        this.services.processor = new DataProcessor();
        
        // Test connection
        const connected = await this.services.api.testConnection();
        this.updateConnectionStatus(connected);
    }
    
    async initializeComponents() {
        // Initialize VSOM Grid component
        const gridContainer = document.getElementById('vsom-grid');
        if (gridContainer) {
            this.components.grid = new VSOMGrid(gridContainer, {
                onNodeClick: this.handleNodeClick.bind(this),
                onNodeHover: this.handleNodeHover.bind(this)
            });
            await this.components.grid.init();
        }
        
        // Initialize Data Panel component
        const dataContainer = document.getElementById('data-panel');
        if (dataContainer) {
            this.components.dataPanel = new DataPanel(dataContainer, {
                onInteractionClick: this.handleInteractionClick.bind(this)
            });
            await this.components.dataPanel.init();
        }
        
        // Initialize ZPT Controls component
        const zptContainer = document.getElementById('zpt-controls');
        if (zptContainer) {
            this.components.zptControls = new ZPTControls(zptContainer, {
                onZPTChange: this.handleZPTChange,
                initialState: {
                    zoom: this.state.zoom,
                    pan: this.state.pan,
                    tilt: this.state.tilt,
                    threshold: this.state.threshold
                }
            });
            await this.components.zptControls.init();
        }
    }
    
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-map');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', this.refreshData);
        }
        
        // Auto layout button
        const autoLayoutBtn = document.getElementById('auto-layout');
        if (autoLayoutBtn) {
            autoLayoutBtn.addEventListener('click', this.handleAutoLayout.bind(this));
        }
        
        // Window events
        window.addEventListener('beforeunload', this.cleanup.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Visibility change (pause updates when hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPeriodicUpdates();
            } else {
                this.startPeriodicUpdates();
            }
        });
    }
    
    async refreshData() {
        try {
            this.showLoading(true);

            // Clear any existing tooltips before refresh
            VSOMUtils.hideTooltip();

            // Get comprehensive data from multiple sources including SPARQL store
            const [sessionData, conceptsData, zptState, sparqlData, entitiesData, memoryData] = await Promise.allSettled([
                this.services.api.getSessionData(),
                this.services.api.getConceptsData(),
                this.services.api.getZPTState(),
                this.services.api.getSPARQLData(),
                this.services.api.getEntities(),
                this.services.api.getMemoryItems()
            ]);

            // Extract successful results
            const session = sessionData.status === 'fulfilled' ? sessionData.value : {};
            const concepts = conceptsData.status === 'fulfilled' ? conceptsData.value : {};
            const zpt = zptState.status === 'fulfilled' ? zptState.value : {};
            const sparql = sparqlData.status === 'fulfilled' ? sparqlData.value : {};
            const entities = entitiesData.status === 'fulfilled' ? entitiesData.value : {};
            const memory = memoryData.status === 'fulfilled' ? memoryData.value : {};

            // Aggregate all available data sources including SPARQL
            const aggregatedData = this.aggregateDataSources(session, concepts, zpt, sparql, entities, memory);

            // Current ZPT parameters
            const currentZPT = {
                zoom: zpt.zoom || this.state.zoom,
                pan: zpt.pan || this.state.pan,
                tilt: zpt.tilt || this.state.tilt,
                threshold: zpt.threshold || this.state.threshold
            };

            // Process all data for VSOM visualization
            const vsomData = await this.services.processor.processInteractions(aggregatedData.items, currentZPT);

            // Update state
            this.updateState({
                interactions: aggregatedData.interactions,
                vsomData,
                concepts: aggregatedData.concepts,
                aggregatedData,
                zoom: currentZPT.zoom,
                pan: currentZPT.pan,
                tilt: currentZPT.tilt,
                threshold: currentZPT.threshold,
                lastUpdate: new Date()
            });

            // Update components
            await this.updateComponents();

            this.showLoading(false);

        } catch (error) {
            console.error('Failed to refresh data:', error);
            this.showToast('Failed to refresh data: ' + error.message, 'error');
            this.showLoading(false);
        }
    }

    /**
     * Aggregate data from multiple sources based on ZPT scope
     */
    aggregateDataSources(sessionData, conceptsData, zptState) {
        const interactions = sessionData.sessionCache?.interactions || sessionData.detailedInteractions || sessionData.interactions || [];
        const conceptAnalytics = conceptsData.conceptAnalytics || {};
        const concepts = Array.isArray(conceptAnalytics.topConcepts) ? conceptAnalytics.topConcepts : [];
        const relationships = conceptsData.conceptRelationships || [];

        // Create visualizable items from all sources
        const items = [];

        // Add interactions as entities
        interactions.forEach(interaction => {
            items.push({
                ...interaction,
                type: interaction.type || 'interaction',
                source: 'session',
                visualType: 'entity'
            });
        });

        // Add concepts as semantic units
        concepts.forEach((concept, index) => {
            items.push({
                id: `concept_${index}`,
                type: 'concept',
                content: concept.concept || concept.name,
                concepts: [concept.concept || concept.name],
                frequency: concept.count || concept.frequency || 1,
                source: 'concepts',
                visualType: 'unit',
                x: index % 5,
                y: Math.floor(index / 5),
                size: Math.max(6, Math.min(20, (concept.count || 1) * 2)),
                color: '#4CAF50',
                metadata: {
                    quality: Math.min(1, (concept.count || 1) / 10),
                    importance: Math.min(1, (concept.frequency || 0.1) * 2)
                }
            });
        });

        // Add relationships as connections
        relationships.forEach((rel, index) => {
            items.push({
                id: `relationship_${index}`,
                type: 'relationship',
                content: `${rel.source} → ${rel.target}`,
                concepts: [rel.source, rel.target],
                source: 'relationships',
                visualType: 'connection',
                x: index % 5,
                y: Math.floor(index / 5),
                size: 8,
                color: '#FF9800',
                metadata: {
                    strength: rel.strength || 0.5,
                    quality: rel.confidence || 0.7
                }
            });
        });

        // If no data, create placeholder entities to show the visualization is working
        if (items.length === 0) {
            const placeholders = this.createPlaceholderData();
            items.push(...placeholders);
        }

        return {
            items,
            interactions,
            concepts,
            relationships,
            totalItems: items.length,
            sources: {
                interactions: interactions.length,
                concepts: concepts.length,
                relationships: relationships.length
            }
        };
    }

    /**
     * Create placeholder data when no real data is available
     */
    createPlaceholderData() {
        const placeholders = [];
        const placeholderTypes = [
            { type: 'system', content: 'VSOM Navigation System', color: '#2196F3' },
            { type: 'memory', content: 'Semantic Memory Store', color: '#9C27B0' },
            { type: 'concept', content: 'Knowledge Graph', color: '#4CAF50' },
            { type: 'interaction', content: 'Ready for Data', color: '#FF5722' },
            { type: 'analytics', content: 'Analytics Engine', color: '#E91E63' },
            { type: 'processing', content: 'Data Processing', color: '#FF9800' },
            { type: 'storage', content: 'Storage Layer', color: '#795548' },
            { type: 'query', content: 'Query Interface', color: '#607D8B' },
            { type: 'embedding', content: 'Embedding Service', color: '#009688' },
            { type: 'semantic', content: 'Semantic Analysis', color: '#8BC34A' }
        ];

        placeholderTypes.forEach((item, index) => {
            placeholders.push({
                id: `placeholder_${index}`,
                type: item.type,
                content: item.content,
                concepts: [item.type, 'placeholder', 'semem'],
                source: 'placeholder',
                visualType: 'entity',
                // Don't set x,y coordinates here - let DataProcessor position them properly
                size: 8 + Math.random() * 8, // Varied sizes
                color: item.color,
                opacity: 0.8,
                timestamp: new Date().toISOString(),
                metadata: {
                    quality: 0.5, // Default quality for placeholder
                    importance: 0.5, // Default importance for placeholder
                    isPlaceholder: true
                }
            });
        });

        return placeholders;
    }

    async updateComponents() {
        // Update VSOM Grid
        if (this.components.grid && this.state.vsomData) {
            await this.components.grid.updateData(this.state.vsomData);
        }
        
        // Update Data Panel
        if (this.components.dataPanel) {
            await this.components.dataPanel.updateData({
                interactions: this.state.interactions,
                sessionStats: this.getSessionStats(),
                vsomStats: this.getVSOMStats()
            });
        }
        
        // Update ZPT Controls
        if (this.components.zptControls) {
            await this.components.zptControls.updateState({
                zoom: this.state.zoom,
                pan: this.state.pan,
                tilt: this.state.tilt,
                threshold: this.state.threshold
            });
        }
        
        // Update UI elements
        this.updateUIElements();
    }
    
    updateUIElements() {
        // Update header info
        const interactionsCount = document.getElementById('interactions-count');
        if (interactionsCount) {
            interactionsCount.textContent = this.state.interactions.length;
        }
        
        const sessionDuration = document.getElementById('session-duration');
        if (sessionDuration) {
            sessionDuration.textContent = this.getFormattedDuration();
        }
        
        // Update ZPT display
        const currentZoom = document.getElementById('current-zoom');
        if (currentZoom) {
            currentZoom.textContent = this.state.zoom;
        }
        
        const currentPan = document.getElementById('current-pan');
        if (currentPan) {
            const panText = this.state.pan.domains || this.state.pan.keywords ? 
                'filtered' : 'all';
            currentPan.textContent = panText;
        }
        
        const currentTilt = document.getElementById('current-tilt');
        if (currentTilt) {
            currentTilt.textContent = this.state.tilt;
        }
        
        // Update last update time
        const lastUpdate = document.getElementById('last-update');
        if (lastUpdate && this.state.lastUpdate) {
            lastUpdate.textContent = VSOMUtils.formatRelativeTime(this.state.lastUpdate);
        }
    }
    
    async handleZPTChange(changes) {
        console.log('ZPT state changed:', changes);
        
        // Update local state
        this.updateState(changes);
        
        // Send changes to API if needed
        try {
            if (changes.zoom !== undefined) {
                await this.services.api.setZoom(changes.zoom);
            }
            if (changes.pan !== undefined) {
                await this.services.api.setPan(changes.pan);
            }
            if (changes.tilt !== undefined) {
                await this.services.api.setTilt(changes.tilt);
            }
            
            // Refresh VSOM data with new settings
            await this.refreshData();
            
        } catch (error) {
            console.error('Failed to update ZPT state:', error);
            this.showToast('Failed to update navigation settings', 'error');
        }
    }
    
    handleNodeClick(nodeData) {
        console.log('Node clicked:', nodeData);
        
        // Highlight interaction in data panel
        if (this.components.dataPanel) {
            this.components.dataPanel.highlightInteraction(nodeData.interactionId);
        }
        
        // Show node details in tooltip or modal
        this.showNodeDetails(nodeData);
    }
    
    handleNodeHover(nodeData, event) {
        // Show tooltip with node information
        if (nodeData) {
            console.log('Showing tooltip for node:', nodeData);
            VSOMUtils.showTooltip(nodeData, event || window.event);
        } else {
            VSOMUtils.hideTooltip();
        }
    }
    
    handleInteractionClick(interaction) {
        console.log('Interaction clicked:', interaction);
        
        // Highlight corresponding node in VSOM grid
        if (this.components.grid) {
            this.components.grid.highlightNode(interaction.id);
        }
        
        // Show interaction details
        this.showInteractionDetails(interaction);
    }
    
    async handleAutoLayout() {
        if (this.components.grid) {
            await this.components.grid.autoLayout();
            this.showToast('Auto layout applied', 'info');
        }
    }
    
    handleResize() {
        if (this.components.grid) {
            this.components.grid.handleResize();
        }
    }
    
    startPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.refreshData();
        }, 30000);
    }
    
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    updateState(changes) {
        this.state = { ...this.state, ...changes };
    }
    
    updateConnectionStatus(connected) {
        this.state.connected = connected;
        
        const statusDot = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        const apiStatus = document.getElementById('api-status');
        
        if (connected) {
            statusDot?.classList.add('connected');
            statusDot?.classList.remove('error');
            if (statusText) statusText.textContent = 'Connected';
            if (apiStatus) apiStatus.textContent = 'Connected';
        } else {
            statusDot?.classList.remove('connected');
            statusDot?.classList.add('error');
            if (statusText) statusText.textContent = 'Disconnected';
            if (apiStatus) apiStatus.textContent = 'Disconnected';
        }
    }
    
    showLoading(show) {
        const loading = document.getElementById('vsom-loading');
        const placeholder = document.getElementById('vsom-placeholder');

        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }

        if (placeholder) {
            // Show placeholder only when not loading AND no interactions
            const hasInteractions = this.state.interactions && this.state.interactions.length > 0;
            placeholder.style.display = (!show && !hasInteractions) ? 'flex' : 'none';
        }
    }
    
    showToast(message, type = 'info') {
        VSOMUtils.showToast(message, type);
    }
    
    showNodeDetails(nodeData) {
        // Implementation for showing node details modal/panel
        console.log('Show node details:', nodeData);

        // Show in data panel
        if (this.components.dataPanel && nodeData.interactionId) {
            this.components.dataPanel.highlightInteraction(nodeData.interactionId);
        }

        // Create a simple alert/popup for now (could be enhanced with a modal later)
        const content = nodeData.content || 'No content available';
        const concepts = Array.isArray(nodeData.concepts) ? nodeData.concepts.join(', ') :
                        (typeof nodeData.concepts === 'number' ? `${nodeData.concepts} concepts` : 'No concepts');
        const timestamp = nodeData.timestamp ? new Date(nodeData.timestamp).toLocaleString() : 'Unknown time';

        const message = `Node Details:\n\nType: ${nodeData.type || 'interaction'}\nID: ${nodeData.interactionId || nodeData.id}\n\nContent: ${content.substring(0, 300)}${content.length > 300 ? '...' : ''}\n\nConcepts: ${concepts}\nTime: ${timestamp}`;

        // Show toast with details
        this.showToast(`${(nodeData.type || 'interaction').toUpperCase()} Node Selected`, 'info', 5000);

        // Log full details to console for debugging
        console.log('Full node details:', {
            id: nodeData.id,
            interactionId: nodeData.interactionId,
            type: nodeData.type,
            content: nodeData.content,
            concepts: nodeData.concepts,
            timestamp: nodeData.timestamp,
            position: { x: nodeData.x, y: nodeData.y }
        });
    }
    
    showInteractionDetails(interaction) {
        // Implementation for showing interaction details modal/panel
        console.log('Show interaction details:', interaction);
    }
    
    getSessionStats() {
        return {
            totalInteractions: this.state.interactions.length,
            totalConcepts: this.state.interactions.reduce((sum, i) => 
                sum + (i.concepts?.length || 0), 0),
            duration: this.getFormattedDuration()
        };
    }
    
    getVSOMStats() {
        if (!this.state.vsomData) {
            return { nodes: 0, gridSize: '0x0', trained: false };
        }
        
        return {
            nodes: this.state.vsomData.nodes?.length || 0,
            gridSize: `${this.state.vsomData.gridSize || 0}x${this.state.vsomData.gridSize || 0}`,
            trained: this.state.vsomData.trained || false
        };
    }
    
    getFormattedDuration() {
        if (!this.state.lastUpdate) return '0s';
        
        const start = new Date(this.state.lastUpdate.getTime() - (this.state.interactions.length * 1000 * 60)); // Rough estimate
        return VSOMUtils.formatDuration(Date.now() - start.getTime());
    }
    
    cleanup() {
        this.stopPeriodicUpdates();
        
        if (this.components.grid) {
            this.components.grid.cleanup();
        }
        if (this.components.dataPanel) {
            this.components.dataPanel.cleanup();
        }
        if (this.components.zptControls) {
            this.components.zptControls.cleanup();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new VSOMStandaloneApp();
    await app.init();
    
    // Expose app instance globally for debugging
    window.vsomApp = app;
});

export default VSOMStandaloneApp;