/**
 * SPARQL Browser Component
 * Enhanced RDF query and visualization with Atuin syntax highlighting
 */

import { eventBus, EVENTS } from '../services/eventBus.js';
import store from '../stores/useStore.js';

export class SPARQLBrowser {
    constructor() {
        this.initialized = false;
        this.turtleEditor = null;
        this.sparqlEditor = null;
        this.graphVisualizer = null;
        this.logger = null;
        this.clipsManager = null;
        this.clipsUI = null;
        this.endpointManager = null;
        this.modelSyncHandler = null;
        this.unsubscribe = null;
    }

    async init() {
        try {
            eventBus.emit(EVENTS.CONSOLE_DEBUG, 'Initializing SPARQL Browser...');
            
            // Initialize evb event bus for Atuin integration
            await this.initializeEvbEventBus();
            
            // Initialize state
            store.setState({
                currentEndpoint: localStorage.getItem('sparql-endpoint') || null,
                endpoints: [],
                queryResults: null,
                isLoading: false,
                error: null,
                editorContent: '',
                graphData: null
            });
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize Atuin editors
            await this.initializeAtuinEditors();
            
            // Load endpoints
            await this.loadEndpoints();
            
            // Setup SPARQL browser tabs
            this.setupTabs();
            
            // Initialize syntax checker
            this.initializeSyntaxChecker();
            
            // Initialize graph visualizer
            await this.initializeGraphVisualizer();
            
            // Initialize SPARQL Clips Manager and UI
            await this.initializeClipsManager();
            
            // Pre-load SPARQL query and save to clips
            await this.preloadSparqlQuery();
            
            // Load system configuration into settings
            await this.loadSystemSettings();
            
            // Automatically load RDF data from Edit panel into Graph visualization
            await this.autoLoadGraphData();
            
            this.initialized = true;
            eventBus.emit(EVENTS.CONSOLE_INFO, 'SPARQL Browser initialized');
            
            // Subscribe to store updates
            this.unsubscribe = store.subscribe(state => {
                // Handle state updates here if needed
                if (state.error) {
                    eventBus.emit(EVENTS.CONSOLE_ERROR, state.error);
                }
            });
            
        } catch (error) {
            const errorMsg = `Failed to initialize SPARQL Browser: ${error.message}`;
            eventBus.emit(EVENTS.APP_ERROR, new Error(errorMsg));
            throw error;
        }
    }

    /**
     * Initialize evb event bus for Atuin integration
     */
    async initializeEvbEventBus() {
        try {
            console.log('Initializing evb event bus for Atuin integration...');
            
            // Try to import evb module if not already available
            if (!window.evb) {
                try {
                    const evbModule = await import('evb');
                    window.evb = evbModule.eventBus || evbModule.default || evbModule;
                    console.log('Imported evb module:', !!window.evb);
                } catch (error) {
                    console.log('Could not import evb module (this is normal if evb is not installed):', error.message);
                }
            }
            
            // Ensure the global event bus and events are available
            if (!window.eventBus) {
                window.eventBus = eventBus;
                console.log('Set window.eventBus');
            }
            
            if (!window.EVENTS) {
                window.EVENTS = EVENTS;
                console.log('Set window.EVENTS');
            }
            
            // Test event emission
            console.log('Testing event bus availability:');
            console.log('- window.eventBus.emit:', typeof window.eventBus?.emit);
            console.log('- window.evb.emit:', typeof window.evb?.emit);
            console.log('- MODEL_SYNCED event defined:', !!window.EVENTS?.MODEL_SYNCED);
            
        } catch (error) {
            console.warn('Failed to initialize evb event bus:', error);
        }
    }

    async initializeAtuinEditors() {
        try {
            eventBus.emit(EVENTS.CONSOLE_DEBUG, 'Initializing Atuin components...');
            
            // Import and set up Atuin components
            const { TurtleEditor } = await import('atuin/core/TurtleEditor');
            const { SPARQLEditor } = await import('atuin/core/SPARQLEditor');
            const { GraphVisualizer } = await import('atuin/core/GraphVisualizer');
            const { LoggerService } = await import('atuin/services');
            const { SPARQLClipsManager } = await import('atuin/services');
            const { SPARQLClipsUI, SplitPaneManager, UIManager } = await import('atuin/ui');
            
            console.log('Atuin components imported successfully');
            
            // Set up window globals
            window.TurtleEditor = TurtleEditor;
            window.SPARQLEditor = SPARQLEditor;
            window.GraphVisualizer = GraphVisualizer;
            window.LoggerService = LoggerService;
            window.SPARQLClipsManager = SPARQLClipsManager;
            window.SPARQLClipsUI = SPARQLClipsUI;
            window.SplitPaneManager = SplitPaneManager;
            window.UIManager = UIManager;
            
            // Create message queue container for LoggerService
            this.createMessageQueue();
            this.logger = new LoggerService('atuin-message-queue');
            
            // Initialize split pane layout
            await this.initializeAtuinLayout();
            
            // Initialize SPARQL editor
            const sparqlElement = document.getElementById('sparql-query-editor');
            if (sparqlElement) {
                this.sparqlEditor = new SPARQLEditor(sparqlElement, this.logger);
                await this.sparqlEditor.initialize();
                console.log('SPARQL editor with syntax highlighting initialized');
            }
            
            // Initialize Turtle editor
            const turtleElement = document.getElementById('turtle-editor');
            if (turtleElement) {
                this.turtleEditor = new TurtleEditor(turtleElement, this.logger);
                await this.turtleEditor.initialize();
                
                // Load sample RDF data
                const sampleRDF = this.getSampleRDFData();
                this.turtleEditor.setValue(sampleRDF);
                console.log('Turtle editor with syntax highlighting initialized');
            }
            
            // Initialize Graph Visualizer
            await this.initializeGraphVisualizer();
            
            // Initialize SPARQL Clips Manager
            await this.initializeClipsManager();
            
            eventBus.emit(EVENTS.CONSOLE_INFO, 'Atuin components initialized successfully');
            
        } catch (error) {
            console.warn('Could not initialize Atuin components:', error);
            eventBus.emit(EVENTS.APP_ERROR, new Error(`Atuin initialization failed: ${error.message}`));
        }
    }

    async initializeAtuinLayout() {
        try {
            // Get layout containers
            const container = document.getElementById('atuin-split-container');
            const leftPane = document.getElementById('atuin-left-pane');
            const rightPane = document.getElementById('atuin-right-pane');
            const divider = document.getElementById('atuin-split-divider');
            
            if (container && leftPane && rightPane && divider) {
                // Initialize split pane manager
                this.splitPaneManager = new window.SplitPaneManager({
                    container,
                    leftPane,
                    rightPane,
                    divider
                });
                
                console.log('Atuin split pane layout initialized');
                
                // Set up tab switching for both panels
                this.setupAtuinTabs();
            } else {
                console.warn('Could not find all required layout elements for Atuin');
            }
        } catch (error) {
            console.error('Failed to initialize Atuin layout:', error);
        }
    }

