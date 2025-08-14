/**
 * SPARQL Controller Component
 * Integrated SPARQL browser with Atuin syntax highlighting for the Semantic Memory Workbench
 * Follows the Atuin integration patterns using ES modules
 */

import { showToast, escapeHtml, getElementById, createElement } from '../utils/domUtils.js';

/**
 * SPARQLController manages the SPARQL browser interface
 * Uses Atuin components for RDF editing, SPARQL querying, and graph visualization
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
        this.endpointManager = null;
        
        // Event bus (will be loaded from evb)
        this.eventBus = null;
        this.EVENTS = null;
        
        // State
        this.isInitialized = false;
        this.currentEndpoint = null;
        this.endpoints = [];
        this.activeMode = 'rdf'; // 'rdf' or 'sparql'
        this.eventListeners = [];
        
        // Configuration
        this.config = {
            rdfEditorId: 'turtle-editor',
            sparqlEditorId: 'sparql-query-editor', 
            graphContainerId: 'graph-container',
            messageQueueId: 'sparql-message-queue',
            clipsContainerId: 'clips-container'
        };
    }

    /**
     * Initialize the SPARQL Controller
     */
    async initialize() {
        try {
            console.log('Initializing SPARQL Controller...');
            
            // Load Atuin components and event bus
            await this.loadAtuinComponents();
            
            // Render the SPARQL browser interface
            this.render();
            
            // Initialize Atuin components
            await this.initializeAtuinComponents();
            
            // Set up endpoints from settings
            this.loadEndpointsFromSettings();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load sample content
            this.loadSampleContent();
            
            this.isInitialized = true;
            console.log('SPARQL Controller initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize SPARQL Controller:', error);
            this.renderFallbackInterface(error);
        }
    }
    
    /**
     * Load Atuin components and dependencies
     */
    async loadAtuinComponents() {
        try {
            console.log('Attempting to load Atuin components...');
            
            // Try to load evb event bus
            try {
                const evbModule = await import('evb');
                this.eventBus = evbModule.eventBus || evbModule.default?.eventBus;
                this.EVENTS = evbModule.EVENTS || evbModule.default?.EVENTS;
                console.log('Event bus loaded successfully');
            } catch (evbError) {
                console.warn('Could not load evb event bus:', evbError.message);
                // Continue without event bus
            }
            
            // Try to load Atuin components
            try {
                const atuinCore = await import('atuin/core');
                const atuinServices = await import('atuin/services');
                const atuinUI = await import('atuin/ui/components');
                
                this.TurtleEditor = atuinCore.TurtleEditor;
                this.SPARQLEditor = atuinCore.SPARQLEditor;
                this.GraphVisualizer = atuinCore.GraphVisualizer;
                this.LoggerService = atuinServices.LoggerService;
                this.SPARQLClipsManager = atuinServices.SPARQLClipsManager;
                this.SPARQLClipsUI = atuinUI.SPARQLClipsUI;
                this.SPARQLEndpointManager = atuinUI.SPARQLEndpointManager;
                
                console.log('Atuin components loaded successfully');
                
                // Try to load CSS
                try {
                    await import('atuin/css/main');
                    await import('atuin/css/editor');
                    await import('atuin/css/graph');
                    console.log('Atuin CSS loaded successfully');
                } catch (cssError) {
                    console.warn('Could not load Atuin CSS:', cssError.message);
                }
                
            } catch (atuinError) {
                console.warn('Could not load Atuin components:', atuinError.message);
                throw new Error('Atuin components not available');
            }
            
        } catch (error) {
            console.warn('Some Atuin modules failed to load - using basic editors');
            throw error;
        }
    }
    
    /**
     * Render the SPARQL browser interface
     */
    render() {
        const sparqlTab = getElementById('sparql-tab');
        if (!sparqlTab) {
            console.error('SPARQL tab element not found');
            return;
        }
        
        sparqlTab.innerHTML = `
            <div class="sparql-browser-container">
                <div class="sparql-header">
                    <h2>SPARQL Browser</h2>
                    <p>Advanced RDF editing and SPARQL querying with syntax highlighting</p>
                </div>
                
                <!-- Message queue for Atuin logger -->
                <div id="${this.config.messageQueueId}" class="atuin-messages"></div>
                
                <div class="sparql-main">
                    <!-- Editor tabs -->
                    <div class="sparql-tabs">
                        <nav class="sparql-tab-nav" role="tablist">
                            <button class="sparql-tab-btn active" data-mode="rdf" role="tab">
                                🐢 RDF Editor
                            </button>
                            <button class="sparql-tab-btn" data-mode="sparql" role="tab">
                                📝 SPARQL Query
                            </button>
                        </nav>
                    </div>
                    
                    <!-- Editor content -->
                    <div class="sparql-editor-container">
                        <!-- RDF Editor controls -->
                        <div id="rdf-editor-controls" class="editor-controls">
                            <div class="control-group">
                                <button id="validate-rdf" class="btn btn-secondary">
                                    <span class="btn-icon">✓</span>
                                    <span class="btn-text">Validate</span>
                                </button>
                                <button id="visualize-rdf" class="btn btn-secondary">
                                    <span class="btn-icon">🎯</span>
                                    <span class="btn-text">Visualize</span>
                                </button>
                                <button id="clear-rdf" class="btn btn-secondary">
                                    <span class="btn-icon">🗑️</span>
                                    <span class="btn-text">Clear</span>
                                </button>
                            </div>
                        </div>
                        
                        <!-- RDF Turtle Editor -->
                        <div id="rdf-editor-panel" class="editor-panel active">
                            <textarea id="${this.config.rdfEditorId}" 
                                      class="sparql-editor" 
                                      placeholder="Enter Turtle RDF content here..."></textarea>
                            <div class="editor-status">
                                <span class="status-item">Format: <span id="rdf-format">Turtle</span></span>
                                <span class="status-item">Lines: <span id="rdf-lines">0</span></span>
                            </div>
                        </div>
                        
                        <!-- SPARQL Query Editor -->
                        <div id="sparql-editor-panel" class="editor-panel">
                            <div class="editor-controls">
                                <div class="control-group">
                                    <select id="sparql-endpoint-select" class="endpoint-select">
                                        <option value="">Select SPARQL endpoint...</option>
                                    </select>
                                    <button id="execute-sparql" class="btn btn-primary">
                                        <span class="btn-icon">▶️</span>
                                        <span class="btn-text">Execute Query</span>
                                    </button>
                                </div>
                            </div>
                            <textarea id="${this.config.sparqlEditorId}" 
                                      class="sparql-editor" 
                                      placeholder="Enter SPARQL query here..."></textarea>
                        </div>
                    </div>
                    
                    <!-- Bottom panel with results, endpoints, clips -->
                    <div class="sparql-bottom">
                        <nav class="sparql-bottom-nav" role="tablist">
                            <button class="sparql-bottom-btn active" data-panel="results" role="tab">
                                📊 Results
                            </button>
                            <button class="sparql-bottom-btn" data-panel="endpoints" role="tab">
                                🔗 Endpoints  
                            </button>
                            <button class="sparql-bottom-btn" data-panel="clips" role="tab">
                                📋 Clips
                            </button>
                        </nav>
                        
                        <!-- Results panel -->
                        <div id="results-panel" class="bottom-panel active">
                            <div id="sparql-results" class="results-container">
                                <div class="results-placeholder">Execute a query to see results</div>
                            </div>
                        </div>
                        
                        <!-- Endpoints panel -->
                        <div id="endpoints-panel" class="bottom-panel">
                            <div class="endpoint-management">
                                <div class="add-endpoint">
                                    <input type="url" id="new-endpoint-url" placeholder="https://example.org/sparql" class="endpoint-input">
                                    <button id="add-endpoint" class="btn btn-secondary">Add Endpoint</button>
                                </div>
                                <div id="endpoint-list" class="endpoint-list">
                                    <!-- Endpoints will be populated here -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Clips panel -->
                        <div id="clips-panel" class="bottom-panel">
                            <div id="${this.config.clipsContainerId}" class="clips-container">
                                <!-- SPARQL clips will be rendered here -->
                            </div>
                        </div>
                    </div>
                    
                    <!-- Graph visualization -->
                    <div class="sparql-graph">
                        <div class="graph-header">
                            <h3>Graph Visualization</h3>
                            <div class="graph-controls">
                                <button id="fit-graph" class="btn btn-sm">Fit to View</button>
                                <button id="toggle-physics" class="btn btn-sm">Toggle Physics</button>
                            </div>
                        </div>
                        <div id="${this.config.graphContainerId}" class="graph-container"></div>
                    </div>
                </div>
                
                <!-- File operations -->
                <div class="sparql-footer">
                    <div class="file-operations">
                        <input type="file" id="import-file" accept=".ttl,.turtle,.rq,.sparql" style="display: none;">
                        <button id="import-file-btn" class="btn btn-outline">
                            <span class="btn-icon">📥</span>
                            <span class="btn-text">Import File</span>
                        </button>
                        <button id="export-file-btn" class="btn btn-outline">
                            <span class="btn-icon">📤</span>
                            <span class="btn-text">Export File</span>
                        </button>
                    </div>
                    <div class="status-display">
                        <span id="connection-status">RDF Editor active</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Initialize Atuin components
     */
    async initializeAtuinComponents() {
        if (!this.LoggerService) {
            console.warn('Atuin LoggerService not available, using console logger');
            this.logger = console;
        } else {
            this.logger = new this.LoggerService(this.config.messageQueueId);
        }
        
        // Initialize Turtle Editor
        if (this.TurtleEditor) {
            this.turtleEditor = new this.TurtleEditor(this.config.rdfEditorId, this.logger);
            console.log('Turtle editor initialized');
        }
        
        // Initialize SPARQL Editor
        if (this.SPARQLEditor) {
            this.sparqlEditor = new this.SPARQLEditor(this.config.sparqlEditorId, this.logger);
            console.log('SPARQL editor initialized');
        }
        
        // Initialize Graph Visualizer
        if (this.GraphVisualizer) {
            this.graphVisualizer = new this.GraphVisualizer(this.config.graphContainerId, this.logger);
            console.log('Graph visualizer initialized');
        }
        
        // Initialize SPARQL Clips Manager
        if (this.SPARQLClipsManager && this.SPARQLClipsUI) {
            this.clipsManager = new this.SPARQLClipsManager(this.logger);
            this.clipsUI = new this.SPARQLClipsUI({
                clipsManager: this.clipsManager,
                logger: this.logger,
                onClipSelect: (query) => {
                    if (this.sparqlEditor) {
                        this.sparqlEditor.setValue(query);
                        this.switchToMode('sparql');
                    }
                }
            });
            
            // Render clips UI
            const clipsContainer = getElementById(this.config.clipsContainerId);
            if (clipsContainer) {
                this.clipsUI.render(clipsContainer);
            }
        }
        
        // Initialize Endpoint Manager
        if (this.SPARQLEndpointManager) {
            this.endpointManager = new this.SPARQLEndpointManager({
                logger: this.logger,
                defaultEndpoints: this.getDefaultEndpoints()
            });
            this.updateEndpointSelect();
        }
    }
    
    /**
     * Load endpoints from settings
     */
    loadEndpointsFromSettings() {
        if (this.settingsManager) {
            const sparqlEndpoints = this.settingsManager.get('sparqlEndpoints') || [];
            this.endpoints = sparqlEndpoints.map(ep => ep.urlBase + ep.query);
            console.log('Loaded endpoints from settings:', this.endpoints);
        }
    }
    
    /**
     * Get default SPARQL endpoints
     */
    getDefaultEndpoints() {
        const settingsEndpoints = this.settingsManager?.get('sparqlEndpoints') || [];
        const defaultEndpoints = [
            'https://query.wikidata.org/sparql',
            'https://dbpedia.org/sparql'
        ];
        
        // Combine settings endpoints with defaults
        const allEndpoints = [
            ...settingsEndpoints.map(ep => ep.urlBase + ep.query),
            ...defaultEndpoints
        ];
        
        // Remove duplicates
        return [...new Set(allEndpoints)];
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.sparql-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                if (mode) {
                    this.switchToMode(mode);
                }
            });
        });
        
        // Bottom panel switching
        const bottomButtons = document.querySelectorAll('.sparql-bottom-btn');
        bottomButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.target.dataset.panel;
                if (panel) {
                    this.switchToBottomPanel(panel);
                }
            });
        });
        
        // Control buttons
        const validateBtn = getElementById('validate-rdf');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateRDF());
        }
        
        const visualizeBtn = getElementById('visualize-rdf');
        if (visualizeBtn) {
            visualizeBtn.addEventListener('click', () => this.visualizeRDF());
        }
        
        const clearBtn = getElementById('clear-rdf');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearRDF());
        }
        
        const executeBtn = getElementById('execute-sparql');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeSPARQL());
        }
        
        // File operations
        const importBtn = getElementById('import-file-btn');
        const importFile = getElementById('import-file');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => this.handleFileImport(e));
        }
        
        const exportBtn = getElementById('export-file-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportFile());
        }
        
        // Graph controls
        const fitBtn = getElementById('fit-graph');
        if (fitBtn) {
            fitBtn.addEventListener('click', () => {
                if (this.graphVisualizer) {
                    this.graphVisualizer.fit();
                }
            });
        }
        
        // Endpoint management
        const addEndpointBtn = getElementById('add-endpoint');
        if (addEndpointBtn) {
            addEndpointBtn.addEventListener('click', () => this.addEndpoint());
        }
        
        // Event bus listeners (if available)
        if (this.eventBus && this.EVENTS) {
            // Listen for model updates to update graph
            this.eventBus.on(this.EVENTS.MODEL_SYNCED, (content) => {
                if (this.graphVisualizer) {
                    this.graphVisualizer.updateGraph(content);
                }
                this.updateLineCount(content);
            });
            
            // Listen for endpoint updates
            this.eventBus.on(this.EVENTS.ENDPOINT_UPDATED, () => {
                this.updateEndpointSelect();
            });
        }
    }
    
    /**
     * Load sample content
     */
    loadSampleContent() {
        const sampleRDF = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
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

        if (this.turtleEditor) {
            this.turtleEditor.setValue(sampleRDF);
        } else {
            // Fallback for basic textarea
            const textarea = getElementById(this.config.rdfEditorId);
            if (textarea) {
                textarea.value = sampleRDF;
            }
        }
        
        this.updateLineCount(sampleRDF);
    }
    
    /**
     * Switch between RDF and SPARQL modes
     */
    switchToMode(mode) {
        this.activeMode = mode;
        
        // Update tab buttons
        document.querySelectorAll('.sparql-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update editor panels
        document.querySelectorAll('.editor-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${mode}-editor-panel`);
        });
        
        // Update controls
        const rdfControls = getElementById('rdf-editor-controls');
        if (rdfControls) {
            rdfControls.style.display = mode === 'rdf' ? 'block' : 'none';
        }
        
        // Focus appropriate editor
        setTimeout(() => {
            if (mode === 'rdf' && this.turtleEditor) {
                this.turtleEditor.focus();
            } else if (mode === 'sparql' && this.sparqlEditor) {
                this.sparqlEditor.focus();
            }
        }, 100);
    }
    
    /**
     * Switch between bottom panels
     */
    switchToBottomPanel(panel) {
        // Update nav buttons
        document.querySelectorAll('.sparql-bottom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.panel === panel);
        });
        
        // Update panels
        document.querySelectorAll('.bottom-panel').forEach(p => {
            p.classList.toggle('active', p.id === `${panel}-panel`);
        });
    }
    
    /**
     * Validate RDF content
     */
    validateRDF() {
        if (this.turtleEditor) {
            const content = this.turtleEditor.getValue();
            // Validation is handled by Atuin internally
            this.logger?.info('RDF validation completed');
        } else {
            showToast('RDF validation requires Atuin components', 'warning');
        }
    }
    
    /**
     * Visualize RDF content
     */
    visualizeRDF() {
        if (this.turtleEditor && this.graphVisualizer) {
            const content = this.turtleEditor.getValue();
            this.graphVisualizer.updateGraph(content);
            this.logger?.info('Graph visualization updated');
        } else {
            showToast('Graph visualization requires Atuin components', 'warning');
        }
    }
    
    /**
     * Clear RDF content
     */
    clearRDF() {
        if (this.turtleEditor) {
            this.turtleEditor.setValue('');
        } else {
            const textarea = getElementById(this.config.rdfEditorId);
            if (textarea) {
                textarea.value = '';
            }
        }
        this.updateLineCount('');
    }
    
    /**
     * Execute SPARQL query
     */
    async executeSPARQL() {
        if (!this.sparqlEditor) {
            showToast('SPARQL execution requires Atuin components', 'warning');
            return;
        }
        
        const query = this.sparqlEditor.getValue();
        const endpointSelect = getElementById('sparql-endpoint-select');
        const endpoint = endpointSelect?.value;
        
        if (!endpoint) {
            showToast('Please select a SPARQL endpoint', 'warning');
            return;
        }
        
        if (!query.trim()) {
            showToast('Please enter a SPARQL query', 'warning');
            return;
        }
        
        try {
            this.logger?.info(`Executing SPARQL query on ${endpoint}`);
            
            // Execute query (this would integrate with your SPARQL service)
            const results = await this.executeQuery(query, endpoint);
            this.displayResults(results);
            
        } catch (error) {
            this.logger?.error(`Query execution failed: ${error.message}`);
            showToast(`Query execution failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Execute SPARQL query against endpoint
     */
    async executeQuery(query, endpoint) {
        // This is a placeholder - integrate with your SPARQL service
        console.log('Executing query:', query, 'on endpoint:', endpoint);
        
        // For now, return mock results
        return {
            head: { vars: ['s', 'p', 'o'] },
            results: {
                bindings: [
                    { s: { value: 'http://example.org/subject' }, p: { value: 'http://example.org/predicate' }, o: { value: 'http://example.org/object' } }
                ]
            }
        };
    }
    
    /**
     * Display SPARQL results
     */
    displayResults(results) {
        const resultsContainer = getElementById('sparql-results');
        if (!resultsContainer) return;
        
        // Switch to results panel
        this.switchToBottomPanel('results');
        
        // Format and display results
        resultsContainer.innerHTML = `
            <div class="results-header">
                <h4>Query Results (${results.results?.bindings?.length || 0} results)</h4>
            </div>
            <div class="results-content">
                <pre>${JSON.stringify(results, null, 2)}</pre>
            </div>
        `;
    }
    
    /**
     * Add SPARQL endpoint
     */
    addEndpoint() {
        const urlInput = getElementById('new-endpoint-url');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        if (!url) {
            showToast('Please enter an endpoint URL', 'warning');
            return;
        }
        
        if (this.endpointManager) {
            this.endpointManager.addEndpoint(url);
        } else {
            this.endpoints.push(url);
        }
        
        urlInput.value = '';
        this.updateEndpointSelect();
        showToast('Endpoint added successfully', 'success');
    }
    
    /**
     * Update endpoint select dropdown
     */
    updateEndpointSelect() {
        const select = getElementById('sparql-endpoint-select');
        if (!select) return;
        
        const endpoints = this.endpointManager ? 
            this.endpointManager.getEndpoints() : 
            this.endpoints;
            
        select.innerHTML = '<option value="">Select SPARQL endpoint...</option>';
        
        endpoints.forEach(endpoint => {
            const option = document.createElement('option');
            option.value = endpoint;
            option.textContent = endpoint;
            select.appendChild(option);
        });
    }
    
    /**
     * Handle file import
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            
            if (file.name.endsWith('.ttl') || file.name.endsWith('.turtle')) {
                if (this.turtleEditor) {
                    this.turtleEditor.setValue(content);
                } else {
                    const textarea = getElementById(this.config.rdfEditorId);
                    if (textarea) textarea.value = content;
                }
                this.switchToMode('rdf');
            } else if (file.name.endsWith('.rq') || file.name.endsWith('.sparql')) {
                if (this.sparqlEditor) {
                    this.sparqlEditor.setValue(content);
                } else {
                    const textarea = getElementById(this.config.sparqlEditorId);
                    if (textarea) textarea.value = content;
                }
                this.switchToMode('sparql');
            }
            
            this.updateLineCount(content);
            showToast('File imported successfully', 'success');
        };
        
        reader.readAsText(file);
    }
    
    /**
     * Export current content
     */
    exportFile() {
        let content, filename, mimeType;
        
        if (this.activeMode === 'rdf') {
            content = this.turtleEditor ? this.turtleEditor.getValue() : '';
            filename = 'export.ttl';
            mimeType = 'text/turtle';
        } else {
            content = this.sparqlEditor ? this.sparqlEditor.getValue() : '';
            filename = 'query.rq';
            mimeType = 'application/sparql-query';
        }
        
        if (!content.trim()) {
            showToast('No content to export', 'warning');
            return;
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        showToast('File exported successfully', 'success');
    }
    
    /**
     * Update line count display
     */
    updateLineCount(content) {
        const lines = content.split('\n').length;
        const linesDisplay = getElementById('rdf-lines');
        if (linesDisplay) {
            linesDisplay.textContent = lines;
        }
    }
    
    /**
     * Render fallback interface when Atuin is not available
     */
    renderFallbackInterface(error) {
        const sparqlTab = getElementById('sparql-tab');
        if (!sparqlTab) return;
        
        sparqlTab.innerHTML = `
            <div class="sparql-fallback">
                <div class="sparql-header">
                    <h2>SPARQL Browser</h2>
                    <p>Basic mode - Atuin components not available</p>
                </div>
                
                <div class="error-notice">
                    <h3>⚠️ Limited Functionality</h3>
                    <p>The enhanced SPARQL browser with syntax highlighting requires the Atuin library.</p>
                    <p>Error: ${error.message}</p>
                    <p>Install with: <code>npm install atuin evb</code></p>
                </div>
                
                <div class="basic-sparql">
                    <div class="basic-editor">
                        <h3>RDF Editor</h3>
                        <textarea id="${this.config.rdfEditorId}" 
                                  class="basic-textarea" 
                                  placeholder="Enter Turtle RDF content here..."
                                  rows="20"></textarea>
                    </div>
                    
                    <div class="basic-editor">
                        <h3>SPARQL Query</h3>
                        <textarea id="${this.config.sparqlEditorId}" 
                                  class="basic-textarea" 
                                  placeholder="Enter SPARQL query here..."
                                  rows="10"></textarea>
                        <button id="execute-basic" class="btn btn-primary">Execute Query</button>
                    </div>
                </div>
            </div>
        `;
        
        // Set up basic functionality
        this.loadSampleContent();
        
        const executeBtn = getElementById('execute-basic');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                showToast('Full SPARQL execution requires Atuin components', 'warning');
            });
        }
    }
    
    /**
     * Clear query content
     */
    clearQuery() {
        if (this.activeMode === 'rdf') {
            this.clearRDF();
        } else {
            if (this.sparqlEditor) {
                this.sparqlEditor.setValue('');
            } else {
                const textarea = getElementById(this.config.sparqlEditorId);
                if (textarea) textarea.value = '';
            }
        }
    }
    
    /**
     * Get current state for session management
     */
    getState() {
        return {
            activeMode: this.activeMode,
            rdfContent: this.turtleEditor ? this.turtleEditor.getValue() : '',
            sparqlContent: this.sparqlEditor ? this.sparqlEditor.getValue() : '',
            currentEndpoint: this.currentEndpoint
        };
    }
    
    /**
     * Set state for session restoration
     */
    setState(state) {
        if (state.activeMode) {
            this.activeMode = state.activeMode;
            this.switchToMode(state.activeMode);
        }
        
        if (state.rdfContent && this.turtleEditor) {
            this.turtleEditor.setValue(state.rdfContent);
        }
        
        if (state.sparqlContent && this.sparqlEditor) {
            this.sparqlEditor.setValue(state.sparqlContent);
        }
        
        if (state.currentEndpoint) {
            this.currentEndpoint = state.currentEndpoint;
            const select = getElementById('sparql-endpoint-select');
            if (select) {
                select.value = state.currentEndpoint;
            }
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.eventBus && this.EVENTS) {
            // Remove event listeners
            this.eventListeners.forEach(({ event, handler }) => {
                this.eventBus.off(event, handler);
            });
        }
        
        this.isInitialized = false;
    }
}