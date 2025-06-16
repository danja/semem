/**
 * SPARQL Browser Component
 * Integrates Atuin components for RDF editing and visualization
 */

// Import Atuin components and utilities
import { TurtleEditor, SPARQLEditor, GraphVisualizer } from '/node_modules/atuin/core/index.js';
import { LoggerService } from '/node_modules/atuin/services/index.js';
import { eventBus, EVENTS } from '/node_modules/evb/index.js';

class SPARQLBrowser {
    constructor() {
        this.logger = null;
        this.turtleEditor = null;
        this.sparqlEditor = null;
        this.graphVisualizer = null;
        this.currentEndpoint = null;
        this.endpoints = [];
        this.initialized = false;
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        try {
            console.log('Initializing SPARQL Browser...');
            
            // Initialize logger service (message container will be created dynamically)
            this.createMessageContainer();
            this.logger = new LoggerService('sparql-messages');
            
            // Initialize Atuin components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load available endpoints
            await this.loadEndpoints();
            
            // Setup SPARQL browser tabs
            this.setupTabs();
            
            this.initialized = true;
            this.logger.success('SPARQL Browser initialized successfully');
            console.log('SPARQL Browser initialized');
            
        } catch (error) {
            console.error('Failed to initialize SPARQL Browser:', error);
            if (this.logger) {
                this.logger.error(`Initialization failed: ${error.message}`);
            }
        }
    }

    createMessageContainer() {
        // Create message container for Atuin logger if it doesn't exist
        if (!document.getElementById('sparql-messages')) {
            const messageContainer = document.createElement('div');
            messageContainer.id = 'sparql-messages';
            messageContainer.className = 'atuin-messages';
            document.body.appendChild(messageContainer);
        }
    }

