/**
 * SPARQL Controller Component
 * Integrated SPARQL browser with Atuin syntax highlighting for the Semantic Memory Workbench
 * Adapted from the existing sparqlBrowser.js with workbench integration
 */

import { showToast, escapeHtml, getElementById, createElement } from '../utils/domUtils.js';

/**
 * SPARQLController manages the SPARQL browser interface
 * Provides RDF editing, SPARQL querying, graph visualization, and endpoint management
 */
export class SPARQLController {
    constructor(stateManager, apiService, settingsManager) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        this.settingsManager = settingsManager;
        
        // Atuin components (will be loaded dynamically)
        this.turtleEditor = null;
        this.sparqlEditor = null;
        this.graphVisualizer = null;
        this.logger = null;
        this.clipsManager = null;
        this.clipsUI = null;
        
        // State
        this.isInitialized = false;
        this.currentEndpoint = null;
        this.endpoints = [];
        this.activeLeftTab = 'turtle-editor';
        this.activeRightTab = 'view-pane';
        
        // Sample RDF data for initialization
        this.sampleRDF = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ragno: <http://purl.org/stuff/ragno/> .

# Sample semantic memory knowledge graph
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

ex:semanticWeb a ragno:Concept ;
    rdfs:label "Semantic Web" ;
    rdfs:comment "Technologies for machine-readable web data" .

ex:artificialIntelligence a ragno:Concept ;
    rdfs:label "Artificial Intelligence" ;
    rdfs:comment "Computer systems that perform tasks requiring human intelligence" .

ex:machineLearning a ragno:Concept ;
    rdfs:label "Machine Learning" ;
    rdfs:comment "AI systems that improve through experience" .

ex:acmeCorp a ex:Organization ;
    rdfs:label "ACME Corporation" ;
    ex:industry "Technology" ;
    ex:foundedIn 2010 ;
    ex:hasEmployee ex:alice, ex:charlie .`;

        // Default SPARQL query
        this.defaultSparqlQuery = `PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

CONSTRUCT {
    ?subject rdf:type ?type .
    ?subject rdfs:label ?label .
    ?subject foaf:name ?name .
    ?subject ?prop ?value .
}
WHERE {
    ?subject rdf:type ?type .
    OPTIONAL { ?subject rdfs:label ?label }
    OPTIONAL { ?subject foaf:name ?name }
    OPTIONAL { ?subject ?prop ?value }
}
LIMIT 20`;
        
        // Bind methods
        this.initializeAtuinComponents = this.initializeAtuinComponents.bind(this);
        this.handleTabSwitch = this.handleTabSwitch.bind(this);
        this.executeQuery = this.executeQuery.bind(this);
        this.saveQuery = this.saveQuery.bind(this);
        this.loadQuery = this.loadQuery.bind(this);
        this.refreshGraphVisualization = this.refreshGraphVisualization.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize the SPARQL controller
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing SPARQL Controller...');
            
            // Load endpoints from settings
            this.loadEndpointsFromSettings();
            
            // Render the interface
            this.render();
            
            // Try to initialize Atuin components (optional - graceful degradation)
            await this.initializeAtuinComponents();
            
            // Setup basic functionality
            this.setupBasicFunctionality();
            
            // Listen for settings changes
            this.setupSettingsListeners();
            
            this.isInitialized = true;
            console.log('SPARQL Controller initialized successfully');
            
            // Show success message only if Atuin components loaded
            if (this.turtleEditor && this.sparqlEditor) {
                showToast('SPARQL browser with syntax highlighting loaded', 'success', 3000);
            }
            
        } catch (error) {
            console.error('Failed to initialize SPARQL Controller:', error);
            // Continue with basic functionality even if Atuin fails
            showToast('SPARQL browser loaded (basic mode)', 'warning', 3000);
            this.isInitialized = true;
        }
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        document.addEventListener('click', (event) => {
            // Tab switching
            if (event.target.matches('.sparql-tab-btn')) {
                const tab = event.target.dataset.tab;
                const panel = event.target.dataset.panel;
                if (tab && panel) {
                    this.handleTabSwitch(panel, tab);
                }
            }
            
            // SPARQL operations
            if (event.target.matches('#sparql-execute-btn')) {
                event.preventDefault();
                this.executeQuery();
            }
            
            if (event.target.matches('#sparql-save-btn')) {
                event.preventDefault();
                this.saveQuery();
            }
            
            if (event.target.matches('#sparql-load-btn')) {
                event.preventDefault();
                this.loadQuery();
            }
            
            if (event.target.matches('#sparql-clear-btn')) {
                event.preventDefault();
                this.clearEditor();
            }
            
            // RDF operations
            if (event.target.matches('#rdf-validate-btn')) {
                event.preventDefault();
                this.validateRDF();
            }
            
            if (event.target.matches('#rdf-visualize-btn')) {
                event.preventDefault();
                this.refreshGraphVisualization();
            }
            
            if (event.target.matches('#rdf-clear-btn')) {
                event.preventDefault();
                this.clearRDFEditor();
            }
            
            // File operations
            if (event.target.matches('#sparql-export-btn')) {
                event.preventDefault();
                this.exportContent();
            }
            
            if (event.target.matches('#sparql-import-btn')) {
                event.preventDefault();
                this.importContent();
            }
            
            // Endpoint management
            if (event.target.matches('#sparql-add-endpoint-btn')) {
                event.preventDefault();
                this.addEndpoint();
            }
            
            if (event.target.matches('#sparql-remove-endpoint-btn')) {
                event.preventDefault();
                this.removeEndpoint();
            }
        });
        
        document.addEventListener('change', (event) => {
            if (event.target.matches('#sparql-endpoint-select')) {
                this.handleEndpointChange(event.target.value);
            }
        });
    }
    
    /**
     * Render the SPARQL interface
     */
    render() {
        const sparqlTab = getElementById('sparql-tab');
        if (!sparqlTab) {
            console.error('SPARQL tab element not found');
            return;
        }
        
        sparqlTab.innerHTML = `
            <div class="sparql-container">
                <div class="sparql-header">
                    <h2>SPARQL Browser</h2>
                    <p class="sparql-description">Advanced RDF editing and SPARQL querying with syntax highlighting</p>
                </div>
                