    setupAtuinTabs() {
        // Left panel tabs (Turtle/SPARQL)
        const leftTabs = document.querySelectorAll('#atuin-left-pane .tab');
        leftTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchLeftTab(tabName);
            });
        });

        // Right panel tabs (View/Settings)
        const rightTabs = document.querySelectorAll('#atuin-right-pane .tab');
        rightTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchRightTab(tabName);
            });
        });
    }

    switchLeftTab(tabName) {
        try {
            // Update active tab button
            const leftTabs = document.querySelectorAll('#atuin-left-pane .tab');
            leftTabs.forEach(tab => tab.classList.remove('active'));
            
            const activeTab = document.querySelector(`#atuin-left-pane [data-tab="${tabName}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }

            // Show corresponding content panel
            if (tabName === 'turtle-editor') {
                document.getElementById('turtle-editor-pane').style.display = 'block';
                document.getElementById('sparql-editor-pane').style.display = 'none';
            } else if (tabName === 'sparql-query') {
                document.getElementById('turtle-editor-pane').style.display = 'none';
                document.getElementById('sparql-editor-pane').style.display = 'block';
            }
            
            console.log(`Switched to left tab: ${tabName}`);
        } catch (error) {
            console.warn(`Error switching left tab to ${tabName}:`, error);
        }
    }

    switchRightTab(tabName) {
        try {
            // Update active tab button
            const rightTabs = document.querySelectorAll('#atuin-right-pane .tab');
            rightTabs.forEach(tab => tab.classList.remove('active'));
            
            const activeTab = document.querySelector(`#atuin-right-pane [data-tab="${tabName}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }

            // Show corresponding content panel
            if (tabName === 'view-pane') {
                document.getElementById('view-pane').style.display = 'block';
                document.getElementById('settings-pane').style.display = 'none';
            } else if (tabName === 'settings-pane') {
                document.getElementById('view-pane').style.display = 'none';
                document.getElementById('settings-pane').style.display = 'block';
            }
            
            console.log(`Switched to right tab: ${tabName}`);
        } catch (error) {
            console.warn(`Error switching right tab to ${tabName}:`, error);
        }
    }

    createMessageQueue() {
        // Check if message queue already exists
        if (document.getElementById('atuin-message-queue')) {
            return;
        }
        
        // Create message queue container as required by Atuin LoggerService
        const messageQueue = document.createElement('div');
        messageQueue.id = 'atuin-message-queue';
        messageQueue.className = 'atuin-messages';
        messageQueue.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            width: 300px;
            max-height: 400px;
            overflow-y: auto;
        `;
        
        document.body.appendChild(messageQueue);
        console.log('Created Atuin message queue container');
    }

    async initializeGraphVisualizer() {
        try {
            // Prevent multiple initializations
            if (this.graphVisualizer) {
                console.log('GraphVisualizer already initialized, skipping...');
                return;
            }
            
            const graphContainer = document.getElementById('rdf-graph-container');
            
            if (graphContainer && window.GraphVisualizer) {
                console.log('Graph container found:', graphContainer);
                console.log('Graph container dimensions:', graphContainer.offsetWidth, 'x', graphContainer.offsetHeight);
                
                // Ensure container has proper dimensions before initialization
                if (graphContainer.offsetHeight === 0) {
                    graphContainer.style.height = '400px';
                    graphContainer.style.width = '100%';
                    console.log('Set graph container dimensions to 400px height');
                }
                
                // Ensure container has proper dimensions BEFORE initializing GraphVisualizer
                console.log('Preparing container for GraphVisualizer...');
                if (graphContainer.offsetHeight === 0) {
                    graphContainer.style.height = '400px';
                    graphContainer.style.width = '100%';
                    graphContainer.style.display = 'block';
                    graphContainer.style.visibility = 'visible';
                    console.log('Set container dimensions before GraphVisualizer init');
                }
                
                // Force a reflow to ensure dimensions are applied
                const _ = graphContainer.offsetHeight;
                
                // Initialize GraphVisualizer with container ID (per Atuin integration guide)
                this.graphVisualizer = new window.GraphVisualizer('rdf-graph-container', this.logger);
                console.log('=== GRAPH VISUALIZER INITIALIZED ===');
                console.log('GraphVisualizer instance:', this.graphVisualizer);
                console.log('Container ID:', 'rdf-graph-container');
                console.log('Logger:', this.logger);
                
                // Check if GraphVisualizer properly initialized its network
                console.log('GraphVisualizer network after init:', !!this.graphVisualizer.network);
                if (!this.graphVisualizer.network) {
                    console.warn('GraphVisualizer network is null after initialization');
                    console.log('This means automatic event listening likely failed');
                    
                    // Try manual initialization
                    if (typeof this.graphVisualizer.initialize === 'function') {
                        console.log('Attempting manual initialize() call...');
                        try {
                            this.graphVisualizer.initialize();
                            console.log('Manual initialize() completed. Network:', !!this.graphVisualizer.network);
                        } catch (error) {
                            console.error('Manual initialize() failed:', error);
                        }
                    }
                }
                
                // Add debug info
                if (window.showDebug) {
                    window.showDebug('GraphVisualizer initialized successfully');
                }
                
                // Set up event listener for MODEL_SYNCED events (automatic sync with TurtleEditor)
                if (window.eventBus && window.EVENTS) {
                    const modelSyncHandler = (content) => {
                        console.log('=== MODEL_SYNCED EVENT RECEIVED ===');
                        console.log('Content length:', content ? content.length : 0);
                        console.log('Content preview:', content ? content.substring(0, 100) + '...' : 'empty');
                        console.log('Graph visualizer available:', !!this.graphVisualizer);
                        console.log('Graph container:', document.getElementById('rdf-graph-container'));
                        
                        // Add to debug info
                        if (window.showDebug) {
                            window.showDebug(`MODEL_SYNCED event received with ${content?.length || 0} characters`);
                        }
                        
                        // According to Atuin docs, GraphVisualizer automatically listens for MODEL_SYNCED events
                        // We don't need to manually call updateGraph() - it should happen automatically
                        console.log('MODEL_SYNCED event received - GraphVisualizer should auto-update');
                        console.log('Content length:', content ? content.length : 0);
                        console.log('GraphVisualizer network status:', !!this.graphVisualizer?.network);
                        
                        // Add debug info
                        if (window.showDebug) {
                            window.showDebug(`MODEL_SYNCED event received with ${content?.length || 0} characters - auto-updating graph`);
                        }
                        
                        // Check if the graph updates automatically (debounced)
                        if (!this._checkUpdateTimeout) {
                            this._checkUpdateTimeout = setTimeout(() => {
                                console.log('Checking if GraphVisualizer auto-updated...');
                                console.log('Network state after MODEL_SYNCED:', !!this.graphVisualizer?.network);
                                if (this.graphVisualizer?.network) {
                                    console.log('🎉 GraphVisualizer auto-updated successfully!');
                                    this.updateGraphStats();
                                    
                                    // Force a resize/fit to ensure proper display
                                    if (typeof this.graphVisualizer.resizeAndFit === 'function') {
                                        console.log('Calling resizeAndFit() to ensure proper display');
                                        this.graphVisualizer.resizeAndFit();
                                    }
                                }
                                this._checkUpdateTimeout = null;
                            }, 300);
                        }
                        
                        // Ensure graph tab is visible when content updates
                        setTimeout(() => {
                            const graphContainer = document.getElementById('rdf-graph-container');
                            if (graphContainer && this.graphVisualizer) {
                                // Force container visibility and update graph
                                if (graphContainer.offsetHeight === 0) {
                                    graphContainer.style.height = '400px';
                                    graphContainer.style.width = '100%';
                                }
                                
                                // Update node/edge counts after graph update
                                this.updateGraphStats();
                            }
                        }, 100);
                    };
                    
                    window.eventBus.on(window.EVENTS.MODEL_SYNCED, modelSyncHandler);
                    
                    // Store handler reference for cleanup
                    this.modelSyncHandler = modelSyncHandler;
                }
                
                // The GraphVisualizer automatically listens for MODEL_SYNCED events from evb
                // It will automatically update when TurtleEditor emits content changes
            } else {
                console.warn('Graph container not found or GraphVisualizer not available');
                console.log('GraphContainer exists:', !!graphContainer);
                console.log('GraphVisualizer available:', !!window.GraphVisualizer);
            }
        } catch (error) {
            console.warn('Could not initialize Graph Visualizer:', error);
        }
    }

    /**
     * Initialize SPARQL Clips Manager for saving/loading query clips
     */
    async initializeClipsManager() {
        try {
            if (window.SPARQLClipsManager && window.SPARQLClipsUI) {
                // First check if the container exists before creating the UI
                const clipsContainer = document.getElementById('sparql-clips-container');
                if (!clipsContainer) {
                    console.warn('SPARQL clips container not found - clips feature will not be available');
                    return;
                }
                
                console.log('Initializing SPARQL Clips Manager with container:', clipsContainer);
                
                // Initialize the clips manager
                this.clipsManager = new window.SPARQLClipsManager(this.logger);
                
                // Create clips UI with options object
                // Note: We need to override the render method to always use our container
                const originalRender = window.SPARQLClipsUI.prototype.render;
                window.SPARQLClipsUI.prototype.render = function(container = clipsContainer) {
                    return originalRender.call(this, container);
                };
                
                this.clipsUI = new window.SPARQLClipsUI({
                    clipsManager: this.clipsManager,
                    logger: this.logger,
                    onClipSelect: (query) => {
                        // Load selected clip into SPARQL editor
                        if (this.sparqlEditor && this.sparqlEditor.setValue) {
                            this.sparqlEditor.setValue(query);
                        } else {
                            const sparqlElement = document.getElementById('sparql-query-editor');
                            if (sparqlElement) sparqlElement.value = query;
                        }
                        console.log('Loaded SPARQL clip into editor');
                    }
                });
                
                // The clips UI will automatically render when loadClips() is called in the constructor
                
                console.log('SPARQL Clips Manager initialized successfully');
            } else {
                console.log('SPARQLClipsManager or SPARQLClipsUI not available - skipping clips initialization');
            }
        } catch (error) {
            console.warn('Could not initialize SPARQL Clips Manager:', error);
            console.warn('Error details:', error.message);
            
            // Fallback: Hide the clips container if initialization fails
            const clipsContainer = document.getElementById('sparql-clips-container');
            if (clipsContainer) {
                clipsContainer.style.display = 'none';
                console.log('Hidden clips container due to initialization failure');
            }
        }
    }

    /**
     * Initialize SPARQL Endpoint Manager for managing endpoints
     */
    async initializeEndpointManager() {
        try {
            if (window.SPARQLEndpointManager) {
                this.endpointManager = new window.SPARQLEndpointManager({
                    logger: this.logger,
                    defaultEndpoints: [
                        'http://localhost:3030/ds/sparql',
                        'https://query.wikidata.org/sparql',
                        'https://dbpedia.org/sparql'
                    ]
                });
                
                // Set up endpoint change listener
                if (window.eventBus && window.EVENTS) {
                    window.eventBus.on(window.EVENTS.ENDPOINT_UPDATED, ({ endpoint }) => {
                        console.log('SPARQL endpoint updated to:', endpoint);
                        this.currentEndpoint = endpoint;
                    });
                }
                
                console.log('SPARQL Endpoint Manager initialized');
            }
        } catch (error) {
            console.warn('Could not initialize SPARQL Endpoint Manager:', error);
        }
    }

    /**
     * Get sample RDF data for initial testing
     */
    getSampleRDFData() {
        return `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix dbo: <http://dbpedia.org/ontology/> .
@prefix dbr: <http://dbpedia.org/resource/> .

# Sample knowledge graph about people and organizations
ex:alice a foaf:Person ;
    foaf:name "Alice Johnson" ;
    foaf:age 30 ;
    foaf:knows ex:bob, ex:charlie ;
    ex:worksFor ex:acmeCorp ;
    foaf:interest ex:semanticWeb, ex:artificialIntelligence .

ex:bob a foaf:Person ;
    foaf:name "Bob Smith" ;
    foaf:age 35 ;
    foaf:knows ex:alice ;
    ex:worksFor ex:techStart ;
    foaf:interest ex:machineLearning .

ex:charlie a foaf:Person ;
    foaf:name "Charlie Brown" ;
    foaf:age 28 ;
    foaf:knows ex:alice ;
    ex:worksFor ex:acmeCorp ;
    foaf:interest ex:dataScience, ex:semanticWeb .

ex:acmeCorp a ex:Organization ;
    rdfs:label "ACME Corporation" ;
    ex:industry "Technology" ;
    ex:foundedIn 2010 ;
    ex:hasEmployee ex:alice, ex:charlie ;
    ex:headquarteredIn ex:sanFrancisco .

ex:techStart a ex:Organization ;
    rdfs:label "Tech Startup Inc" ;
    ex:industry "Software" ;
    ex:foundedIn 2020 ;
    ex:hasEmployee ex:bob ;
    ex:headquarteredIn ex:austin .

ex:semanticWeb a ex:Topic ;
    rdfs:label "Semantic Web" ;
    rdfs:comment "Technologies for machine-readable web data" .

ex:artificialIntelligence a ex:Topic ;
    rdfs:label "Artificial Intelligence" ;
    rdfs:comment "Computer systems that perform tasks requiring human intelligence" .

ex:machineLearning a ex:Topic ;
    rdfs:label "Machine Learning" ;
    rdfs:comment "AI systems that improve through experience" .

ex:dataScience a ex:Topic ;
    rdfs:label "Data Science" ;
    rdfs:comment "Interdisciplinary field using statistics and algorithms" .

ex:sanFrancisco a ex:Location ;
    rdfs:label "San Francisco, CA" ;
    ex:country "USA" ;
    ex:state "California" .

ex:austin a ex:Location ;
    rdfs:label "Austin, TX" ;
    ex:country "USA" ;
    ex:state "Texas" .`;
    }

    /**
     * Update graph statistics display (debounced to prevent infinite loops)
     */
    updateGraphStats() {
        // Debounce to prevent rapid successive calls
        if (this._statsUpdateTimeout) {
            clearTimeout(this._statsUpdateTimeout);
        }
        
        this._statsUpdateTimeout = setTimeout(() => {
            this._doUpdateGraphStats();
        }, 100);
    }
    
    _doUpdateGraphStats() {
        try {
            if (this.graphVisualizer && this.graphVisualizer.network) {
                const nodes = this.graphVisualizer.network.body.data.nodes;
                const edges = this.graphVisualizer.network.body.data.edges;
                
                const nodeCount = nodes ? nodes.length : 0;
                const edgeCount = edges ? edges.length : 0;
                
                // Update the UI counters
                const nodeCountEl = document.getElementById('node-count');
                const edgeCountEl = document.getElementById('edge-count');
                if (nodeCountEl) nodeCountEl.textContent = nodeCount;
                if (edgeCountEl) edgeCountEl.textContent = edgeCount;
                
                console.log(`Graph stats updated - Nodes: ${nodeCount}, Edges: ${edgeCount}`);
            }
        } catch (error) {
            console.warn('Could not update graph stats:', error);
        }
    }

    updateGraphWithTriples(triples) {
        console.log('Updating graph with parsed triples:', triples?.length || 0);
        
        if (triples && triples.length > 0) {
            // Store triples in the GraphVisualizer
            this.graphVisualizer.triples = triples;
            
            // Try different methods to trigger visualization
            const updateMethods = ['update', 'render', 'draw', 'refresh', 'build', 'create', 'visualize'];
            
            for (const method of updateMethods) {
                if (typeof this.graphVisualizer[method] === 'function') {
                    console.log(`Calling graphVisualizer.${method}()`);
                    try {
                        this.graphVisualizer[method]();
                        break; // If successful, stop trying other methods
                    } catch (error) {
                        console.warn(`Error calling ${method}:`, error);
                    }
                }
            }
            
            // Force update stats (debounced)
            this.updateGraphStats();
        }
    }

    setupEventListeners() {
        // Execute Query button (from SPARQL toolbar)
        const executeBtn = document.getElementById('run-sparql-query');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeQuery());
        }

        // Store Query button (from SPARQL toolbar)
        const storeBtn = document.getElementById('store-sparql-query');
        if (storeBtn) {
            storeBtn.addEventListener('click', () => this.saveQuery());
        }

        // Clips Query button (from SPARQL toolbar)
        const clipsBtn = document.getElementById('clips-sparql-query');
        if (clipsBtn) {
            clipsBtn.addEventListener('click', () => this.loadQuery());
        }

        // File controls
        const loadFileBtn = document.getElementById('atuin-load-file-btn');
        if (loadFileBtn) {
            loadFileBtn.addEventListener('click', () => {
                document.getElementById('atuin-load-file').click();
            });
        }

        const saveFileBtn = document.getElementById('atuin-save-file-btn');
        if (saveFileBtn) {
            saveFileBtn.addEventListener('click', () => this.saveFile());
        }

        // Endpoint management
        const addEndpointBtn = document.getElementById('add-sparql-endpoint');
        if (addEndpointBtn) {
            addEndpointBtn.addEventListener('click', () => this.addEndpoint());
        }

        const removeEndpointBtn = document.getElementById('remove-sparql-endpoint');
        if (removeEndpointBtn) {
            removeEndpointBtn.addEventListener('click', () => this.removeEndpoint());
        }
    }

    setupTabs() {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            this.setupLeftPanelTabs();
            this.setupRightPanelTabs();
        }, 100);
    }

    setupLeftPanelTabs() {
        // Left panel tabs: Turtle and SPARQL
        const turtleTab = document.getElementById('tab-turtle');
        const sparqlTab = document.getElementById('tab-sparql');
        const turtlePane = document.getElementById('turtle-editor-pane');
        const sparqlPane = document.getElementById('sparql-editor-pane');

        console.log('Setting up left panel tabs:', {
            turtleTab: !!turtleTab,
            sparqlTab: !!sparqlTab,
            turtlePane: !!turtlePane,
            sparqlPane: !!sparqlPane
        });

        if (turtleTab && sparqlTab && turtlePane && sparqlPane) {
            turtleTab.addEventListener('click', () => {
                console.log('Turtle tab clicked');
                turtleTab.classList.add('active');
                sparqlTab.classList.remove('active');
                turtlePane.style.display = 'block';
                sparqlPane.style.display = 'none';
            });

            sparqlTab.addEventListener('click', () => {
                console.log('SPARQL tab clicked');
                sparqlTab.classList.add('active');
                turtleTab.classList.remove('active');
                sparqlPane.style.display = 'block';
                turtlePane.style.display = 'none';
            });
        } else {
            console.warn('Could not find all left panel tab elements');
        }
    }

    setupRightPanelTabs() {
        // Right panel tabs: View and Settings
        const viewTab = document.getElementById('tab-view');
        const settingsTab = document.getElementById('tab-settings');
        const viewPane = document.getElementById('view-pane');
        const settingsPane = document.getElementById('settings-pane');

        console.log('Setting up right panel tabs:', {
            viewTab: !!viewTab,
            settingsTab: !!settingsTab,
            viewPane: !!viewPane,
            settingsPane: !!settingsPane
        });

        if (viewTab && settingsTab && viewPane && settingsPane) {
            viewTab.addEventListener('click', () => {
                console.log('=== VIEW TAB CLICKED ===');
                viewTab.classList.add('active');
                settingsTab.classList.remove('active');
                
                // Use setProperty to override inline styles
                viewPane.style.setProperty('display', 'block', 'important');
                settingsPane.style.setProperty('display', 'none', 'important');
                
                console.log('View pane display after click:', window.getComputedStyle(viewPane).display);
                
                // Trigger graph refresh when view tab is selected
                setTimeout(() => {
                    if (this.graphVisualizer && typeof this.graphVisualizer.resizeAndFit === 'function') {
                        this.graphVisualizer.resizeAndFit();
                    }
                }, 100);
            });

            settingsTab.addEventListener('click', () => {
                console.log('=== SETTINGS TAB CLICKED ===');
                console.log('settingsPane element:', settingsPane);
                console.log('viewPane element:', viewPane);
                console.log('Before - settingsPane display:', settingsPane.style.display);
                console.log('Before - viewPane display:', viewPane.style.display);
                console.log('Before - settingsPane computed style:', window.getComputedStyle(settingsPane).display);
                
                // Force visibility with !important equivalent
                settingsTab.classList.add('active');
                viewTab.classList.remove('active');
                
                // Use setAttribute to override inline styles
                settingsPane.style.setProperty('display', 'block', 'important');
                viewPane.style.setProperty('display', 'none', 'important');
                
                console.log('After - settingsPane display:', settingsPane.style.display);
                console.log('After - viewPane display:', viewPane.style.display);
                console.log('After - settingsPane computed style:', window.getComputedStyle(settingsPane).display);
                console.log('Settings pane visible:', settingsPane.offsetHeight > 0);
                console.log('Settings pane offsetWidth:', settingsPane.offsetWidth);
                console.log('Settings pane getBoundingClientRect:', settingsPane.getBoundingClientRect());
            });
        } else {
            console.warn('Could not find all right panel tab elements');
        }
    }
    
    refreshGraphVisualization() {
        // Debounce to prevent rapid successive calls
        if (this._refreshTimeout) {
            console.log('Refresh already in progress, skipping...');
            return;
        }
        
        this._refreshTimeout = setTimeout(() => {
            this._refreshTimeout = null;
        }, 1000);
        
        console.log('Refreshing graph visualization...');
        
        // Debug available event bus systems
        console.log('Event bus systems available:');
        console.log('- window.eventBus:', !!window.eventBus);
        console.log('- window.evb:', !!window.evb);
        console.log('- window.EVENTS:', !!window.EVENTS);
        console.log('- local eventBus:', !!eventBus);
        
        // Get current content from turtle editor
        const turtleElement = document.getElementById('turtle-editor');
        let rdfContent = '';
        
        if (this.turtleEditor && this.turtleEditor.getValue) {
            // Use Atuin TurtleEditor method
            rdfContent = this.turtleEditor.getValue();
            console.log('Got RDF content from Atuin TurtleEditor:', rdfContent ? rdfContent.substring(0, 100) + '...' : 'empty');
        } else if (turtleElement && turtleElement.value) {
            // Fallback to basic textarea
            rdfContent = turtleElement.value;
            console.log('Got RDF content from basic textarea:', rdfContent ? rdfContent.substring(0, 100) + '...' : 'empty');
        }
        
        if (!rdfContent.trim()) {
            console.log('=== NO RDF CONTENT TO VISUALIZE ===');
            console.log('RDF content length:', rdfContent.length);
            console.log('Turtle element exists:', !!turtleElement);
            console.log('Turtle element value:', turtleElement?.value?.substring(0, 100));
            console.log('Turtle editor exists:', !!this.turtleEditor);
            console.log('Turtle editor getValue method:', !!this.turtleEditor?.getValue);
            
            // Add to debug info
            if (window.showDebug) {
                window.showDebug('No RDF content found in turtle editor');
            }
            
            return;
        }
        
        // Ensure graph container has proper dimensions
        const graphContainer = document.getElementById('rdf-graph-container');
        if (graphContainer) {
            if (graphContainer.offsetHeight === 0) {
                graphContainer.style.height = '400px';
                graphContainer.style.width = '100%';
                console.log('Set graph container dimensions to 400px height');
            }
            
            console.log('Graph container dimensions:', graphContainer.offsetWidth, 'x', graphContainer.offsetHeight);
        }
        
        // Emit MODEL_SYNCED event to trigger automatic graph update via evb event bus
        if (rdfContent.trim()) {
            console.log('=== EMITTING MODEL_SYNCED EVENT ===');
            console.log('RDF content length:', rdfContent.length);
            console.log('RDF content preview:', rdfContent.substring(0, 200) + '...');
            
            // Emit to both event bus systems to ensure GraphVisualizer receives the event
            let eventsEmitted = 0;
            
            // Emit to window.eventBus (for general UI)
            if (window.eventBus && window.EVENTS && window.EVENTS.MODEL_SYNCED) {
                console.log('✓ Using window.eventBus for MODEL_SYNCED event');
                window.eventBus.emit(window.EVENTS.MODEL_SYNCED, rdfContent);
                eventsEmitted++;
            }
            
            // Emit to evb eventBus (for GraphVisualizer)
            if (window.evb && window.evb.emit) {
                console.log('✓ Using window.evb for MODEL_SYNCED event (for GraphVisualizer)');
                window.evb.emit('MODEL_SYNCED', rdfContent);
                eventsEmitted++;
            }
            
            console.log(`Events emitted to ${eventsEmitted} event bus systems`);
            
            if (eventsEmitted === 0) {
                console.warn('No event bus systems available for MODEL_SYNCED');
            }
            
            // Update stats after a delay to allow graph to process (single call)
            this.updateGraphStats();
            
        } else if (rdfContent.trim() && this.graphVisualizer && this.graphVisualizer.updateGraph) {
            // Fallback: direct update if event bus not available
            console.log('Calling updateGraph directly on GraphVisualizer...');
            try {
                this.graphVisualizer.updateGraph(rdfContent);
                setTimeout(() => {
                    this.updateGraphStats();
                }, 500);
                console.log('Graph visualization updated successfully');
            } catch (error) {
                console.error('Failed to update graph visualization:', error);
            }
        } else {
            console.log('No RDF content or graph visualizer not available');
            console.log('RDF content length:', rdfContent.length);
            console.log('GraphVisualizer available:', !!this.graphVisualizer);
            console.log('Event bus available:', !!(window.eventBus && window.EVENTS));
        }
    }

    /**
     * Automatically load RDF data from Edit panel into Graph visualization on startup
     */
    async autoLoadGraphData() {
        console.log('Auto-loading RDF data from Edit panel into Graph visualization...');
        
        // Small delay to ensure all components are initialized
        setTimeout(() => {
            // Trigger the graph refresh which will pull data from the turtle editor
            this.refreshGraphVisualization();
            
            // Also emit a MODEL_SYNCED event to ensure the event bus system is triggered
            if (this.turtleEditor && this.turtleEditor.getValue) {
                const rdfContent = this.turtleEditor.getValue();
                if (rdfContent && rdfContent.trim()) {
                    console.log('Auto-loading: Emitting MODEL_SYNCED event with RDF data');
                    if (window.eventBus && window.EVENTS) {
                        window.eventBus.emit(window.EVENTS.MODEL_SYNCED, rdfContent);
                    }
                }
            }
        }, 200);
    }

    activateGraphTab() {
        // Manually activate the graph tab without clicking
        const tabButtons = document.querySelectorAll('.sparql-tabs .tab-inner-btn');
        const tabContents = document.querySelectorAll('.sparql-tab-content');
        
        // Remove active class from all
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Activate graph tab
        const graphTabButton = document.querySelector('[data-tab="sparql-graph"]');
        const graphTabContent = document.getElementById('sparql-graph');
        
        if (graphTabButton) graphTabButton.classList.add('active');
        if (graphTabContent) graphTabContent.classList.add('active');
        
        console.log('Manually activated graph tab');
    }

    async loadEndpoints() {
        try {
            const response = await fetch('/api/sparql/endpoints');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.endpoints = data.endpoints || [];
            this.updateEndpointSelect();
            
        } catch (error) {
            console.error('Failed to load endpoints:', error);
        }
    }

    updateEndpointSelect() {
        const select = document.getElementById('sparql-endpoint-select');
        if (!select) return;

        select.innerHTML = '';
        
        if (this.endpoints.length === 0) {
            select.innerHTML = '<option value="">No endpoints available</option>';
            return;
        }

        this.endpoints.forEach((endpoint, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = endpoint.label || endpoint.queryEndpoint;
            if (index === 0) option.selected = true;
            select.appendChild(option);
        });

        this.currentEndpoint = this.endpoints[0];
    }

    async executeQuery() {
        const query = document.getElementById('sparql-query-editor')?.value;
        
        if (!query?.trim()) {
            console.warn('Please enter a SPARQL query');
            return;
        }

        try {
            const isConstruct = query.trim().toUpperCase().startsWith('CONSTRUCT');
            const endpoint = isConstruct ? '/api/sparql/construct' : '/api/sparql/query';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (isConstruct) {
                this.displayGraphResult(result);
            } else {
                this.displayQueryResult(result);
            }
            
        } catch (error) {
            console.error('Query execution failed:', error);
        }
    }

    displayQueryResult(result) {
        const container = document.getElementById('query-results');
        if (!container) return;

        if (result.results?.bindings?.length > 0) {
            const table = this.createResultsTable(result);
            container.innerHTML = '';
            container.appendChild(table);
        } else {
            container.innerHTML = '<p>No results found</p>';
        }
    }

    createResultsTable(result) {
        const table = document.createElement('table');
        table.className = 'results-table';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        result.head?.vars?.forEach(variable => {
            const th = document.createElement('th');
            th.textContent = variable;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        result.results.bindings.forEach(binding => {
            const row = document.createElement('tr');
            result.head.vars.forEach(variable => {
                const td = document.createElement('td');
                const value = binding[variable];
                if (value) {
                    td.textContent = value.value;
                    td.title = `Type: ${value.type}`;
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        
        return table;
    }

    displayGraphResult(result) {
        console.log('displayGraphResult called with:', result);
        
        // Switch to Graph tab safely
        try {
            const graphTab = document.querySelector('[data-tab="sparql-graph"]');
            if (graphTab && typeof graphTab.click === 'function') {
                graphTab.click();
                console.log('Switched to graph tab');
            } else {
                console.warn('Graph tab not found or not clickable');
                // Manually switch to graph tab content
                this.activateGraphTab();
            }
        } catch (error) {
            console.error('Error switching to graph tab:', error);
            this.activateGraphTab();
        }
        
        // Debug: Log the full RDF structure
        console.log('Full RDF object:', result.rdf);
        console.log('Full graph object:', result.graph);
        
        // Load RDF data into turtle editor and trigger graph visualization via event bus
        let rdfContent = null;
        if (result.rdf && result.rdf.content) {
            rdfContent = result.rdf.content;
        } else if (result.rdf && typeof result.rdf === 'string') {
            rdfContent = result.rdf;
        } else if (result.rdf && result.rdf.data) {
            rdfContent = result.rdf.data;
        }
        
        if (rdfContent) {
            console.log('Found RDF content:', rdfContent.substring(0, 200) + '...');
            
            // Update turtle editor with RDF content (use Atuin editor if available)
            if (this.turtleEditor && this.turtleEditor.setValue) {
                // Use Atuin TurtleEditor with syntax highlighting
                this.turtleEditor.setValue(rdfContent);
                console.log('Updated Atuin turtle editor with syntax highlighting');
            } else {
                // Fallback to basic textarea
                const turtleElement = document.getElementById('turtle-editor');
                if (turtleElement) {
                    turtleElement.value = rdfContent;
                    console.log('Updated basic turtle editor');
                }
            }
            
            // Emit event bus message for Atuin integration
            if (window.eventBus && window.EVENTS) {
                // Primary event that Atuin components listen for
                window.eventBus.emit(window.EVENTS.MODEL_SYNCED, rdfContent);
                console.log('Emitted MODEL_SYNCED event for Atuin graph visualization');
            }
        } else {
            console.log('No RDF content found in result - structure:', Object.keys(result.rdf || {}));
        }
        
        // Display graph metadata and controls
        const graphContainer = document.getElementById('rdf-graph-container');
        if (graphContainer && result.graph) {
            const nodeCount = result.graph.nodes ? result.graph.nodes.length : 0;
            const edgeCount = result.graph.edges ? result.graph.edges.length : 0;
            
            graphContainer.innerHTML = `
                <div style="padding: 1rem;">
                    <h4>CONSTRUCT Query Result (${nodeCount} nodes, ${edgeCount} edges)</h4>
                    <div id="atuin-graph-display" style="width: 100%; height: 400px; border: 1px solid #ddd; margin: 1rem 0;">
                        <!-- Atuin graph visualization will be rendered here -->
                    </div>
                    <details style="margin-top: 1rem;">
                        <summary>Raw Graph Data</summary>
                        <pre style="background: #f5f5f5; padding: 1rem; overflow: auto; max-height: 200px;">${JSON.stringify(result.graph, null, 2)}</pre>
                    </details>
                </div>
            `;
            
            // Update node and edge counts in the UI
            const nodeCountEl = document.getElementById('node-count');
            const edgeCountEl = document.getElementById('edge-count');
            if (nodeCountEl) nodeCountEl.textContent = nodeCount;
            if (edgeCountEl) edgeCountEl.textContent = edgeCount;
            
            console.log(`Loaded graph with ${nodeCount} nodes and ${edgeCount} edges`);
        }
    }

    async loadGraph() {
        const query = document.getElementById('graph-query')?.value;
        if (!query?.trim()) {
            console.warn('Please enter a subject URI or CONSTRUCT query');
            return;
        }

        // Determine if it's a URI or a CONSTRUCT query
        const isConstruct = query.trim().toUpperCase().includes('CONSTRUCT');
        
        if (isConstruct) {
            // Execute as CONSTRUCT query
            const queryEditor = document.getElementById('sparql-query-editor');
            const prevQuery = queryEditor?.value;
            if (queryEditor) queryEditor.value = query;
            await this.executeQuery();
            if (prevQuery && queryEditor) queryEditor.value = prevQuery;
        } else {
            // Treat as subject URI and build CONSTRUCT query
            const constructQuery = `
                CONSTRUCT { 
                    <${query}> ?p ?o .
                    ?s ?p2 <${query}> .
                } WHERE {
                    {
                        <${query}> ?p ?o .
                    } UNION {
                        ?s ?p2 <${query}> .
                    }
                } LIMIT 100
            `;
            
            const response = await fetch('/api/sparql/construct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: constructQuery })
            });

            if (response.ok) {
                const result = await response.json();
                this.displayGraphResult(result);
            }
        }
    }

    async validateRDF() {
        const content = document.getElementById('turtle-editor')?.value;
        
        if (!content?.trim()) {
            console.warn('Please enter RDF content to validate');
            return;
        }

        try {
            const response = await fetch('/api/sparql/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            const result = await response.json();
            
            if (result.valid) {
                console.log('RDF content is valid');
            } else {
                console.error(`Validation failed: ${result.error}`);
            }
            
        } catch (error) {
            console.error(`Validation error: ${error.message}`);
        }
    }

    async insertRDF() {
        const content = document.getElementById('turtle-editor')?.value;
        
        if (!content?.trim()) {
            console.warn('Please enter RDF content to insert');
            return;
        }

        try {
            const response = await fetch('/api/sparql/insert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });

            if (response.ok) {
                console.log('RDF content inserted successfully');
            } else {
                const error = await response.text();
                console.error(`Insert failed: ${error}`);
            }
            
        } catch (error) {
            console.error(`Insert error: ${error.message}`);
        }
    }

    /**
     * Cleanup method to remove event listeners and dispose of resources
     */
    /**
     * Cleanup method to remove event listeners and dispose of resources
     */
    cleanup() {
        try {
            eventBus.emit(EVENTS.CONSOLE_DEBUG, 'Cleaning up SPARQL Browser...');
            
            // Unsubscribe from store updates
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }
            
            // Remove event bus listeners
            eventBus.off(EVENTS.SPARQL_ENDPOINT_CHANGED);
            eventBus.off(EVENTS.GRAPH_UPDATED);
            
            if (this.modelSyncHandler) {
                eventBus.off(EVENTS.MODEL_SYNCED, this.modelSyncHandler);
                this.modelSyncHandler = null;
            }
            
            // Dispose of Atuin components if they have cleanup methods
            if (this.turtleEditor?.dispose) {
                this.turtleEditor.dispose();
            }
            if (this.sparqlEditor?.dispose) {
                this.sparqlEditor.dispose();
            }
            if (this.graphVisualizer?.dispose) {
                this.graphVisualizer.dispose();
            }
            
            // Cleanup clips manager and UI if they exist
            if (this.clipsManager?.cleanup) {
                this.clipsManager.cleanup();
            }
            if (this.clipsUI?.cleanup) {
                this.clipsUI.cleanup();
            }
            
            // Clear references
            this.turtleEditor = null;
            this.sparqlEditor = null;
            this.graphVisualizer = null;
            this.clipsManager = null;
            this.clipsUI = null;
            this.endpointManager = null;
            
            // Reset state
            store.setState({
                currentEndpoint: null,
                endpoints: [],
                queryResults: null,
                isLoading: false,
                error: null,
                editorContent: '',
                graphData: null
            });
            
            this.initialized = false;
            eventBus.emit(EVENTS.CONSOLE_INFO, 'SPARQL Browser cleaned up');
            
        } catch (error) {
            const errorMsg = `Error during cleanup: ${error.message}`;
            eventBus.emit(EVENTS.APP_ERROR, new Error(errorMsg));
            console.error(errorMsg, error);
        }
    }
    
    /**
     * Execute a SPARQL query
     * @param {string} query - The SPARQL query to execute
     * @param {string} [endpoint] - Optional endpoint URL to use
     * @returns {Promise<Object>} Query results
     */
    async executeQuery(query, endpoint) {
        try {
            if (!query?.trim()) {
                throw new Error('Query cannot be empty');
            }
            
            store.setState({ 
                isLoading: true, 
                error: null,
                queryResults: null
            });
            
            const targetEndpoint = endpoint || store.getState().currentEndpoint;
            if (!targetEndpoint) {
                throw new Error('No SPARQL endpoint specified');
            }
            
            eventBus.emit(EVENTS.CONSOLE_DEBUG, `Executing query on ${targetEndpoint}`);
            eventBus.emit(EVENTS.CONSOLE_DEBUG, `Query: ${query.substring(0, 100)}...`);
            
            const startTime = performance.now();
            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json,application/ld+json,application/json'
                },
                body: query
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText || 'No error details'}`);
            }
            
            const results = await response.json();
            const duration = (performance.now() - startTime).toFixed(2);
            
            // Update state with results
            store.setState({
                queryResults: results,
                isLoading: false,
                lastQueryTime: duration
            });
            
            // Emit event with results
            eventBus.emit(EVENTS.SPARQL_QUERY_EXECUTED, { 
                query, 
                endpoint: targetEndpoint,
                results,
                duration: parseFloat(duration)
            });
            
            eventBus.emit(EVENTS.CONSOLE_INFO, `Query executed in ${duration}ms`);
            
            return results;
            
        } catch (error) {
            const errorMsg = `Query execution failed: ${error.message}`;
            store.setState({ 
                error: errorMsg,
                isLoading: false,
                queryResults: null
            });
            eventBus.emit(EVENTS.APP_ERROR, new Error(errorMsg));
            throw error;
        }
    }
    
    /**
     * Set up event listeners for the SPARQL Browser
     */
    setupEventListeners() {
        // Handle endpoint changes
        eventBus.on(EVENTS.SPARQL_ENDPOINT_CHANGED, (endpoint) => {
            if (endpoint) {
                localStorage.setItem('sparql-endpoint', endpoint);
                store.setState({ currentEndpoint: endpoint });
                eventBus.emit(EVENTS.CONSOLE_INFO, `SPARQL endpoint changed to: ${endpoint}`);
            }
        });
        
        // Handle graph updates
        eventBus.on(EVENTS.GRAPH_UPDATED, (graphData) => {
            store.setState({ graphData });
        });
        
        // Handle window unload
        window.addEventListener('beforeunload', this.cleanup.bind(this));
    }
    
    /**
     * Save current SPARQL query as a clip
     */
    async saveQuery() {
        try {
            // Get current query from editor
            let query = '';
            if (this.sparqlEditor && this.sparqlEditor.getValue) {
                query = this.sparqlEditor.getValue();
            } else {
                const sparqlElement = document.getElementById('sparql-query-editor');
                if (sparqlElement) query = sparqlElement.value;
            }

            if (!query.trim()) {
                console.warn('No query to save');
                return;
            }

            // Prompt for clip name
            const name = prompt('Enter a name for this query:');
            if (!name) return;

            // Save using clips manager
            if (this.clipsManager) {
                await this.clipsManager.saveClip(name, query);
                console.log('Query saved successfully:', name);
                
                // Refresh clips UI
                if (this.clipsUI && this.clipsUI.loadClips) {
                    await this.clipsUI.loadClips();
                }
            } else {
                console.warn('Clips manager not available');
            }
        } catch (error) {
            console.error('Failed to save query:', error);
        }
    }

    /**
     * Load a query from saved clips (show clips UI)
     */
    async loadQuery() {
        try {
            if (this.clipsManager) {
                // Get all clips and show selection
                const clips = await this.clipsManager.getAllClips();
                
                if (!clips || clips.length === 0) {
                    alert('No saved queries found');
                    return;
                }

                // Create simple selection dialog
                const clipNames = clips.map((clip, index) => `${index + 1}. ${clip.name}`).join('\n');
                const selection = prompt(`Select a query to load:\n\n${clipNames}\n\nEnter the number:`);
                
                if (!selection) return;
                
                const clipIndex = parseInt(selection) - 1;
                if (clipIndex >= 0 && clipIndex < clips.length) {
                    const selectedClip = clips[clipIndex];
                    
                    // Load query into editor
                    if (this.sparqlEditor && this.sparqlEditor.setValue) {
                        this.sparqlEditor.setValue(selectedClip.query);
                    } else {
                        const sparqlElement = document.getElementById('sparql-query-editor');
                        if (sparqlElement) sparqlElement.value = selectedClip.query;
                    }
                    
                    console.log('Query loaded successfully:', selectedClip.name);
                } else {
                    alert('Invalid selection');
                }
            } else {
                console.warn('Clips manager not available');
            }
        } catch (error) {
            console.error('Failed to load query:', error);
        }
    }

    /**
     * Save current content to file
     */
    saveFile() {
        try {
            let content = '';
            let filename = 'sparql-content';
            let extension = '.txt';

            // Determine content based on active tab
            const activeLeftTab = document.querySelector('#atuin-left-pane .tab.active');
            if (activeLeftTab?.getAttribute('data-tab') === 'turtle-editor') {
                if (this.turtleEditor && this.turtleEditor.getValue) {
                    content = this.turtleEditor.getValue();
                    filename = 'rdf-data';
                    extension = '.ttl';
                }
            } else if (activeLeftTab?.getAttribute('data-tab') === 'sparql-query') {
                if (this.sparqlEditor && this.sparqlEditor.getValue) {
                    content = this.sparqlEditor.getValue();
                    filename = 'sparql-query';
                    extension = '.rq';
                }
            }

            if (!content.trim()) {
                console.warn('No content to save');
                return;
            }

            // Create download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + extension;
            a.click();
            URL.revokeObjectURL(url);

            console.log('File saved successfully');
        } catch (error) {
            console.error('Failed to save file:', error);
        }
    }

    /**
     * Add new SPARQL endpoint
     */
    async addEndpoint() {
        try {
            const urlInput = document.getElementById('sparql-endpoint-url');
            const url = urlInput?.value?.trim();

            if (!url) {
                alert('Please enter an endpoint URL');
                return;
            }

            // Test endpoint connection
            try {
                const testResponse = await fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'application/sparql-results+json' }
                });
                
                if (!testResponse.ok) {
                    throw new Error(`HTTP ${testResponse.status}`);
                }
            } catch (error) {
                if (!confirm(`Could not connect to endpoint. Add anyway?\n\nError: ${error.message}`)) {
                    return;
                }
            }

            // Add to endpoints list
            if (!this.endpoints) this.endpoints = [];
            
            const newEndpoint = {
                label: url,
                queryEndpoint: url,
                id: Date.now().toString()
            };
            
            this.endpoints.push(newEndpoint);
            this.updateEndpointSelect();
            
            // Clear input
            if (urlInput) urlInput.value = '';
            
            console.log('Endpoint added successfully:', url);
        } catch (error) {
            console.error('Failed to add endpoint:', error);
            alert('Failed to add endpoint: ' + error.message);
        }
    }

    /**
     * Remove selected SPARQL endpoint
     */
    removeEndpoint() {
        try {
            const select = document.getElementById('sparql-endpoint-select');
            const selectedIndex = select?.selectedIndex;

            if (selectedIndex === undefined || selectedIndex < 0) {
                alert('Please select an endpoint to remove');
                return;
            }

            if (!confirm('Are you sure you want to remove this endpoint?')) {
                return;
            }

            // Remove from list
            if (this.endpoints && selectedIndex < this.endpoints.length) {
                this.endpoints.splice(selectedIndex, 1);
                this.updateEndpointSelect();
                console.log('Endpoint removed successfully');
            }
        } catch (error) {
            console.error('Failed to remove endpoint:', error);
        }
    }

    /**
     * Initialize syntax checker to show "passed" state by default
     */
    initializeSyntaxChecker() {
        try {
            // Hide all status indicators first
            const statusElements = [
                'atuin-syntax-check-failed',
                'atuin-syntax-check-working', 
                'atuin-syntax-check-pending',
                'atuin-syntax-check-off'
            ];
            
            statusElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.style.display = 'none';
                }
            });
            
            // Show "passed" status by default
            const passedElement = document.getElementById('atuin-syntax-check-passed');
            if (passedElement) {
                passedElement.style.display = 'block';
            }
            
            console.log('Syntax checker initialized to "passed" state');
        } catch (error) {
            console.error('Failed to initialize syntax checker:', error);
        }
    }

    /**
     * Pre-load SPARQL tab with a CONSTRUCT query for ragno:Concept subjects
     */
    async preloadSparqlQuery() {
        try {
            const defaultQuery = `PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
    ?subject rdf:type ragno:Concept .
    ?subject rdfs:label ?label .
    ?subject ?prop ?value .
}
WHERE {
    ?subject rdf:type ragno:Concept .
    OPTIONAL { ?subject rdfs:label ?label }
    OPTIONAL { ?subject ?prop ?value }
}
LIMIT 5`;

            // Load query into SPARQL editor
            const sparqlEditor = document.getElementById('sparql-query-editor');
            if (sparqlEditor) {
                if (this.sparqlEditor && this.sparqlEditor.setValue) {
                    // Use Atuin SPARQL editor if available
                    this.sparqlEditor.setValue(defaultQuery);
                } else {
                    // Fallback to basic textarea
                    sparqlEditor.value = defaultQuery;
                }
                console.log('Pre-loaded SPARQL query into editor');
            }

            // Save to clips if clips manager is available
            if (this.clipsManager && typeof this.clipsManager.saveClip === 'function') {
                await this.clipsManager.saveClip({
                    name: 'Find ragno:Concept subjects',
                    query: defaultQuery,
                    description: 'CONSTRUCT query to find 5 subjects with type ragno:Concept',
                    timestamp: new Date().toISOString()
                });
                console.log('Saved default SPARQL query to clips');
                
                // Refresh clips UI if available
                if (this.clipsUI && typeof this.clipsUI.loadClips === 'function') {
                    this.clipsUI.loadClips();
                }
            } else {
                console.log('Clips manager not available - query not saved to clips');
            }

        } catch (error) {
            console.error('Failed to preload SPARQL query:', error);
        }
    }

    /**
     * Load system configuration values into settings panel
     */
    async loadSystemSettings() {
        try {
            console.log('Loading system settings...');
            
            // Fetch system configuration from API
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.status}`);
            }
            
            const config = await response.json();
            console.log('Received system config:', config);

            // Load SPARQL endpoints
            if (config.sparql?.endpoints) {
                const endpointSelect = document.getElementById('sparql-endpoint-select');
                const endpointUrlInput = document.getElementById('sparql-endpoint-url');
                
                if (endpointSelect) {
                    // Clear existing options
                    endpointSelect.innerHTML = '';
                    
                    // Add endpoints from config
                    config.sparql.endpoints.forEach((endpoint, index) => {
                        const option = document.createElement('option');
                        option.value = endpoint.url || endpoint;
                        option.textContent = endpoint.name || endpoint.url || endpoint;
                        if (index === 0 || endpoint.default) {
                            option.selected = true;
                        }
                        endpointSelect.appendChild(option);
                    });
                    console.log(`Loaded ${config.sparql.endpoints.length} SPARQL endpoints`);
                }
                
                // Pre-fill URL input with first endpoint
                if (endpointUrlInput && config.sparql.endpoints.length > 0) {
                    const firstEndpoint = config.sparql.endpoints[0];
                    endpointUrlInput.value = firstEndpoint.url || firstEndpoint;
                }
            }

            // Load visualization settings
            if (config.visualization) {
                const nodeSizeSlider = document.getElementById('atuin-node-size');
                const nodeSizeValue = document.getElementById('atuin-node-size-value');
                const edgeWidthSlider = document.getElementById('atuin-edge-width');
                const physicsCheckbox = document.getElementById('atuin-physics-enabled');

                if (nodeSizeSlider && config.visualization.nodeSize) {
                    nodeSizeSlider.value = config.visualization.nodeSize;
                    if (nodeSizeValue) nodeSizeValue.textContent = config.visualization.nodeSize;
                }

                if (edgeWidthSlider && config.visualization.edgeWidth) {
                    edgeWidthSlider.value = config.visualization.edgeWidth;
                }

                if (physicsCheckbox && typeof config.visualization.physics === 'boolean') {
                    physicsCheckbox.checked = config.visualization.physics;
                }
                console.log('Loaded visualization settings');
            }

            // Load editor settings
            if (config.editor) {
                const fontSizeSelect = document.getElementById('atuin-font-size');
                const autoCompleteCheckbox = document.getElementById('atuin-auto-complete');

                if (fontSizeSelect && config.editor.fontSize) {
                    fontSizeSelect.value = config.editor.fontSize;
                }

                if (autoCompleteCheckbox && typeof config.editor.autoComplete === 'boolean') {
                    autoCompleteCheckbox.checked = config.editor.autoComplete;
                }
                console.log('Loaded editor settings');
            }

            // Setup event listeners for settings changes
            this.setupSettingsEventListeners();

        } catch (error) {
            console.error('Failed to load system settings:', error);
            // Set fallback values
            this.setFallbackSettings();
        }
    }

    /**
     * Setup event listeners for settings changes
     */
    setupSettingsEventListeners() {
        // Node size slider
        const nodeSizeSlider = document.getElementById('atuin-node-size');
        const nodeSizeValue = document.getElementById('atuin-node-size-value');
        if (nodeSizeSlider && nodeSizeValue) {
            nodeSizeSlider.addEventListener('input', (e) => {
                nodeSizeValue.textContent = e.target.value;
                this.updateVisualizationSettings();
            });
        }

        // Edge width slider
        const edgeWidthSlider = document.getElementById('atuin-edge-width');
        if (edgeWidthSlider) {
            edgeWidthSlider.addEventListener('input', () => {
                this.updateVisualizationSettings();
            });
        }

        // Physics checkbox
        const physicsCheckbox = document.getElementById('atuin-physics-enabled');
        if (physicsCheckbox) {
            physicsCheckbox.addEventListener('change', () => {
                this.updateVisualizationSettings();
            });
        }

        // Font size select
        const fontSizeSelect = document.getElementById('atuin-font-size');
        if (fontSizeSelect) {
            fontSizeSelect.addEventListener('change', () => {
                this.updateEditorSettings();
            });
        }

        // Auto-complete checkbox
        const autoCompleteCheckbox = document.getElementById('atuin-auto-complete');
        if (autoCompleteCheckbox) {
            autoCompleteCheckbox.addEventListener('change', () => {
                this.updateEditorSettings();
            });
        }

        // SPARQL endpoint management
        const addEndpointBtn = document.getElementById('add-sparql-endpoint');
        const removeEndpointBtn = document.getElementById('remove-sparql-endpoint');
        
        if (addEndpointBtn) {
            addEndpointBtn.addEventListener('click', () => this.addSparqlEndpoint());
        }
        
        if (removeEndpointBtn) {
            removeEndpointBtn.addEventListener('click', () => this.removeSparqlEndpoint());
        }
    }

    /**
     * Set fallback settings if config fetch fails
     */
    setFallbackSettings() {
        console.log('Setting fallback settings...');
        
        // Default SPARQL endpoint
        const endpointUrlInput = document.getElementById('sparql-endpoint-url');
        if (endpointUrlInput && !endpointUrlInput.value) {
            endpointUrlInput.value = 'http://localhost:3030/dataset/sparql';
        }

        // Default visualization settings
        const nodeSizeSlider = document.getElementById('atuin-node-size');
        const nodeSizeValue = document.getElementById('atuin-node-size-value');
        if (nodeSizeSlider && !nodeSizeSlider.value) {
            nodeSizeSlider.value = '20';
            if (nodeSizeValue) nodeSizeValue.textContent = '20';
        }

        const edgeWidthSlider = document.getElementById('atuin-edge-width');
        if (edgeWidthSlider && !edgeWidthSlider.value) {
            edgeWidthSlider.value = '2';
        }

        const physicsCheckbox = document.getElementById('atuin-physics-enabled');
        if (physicsCheckbox) {
            physicsCheckbox.checked = true;
        }

        // Default editor settings
        const fontSizeSelect = document.getElementById('atuin-font-size');
        if (fontSizeSelect && !fontSizeSelect.value) {
            fontSizeSelect.value = '14';
        }

        const autoCompleteCheckbox = document.getElementById('atuin-auto-complete');
        if (autoCompleteCheckbox) {
            autoCompleteCheckbox.checked = true;
        }
    }

    /**
     * Update visualization settings
     */
    updateVisualizationSettings() {
        if (this.graphVisualizer && typeof this.graphVisualizer.updateSettings === 'function') {
            const settings = {
                nodeSize: parseInt(document.getElementById('atuin-node-size')?.value || 20),
                edgeWidth: parseInt(document.getElementById('atuin-edge-width')?.value || 2),
                physics: document.getElementById('atuin-physics-enabled')?.checked || true
            };
            this.graphVisualizer.updateSettings(settings);
            console.log('Updated visualization settings:', settings);
        }
    }

    /**
     * Update editor settings
     */
    updateEditorSettings() {
        const fontSize = document.getElementById('atuin-font-size')?.value || '14';
        const autoComplete = document.getElementById('atuin-auto-complete')?.checked || true;
        
        // Apply font size to editors
        const turtleEditor = document.getElementById('turtle-editor');
        const sparqlEditor = document.getElementById('sparql-query-editor');
        
        if (turtleEditor) {
            turtleEditor.style.fontSize = fontSize + 'px';
        }
        if (sparqlEditor) {
            sparqlEditor.style.fontSize = fontSize + 'px';
        }
        
        console.log('Updated editor settings:', { fontSize, autoComplete });
    }

    /**
     * Add new SPARQL endpoint
     */
    addSparqlEndpoint() {
        const urlInput = document.getElementById('sparql-endpoint-url');
        const select = document.getElementById('sparql-endpoint-select');
        
        if (urlInput && select && urlInput.value.trim()) {
            const option = document.createElement('option');
            option.value = urlInput.value.trim();
            option.textContent = urlInput.value.trim();
            option.selected = true;
            select.appendChild(option);
            
            // Clear input
            urlInput.value = '';
            
            console.log('Added SPARQL endpoint:', option.value);
        }
    }

    /**
     * Remove selected SPARQL endpoint
     */
    removeSparqlEndpoint() {
        const select = document.getElementById('sparql-endpoint-select');
        if (select && select.selectedIndex >= 0) {
            const removedEndpoint = select.options[select.selectedIndex].value;
            select.remove(select.selectedIndex);
            console.log('Removed SPARQL endpoint:', removedEndpoint);
        }
    }

    /**
     * Alias for cleanup to maintain backward compatibility
     */
    destroy() {
        this.cleanup();
    }
}