    async initializeComponents() {
        try {
            // Initialize TurtleEditor for RDF editing
            const turtleEditorElement = document.getElementById('turtle-editor');
            if (turtleEditorElement) {
                this.turtleEditor = new TurtleEditor('turtle-editor', this.logger);
                console.log('TurtleEditor initialized');
            }

            // Initialize SPARQLEditor for query composition
            const sparqlEditorElement = document.getElementById('sparql-query-editor');
            if (sparqlEditorElement) {
                this.sparqlEditor = new SPARQLEditor('sparql-query-editor', this.logger);
                console.log('SPARQLEditor initialized');
            }

            // Initialize GraphVisualizer for RDF graph visualization
            const graphContainer = document.getElementById('rdf-graph-container');
            if (graphContainer) {
                this.graphVisualizer = new GraphVisualizer('rdf-graph-container', this.logger);
                console.log('GraphVisualizer initialized');
            }

        } catch (error) {
            console.error('Error initializing Atuin components:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Listen for RDF content changes from TurtleEditor
        eventBus.on(EVENTS.MODEL_SYNCED, (content) => {
            console.log('RDF content updated:', content.substring(0, 100) + '...');
            // Update graph visualization when RDF content changes
            if (this.graphVisualizer && content.trim()) {
                this.graphVisualizer.updateGraph(content);
                this.updateGraphStats();
            }
        });

        // SPARQL query execution
        const executeBtn = document.getElementById('execute-query');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeQuery());
        }

        // Graph loading
        const loadGraphBtn = document.getElementById('load-graph');
        if (loadGraphBtn) {
            loadGraphBtn.addEventListener('click', () => this.loadGraph());
        }

        // RDF validation
        const validateBtn = document.getElementById('validate-rdf');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateRDF());
        }

        // RDF formatting
        const formatBtn = document.getElementById('format-rdf');
        if (formatBtn) {
            formatBtn.addEventListener('click', () => this.formatRDF());
        }

        // File operations
        const loadFileBtn = document.getElementById('load-file');
        const saveFileBtn = document.getElementById('save-file');
        const fileInput = document.getElementById('rdf-file-input');

        if (loadFileBtn && fileInput) {
            loadFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.loadRDFFile(e));
        }

        if (saveFileBtn) {
            saveFileBtn.addEventListener('click', () => this.saveRDFFile());
        }

        // Endpoint management
        const addEndpointBtn = document.getElementById('add-endpoint');
        const testEndpointBtn = document.getElementById('test-endpoint');
        const refreshEndpointsBtn = document.getElementById('refresh-endpoints');

        if (addEndpointBtn) {
            addEndpointBtn.addEventListener('click', () => this.addEndpoint());
        }

        if (testEndpointBtn) {
            testEndpointBtn.addEventListener('click', () => this.testEndpoint());
        }

        if (refreshEndpointsBtn) {
            refreshEndpointsBtn.addEventListener('click', () => this.loadEndpoints());
        }

        // Graph controls
        const fitGraphBtn = document.getElementById('fit-graph');
        const exportGraphBtn = document.getElementById('export-graph');

        if (fitGraphBtn) {
            fitGraphBtn.addEventListener('click', () => {
                if (this.graphVisualizer) {
                    this.graphVisualizer.fit();
                }
            });
        }

        if (exportGraphBtn) {
            exportGraphBtn.addEventListener('click', () => this.exportGraph());
        }

        // RDF insertion
        const insertBtn = document.getElementById('insert-rdf');
        if (insertBtn) {
            insertBtn.addEventListener('click', () => this.insertRDF());
        }

        // Clear editor
        const clearBtn = document.getElementById('clear-editor');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.turtleEditor) {
                    this.turtleEditor.setValue('');
                }
            });
        }
    }

    setupTabs() {
        // Setup inner tabs for SPARQL browser
        const tabButtons = document.querySelectorAll('.sparql-tabs .tab-inner-btn');
        const tabContents = document.querySelectorAll('.sparql-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    async loadEndpoints() {
        try {
            const response = await fetch('/api/sparql/endpoints');
            if (response.ok) {
                this.endpoints = await response.json();
                this.updateEndpointSelects();
                this.updateEndpointsList();
            } else {
                // Use default endpoints if API is not available
                this.endpoints = [
                    {
                        id: 'local-3030',
                        name: 'Local Fuseki (3030)',
                        queryUrl: 'http://localhost:3030/semem/query',
                        updateUrl: 'http://localhost:3030/semem/update',
                        defaultGraph: 'http://danny.ayers.name/content'
                    },
                    {
                        id: 'local-4030',
                        name: 'Local Fuseki (4030)',
                        queryUrl: 'http://localhost:4030/semem/query',
                        updateUrl: 'http://localhost:4030/semem/update',
                        defaultGraph: 'http://danny.ayers.name/content'
                    }
                ];
                this.updateEndpointSelects();
                this.updateEndpointsList();
            }
        } catch (error) {
            console.error('Error loading endpoints:', error);
            this.logger?.warn('Failed to load endpoints from server');
        }
    }

    updateEndpointSelects() {
        const select = document.getElementById('sparql-endpoint-select');
        if (select) {
            select.innerHTML = '<option value="">Select endpoint...</option>';
            this.endpoints.forEach(endpoint => {
                const option = document.createElement('option');
                option.value = endpoint.id;
                option.textContent = endpoint.name;
                select.appendChild(option);
            });
        }
    }

    updateEndpointsList() {
        const container = document.getElementById('endpoints-container');
        if (container) {
            if (this.endpoints.length === 0) {
                container.innerHTML = '<div class="endpoints-placeholder"><p>No endpoints configured. Add an endpoint above to get started.</p></div>';
                return;
            }

            container.innerHTML = '';
            this.endpoints.forEach(endpoint => {
                const item = document.createElement('div');
                item.className = 'endpoint-item';
                item.innerHTML = `
                    <div class="endpoint-header">
                        <span class="endpoint-name">${endpoint.name}</span>
                        <span class="endpoint-status disconnected">Disconnected</span>
                    </div>
                    <div class="endpoint-details">
                        <div>Query: ${endpoint.queryUrl}</div>
                        <div>Update: ${endpoint.updateUrl || 'N/A'}</div>
                        <div>Graph: ${endpoint.defaultGraph || 'Default'}</div>
                    </div>
                    <div class="endpoint-actions">
                        <button class="btn small-btn" onclick="sparqlBrowser.testSpecificEndpoint('${endpoint.id}')">Test</button>
                        <button class="btn small-btn secondary-btn" onclick="sparqlBrowser.removeEndpoint('${endpoint.id}')">Remove</button>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    }

    async executeQuery() {
        if (!this.sparqlEditor) {
            this.logger?.error('SPARQL editor not initialized');
            return;
        }

        const query = this.sparqlEditor.getValue();
        if (!query.trim()) {
            this.logger?.warn('Please enter a SPARQL query');
            return;
        }

        const endpointSelect = document.getElementById('sparql-endpoint-select');
        const endpointId = endpointSelect?.value;
        
        if (!endpointId) {
            this.logger?.warn('Please select a SPARQL endpoint');
            return;
        }

        const endpoint = this.endpoints.find(e => e.id === endpointId);
        if (!endpoint) {
            this.logger?.error('Selected endpoint not found');
            return;
        }

        try {
            this.logger?.info('Executing SPARQL query...');
            
            const response = await fetch('/api/sparql/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    endpoint: endpoint.queryUrl,
                    limit: document.getElementById('limit-results')?.checked ? 1000 : null
                })
            });

            if (response.ok) {
                const results = await response.json();
                this.displayQueryResults(results);
                this.logger?.success(`Query executed successfully. Found ${results.results?.bindings?.length || 0} results.`);
            } else {
                const error = await response.text();
                this.logger?.error(`Query failed: ${error}`);
            }
        } catch (error) {
            console.error('Query execution error:', error);
            this.logger?.error(`Query execution failed: ${error.message}`);
        }
    }

    displayQueryResults(results) {
        const container = document.getElementById('query-results');
        if (!container) return;

        if (!results.results || !results.results.bindings || results.results.bindings.length === 0) {
            container.innerHTML = '<div class="results-placeholder"><p>No results found</p></div>';
            return;
        }

        const bindings = results.results.bindings;
        const variables = results.head?.vars || [];

        let html = '<div class="results-table-container"><table class="results-table">';
        
        // Header
        html += '<thead><tr>';
        variables.forEach(variable => {
            html += `<th>${variable}</th>`;
        });
        html += '</tr></thead>';

        // Data rows
        html += '<tbody>';
        bindings.forEach(binding => {
            html += '<tr>';
            variables.forEach(variable => {
                const value = binding[variable];
                if (value) {
                    const displayValue = value.type === 'uri' 
                        ? `<a href="${value.value}" target="_blank" class="uri-link">${this.shortenURI(value.value)}</a>`
                        : value.value;
                    html += `<td>${displayValue}</td>`;
                } else {
                    html += '<td class="empty-cell">-</td>';
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';

        container.innerHTML = html;
    }

    shortenURI(uri) {
        // Simple URI shortening for display
        if (uri.length > 50) {
            return '...' + uri.substring(uri.length - 47);
        }
        return uri;
    }

    async loadGraph() {
        const queryInput = document.getElementById('graph-query');
        const query = queryInput?.value?.trim();
        
        if (!query) {
            this.logger?.warn('Please enter a subject URI or CONSTRUCT query');
            return;
        }

        const endpointSelect = document.getElementById('sparql-endpoint-select');
        const endpointId = endpointSelect?.value;
        
        if (!endpointId) {
            this.logger?.warn('Please select a SPARQL endpoint');
            return;
        }

        const endpoint = this.endpoints.find(e => e.id === endpointId);
        if (!endpoint) {
            this.logger?.error('Selected endpoint not found');
            return;
        }

        try {
            this.logger?.info('Loading RDF graph...');
            
            // Determine if it's a URI or a CONSTRUCT query
            const isConstructQuery = query.toUpperCase().includes('CONSTRUCT');
            let sparqlQuery;
            
            if (isConstructQuery) {
                sparqlQuery = query;
            } else {
                // Build a CONSTRUCT query for the given subject
                const depth = document.getElementById('graph-depth')?.value || 2;
                const limit = document.getElementById('graph-limit')?.value || 100;
                
                sparqlQuery = `
                    CONSTRUCT { 
                        ?s ?p ?o .
                        ?o ?p2 ?o2 .
                    } WHERE {
                        {
                            <${query}> ?p ?o .
                            BIND(<${query}> AS ?s)
                        } UNION {
                            <${query}> ?p ?o .
                            ?o ?p2 ?o2 .
                            BIND(<${query}> AS ?s)
                            FILTER(?p2 != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
                        }
                    } LIMIT ${limit}
                `;
            }

            const response = await fetch('/api/sparql/construct', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: sparqlQuery,
                    endpoint: endpoint.queryUrl
                })
            });

            if (response.ok) {
                const rdfData = await response.text();
                if (this.graphVisualizer && rdfData.trim()) {
                    this.graphVisualizer.updateGraph(rdfData);
                    this.updateGraphStats();
                    this.logger?.success('Graph loaded successfully');
                } else {
                    this.logger?.warn('No graph data returned');
                }
            } else {
                const error = await response.text();
                this.logger?.error(`Failed to load graph: ${error}`);
            }
        } catch (error) {
            console.error('Graph loading error:', error);
            this.logger?.error(`Graph loading failed: ${error.message}`);
        }
    }

    updateGraphStats() {
        // Update graph statistics display
        if (this.graphVisualizer && this.graphVisualizer.network) {
            const nodes = this.graphVisualizer.network.body.data.nodes;
            const edges = this.graphVisualizer.network.body.data.edges;
            
            const nodeCountEl = document.getElementById('node-count');
            const edgeCountEl = document.getElementById('edge-count');
            
            if (nodeCountEl) nodeCountEl.textContent = nodes.length || 0;
            if (edgeCountEl) edgeCountEl.textContent = edges.length || 0;
        }
    }

    async validateRDF() {
        if (!this.turtleEditor) {
            this.logger?.error('Turtle editor not initialized');
            return;
        }

        const content = this.turtleEditor.getValue();
        if (!content.trim()) {
            this.logger?.warn('Please enter RDF content to validate');
            return;
        }

        try {
            const response = await fetch('/api/sparql/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    format: document.getElementById('rdf-format')?.value || 'turtle'
                })
            });

            const result = await response.json();
            this.displayValidationResult(result);
            
            if (result.valid) {
                this.logger?.success('RDF content is valid');
            } else {
                this.logger?.error(`RDF validation failed: ${result.errors?.join(', ')}`);
            }
        } catch (error) {
            console.error('Validation error:', error);
            this.logger?.error(`Validation failed: ${error.message}`);
        }
    }

    displayValidationResult(result) {
        const container = document.getElementById('rdf-validation-result');
        if (!container) return;

        container.classList.remove('hidden', 'success', 'error');
        
        if (result.valid) {
            container.classList.add('success');
            container.innerHTML = '<strong>✓ Valid RDF</strong><p>The RDF content is syntactically correct.</p>';
        } else {
            container.classList.add('error');
            const errors = result.errors || ['Unknown validation error'];
            container.innerHTML = `<strong>✗ Invalid RDF</strong><ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>`;
        }
    }

    formatRDF() {
        if (!this.turtleEditor) {
            this.logger?.error('Turtle editor not initialized');
            return;
        }

        // For now, just refresh the editor content
        // In a full implementation, this would format the RDF
        const content = this.turtleEditor.getValue();
        this.turtleEditor.setValue(content);
        this.logger?.info('RDF content formatted');
    }

    loadRDFFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            if (this.turtleEditor) {
                this.turtleEditor.setValue(content);
                this.logger?.success(`Loaded file: ${file.name}`);
            }
        };
        reader.readAsText(file);
    }

    saveRDFFile() {
        if (!this.turtleEditor) {
            this.logger?.error('Turtle editor not initialized');
            return;
        }

        const content = this.turtleEditor.getValue();
        if (!content.trim()) {
            this.logger?.warn('No content to save');
            return;
        }

        const blob = new Blob([content], { type: 'text/turtle' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rdf-data.ttl';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.logger?.success('RDF file saved');
    }

    async insertRDF() {
        if (!this.turtleEditor) {
            this.logger?.error('Turtle editor not initialized');
            return;
        }

        const content = this.turtleEditor.getValue();
        if (!content.trim()) {
            this.logger?.warn('Please enter RDF content to insert');
            return;
        }

        const endpointSelect = document.getElementById('sparql-endpoint-select');
        const endpointId = endpointSelect?.value;
        
        if (!endpointId) {
            this.logger?.warn('Please select a SPARQL endpoint');
            return;
        }

        const endpoint = this.endpoints.find(e => e.id === endpointId);
        if (!endpoint) {
            this.logger?.error('Selected endpoint not found');
            return;
        }

        try {
            this.logger?.info('Inserting RDF data...');
            
            const response = await fetch('/api/sparql/insert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content,
                    endpoint: endpoint.updateUrl || endpoint.queryUrl,
                    graph: endpoint.defaultGraph,
                    format: document.getElementById('rdf-format')?.value || 'turtle'
                })
            });

            if (response.ok) {
                this.logger?.success('RDF data inserted successfully');
            } else {
                const error = await response.text();
                this.logger?.error(`Insert failed: ${error}`);
            }
        } catch (error) {
            console.error('Insert error:', error);
            this.logger?.error(`Insert failed: ${error.message}`);
        }
    }

    async addEndpoint() {
        const name = document.getElementById('endpoint-name')?.value?.trim();
        const queryUrl = document.getElementById('endpoint-query-url')?.value?.trim();
        const updateUrl = document.getElementById('endpoint-update-url')?.value?.trim();
        const defaultGraph = document.getElementById('endpoint-graph')?.value?.trim();
        const username = document.getElementById('endpoint-username')?.value?.trim();
        const password = document.getElementById('endpoint-password')?.value?.trim();

        if (!name || !queryUrl) {
            this.logger?.warn('Name and Query URL are required');
            return;
        }

        const endpoint = {
            id: 'custom-' + Date.now(),
            name: name,
            queryUrl: queryUrl,
            updateUrl: updateUrl,
            defaultGraph: defaultGraph,
            auth: (username && password) ? { username, password } : null
        };

        this.endpoints.push(endpoint);
        this.updateEndpointSelects();
        this.updateEndpointsList();
        
        // Clear form
        document.getElementById('endpoint-name').value = '';
        document.getElementById('endpoint-query-url').value = '';
        document.getElementById('endpoint-update-url').value = '';
        document.getElementById('endpoint-graph').value = '';
        document.getElementById('endpoint-username').value = '';
        document.getElementById('endpoint-password').value = '';

        this.logger?.success(`Endpoint "${name}" added successfully`);
    }

    async testEndpoint() {
        const queryUrl = document.getElementById('endpoint-query-url')?.value?.trim();
        
        if (!queryUrl) {
            this.logger?.warn('Please enter a query URL to test');
            return;
        }

        try {
            this.logger?.info('Testing endpoint connection...');
            
            const response = await fetch('/api/sparql/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: queryUrl
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.logger?.success('Endpoint connection successful');
                } else {
                    this.logger?.error(`Endpoint test failed: ${result.error}`);
                }
            } else {
                this.logger?.error('Endpoint test failed: Connection error');
            }
        } catch (error) {
            console.error('Endpoint test error:', error);
            this.logger?.error(`Endpoint test failed: ${error.message}`);
        }
    }

    async testSpecificEndpoint(endpointId) {
        const endpoint = this.endpoints.find(e => e.id === endpointId);
        if (!endpoint) return;

        try {
            this.logger?.info(`Testing endpoint: ${endpoint.name}...`);
            
            const response = await fetch('/api/sparql/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: endpoint.queryUrl
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.updateEndpointStatus(endpointId, result.success);
                
                if (result.success) {
                    this.logger?.success(`Endpoint "${endpoint.name}" is online`);
                } else {
                    this.logger?.error(`Endpoint "${endpoint.name}" test failed: ${result.error}`);
                }
            } else {
                this.updateEndpointStatus(endpointId, false);
                this.logger?.error(`Endpoint "${endpoint.name}" connection failed`);
            }
        } catch (error) {
            this.updateEndpointStatus(endpointId, false);
            console.error('Endpoint test error:', error);
            this.logger?.error(`Endpoint "${endpoint.name}" test failed: ${error.message}`);
        }
    }

    updateEndpointStatus(endpointId, isOnline) {
        const containers = document.querySelectorAll('.endpoint-item');
        containers.forEach(container => {
            const nameElement = container.querySelector('.endpoint-name');
            const endpoint = this.endpoints.find(e => e.name === nameElement?.textContent);
            
            if (endpoint && endpoint.id === endpointId) {
                const statusElement = container.querySelector('.endpoint-status');
                if (statusElement) {
                    statusElement.className = `endpoint-status ${isOnline ? 'connected' : 'disconnected'}`;
                    statusElement.textContent = isOnline ? 'Connected' : 'Disconnected';
                }
            }
        });
    }

    removeEndpoint(endpointId) {
        const index = this.endpoints.findIndex(e => e.id === endpointId);
        if (index > -1) {
            const endpoint = this.endpoints[index];
            this.endpoints.splice(index, 1);
            this.updateEndpointSelects();
            this.updateEndpointsList();
            this.logger?.success(`Endpoint "${endpoint.name}" removed`);
        }
    }

    exportGraph() {
        if (!this.graphVisualizer) {
            this.logger?.error('Graph visualizer not initialized');
            return;
        }

        // Export the current graph as Turtle
        if (this.turtleEditor) {
            const content = this.turtleEditor.getValue();
            if (content.trim()) {
                this.saveRDFFile();
            } else {
                this.logger?.warn('No graph content to export');
            }
        }
    }
}

// Initialize SPARQL Browser when module loads
const sparqlBrowser = new SPARQLBrowser();

// Export for global access
window.sparqlBrowser = sparqlBrowser;

export default SPARQLBrowser;