                <div class="sparql-layout">
                    <!-- Left Panel: Editors -->
                    <div class="sparql-left-panel">
                        <div class="panel-header">
                            <nav class="sparql-tabs">
                                <button 
                                    class="sparql-tab-btn active" 
                                    data-panel="left" 
                                    data-tab="turtle-editor"
                                    title="RDF Turtle Editor"
                                >
                                    🐢 RDF Editor
                                </button>
                                <button 
                                    class="sparql-tab-btn" 
                                    data-panel="left" 
                                    data-tab="sparql-query"
                                    title="SPARQL Query Editor"
                                >
                                    📝 SPARQL Query
                                </button>
                            </nav>
                        </div>
                        
                        <div class="panel-content">
                            <!-- Turtle Editor Tab -->
                            <div id="turtle-editor-pane" class="tab-pane active">
                                <div class="editor-toolbar">
                                    <button id="rdf-validate-btn" class="btn btn-outline">
                                        <span class="btn-icon">✓</span>
                                        Validate
                                    </button>
                                    <button id="rdf-visualize-btn" class="btn btn-outline">
                                        <span class="btn-icon">🎯</span>
                                        Visualize
                                    </button>
                                    <button id="rdf-clear-btn" class="btn btn-outline">
                                        <span class="btn-icon">🗑️</span>
                                        Clear
                                    </button>
                                </div>
                                
                                <div class="editor-container">
                                    <textarea 
                                        id="turtle-editor" 
                                        class="code-editor"
                                        rows="20"
                                        placeholder="Enter Turtle RDF content here..."
                                    >${escapeHtml(this.sampleRDF)}</textarea>
                                </div>
                                
                                <div class="editor-status">
                                    <span class="status-item">
                                        <span class="status-label">Format:</span>
                                        <span class="status-value">Turtle</span>
                                    </span>
                                    <span class="status-item">
                                        <span class="status-label">Lines:</span>
                                        <span id="turtle-line-count" class="status-value">0</span>
                                    </span>
                                </div>
                            </div>
                            
                            <!-- SPARQL Query Tab -->
                            <div id="sparql-query-pane" class="tab-pane">
                                <div class="editor-toolbar">
                                    <button id="sparql-execute-btn" class="btn btn-primary">
                                        <span class="btn-icon">▶️</span>
                                        Execute Query
                                    </button>
                                    <button id="sparql-save-btn" class="btn btn-outline">
                                        <span class="btn-icon">💾</span>
                                        Save
                                    </button>
                                    <button id="sparql-load-btn" class="btn btn-outline">
                                        <span class="btn-icon">📁</span>
                                        Load
                                    </button>
                                    <button id="sparql-clear-btn" class="btn btn-outline">
                                        <span class="btn-icon">🗑️</span>
                                        Clear
                                    </button>
                                </div>
                                
                                <div class="editor-container">
                                    <textarea 
                                        id="sparql-query-editor" 
                                        class="code-editor"
                                        rows="15"
                                        placeholder="Enter SPARQL query here..."
                                    >${escapeHtml(this.defaultSparqlQuery)}</textarea>
                                </div>
                                
                                <div class="editor-status">
                                    <span class="status-item">
                                        <span class="status-label">Query Type:</span>
                                        <span id="query-type" class="status-value">CONSTRUCT</span>
                                    </span>
                                    <span class="status-item">
                                        <span class="status-label">Endpoint:</span>
                                        <span id="current-endpoint" class="status-value">None</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right Panel: Results and Settings -->
                    <div class="sparql-right-panel">
                        <div class="panel-header">
                            <nav class="sparql-tabs">
                                <button 
                                    class="sparql-tab-btn active" 
                                    data-panel="right" 
                                    data-tab="results-pane"
                                    title="Query Results and Graph Visualization"
                                >
                                    📊 Results
                                </button>
                                <button 
                                    class="sparql-tab-btn" 
                                    data-panel="right" 
                                    data-tab="endpoints-pane"
                                    title="SPARQL Endpoint Management"
                                >
                                    🔗 Endpoints
                                </button>
                                <button 
                                    class="sparql-tab-btn" 
                                    data-panel="right" 
                                    data-tab="clips-pane"
                                    title="Query Clips and Templates"
                                >
                                    📋 Clips
                                </button>
                            </nav>
                        </div>
                        
                        <div class="panel-content">
                            <!-- Results Tab -->
                            <div id="results-pane" class="tab-pane active">
                                <div class="results-header">
                                    <h4>Query Results</h4>
                                    <div class="results-actions">
                                        <button id="sparql-export-btn" class="btn btn-outline btn-sm">
                                            📤 Export
                                        </button>
                                    </div>
                                </div>
                                
                                <div id="sparql-results-container" class="results-container">
                                    <div class="results-placeholder">
                                        <div class="placeholder-icon">📊</div>
                                        <div class="placeholder-text">Execute a SPARQL query to see results</div>
                                        <div class="placeholder-actions">
                                            <button class="btn btn-primary" onclick="document.querySelector('[data-tab=sparql-query]').click()">
                                                Open SPARQL Editor
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Graph Visualization Container -->
                                <div id="graph-visualization-container" style="display: none;">
                                    <div class="graph-header">
                                        <h5>RDF Graph Visualization</h5>
                                        <div class="graph-stats">
                                            <span>Nodes: <span id="graph-node-count">0</span></span>
                                            <span>Edges: <span id="graph-edge-count">0</span></span>
                                        </div>
                                    </div>
                                    <div id="rdf-graph-container" class="graph-container"></div>
                                </div>
                            </div>
                            
                            <!-- Endpoints Tab -->
                            <div id="endpoints-pane" class="tab-pane">
                                <div class="endpoints-header">
                                    <h4>SPARQL Endpoints</h4>
                                    <p class="endpoints-description">Manage SPARQL endpoint connections</p>
                                </div>
                                
