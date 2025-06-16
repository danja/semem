/**
 * SPARQL Browser Component
 * Basic RDF query and visualization without Atuin (temporarily)
 * TODO: Integrate Atuin components properly
 */

export class SPARQLBrowser {
    constructor() {
        this.currentEndpoint = null;
        this.endpoints = [];
        this.initialized = false;
    }

    async init() {
        try {
            console.log('Initializing SPARQL Browser...');
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load available endpoints
            await this.loadEndpoints();
            
            // Setup SPARQL browser tabs
            this.setupTabs();
            
            this.initialized = true;
            console.log('SPARQL Browser initialized');
            
        } catch (error) {
            console.error('Failed to initialize SPARQL Browser:', error);
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
        // Switch to Graph tab
        const graphTab = document.querySelector('[data-tab="sparql-graph"]');
        if (graphTab) {
            graphTab.click();
        }
        
        // For now, just display the raw result - TODO: implement visualization
        const graphContainer = document.getElementById('rdf-graph-container');
        if (graphContainer && result.graph) {
            graphContainer.innerHTML = `
                <div style="padding: 1rem;">
                    <h4>CONSTRUCT Query Result (${result.graph.length} triples)</h4>
                    <pre style="background: #f5f5f5; padding: 1rem; overflow: auto; max-height: 300px;">${JSON.stringify(result.graph, null, 2)}</pre>
                </div>
            `;
            console.log(`Loaded graph with ${result.graph.length} triples`);
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
}