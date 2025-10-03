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
            // ZPT State - Start at corpus level to show communities
            zoom: 'corpus',
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

            // Hide initial loader
            const initialLoader = document.getElementById('initial-loader');
            if (initialLoader) {
                initialLoader.classList.add('hidden');
                setTimeout(() => initialLoader.remove(), 300);
            }

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

        // Train VSOM button
        const trainBtn = document.getElementById('train-vsom');
        if (trainBtn) {
            trainBtn.addEventListener('click', this.handleTrainVSOM.bind(this));
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

    async refreshData(preserveZPTState = false) {
        try {
            this.showLoading(true);

            // Clear any existing tooltips before refresh
            VSOMUtils.hideTooltip();

            // Get knowledge graph data from inspect endpoint
            const knowledgeGraph = await this.services.api.getKnowledgeGraph();
            console.log('🔍 Knowledge graph received:', {
                nodes: knowledgeGraph.nodes?.length || 0,
                edges: knowledgeGraph.edges?.length || 0,
                metadata: knowledgeGraph.metadata
            });

            // Get session data for backward compatibility
            const sessionData = await this.services.api.getSessionData();
            console.log('🔍 Session data received:', sessionData);

            // Use knowledge graph nodes as interactions for visualization
            // Convert nodes to interaction-like format for compatibility
            const interactions = knowledgeGraph.nodes.map((node, idx) => ({
                id: node.id,
                label: node.label || `Node ${idx}`,
                type: node.type,
                graph: node.graph,
                prompt: node.label || node.id,
                response: `${node.type} from ${node.graph}`,
                concepts: [node.type, node.graph],
                metadata: { nodeType: node.type, sourceGraph: node.graph }
            }));
            console.log('🔍 Converted knowledge graph to interactions:', interactions.length);

            // Extract concepts from interactions
            const concepts = [];
            interactions.forEach(interaction => {
                if (interaction.concepts && Array.isArray(interaction.concepts)) {
                    concepts.push(...interaction.concepts);
                }
            });

            // Use current app state for ZPT if preserving, otherwise get from API
            let currentZPT;
            if (preserveZPTState) {
                console.log('🔍 Preserving current ZPT state:', this.state);
                currentZPT = {
                    zoom: this.state.zoom,
                    pan: this.state.pan,
                    tilt: this.state.tilt,
                    threshold: this.state.threshold
                };
            } else {
                try {
                    const zptState = await this.services.api.getZPTState();
                    currentZPT = {
                        zoom: zptState.state?.zoom || this.state.zoom,
                        pan: zptState.state?.pan || this.state.pan,
                        tilt: zptState.state?.tilt || this.state.tilt,
                        threshold: this.state.threshold
                    };
                } catch (zptError) {
                    console.warn('Failed to get ZPT state, using defaults:', zptError);
                    currentZPT = {
                        zoom: this.state.zoom,
                        pan: this.state.pan,
                        tilt: this.state.tilt,
                        threshold: this.state.threshold
                    };
                }
            }

            // Process interactions for VSOM visualization
            const vsomData = await this.services.processor.processInteractions(interactions, currentZPT);

            // Update state (only update ZPT if not preserving)
            const stateUpdate = {
                interactions: interactions,
                vsomData,
                concepts: [...new Set(concepts)], // Remove duplicates
                lastUpdate: new Date()
            };

            if (!preserveZPTState) {
                stateUpdate.zoom = currentZPT.zoom;
                stateUpdate.pan = currentZPT.pan;
                stateUpdate.tilt = currentZPT.tilt;
                stateUpdate.threshold = currentZPT.threshold;
            }

            this.updateState(stateUpdate);

            console.log('🔍 Updated state:', {
                interactionCount: this.state.interactions.length,
                conceptCount: this.state.concepts.length,
                zptState: { zoom: this.state.zoom, pan: this.state.pan, tilt: this.state.tilt },
                vsomData: this.state.vsomData
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
     * Aggregate data from multiple sources based on ZPT scope and contextual relevance
     * Now prioritizes data that would be used for prompt synthesis at current ZPT state
     */
    aggregateDataSources(sessionData, conceptsData, zptState, sparqlData, entitiesData, memoryData, contextScope) {
        // Primary data: What's currently in contextual scope (for prompt synthesis)
        const contextualInfo = contextScope.contextual || {};
        const isContextualScope = contextScope.success && contextualInfo.items > 0;

        console.log('🔍 VSOM Data Sources:', {
            contextualScope: isContextualScope,
            contextItems: contextualInfo.items || 0,
            memories: contextualInfo.memories || 0,
            zptState: contextualInfo.zptState?.zoom || 'unknown'
        });

        // Supporting data: Traditional sources
        console.log('🔍 Raw sessionData:', sessionData);
        console.log('🔍 sessionAnalytics:', sessionData.sessionAnalytics);
        const interactions = sessionData.sessionAnalytics?.interactions || sessionData.sessionCache?.interactions || sessionData.detailedInteractions || sessionData.interactions || [];
        console.log('🔍 Extracted interactions:', interactions);
        const conceptAnalytics = conceptsData.conceptAnalytics || {};
        const concepts = Array.isArray(conceptAnalytics.topConcepts) ? conceptAnalytics.topConcepts : [];
        const relationships = conceptsData.conceptRelationships || [];

        // SPARQL and entity data
        const sparqlResults = sparqlData.data || {};
        const entityResults = entitiesData.entities || [];
        const memoryResults = memoryData.memories || [];

        // Create visualizable items based on zoom level
        const items = [];
        const currentZoom = contextualInfo.zptState?.zoom || zptState.zoom || 'corpus';

        console.log('🔍 Current zoom level:', currentZoom);

        // Special handling for corpus-level zoom: Show communities as nodes
        if (currentZoom === 'corpus') {
            console.log('🏘️ Creating corpus-level community nodes');

            // Create communities based on concept clustering and entity relationships
            const communities = this.createCorpusCommunities(interactions, concepts, entityResults, memoryResults);

            communities.forEach((community, index) => {
                items.push({
                    id: `community_${index}`,
                    type: 'community',
                    content: community.name,
                    concepts: community.concepts,
                    source: 'corpus',
                    visualType: 'community',
                    x: (index % 4) * 2,
                    y: Math.floor(index / 4) * 2,
                    size: Math.max(12, Math.min(24, community.size * 2)),
                    color: community.color,
                    metadata: {
                        quality: community.coherence,
                        importance: community.size / 20,
                        memberCount: community.size,
                        topics: community.topics,
                        strength: community.strength
                    }
                });
            });

            console.log(`🏘️ Created ${communities.length} community nodes`);

            // Return early for corpus level - don't add other data types
            return {
                items,
                interactions: [],
                concepts: communities.map(c => ({ concept: c.name, count: c.size })),
                relationships: [],
                summary: {
                    totalItems: items.length,
                    communities: communities.length,
                    zoomLevel: 'corpus'
                }
            };
        }

        // Priority 1: Data that would be in contextual scope for prompt synthesis (for non-corpus levels)
        if (isContextualScope) {
            // Add contextual indicators
            items.push({
                id: 'contextual_scope_indicator',
                type: 'context_scope',
                content: `Contextual Scope (${contextualInfo.items} items, ${contextualInfo.memories} memories)`,
                concepts: ['context', 'scope', 'prompt-synthesis'],
                source: 'contextual',
                visualType: 'scope_indicator',
                x: 0,
                y: 0,
                size: 12 + Math.min(8, contextualInfo.items),
                color: '#FF5722', // Orange for contextual scope
                metadata: {
                    quality: Math.min(1, contextualInfo.items / 10),
                    importance: 0.9, // High importance for contextual data
                    contextual: true,
                    analysis: contextualInfo.analysis,
                    searchMethod: contextualInfo.searchMethod
                }
            });
        }

        // Priority 2: Interactions (filtered by contextual relevance if available)
        const relevantInteractions = isContextualScope ?
            interactions.slice(0, Math.max(5, Math.floor(contextualInfo.items / 2))) : // Limit when context available
            interactions;

        relevantInteractions.forEach((interaction, index) => {
            items.push({
                ...interaction,
                type: interaction.type || 'interaction',
                source: 'session',
                visualType: 'entity',
                metadata: {
                    ...(interaction.metadata || {}),
                    contextualRelevance: isContextualScope ? 0.7 : 0.5
                }
            });
        });

        // Priority 3: Concepts (prioritize those that might be contextually relevant)
        const relevantConcepts = isContextualScope ?
            concepts.slice(0, Math.max(3, Math.floor(contextualInfo.items / 3))) : // Limit when context available
            concepts.slice(0, 10); // Always limit concepts for performance

        relevantConcepts.forEach((concept, index) => {
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
                color: isContextualScope ? '#66BB6A' : '#4CAF50', // Brighter green when contextual
                metadata: {
                    quality: Math.min(1, (concept.count || 1) / 10),
                    importance: Math.min(1, (concept.frequency) * 2),
                    contextualRelevance: isContextualScope ? 0.6 : 0.3
                }
            });
        });

        // Priority 4: SPARQL results (entities and memory items from current context)
        if (sparqlResults.entities && Array.isArray(sparqlResults.entities)) {
            sparqlResults.entities.slice(0, Math.min(5, contextualInfo.items || 5)).forEach((entity, index) => {
                items.push({
                    id: `sparql_entity_${index}`,
                    type: 'entity',
                    content: entity.content || entity.uri || `Entity ${index}`,
                    concepts: entity.concepts || [],
                    source: 'sparql',
                    visualType: 'entity',
                    x: (index + 5) % 5,
                    y: Math.floor((index + 5) / 5),
                    size: 10,
                    color: '#3F51B5', // Indigo for SPARQL entities
                    metadata: {
                        quality: 0.8,
                        importance: isContextualScope ? 0.8 : 0.5,
                        contextualRelevance: isContextualScope ? 0.9 : 0.4,
                        uri: entity.uri
                    }
                });
            });
        }

        // Priority 5: Memory items (from semantic search)
        memoryResults.slice(0, Math.min(3, contextualInfo.memories || 3)).forEach((memory, index) => {
            items.push({
                id: `memory_${index}`,
                type: 'memory',
                content: memory.content || memory.prompt || `Memory ${index}`,
                concepts: memory.concepts || [],
                source: 'memory',
                visualType: 'memory',
                x: (index + 8) % 5,
                y: Math.floor((index + 8) / 5),
                size: 9,
                color: '#9C27B0', // Purple for memories
                metadata: {
                    quality: memory.quality,
                    importance: isContextualScope ? 0.7 : 0.4,
                    contextualRelevance: isContextualScope ? 0.8 : 0.3,
                    similarity: memory.similarity
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
                    strength: rel.strength,
                    quality: rel.confidence
                }
            });
        });

        // No placeholder data - only show live data

        // Debug: Check interactions before return
        console.log('🔍 Interactions before return:', interactions.length, interactions);
        console.log('🔍 About to return aggregatedData with interactions:', interactions.length);

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
     * Create corpus-level communities from live semantic memory data
     */
    createCorpusCommunities(interactions, concepts, entities, memories) {
        console.log('🏘️ Creating live corpus communities from:', {
            interactions: interactions.length,
            concepts: concepts.length,
            entities: entities.length,
            memories: memories.length
        });

        const communities = [];
        const colors = ['#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFC107', '#FF9800'];

        // Community 1: Memory-based community (live memories from semantic search)
        if (memories.length > 0) {
            communities.push({
                name: `Memory Community`,
                concepts: ['memory', 'semantic-search', 'embeddings'],
                size: memories.length,
                color: colors[0],
                topics: memories.slice(0, 3).map(m => (m.content || m.prompt || 'Memory').substring(0, 30)),
                coherence: 0.8,
                strength: 0.7,
                members: memories.slice(0, 5).map(m => m.content || m.prompt || 'Memory item')
            });
        }

        // Community 2: Concept-based community (live extracted concepts)
        if (concepts.length > 0) {
            communities.push({
                name: `Concept Community`,
                concepts: concepts.slice(0, 5).map(c => c.concept || c.name || c),
                size: concepts.length,
                color: colors[1],
                topics: concepts.slice(0, 3).map(c => c.concept || c.name || c),
                coherence: 0.7,
                strength: 0.6,
                members: concepts.slice(0, 5).map(c => c.concept || c.name || c)
            });
        }

        // Community 3: Entity-based community (live SPARQL entities)
        if (entities.length > 0) {
            communities.push({
                name: `Entity Community`,
                concepts: ['entities', 'sparql', 'knowledge-graph'],
                size: entities.length,
                color: colors[2],
                topics: entities.slice(0, 3).map(e => (e.content || e.uri || 'Entity').substring(0, 30)),
                coherence: 0.75,
                strength: 0.8,
                members: entities.slice(0, 5).map(e => e.uri || e.content || 'Entity')
            });
        }

        // Community 4: Interaction-based community (live session interactions)
        if (interactions.length > 0) {
            const interactionTypes = [...new Set(interactions.map(i => i.type || 'interaction'))];
            communities.push({
                name: `Interaction Community`,
                concepts: ['interactions', 'session', 'dialogue'],
                size: interactions.length,
                color: colors[3],
                topics: interactionTypes,
                coherence: 0.6,
                strength: 0.5,
                members: interactions.slice(0, 5).map(i => (i.content || i.prompt || 'Interaction').substring(0, 30))
            });
        }

        // Community 5: Document-based community (live document content)
        const documentPattern = [...interactions, ...memories].filter(item => {
            const content = item.content || item.prompt || '';
            return content.length > 200 || content.includes('document') || content.includes('text') || content.includes('PDF');
        });

        if (documentPattern.length > 0) {
            communities.push({
                name: `Document Community`,
                concepts: ['documents', 'text-processing', 'corpus'],
                size: documentPattern.length,
                color: colors[4],
                topics: documentPattern.slice(0, 3).map(d => (d.content || d.prompt || '').substring(0, 30)),
                coherence: 0.65,
                strength: 0.6,
                members: documentPattern.slice(0, 5).map(d => (d.content || d.prompt || '').substring(0, 50) + '...')
            });
        }

        console.log(`🏘️ Created ${communities.length} live corpus communities:`, communities.map(c => `${c.name} (${c.size} items)`));
        return communities;
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

            // Refresh VSOM data with new settings (preserve ZPT state)
            await this.refreshData(true);

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

    async handleTrainVSOM() {
        try {
            this.showToast('Starting VSOM training...', 'info');
            this.showLoading(true, 'Training self-organizing map...');

            console.log('🧠 [VSOM] Starting training with current knowledge graph');

            // TODO move to preferences.js
            // Get VSOM training parameters from preferences (or use backend defaults)
            // Backend defaults: epochs=100, learningRate=0.1, gridSize=20
            // These match config/preferences.js VSOM_CONFIG.TRAINING defaults
            const trainingParams = {
                // Don't specify - let backend use config/preferences.js defaults
                // epochs: 100,
                // learningRate: 0.1,
                // gridSize: 20
            };

            console.log('🧠 [VSOM] Starting training with backend defaults from config/preferences.js');
            // Train VSOM - this will use embeddings from the knowledge graph
            const trainingResult = await this.services.api.trainVSOM(trainingParams);

            console.log('✅ [VSOM] Training completed:', trainingResult);
            console.log('🔍 [VSOM] Result details:', {
                success: trainingResult.success,
                hasMappings: !!trainingResult.mappings,
                mappingsCount: trainingResult.mappings?.length || 0,
                hasMetadata: !!trainingResult.metadata,
                entitiesCount: trainingResult.metadata?.entitiesCount || 0,
                embeddingDimension: trainingResult.metadata?.embeddingDimension || 0,
                error: trainingResult.error || 'none',
                keys: Object.keys(trainingResult)
            });

            if (trainingResult.success) {
                console.log('✅ [VSOM] Training was successful, processing mappings...');

                // Apply trained positions to the visualization
                if (trainingResult.mappings && trainingResult.mappings.length > 0 && this.components.grid) {
                    console.log(`🔍 [VSOM] Processing ${trainingResult.mappings.length} mappings`);
                    console.log('🔍 [VSOM] First mapping sample:', trainingResult.mappings[0]);

                    // Convert mappings to positioned nodes with required properties
                    const trainedNodes = trainingResult.mappings.map((mapping, index) => ({
                        ...mapping.entity,
                        ...mapping.metadata,
                        id: mapping.entity.id || mapping.metadata.uri,
                        x: mapping.mapPosition[0] || 0,
                        y: mapping.mapPosition[1] || 0,
                        trained: true,
                        distance: mapping.distance || 0,
                        // Add required visualization properties (matching VSOMGrid expectations)
                        size: 8,  // VSOMGrid uses 'size', not 'radius'
                        color: '#4CAF50',
                        memoryImportance: 0.5,
                        activation: 0.8,
                        timestamp: new Date().toISOString()
                    }));

                    console.log(`🔍 [VSOM] Created ${trainedNodes.length} trained nodes`);
                    console.log('🔍 [VSOM] First trained node sample:', trainedNodes[0]);
                    console.log('🔍 [VSOM] Calling grid.updateData...');

                    // Update grid with trained positions
                    await this.components.grid.updateData({ nodes: trainedNodes });

                    console.log('✅ [VSOM] Grid updated successfully');

                    // Update data panel with new stats
                    if (this.components.dataPanel) {
                        await this.components.dataPanel.updateData({
                            interactions: this.state.interactions,
                            sessionStats: this.getSessionStats(),
                            vsomStats: {
                                ...this.getVSOMStats(),
                                trainedNodes: trainedNodes.length,
                                trainingError: trainingResult.finalError,
                                embeddingDimension: trainingResult.metadata.embeddingDimension
                            }
                        });
                        console.log('✅ [VSOM] Data panel updated');
                    }

                    this.showToast(
                        `Training complete! ${trainingResult.metadata.entitiesCount} nodes organized. ` +
                        `Final error: ${trainingResult.finalError.toFixed(4)}`,
                        'success'
                    );
                } else {
                    console.warn('⚠️ [VSOM] No mappings to display:', {
                        hasMappings: !!trainingResult.mappings,
                        mappingsLength: trainingResult.mappings?.length,
                        hasGrid: !!this.components.grid
                    });
                    this.showToast('Training completed but no mappings returned', 'warning');
                }
            } else {
                console.error('❌ [VSOM] Training reported failure:', trainingResult.error);
                this.showToast(`Training failed: ${trainingResult.error || 'Unknown error'}`, 'error');
            }

            this.showLoading(false);

        } catch (error) {
            console.error('❌ [VSOM] Training error:', error);
            console.error('❌ [VSOM] Error stack:', error.stack);
            this.showToast(`Training error: ${error.message}`, 'error');
            this.showLoading(false);
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

        // Update every 5 minutes (less aggressive)
        this.updateInterval = setInterval(() => {
            this.refreshData();
        }, 300000);
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

    showLoading(show, message = 'Loading...') {
        const loading = document.getElementById('vsom-loading');

        if (loading) {
            loading.style.display = show ? 'flex' : 'none';

            // Update loading message
            const loadingText = loading.querySelector('.loading-text');
            if (loadingText && show) {
                loadingText.textContent = message;
            }
        }

        // No placeholder elements - only show live data visualization
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
        const totalConcepts = this.state.interactions.reduce((sum, i) => {
            if (typeof i.concepts === 'number') {
                return sum + i.concepts;
            } else if (Array.isArray(i.concepts)) {
                return sum + i.concepts.length;
            }
            return sum;
        }, 0);

        // Use actual duration from API if available
        let duration = '0s';
        if (this.state.sessionData?.sessionAnalytics?.duration) {
            duration = VSOMUtils.formatDuration(this.state.sessionData.sessionAnalytics.duration);
        } else {
            duration = this.getFormattedDuration();
        }

        return {
            totalInteractions: this.state.interactions.length,
            totalConcepts: totalConcepts,
            duration: duration
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