                                <div class="endpoints-form">
                                    <div class="form-group">
                                        <label for="sparql-endpoint-select">Active Endpoint</label>
                                        <select id="sparql-endpoint-select" class="form-select">
                                            <option value="">Select an endpoint...</option>
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="sparql-endpoint-url">Add New Endpoint</label>
                                        <div class="input-group">
                                            <input 
                                                type="url" 
                                                id="sparql-endpoint-url" 
                                                class="form-input"
                                                placeholder="https://query.wikidata.org/sparql"
                                            >
                                            <button id="sparql-add-endpoint-btn" class="btn btn-primary">
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="endpoints-actions">
                                        <button id="sparql-remove-endpoint-btn" class="btn btn-outline">
                                            Remove Selected
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="endpoints-presets">
                                    <h5>Popular Endpoints</h5>
                                    <div class="preset-endpoints">
                                        <div class="preset-item">
                                            <span class="preset-name">Wikidata</span>
                                            <span class="preset-url">https://query.wikidata.org/sparql</span>
                                            <button class="btn btn-outline btn-sm" onclick="document.getElementById('sparql-endpoint-url').value = 'https://query.wikidata.org/sparql'">
                                                Use
                                            </button>
                                        </div>
                                        <div class="preset-item">
                                            <span class="preset-name">DBpedia</span>
                                            <span class="preset-url">https://dbpedia.org/sparql</span>
                                            <button class="btn btn-outline btn-sm" onclick="document.getElementById('sparql-endpoint-url').value = 'https://dbpedia.org/sparql'">
                                                Use
                                            </button>
                                        </div>
                                        <div class="preset-item">
                                            <span class="preset-name">Local Fuseki</span>
                                            <span class="preset-url">http://localhost:4030/semem/query</span>
                                            <button class="btn btn-outline btn-sm" onclick="document.getElementById('sparql-endpoint-url').value = 'http://localhost:4030/semem/query'">
                                                Use
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Clips Tab -->
                            <div id="clips-pane" class="tab-pane">
                                <div class="clips-header">
                                    <h4>Query Clips</h4>
                                    <p class="clips-description">Saved SPARQL queries and templates</p>
                                </div>
                                
