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
            
            // Initialize graph visualizer
            await this.initializeGraphVisualizer();
            
            // Initialize SPARQL Clips Manager and UI
            await this.initializeClipsManager();
            
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

    async initializeAtuinEditors() {
        try {
            eventBus.emit(EVENTS.CONSOLE_DEBUG, 'Initializing Atuin editors...');
            
            // Check if Atuin components are available
            if (!window.TurtleEditor || !window.SPARQLEditor || !window.GraphVisualizer || !window.LoggerService) {
                eventBus.emit(EVENTS.CONSOLE_INFO, 'Atuin components not available, trying to load...');
                
                try {
                    // Import Atuin components directly from individual modules to avoid core index issues
                    const { TurtleEditor } = await import('atuin/core/TurtleEditor');
                    const { SPARQLEditor } = await import('atuin/core/SPARQLEditor');
                    const { GraphVisualizer } = await import('atuin/core/GraphVisualizer');
                    const { LoggerService, SPARQLClipsManager } = await import('atuin/services');
                    const { SPARQLClipsUI, SPARQLEndpointManager } = await import('atuin/ui');
                    
                    window.TurtleEditor = TurtleEditor;
                    window.SPARQLEditor = SPARQLEditor;
                    window.GraphVisualizer = GraphVisualizer;
                    window.LoggerService = LoggerService;
                    window.SPARQLClipsManager = SPARQLClipsManager;
                    window.SPARQLClipsUI = SPARQLClipsUI;
                    window.SPARQLEndpointManager = SPARQLEndpointManager;
                    
                    eventBus.emit(EVENTS.CONSOLE_INFO, 'Atuin components loaded successfully');
                } catch (error) {
                    const errorMsg = `Failed to load Atuin components: ${error.message}`;
                    eventBus.emit(EVENTS.APP_ERROR, new Error(errorMsg));
                    throw error;
                }
            }
            
            // Create message queue container for LoggerService (required by Atuin)
            this.createMessageQueue();
            
            // Initialize logger with message queue container ID (per Atuin docs)
            this.logger = new window.LoggerService('atuin-message-queue');
            
            // Initialize SPARQL editor with DOM element (not string ID)
            const sparqlElement = document.getElementById('sparql-query-editor');
            if (sparqlElement && window.SPARQLEditor) {
                this.sparqlEditor = new window.SPARQLEditor(sparqlElement, this.logger);
                this.sparqlEditor.initialize();
                console.log('SPARQL editor with syntax highlighting initialized');
            }
            
            // Initialize Turtle editor with DOM element (not string ID)
            const turtleElement = document.getElementById('turtle-editor');
            if (turtleElement && window.TurtleEditor) {
                this.turtleEditor = new window.TurtleEditor(turtleElement, this.logger);
                this.turtleEditor.initialize();
                
                // Load sample RDF data by default for testing
                const sampleRDF = this.getSampleRDFData();
                this.turtleEditor.setValue(sampleRDF);
                
                console.log('Turtle editor with syntax highlighting initialized with sample data');
            }
            
            // Initialize Graph Visualizer with container ID (per integration guide)
            await this.initializeGraphVisualizer();
            
            // Initialize SPARQL Clips Manager and UI (new Atuin features)
            await this.initializeClipsManager();
            
            // Initialize SPARQL Endpoint Manager (new Atuin features)
            await this.initializeEndpointManager();
            
        } catch (error) {
            console.warn('Could not initialize Atuin editors with syntax highlighting:', error);
            console.log('Falling back to basic textarea editors');
            
            // Load sample data into basic textarea if Atuin fails
            const turtleElement = document.getElementById('turtle-editor');
            if (turtleElement) {
                turtleElement.value = this.getSampleRDFData();
                console.log('Loaded sample RDF data into basic textarea');
            }
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
                
                // Initialize GraphVisualizer with container ID (per Atuin integration guide)
                this.graphVisualizer = new window.GraphVisualizer('rdf-graph-container', this.logger);
                console.log('Graph visualizer initialized with container ID');
                
                // Set up event listener for MODEL_SYNCED events (automatic sync with TurtleEditor)
                if (window.eventBus && window.EVENTS) {
                    const modelSyncHandler = (content) => {
                        console.log('DEBUG: Received MODEL_SYNCED event in SPARQLBrowser:', content ? content.substring(0, 100) + '...' : 'empty');
                        
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
                this.clipsManager = new window.SPARQLClipsManager(this.logger);
                
                // Create clips UI with query selection callback
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
                
                // Render clips UI into container if it exists
                const clipsContainer = document.getElementById('sparql-clips-container');
                if (clipsContainer) {
                    this.clipsUI.render(clipsContainer);
                    console.log('SPARQL Clips Manager initialized');
                } else {
                    console.log('SPARQL clips container not found, clips UI not rendered');
                }
            }
        } catch (error) {
            console.warn('Could not initialize SPARQL Clips Manager:', error);
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
     * Update graph statistics display
     */
    updateGraphStats() {
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

    setupEventListeners() {
        // Execute Query button
        const executeBtn = document.getElementById('execute-query');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeQuery());
        }

        // Load Graph button
        const loadGraphBtn = document.getElementById('load-graph');
        if (loadGraphBtn) {
            loadGraphBtn.addEventListener('click', () => this.loadGraph());
        }

        // Validate RDF button
        const validateBtn = document.getElementById('validate-rdf');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateRDF());
        }

        // Insert RDF button
        const insertBtn = document.getElementById('insert-rdf');
        if (insertBtn) {
            insertBtn.addEventListener('click', () => this.insertRDF());
        }

        // Refresh endpoints button
        const refreshBtn = document.getElementById('refresh-endpoints');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadEndpoints());
        }
    }

    setupTabs() {
        // Add a small delay to ensure DOM is ready
        setTimeout(() => {
            const tabButtons = document.querySelectorAll('.sparql-tabs .tab-inner-btn');
            const tabContents = document.querySelectorAll('.sparql-tab-content');

            console.log('Setting up SPARQL tabs. Found', tabButtons.length, 'tab buttons');

            if (tabButtons.length === 0) {
                console.warn('No SPARQL tab buttons found - DOM might not be ready');
                return;
            }

            tabButtons.forEach((button, index) => {
                const targetTab = button.getAttribute('data-tab');
                console.log(`Tab ${index}: ${targetTab}`);
                
                button.addEventListener('click', () => {
                    console.log(`Tab clicked: ${targetTab}`);
                    
                    // Remove active class from all buttons and contents
                    tabButtons.forEach(btn => {
                        if (btn.classList) {
                            btn.classList.remove('active');
                        }
                    });
                    tabContents.forEach(content => {
                        if (content.classList) {
                            content.classList.remove('active');
                        }
                    });
                    
                    // Add active class to clicked button and corresponding content
                    if (button.classList) {
                        button.classList.add('active');
                    }
                    const targetContent = document.getElementById(targetTab);
                    if (targetContent && targetContent.classList) {
                        targetContent.classList.add('active');
                    }
                    
                    // Special handling for Graph tab - trigger manual graph update
                    if (targetTab === 'sparql-graph') {
                        console.log('Graph tab clicked - calling refreshGraphVisualization');
                        this.refreshGraphVisualization();
                    }
                });
            });
        }, 100);
    }
    
    refreshGraphVisualization() {
        console.log('Refreshing graph visualization...');
        
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
        
        // Emit MODEL_SYNCED event to trigger automatic graph update via event bus
        if (rdfContent.trim() && window.eventBus && window.EVENTS) {
            console.log('Emitting MODEL_SYNCED event for graph update...');
            window.eventBus.emit(window.EVENTS.MODEL_SYNCED, rdfContent);
            
            // Update stats after a delay to allow graph to process
            setTimeout(() => {
                this.updateGraphStats();
            }, 500);
            
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
     * Alias for cleanup to maintain backward compatibility
     */
    destroy() {
        this.cleanup();
    }
}