                                <div id="sparql-clips-container" class="clips-container">
                                    <div class="clips-placeholder">
                                        <div class="placeholder-icon">📋</div>
                                        <div class="placeholder-text">No saved queries yet</div>
                                        <div class="placeholder-hint">Use the Save button in the SPARQL editor to save queries</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="sparql-footer">
                    <div class="footer-actions">
                        <button id="sparql-import-btn" class="btn btn-outline">
                            📥 Import File
                        </button>
                        <div class="footer-status" id="sparql-status">
                            <span class="status-indicator"></span>
                            <span class="status-text">Ready</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize UI state
        this.updateEndpointSelect();
        this.updateLineCount();
    }
    
    /**
     * Initialize Atuin components for syntax highlighting (optional)
     */
    async initializeAtuinComponents() {
        try {
            console.log('Attempting to load Atuin components...');
            
            // Try to import Atuin components
            const atuinModules = await Promise.allSettled([
                import('atuin/core/TurtleEditor'),
                import('atuin/core/SPARQLEditor'), 
                import('atuin/core/GraphVisualizer'),
                import('atuin/services/LoggerService'),
                import('atuin/services/SPARQLClipsManager'),
                import('atuin/ui/SPARQLClipsUI')
            ]);
            
            // Check if imports were successful
            const [turtleModule, sparqlModule, graphModule, loggerModule, clipsModule, clipsUIModule] = atuinModules;
            
            if (turtleModule.status === 'fulfilled' && 
                sparqlModule.status === 'fulfilled' && 
                loggerModule.status === 'fulfilled') {
                
                console.log('Atuin modules loaded successfully');
                
                // Initialize logger
                this.createMessageQueue();
                this.logger = new loggerModule.value.LoggerService('atuin-message-queue');
                
                // Initialize Turtle editor with syntax highlighting
                const turtleElement = getElementById('turtle-editor');
                if (turtleElement) {
                    this.turtleEditor = new turtleModule.value.TurtleEditor(turtleElement, this.logger);
                    await this.turtleEditor.initialize();
                    this.turtleEditor.setValue(this.sampleRDF);
                    console.log('Turtle editor with syntax highlighting initialized');
                }
                
                // Initialize SPARQL editor with syntax highlighting
                const sparqlElement = getElementById('sparql-query-editor');
                if (sparqlElement) {
                    this.sparqlEditor = new sparqlModule.value.SPARQLEditor(sparqlElement, this.logger);
                    await this.sparqlEditor.initialize();
                    this.sparqlEditor.setValue(this.defaultSparqlQuery);
                    console.log('SPARQL editor with syntax highlighting initialized');
                }
                
                // Initialize Graph Visualizer if available
                if (graphModule.status === 'fulfilled') {
                    const graphContainer = getElementById('rdf-graph-container');
                    if (graphContainer) {
                        this.graphVisualizer = new graphModule.value.GraphVisualizer('rdf-graph-container', this.logger);
                        console.log('Graph visualizer initialized');
                        
                        // Auto-visualize initial RDF data
                        setTimeout(() => this.refreshGraphVisualization(), 500);
                    }
                }
                
                // Initialize Clips Manager if available
                if (clipsModule.status === 'fulfilled' && clipsUIModule.status === 'fulfilled') {
                    this.clipsManager = new clipsModule.value.SPARQLClipsManager(this.logger);
                    this.clipsUI = new clipsUIModule.value.SPARQLClipsUI({
                        clipsManager: this.clipsManager,
                        logger: this.logger,
                        onClipSelect: (query) => {
                            if (this.sparqlEditor && this.sparqlEditor.setValue) {
                                this.sparqlEditor.setValue(query);
                            } else {
                                const sparqlElement = getElementById('sparql-query-editor');
                                if (sparqlElement) sparqlElement.value = query;
                            }
                            showToast('Query loaded from clips', 'success', 2000);
                        }
                    });
                    console.log('SPARQL Clips Manager initialized');
                }
                
                // Setup event listeners for model syncing
                this.setupAtuinEventListeners();
                
            } else {
                console.log('Some Atuin modules failed to load - using basic editors');
            }
            
        } catch (error) {
            console.log('Atuin components not available - using basic text editors:', error.message);
            // This is not an error - just means we use basic functionality
        }
    }
    
    /**
     * Create message queue for Atuin logger
     */
    createMessageQueue() {
        if (document.getElementById('atuin-message-queue')) return;
        
        const messageQueue = createElement('div', {
            id: 'atuin-message-queue',
            className: 'atuin-messages',
            style: 'position: fixed; top: 20px; right: 20px; z-index: 1000; width: 300px; max-height: 400px; overflow-y: auto; display: none;'
        });
        
        document.body.appendChild(messageQueue);
    }
    
    /**
     * Setup event listeners for Atuin integration
     */
    setupAtuinEventListeners() {
        // Listen for model sync events
        if (window.eventBus && window.EVENTS) {
            window.eventBus.on(window.EVENTS.MODEL_SYNCED, (content) => {
                console.log('MODEL_SYNCED event received in SPARQL Controller');
                this.updateGraphStats();
            });
        }
        
        // Setup auto-visualization on RDF content changes
        const turtleElement = getElementById('turtle-editor');
        if (turtleElement) {
            turtleElement.addEventListener('input', this.debounce(() => {
                this.updateLineCount();
                this.detectQueryType();
            }, 300));
        }
        
        const sparqlElement = getElementById('sparql-query-editor');
        if (sparqlElement) {
            sparqlElement.addEventListener('input', this.debounce(() => {
                this.detectQueryType();
            }, 300));
        }
    }
    
    /**
     * Setup basic functionality without Atuin
     */
    setupBasicFunctionality() {
        // Update line counts and query type detection
        this.updateLineCount();
        this.detectQueryType();
        
        // Setup auto-update listeners
        const turtleElement = getElementById('turtle-editor');
        if (turtleElement) {
            turtleElement.addEventListener('input', this.debounce(() => {
                this.updateLineCount();
            }, 300));
        }
        
        const sparqlElement = getElementById('sparql-query-editor');
        if (sparqlElement) {
            sparqlElement.addEventListener('input', this.debounce(() => {
                this.detectQueryType();
            }, 300));
        }
    }
    
    /**
     * Setup settings manager listeners
     */
    setupSettingsListeners() {
        this.settingsManager.on('settingChanged', (event) => {
            if (event.path.startsWith('sparqlEndpoints')) {
                this.loadEndpointsFromSettings();
                this.updateEndpointSelect();
            }
        });
    }
    
    /**
     * Load endpoints from settings manager
     */
    loadEndpointsFromSettings() {
        const endpoints = this.settingsManager.get('sparqlEndpoints') || [];
        this.endpoints = endpoints.map(endpoint => ({
            label: endpoint.label,
            url: `${endpoint.urlBase}${endpoint.query}`,
            updateUrl: `${endpoint.urlBase}${endpoint.update}`,
            user: endpoint.user,
            password: endpoint.password
        }));
        
        if (this.endpoints.length > 0 && !this.currentEndpoint) {
            this.currentEndpoint = this.endpoints[0];
        }
    }
    
    /**
     * Handle tab switching
     * @param {string} panel - Panel name ('left' or 'right')
     * @param {string} tab - Tab name
     */
    handleTabSwitch(panel, tab) {
        if (panel === 'left') {
            this.switchLeftTab(tab);
        } else if (panel === 'right') {
            this.switchRightTab(tab);
        }
    }
    
    /**
     * Switch left panel tab
     * @param {string} tab - Tab name
     */
    switchLeftTab(tab) {
        // Update active tab buttons
        document.querySelectorAll('[data-panel="left"].sparql-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Show/hide tab panes
        document.querySelectorAll('#turtle-editor-pane, #sparql-query-pane').forEach(pane => {
            const isActive = pane.id === `${tab}-pane`;
            pane.classList.toggle('active', isActive);
            pane.style.display = isActive ? 'block' : 'none';
        });
        
        this.activeLeftTab = tab;
        
        // Update status
        this.updateStatus(tab === 'turtle-editor' ? 'RDF Editor active' : 'SPARQL Editor active');
    }
    
    /**
     * Switch right panel tab
     * @param {string} tab - Tab name
     */
    switchRightTab(tab) {
        // Update active tab buttons
        document.querySelectorAll('[data-panel="right"].sparql-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        // Show/hide tab panes
        document.querySelectorAll('#results-pane, #endpoints-pane, #clips-pane').forEach(pane => {
            const isActive = pane.id === tab;
            pane.classList.toggle('active', isActive);
            pane.style.display = isActive ? 'block' : 'none';
        });
        
        this.activeRightTab = tab;
    }
    
    /**
     * Execute SPARQL query
     */
    async executeQuery() {
        const queryElement = getElementById('sparql-query-editor');
        const query = this.sparqlEditor ? this.sparqlEditor.getValue() : queryElement?.value;
        
        if (!query?.trim()) {
            showToast('Please enter a SPARQL query', 'warning');
            return;
        }
        
        if (!this.currentEndpoint) {
            showToast('Please select a SPARQL endpoint', 'warning');
            return;
        }
        
        try {
            this.updateStatus('Executing query...');
            
            const startTime = Date.now();
            
            // Determine if it's a CONSTRUCT query for graph visualization
            const isConstruct = query.trim().toUpperCase().includes('CONSTRUCT');
            
            // Use our API service to execute the query
            // This would need to be implemented in ApiService to proxy SPARQL requests
            const result = await this.executeSparqlQuery(query, this.currentEndpoint.url);
            
            const duration = Date.now() - startTime;
            
            // Record performance
            this.stateManager.recordPerformance('sparql_query', duration, {
                queryType: isConstruct ? 'construct' : 'select',
                endpoint: this.currentEndpoint.label,
                queryLength: query.length
            });
            
            // Display results
            if (isConstruct) {
                this.displayGraphResult(result);
                this.switchRightTab('results-pane');
                showToast(`CONSTRUCT query completed (${duration}ms)`, 'success');
            } else {
                this.displayTableResult(result);
                this.switchRightTab('results-pane');
                showToast(`SELECT query completed (${duration}ms) - ${result.results?.bindings?.length || 0} results`, 'success');
            }
            
            this.updateStatus('Query completed');
            
        } catch (error) {
            console.error('Query execution failed:', error);
            this.displayError(error);
            this.updateStatus('Query failed');
            showToast('Query failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Execute SPARQL query (placeholder - would integrate with backend)
     * @param {string} query - SPARQL query
     * @param {string} endpoint - Endpoint URL
     * @returns {object} - Query results
     */
    async executeSparqlQuery(query, endpoint) {
        // This is a placeholder implementation
        // In a real implementation, this would use the ApiService to proxy requests
        // or directly query the SPARQL endpoint
        
        // For now, return mock results based on query type
        const isConstruct = query.trim().toUpperCase().includes('CONSTRUCT');
        
        if (isConstruct) {
            return {
                success: true,
                rdf: this.sampleRDF,
                graph: {
                    nodes: [
                        { id: 'ex:alice', label: 'Alice Johnson', type: 'Person' },
                        { id: 'ex:bob', label: 'Bob Smith', type: 'Person' },
                        { id: 'ex:semanticWeb', label: 'Semantic Web', type: 'Concept' },
                        { id: 'ex:acmeCorp', label: 'ACME Corporation', type: 'Organization' }
                    ],
                    edges: [
                        { from: 'ex:alice', to: 'ex:bob', label: 'knows' },
                        { from: 'ex:alice', to: 'ex:semanticWeb', label: 'interest' },
                        { from: 'ex:alice', to: 'ex:acmeCorp', label: 'worksFor' }
                    ]
                }
            };
        } else {
            return {
                success: true,
                head: { vars: ['subject', 'predicate', 'object'] },
                results: {
                    bindings: [
                        {
                            subject: { type: 'uri', value: 'http://example.org/alice' },
                            predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
                            object: { type: 'literal', value: 'Alice Johnson' }
                        },
                        {
                            subject: { type: 'uri', value: 'http://example.org/bob' },
                            predicate: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/name' },
                            object: { type: 'literal', value: 'Bob Smith' }
                        }
                    ]
                }
            };
        }
    }
    
    /**
     * Display graph/construct query results
     * @param {object} result - Query result
     */
    displayGraphResult(result) {
        const container = getElementById('sparql-results-container');
        if (!container) return;
        
        // Show graph visualization container
        const graphContainer = getElementById('graph-visualization-container');
        if (graphContainer) {
            graphContainer.style.display = 'block';
            
            // Update stats
            const nodeCount = result.graph?.nodes?.length || 0;
            const edgeCount = result.graph?.edges?.length || 0;
            
            const nodeCountEl = getElementById('graph-node-count');
            const edgeCountEl = getElementById('graph-edge-count');
            if (nodeCountEl) nodeCountEl.textContent = nodeCount;
            if (edgeCountEl) edgeCountEl.textContent = edgeCount;
        }
        
        container.innerHTML = `
            <div class="construct-results">
                <div class="result-header">
                    <h4>✅ CONSTRUCT Query Results</h4>
                    <div class="result-meta">
                        <span>Nodes: ${result.graph?.nodes?.length || 0}</span>
                        <span>Edges: ${result.graph?.edges?.length || 0}</span>
                    </div>
                </div>
                
                <div class="result-content">
                    <div class="rdf-content">
                        <h5>Generated RDF</h5>
                        <pre class="rdf-display">${escapeHtml(result.rdf || 'No RDF content')}</pre>
                    </div>
                </div>
            </div>
        `;
        
        // Update RDF editor with result if available
        if (result.rdf) {
            const turtleElement = getElementById('turtle-editor');
            if (this.turtleEditor && this.turtleEditor.setValue) {
                this.turtleEditor.setValue(result.rdf);
            } else if (turtleElement) {
                turtleElement.value = result.rdf;
            }
            
            // Trigger graph visualization
            setTimeout(() => this.refreshGraphVisualization(), 100);
        }
    }
    
    /**
     * Display table/select query results
     * @param {object} result - Query result
     */
    displayTableResult(result) {
        const container = getElementById('sparql-results-container');
        if (!container) return;
        
        // Hide graph container
        const graphContainer = getElementById('graph-visualization-container');
        if (graphContainer) {
            graphContainer.style.display = 'none';
        }
        
        if (result.results?.bindings?.length > 0) {
            const tableHtml = this.createResultsTable(result);
            container.innerHTML = `
                <div class="select-results">
                    <div class="result-header">
                        <h4>✅ SELECT Query Results</h4>
                        <div class="result-meta">
                            <span>Results: ${result.results.bindings.length}</span>
                            <span>Variables: ${result.head?.vars?.length || 0}</span>
                        </div>
                    </div>
                    <div class="result-content">
                        ${tableHtml}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-results">
                    <div class="empty-icon">📊</div>
                    <div class="empty-message">No results found</div>
                    <div class="empty-hint">Try modifying your query or checking the endpoint connection</div>
                </div>
            `;
        }
    }
    
    /**
     * Create HTML table from SPARQL results
     * @param {object} result - Query result
     * @returns {string} - Table HTML
     */
    createResultsTable(result) {
        if (!result.results?.bindings?.length) return '';
        
        const vars = result.head?.vars || [];
        const bindings = result.results.bindings;
        
        let html = '<table class="results-table"><thead><tr>';
        
        // Header
        vars.forEach(variable => {
            html += `<th>${escapeHtml(variable)}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Rows
        bindings.forEach(binding => {
            html += '<tr>';
            vars.forEach(variable => {
                const value = binding[variable];
                if (value) {
                    const displayValue = value.type === 'uri' ? 
                        `<a href="${escapeHtml(value.value)}" target="_blank">${escapeHtml(value.value)}</a>` :
                        escapeHtml(value.value);
                    html += `<td title="Type: ${value.type}">${displayValue}</td>`;
                } else {
                    html += '<td class="null-value">-</td>';
                }
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Display error message
     * @param {Error} error - Error object
     */
    displayError(error) {
        const container = getElementById('sparql-results-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-results">
                <div class="result-header error">
                    <h4>❌ Query Failed</h4>
                </div>
                <div class="result-content">
                    <div class="error-message">${escapeHtml(error.message)}</div>
                    <div class="error-suggestions">
                        <h5>Troubleshooting</h5>
                        <ul>
                            <li>Check your SPARQL syntax</li>
                            <li>Verify the endpoint is accessible</li>
                            <li>Ensure you have proper permissions</li>
                            <li>Try a simpler query to test the connection</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Save current query as a clip
     */
    async saveQuery() {
        const query = this.sparqlEditor ? this.sparqlEditor.getValue() : 
                     getElementById('sparql-query-editor')?.value;
        
        if (!query?.trim()) {
            showToast('No query to save', 'warning');
            return;
        }
        
        const name = prompt('Enter a name for this query:');
        if (!name) return;
        
        try {
            if (this.clipsManager) {
                await this.clipsManager.saveClip(name, query);
                showToast('Query saved to clips', 'success');
                
                // Refresh clips UI
                if (this.clipsUI && this.clipsUI.loadClips) {
                    await this.clipsUI.loadClips();
                }
            } else {
                // Fallback: save to localStorage
                const clips = JSON.parse(localStorage.getItem('sparql-clips') || '[]');
                clips.push({
                    name,
                    query,
                    timestamp: Date.now()
                });
                localStorage.setItem('sparql-clips', JSON.stringify(clips));
                showToast('Query saved to clips', 'success');
                this.updateClipsDisplay();
            }
        } catch (error) {
            console.error('Failed to save query:', error);
            showToast('Failed to save query', 'error');
        }
    }
    
    /**
     * Load a query from clips
     */
    async loadQuery() {
        try {
            let clips = [];
            
            if (this.clipsManager) {
                clips = await this.clipsManager.getAllClips();
            } else {
                clips = JSON.parse(localStorage.getItem('sparql-clips') || '[]');
            }
            
            if (!clips || clips.length === 0) {
                showToast('No saved queries found', 'info');
                return;
            }
            
            // Create selection dialog
            const clipNames = clips.map((clip, index) => 
                `${index + 1}. ${clip.name}`
            ).join('\n');
            
            const selection = prompt(`Select a query to load:\n\n${clipNames}\n\nEnter the number:`);
            if (!selection) return;
            
            const clipIndex = parseInt(selection) - 1;
            if (clipIndex >= 0 && clipIndex < clips.length) {
                const selectedClip = clips[clipIndex];
                
                if (this.sparqlEditor && this.sparqlEditor.setValue) {
                    this.sparqlEditor.setValue(selectedClip.query);
                } else {
                    const sparqlElement = getElementById('sparql-query-editor');
                    if (sparqlElement) sparqlElement.value = selectedClip.query;
                }
                
                showToast('Query loaded from clips', 'success');
                this.detectQueryType();
            } else {
                showToast('Invalid selection', 'warning');
            }
        } catch (error) {
            console.error('Failed to load query:', error);
            showToast('Failed to load query', 'error');
        }
    }
    
    /**
     * Clear SPARQL editor
     */
    clearEditor() {
        if (this.sparqlEditor && this.sparqlEditor.setValue) {
            this.sparqlEditor.setValue('');
        } else {
            const sparqlElement = getElementById('sparql-query-editor');
            if (sparqlElement) sparqlElement.value = '';
        }
        
        this.detectQueryType();
        showToast('SPARQL editor cleared', 'info');
    }
    
    /**
     * Clear RDF editor
     */
    clearRDFEditor() {
        if (this.turtleEditor && this.turtleEditor.setValue) {
            this.turtleEditor.setValue('');
        } else {
            const turtleElement = getElementById('turtle-editor');
            if (turtleElement) turtleElement.value = '';
        }
        
        this.updateLineCount();
        showToast('RDF editor cleared', 'info');
    }
    
    /**
     * Validate RDF content
     */
    async validateRDF() {
        const content = this.turtleEditor ? this.turtleEditor.getValue() : 
                       getElementById('turtle-editor')?.value;
        
        if (!content?.trim()) {
            showToast('No RDF content to validate', 'warning');
            return;
        }
        
        try {
            // This would integrate with a validation service
            // For now, do basic validation
            const hasPrefix = content.includes('@prefix');
            const hasTriples = content.includes('.') && (content.includes(' a ') || content.includes(' rdf:type '));
            
            if (hasPrefix && hasTriples) {
                showToast('RDF syntax appears valid', 'success');
                this.updateStatus('RDF validation passed');
            } else {
                showToast('RDF syntax may have issues', 'warning');
                this.updateStatus('RDF validation warnings');
            }
        } catch (error) {
            showToast('RDF validation failed: ' + error.message, 'error');
            this.updateStatus('RDF validation failed');
        }
    }
    
    /**
     * Refresh graph visualization
     */
    refreshGraphVisualization() {
        const rdfContent = this.turtleEditor ? this.turtleEditor.getValue() : 
                          getElementById('turtle-editor')?.value;
        
        if (!rdfContent?.trim()) {
            showToast('No RDF content to visualize', 'warning');
            return;
        }
        
        try {
            // If Atuin GraphVisualizer is available
            if (this.graphVisualizer) {
                // Emit MODEL_SYNCED event for Atuin
                if (window.eventBus && window.EVENTS) {
                    window.eventBus.emit(window.EVENTS.MODEL_SYNCED, rdfContent);
                }
                
                showToast('Graph visualization updated', 'success');
                this.switchRightTab('results-pane');
                
                // Show graph container
                const graphContainer = getElementById('graph-visualization-container');
                if (graphContainer) {
                    graphContainer.style.display = 'block';
                }
            } else {
                // Fallback: show basic visualization info
                this.displayBasicGraphInfo(rdfContent);
                showToast('Basic graph analysis complete', 'info');
            }
            
        } catch (error) {
            console.error('Graph visualization failed:', error);
            showToast('Graph visualization failed', 'error');
        }
    }
    
    /**
     * Display basic graph information without Atuin
     * @param {string} rdfContent - RDF content
     */
    displayBasicGraphInfo(rdfContent) {
        const container = getElementById('sparql-results-container');
        if (!container) return;
        
        // Basic analysis
        const lines = rdfContent.split('\n');
        const prefixes = lines.filter(line => line.trim().startsWith('@prefix')).length;
        const triples = lines.filter(line => line.trim().includes(' . ')).length;
        const subjects = new Set();
        const predicates = new Set();
        
        // Extract basic info
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('@') && !trimmed.startsWith('#')) {
                const parts = trimmed.split(' ');
                if (parts.length >= 3) {
                    subjects.add(parts[0]);
                    predicates.add(parts[1]);
                }
            }
        });
        
        container.innerHTML = `
            <div class="graph-analysis">
                <div class="result-header">
                    <h4>📊 RDF Graph Analysis</h4>
                </div>
                <div class="result-content">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Prefixes:</span>
                            <span class="stat-value">${prefixes}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Triple statements:</span>
                            <span class="stat-value">${triples}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Unique subjects:</span>
                            <span class="stat-value">${subjects.size}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Unique predicates:</span>
                            <span class="stat-value">${predicates.size}</span>
                        </div>
                    </div>
                    
                    <div class="upgrade-notice">
                        <h5>📈 Enhanced Visualization</h5>
                        <p>Install Atuin components for interactive graph visualization with syntax highlighting</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Export content
     */
    exportContent() {
        const isRDFActive = this.activeLeftTab === 'turtle-editor';
        const content = isRDFActive ? 
            (this.turtleEditor ? this.turtleEditor.getValue() : getElementById('turtle-editor')?.value) :
            (this.sparqlEditor ? this.sparqlEditor.getValue() : getElementById('sparql-query-editor')?.value);
        
        if (!content?.trim()) {
            showToast('No content to export', 'warning');
            return;
        }
        
        const filename = isRDFActive ? 'rdf-data.ttl' : 'sparql-query.rq';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = createElement('a', {
            href: url,
            download: filename,
            style: 'display: none'
        });
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`Content exported as ${filename}`, 'success');
    }
    
    /**
     * Import content
     */
    importContent() {
        const input = createElement('input', {
            type: 'file',
            accept: '.ttl,.rq,.sparql,.rdf,.n3',
            style: 'display: none'
        });
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const isRDF = file.name.endsWith('.ttl') || file.name.endsWith('.rdf') || file.name.endsWith('.n3');
                
                if (isRDF) {
                    if (this.turtleEditor && this.turtleEditor.setValue) {
                        this.turtleEditor.setValue(content);
                    } else {
                        const turtleElement = getElementById('turtle-editor');
                        if (turtleElement) turtleElement.value = content;
                    }
                    this.switchLeftTab('turtle-editor');
                    this.updateLineCount();
                } else {
                    if (this.sparqlEditor && this.sparqlEditor.setValue) {
                        this.sparqlEditor.setValue(content);
                    } else {
                        const sparqlElement = getElementById('sparql-query-editor');
                        if (sparqlElement) sparqlElement.value = content;
                    }
                    this.switchLeftTab('sparql-query');
                    this.detectQueryType();
                }
                
                showToast(`File imported: ${file.name}`, 'success');
            };
            
            reader.readAsText(file);
        };
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }
    
    /**
     * Add new endpoint
     */
    addEndpoint() {
        const urlInput = getElementById('sparql-endpoint-url');
        const url = urlInput?.value?.trim();
        
        if (!url) {
            showToast('Please enter an endpoint URL', 'warning');
            return;
        }
        
        // Add to local list
        const newEndpoint = {
            label: url,
            url: url,
            id: Date.now().toString()
        };
        
        this.endpoints.push(newEndpoint);
        this.updateEndpointSelect();
        
        // Clear input
        urlInput.value = '';
        
        showToast('Endpoint added successfully', 'success');
        
        // Optionally add to settings
        const currentEndpoints = this.settingsManager.get('sparqlEndpoints') || [];
        currentEndpoints.push({
            label: url,
            urlBase: url.replace(/\/(query|sparql).*$/, ''),
            query: '/query',
            update: '/update',
            user: '',
            password: ''
        });
        this.settingsManager.set('sparqlEndpoints', currentEndpoints);
    }
    
    /**
     * Remove selected endpoint
     */
    removeEndpoint() {
        const select = getElementById('sparql-endpoint-select');
        const selectedIndex = select?.selectedIndex;
        
        if (selectedIndex === undefined || selectedIndex < 0 || !this.endpoints[selectedIndex]) {
            showToast('Please select an endpoint to remove', 'warning');
            return;
        }
        
        if (!confirm('Remove this endpoint?')) return;
        
        this.endpoints.splice(selectedIndex, 1);
        this.updateEndpointSelect();
        
        showToast('Endpoint removed', 'info');
    }
    
    /**
     * Handle endpoint change
     * @param {string} endpointId - Endpoint ID
     */
    handleEndpointChange(endpointId) {
        const endpoint = this.endpoints.find(ep => ep.id === endpointId);
        if (endpoint) {
            this.currentEndpoint = endpoint;
            this.updateCurrentEndpointDisplay();
            showToast(`Switched to endpoint: ${endpoint.label}`, 'info', 2000);
        }
    }
    
    /**
     * Update endpoint select dropdown
     */
    updateEndpointSelect() {
        const select = getElementById('sparql-endpoint-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select an endpoint...</option>';
        
        this.endpoints.forEach(endpoint => {
            const option = createElement('option', {
                value: endpoint.id || endpoint.url
            }, endpoint.label || endpoint.url);
            
            select.appendChild(option);
        });
        
        // Select current endpoint
        if (this.currentEndpoint) {
            select.value = this.currentEndpoint.id || this.currentEndpoint.url;
        }
    }
    
    /**
     * Update current endpoint display
     */
    updateCurrentEndpointDisplay() {
        const display = getElementById('current-endpoint');
        if (display) {
            display.textContent = this.currentEndpoint ? 
                this.currentEndpoint.label || this.currentEndpoint.url : 
                'None';
        }
    }
    
    /**
     * Update line count display
     */
    updateLineCount() {
        const content = this.turtleEditor ? this.turtleEditor.getValue() : 
                       getElementById('turtle-editor')?.value || '';
        const lineCount = content.split('\n').length;
        
        const display = getElementById('turtle-line-count');
        if (display) {
            display.textContent = lineCount;
        }
    }
    
    /**
     * Detect and display query type
     */
    detectQueryType() {
        const query = this.sparqlEditor ? this.sparqlEditor.getValue() : 
                     getElementById('sparql-query-editor')?.value || '';
        
        const upperQuery = query.trim().toUpperCase();
        let queryType = 'UNKNOWN';
        
        if (upperQuery.startsWith('SELECT')) queryType = 'SELECT';
        else if (upperQuery.startsWith('CONSTRUCT')) queryType = 'CONSTRUCT';  
        else if (upperQuery.startsWith('ASK')) queryType = 'ASK';
        else if (upperQuery.startsWith('DESCRIBE')) queryType = 'DESCRIBE';
        else if (upperQuery.includes('INSERT') || upperQuery.includes('DELETE')) queryType = 'UPDATE';
        
        const display = getElementById('query-type');
        if (display) {
            display.textContent = queryType;
            display.className = `status-value query-type-${queryType.toLowerCase()}`;
        }
    }
    
    /**
     * Update clips display (fallback)
     */
    updateClipsDisplay() {
        const container = getElementById('sparql-clips-container');
        if (!container || this.clipsUI) return; // Skip if Atuin clips UI is available
        
        try {
            const clips = JSON.parse(localStorage.getItem('sparql-clips') || '[]');
            
            if (clips.length === 0) {
                container.innerHTML = `
                    <div class="clips-placeholder">
                        <div class="placeholder-icon">📋</div>
                        <div class="placeholder-text">No saved queries yet</div>
                        <div class="placeholder-hint">Use the Save button to save queries</div>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = `
                <div class="clips-list">
                    ${clips.map((clip, index) => `
                        <div class="clip-item">
                            <div class="clip-header">
                                <span class="clip-name">${escapeHtml(clip.name)}</span>
                                <span class="clip-date">${new Date(clip.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div class="clip-preview">${escapeHtml(clip.query.substring(0, 100))}...</div>
                            <div class="clip-actions">
                                <button class="btn btn-outline btn-sm" onclick="this.loadClip(${index})">Load</button>
                                <button class="btn btn-outline btn-sm" onclick="this.deleteClip(${index})">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Failed to update clips display:', error);
        }
    }
    
    /**
     * Update graph stats
     */
    updateGraphStats() {
        // This would be called by Atuin event listeners
        console.log('Graph stats update triggered');
    }
    
    /**
     * Update status display
     * @param {string} message - Status message
     */
    updateStatus(message) {
        const statusText = document.querySelector('#sparql-status .status-text');
        if (statusText) {
            statusText.textContent = message;
        }
    }
    
    /**
     * Debounce function for input handlers
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} - Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Get current controller state
     * @returns {object} - Current state
     */
    getState() {
        return {
            activeLeftTab: this.activeLeftTab,
            activeRightTab: this.activeRightTab,
            currentEndpoint: this.currentEndpoint,
            endpoints: this.endpoints,
            rdfContent: this.turtleEditor ? this.turtleEditor.getValue() : getElementById('turtle-editor')?.value,
            sparqlQuery: this.sparqlEditor ? this.sparqlEditor.getValue() : getElementById('sparql-query-editor')?.value
        };
    }
    
    /**
     * Set controller state
     * @param {object} state - State to restore
     */
    setState(state) {
        if (state.activeLeftTab) {
            this.switchLeftTab(state.activeLeftTab);
        }
        
        if (state.activeRightTab) {
            this.switchRightTab(state.activeRightTab);
        }
        
        if (state.currentEndpoint) {
            this.currentEndpoint = state.currentEndpoint;
            this.updateCurrentEndpointDisplay();
        }
        
        if (state.endpoints) {
            this.endpoints = state.endpoints;
            this.updateEndpointSelect();
        }
        
        if (state.rdfContent !== undefined) {
            if (this.turtleEditor && this.turtleEditor.setValue) {
                this.turtleEditor.setValue(state.rdfContent);
            } else {
                const turtleElement = getElementById('turtle-editor');
                if (turtleElement) turtleElement.value = state.rdfContent;
            }
            this.updateLineCount();
        }
        
        if (state.sparqlQuery !== undefined) {
            if (this.sparqlEditor && this.sparqlEditor.setValue) {
                this.sparqlEditor.setValue(state.sparqlQuery);
            } else {
                const sparqlElement = getElementById('sparql-query-editor');
                if (sparqlElement) sparqlElement.value = state.sparqlQuery;
            }
            this.detectQueryType();
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        // Cleanup Atuin components
        if (this.turtleEditor?.dispose) {
            this.turtleEditor.dispose();
        }
        if (this.sparqlEditor?.dispose) {
            this.sparqlEditor.dispose();
        }
        if (this.graphVisualizer?.dispose) {
            this.graphVisualizer.dispose();
        }
        if (this.clipsManager?.cleanup) {
            this.clipsManager.cleanup();
        }
        if (this.clipsUI?.cleanup) {
            this.clipsUI.cleanup();
        }
        
        // Remove message queue
        const messageQueue = getElementById('atuin-message-queue');
        if (messageQueue) {
            document.body.removeChild(messageQueue);
        }
        
        console.log('SPARQL Controller cleaned up');
    }
}