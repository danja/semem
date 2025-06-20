/**
 * Main application initialization
 */
import { setupDebug } from './utils/debug.js';
import { initSettingsForm } from './components/settings.js';
import { checkAPIHealth } from './services/apiService.js';
import { SPARQLBrowser } from './components/sparqlBrowser.js';
import { initMCPClient } from './components/mcpClient.js';
import { initChatForms, loadChatProviders } from './components/chat.js';
import { initMemoryVisualization } from './components/memoryVisualization.js';
import { init as initVSOM } from './features/vsom/index.js';
import Console from './components/Console/Console.js';
import { logger, replaceConsole } from './utils/logger.js';
import tabManager from './utils/tabManager.js';

// Import Atuin and event bus for RDF visualization
let TurtleEditor, GraphVisualizer, LoggerService, eventBus, EVENTS;

/**
 * Initialize Atuin components and real event bus
 */
async function initializeAtuin() {
    try {
        // Use the real event bus from evb package
        console.log('Setting up real event bus for RDF visualization');

        const { eventBus, EVENTS } = await import('evb');

        // Make the real event bus globally available
        window.eventBus = eventBus;
        window.EVENTS = EVENTS;

        console.log('Real event bus initialized for RDF visualization');
        return true;
    } catch (error) {
        console.warn('Failed to initialize real event bus, falling back to mock:', error.message);

        // Fallback to simple mock only if real event bus fails
        window.eventBus = {
            listeners: {},
            emit(event, data) {
                console.log(`EventBus: Emitting ${event}`, data);
                if (this.listeners[event]) {
                    this.listeners[event].forEach(callback => callback(data));
                }
            },
            on(event, callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event].push(callback);
                console.log(`EventBus: Added listener for ${event}`);
            }
        };

        window.EVENTS = {
            MODEL_SYNCED: 'rdf:model:synced',
            GRAPH_UPDATED: 'dataset:graph:updated'
        };

        return false;
    }
}

/**
 * Initialize the entire application
 */
export async function initializeApp() {
    try {
        // Setup debug functionality
        setupDebug();

        // Initialize Atuin components first
        await initializeAtuin();

        // Initialize TabManager first
        tabManager.init();

        // Initialize other components
        initSettingsForm();
        initRangeInputs();
        initSearchForm();
        initMemoryForms();
        await loadChatProviders();
        initChatForms();
        initMemoryVisualization();
        initVSOM();
        await initMCPClient();
        await initSPARQLBrowser();

        // Initialize console after a short delay
        setTimeout(initializeConsole, 500);

        // Hide loading indicator
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `
                <div class="error">
                    <h3>Error initializing application</h3>
                    <p>${error.message}</p>
                </div>`;
        }
    }
}

/**
 * Initialize range inputs with value display
 */
function initRangeInputs() {
    // Search threshold
    const searchThreshold = document.getElementById('search-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    if (searchThreshold && thresholdValue) {
        searchThreshold.addEventListener('input', (e) => {
            thresholdValue.textContent = e.target.value;
        });
    }

    // Memory threshold
    const memoryThreshold = document.getElementById('memory-threshold');
    const memoryThresholdValue = document.getElementById('memory-threshold-value');
    if (memoryThreshold && memoryThresholdValue) {
        memoryThreshold.addEventListener('input', (e) => {
            memoryThresholdValue.textContent = e.target.value;
        });
    }

    // Chat temperature
    const chatTemperature = document.getElementById('chat-temperature');
    const temperatureValue = document.getElementById('temperature-value');
    if (chatTemperature && temperatureValue) {
        chatTemperature.addEventListener('input', (e) => {
            temperatureValue.textContent = e.target.value;
        });
    }

    // Chat stream temperature
    const chatStreamTemperature = document.getElementById('chat-stream-temperature');
    const streamTemperatureValue = document.getElementById('stream-temperature-value');
    if (chatStreamTemperature && streamTemperatureValue) {
        chatStreamTemperature.addEventListener('input', (e) => {
            streamTemperatureValue.textContent = e.target.value;
        });
    }
}

/**
 * Setup failsafe timeout for loading indicator
 */
function setupFailsafeTimeout() {
    let loadingTimeout = null;
    const resetLoadingTimeout = () => {
        clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }, 10000);
    };

    // Expose reset function globally
    window.resetLoadingTimeout = resetLoadingTimeout;
}

// Helper functions for search functionality
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 30000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

function showLoading(show) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    }
}

function displayError(message, container) {
    console.error('Displaying error:', message);
    
    // Use provided container or default to body
    const targetContainer = container || document.body;
    
    // Create error element if it doesn't exist
    let errorElement = targetContainer.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.color = 'red';
        errorElement.style.margin = '10px 0';
        errorElement.style.padding = '10px';
        errorElement.style.border = '1px solid #ff9999';
        errorElement.style.borderRadius = '4px';
        errorElement.style.backgroundColor = '#fff0f0';
        targetContainer.prepend(errorElement);
    }
    
    // Set error message
    errorElement.textContent = message;
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorElement.remove();
    }, 10000);
}

function displaySearchResults(results, container) {
    console.log(`Displaying ${results.length} search results`);
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="results-placeholder">
                <p>No results found. Try adjusting your search criteria.</p>
            </div>`;
        return;
    }

    // Create results HTML
    const resultsHtml = results.map((result, index) => {
        const score = typeof result.score === 'number' ? result.score.toFixed(2) : 'N/A';
        const title = result.title || 'Untitled';
        const content = result.content || result.text || '';
        const url = result.url || '#';
        
        return `
            <div class="result-item">
                <h3 class="result-title">
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(title)}
                    </a>
                </h3>
                <div class="result-content">
                    ${escapeHtml(content.length > 200 ? content.substring(0, 200) + '...' : content)}
                </div>
                <div class="result-meta">
                    <div class="result-meta-item">
                        <span class="result-source">${escapeHtml(result.type || 'document')}</span>
                        <span class="result-score">Score: ${score}</span>
                    </div>
                    ${result.uri ? `
                    <div class="result-uri" title="${escapeHtml(result.uri)}">
                        <span>URI: </span>
                        <a href="${escapeHtml(result.uri)}" target="_blank" rel="noopener noreferrer" class="uri-link">
                            ${escapeHtml(result.uri.length > 50 ? result.uri.substring(0, 50) + '...' : result.uri)}
                        </a>
                    </div>` : ''}
                </div>
            </div>`;
    }).join('');

    // Update the container with results
    container.innerHTML = `
        <div class="result-stats">
            <div class="stat-item">
                <span class="stat-label">Results</span>
                <span class="stat-value">${results.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Top Score</span>
                <span class="stat-value">${results[0]?.score?.toFixed(2) || 'N/A'}</span>
            </div>
        </div>
        <div class="results-list">
            ${resultsHtml}
        </div>
        <div class="debug-info" style="margin-top: 20px; font-size: 0.9em; color: #666;">
            <details>
                <summary>Debug Info</summary>
                <pre>${escapeHtml(JSON.stringify(results, null, 2))}</pre>
            </details>
        </div>`;
}

// Search form initialization
function initSearchForm() {
    console.log('Initializing search form');
    
    const searchForm = document.getElementById('search-form');
    const searchResults = document.getElementById('search-results');
    
    if (!searchForm) {
        console.warn('Search form not found, skipping initialization');
        return;
    }
    
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // This prevents the page refresh!
        
        const formData = new FormData(searchForm);
        const query = formData.get('query');
        const limit = formData.get('limit');
        const threshold = formData.get('threshold');
        const types = formData.get('types');
        const graph = formData.get('graph');
        
        if (!query) return;
        
        try {
            showLoading(true);
            console.log('Search form submitted, showing loading indicator');
            
            // Clear previous results first
            if (searchResults) {
                searchResults.innerHTML = `
                    <div class="results-placeholder">
                        <p>Searching for "${escapeHtml(query)}"...</p>
                    </div>
                `;
            }
            
            // Build query params
            const params = new URLSearchParams({
                q: query,  // Server expects 'q' parameter, not 'query'
                limit: limit
            });
            
            if (threshold) params.append('threshold', threshold);
            if (types) params.append('types', types);
            if (graph) params.append('graph', graph);
            
            console.log(`Searching with params: ${params.toString()}`);
            
            // Perform search with longer timeout for search operations
            const searchUrl = `/api/search?${params.toString()}`;
            console.log(`Making search request to: ${searchUrl}`);
            
            try {
                const response = await fetchWithTimeout(searchUrl, { 
                    timeout: 30000, // 30 second timeout for search
                    headers: {
                        'X-API-Key': 'semem-dev-key'
                    }
                });
                
                console.log(`Search response received: ${response.status}`);
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Search failed');
                }
                
                const data = await response.json();
                console.log(`Search returned ${data.results?.length || 0} results`);
                
                if (searchResults) {
                    displaySearchResults(data.results || [], searchResults);
                }
                
            } catch (fetchError) {
                console.log(`Search fetch error: ${fetchError.message}`);
                
                // Special handling for timeouts
                if (fetchError.name === 'AbortError') {
                    if (searchResults) {
                        displayError('Search request timed out. This may happen if the server is busy or the search operation is complex. Please try again with a simpler query.', searchResults);
                    }
                } else {
                    if (searchResults) {
                        displayError(fetchError.message || 'Search operation failed', searchResults);
                    }
                }
            }
            
        } catch (error) {
            console.log(`General search error: ${error.message}`);
            if (searchResults) {
                displayError(`Search error: ${error.message}`, searchResults);
            }
        } finally {
            showLoading(false);
            console.log('Search completed, hiding loading indicator');
        }
    });
    
    // Initialize graph selector
    initGraphSelector();
}

// Graph selector functionality
function initGraphSelector() {
    const graphSelector = document.getElementById('graph-selector');
    const addGraphBtn = document.getElementById('add-graph-btn');
    const removeGraphBtn = document.getElementById('remove-graph-btn');
    
    if (!graphSelector || !addGraphBtn || !removeGraphBtn) {
        console.warn('Graph selector elements not found, skipping initialization');
        return;
    }
    
    // Load default graph from config and saved graphs from localStorage
    loadGraphList();
    
    // Add event listeners
    addGraphBtn.addEventListener('click', addNewGraph);
    removeGraphBtn.addEventListener('click', removeSelectedGraph);
    graphSelector.addEventListener('change', saveSelectedGraph);
}

function loadGraphList() {
    const graphSelector = document.getElementById('graph-selector');
    if (!graphSelector) return;
    
    // Get saved graphs from localStorage
    const savedGraphs = JSON.parse(localStorage.getItem('semem-graph-list') || '[]');
    
    // Default graph (from config fallback)
    const defaultGraph = 'http://hyperdata.it/content';
    
    // Create Set to avoid duplicates
    const allGraphs = new Set([defaultGraph, ...savedGraphs]);
    
    // Clear existing options
    graphSelector.innerHTML = '';
    
    // Add all graphs as options
    allGraphs.forEach(graph => {
        const option = document.createElement('option');
        option.value = graph;
        option.textContent = graph;
        graphSelector.appendChild(option);
    });
    
    // Set selected graph from localStorage or default
    const selectedGraph = localStorage.getItem('semem-selected-graph') || defaultGraph;
    if (graphSelector.querySelector(`option[value="${selectedGraph}"]`)) {
        graphSelector.value = selectedGraph;
    }
}

function saveGraphList() {
    const graphSelector = document.getElementById('graph-selector');
    if (!graphSelector) return;
    
    const graphs = Array.from(graphSelector.options).map(option => option.value);
    const defaultGraph = 'http://hyperdata.it/content';
    
    // Save all graphs except the default one
    const savedGraphs = graphs.filter(graph => graph !== defaultGraph);
    localStorage.setItem('semem-graph-list', JSON.stringify(savedGraphs));
}

function saveSelectedGraph() {
    const graphSelector = document.getElementById('graph-selector');
    if (!graphSelector) return;
    
    localStorage.setItem('semem-selected-graph', graphSelector.value);
}

function addNewGraph() {
    const newGraph = prompt('Enter the graph name (URI):');
    if (!newGraph || !newGraph.trim()) return;
    
    const graphSelector = document.getElementById('graph-selector');
    if (!graphSelector) return;
    
    // Check if graph already exists
    if (graphSelector.querySelector(`option[value="${newGraph.trim()}"]`)) {
        alert('Graph already exists in the list');
        return;
    }
    
    // Add new option
    const option = document.createElement('option');
    option.value = newGraph.trim();
    option.textContent = newGraph.trim();
    graphSelector.appendChild(option);
    
    // Select the new graph
    graphSelector.value = newGraph.trim();
    
    // Save to localStorage
    saveGraphList();
    saveSelectedGraph();
}

function removeSelectedGraph() {
    const graphSelector = document.getElementById('graph-selector');
    if (!graphSelector) return;
    
    const selectedValue = graphSelector.value;
    const defaultGraph = 'http://hyperdata.it/content';
    
    // Don't allow removing the default graph
    if (selectedValue === defaultGraph) {
        alert('Cannot remove the default graph');
        return;
    }
    
    if (graphSelector.options.length <= 1) {
        alert('Cannot remove the last graph');
        return;
    }
    
    if (confirm(`Remove graph "${selectedValue}" from the list?`)) {
        // Remove the selected option
        const selectedOption = graphSelector.querySelector(`option[value="${selectedValue}"]`);
        if (selectedOption) {
            selectedOption.remove();
        }
        
        // Select the first remaining option
        if (graphSelector.options.length > 0) {
            graphSelector.selectedIndex = 0;
        }
        
        // Save to localStorage
        saveGraphList();
        saveSelectedGraph();
    }
}

function initMemoryForms() {
    console.log('TODO: Implement memory forms initialization');
}

// Chat functions now imported from ./components/chat.js

function initEmbeddingForm() {
    console.log('TODO: Implement embedding form initialization');
}

function initConceptsForm() {
    console.log('TODO: Implement concepts form initialization');
}

function initIndexForm() {
    console.log('TODO: Implement index form initialization');
}

async function initSPARQLBrowser() {
    // Initialize SPARQL browser when the tab becomes visible
    const sparqlTab = document.querySelector('[data-tab="sparql-browser"]');
    if (sparqlTab) {
        const initializeSparqlBrowser = async () => {
            // Check if we're on the SPARQL browser tab
            const sparqlSection = document.getElementById('sparql-browser-tab');
            if (sparqlSection && !sparqlSection.classList.contains('hidden')) {
                if (!window.sparqlBrowser) {
                    console.log('Initializing SPARQL Browser...');
                    window.sparqlBrowser = new SPARQLBrowser();
                    await window.sparqlBrowser.init();

                    // Set up basic graph visualization listener
                    if (window.eventBus && window.EVENTS) {
                        window.eventBus.on(window.EVENTS.MODEL_SYNCED, (rdfContent) => {
                            console.log('Received RDF content for visualization');
                            // This will be handled by the displayGraphResult method
                        });

                        console.log('Event bus listeners set up for RDF visualization');
                    }
                }
            }
        };

        // Initialize when tab is clicked
        sparqlTab.addEventListener('click', initializeSparqlBrowser);

        // Also initialize if already active
        setTimeout(initializeSparqlBrowser, 100);
    }
}

// Track if console is already initialized
let consoleInstance = null;

// Initialize console after the app is loaded
async function initializeConsole() {
    try {
        // Return existing instance if already initialized
        if (window.appConsole) {
            console.log('[DEBUG] Console already initialized, returning existing instance');
            return window.appConsole;
        }

        console.log('[DEBUG] Starting initializeConsole()');

        // Import the Console component
        const { default: Console } = await import('./components/Console/Console.js');
        console.log('[DEBUG] Console component imported:', typeof Console);

        // Create and initialize the console if not already in DOM
        const consoleRoot = document.getElementById('console-root');
        if (!consoleRoot) {
            console.warn('[DEBUG] Console root element not found, creating one');
            const newRoot = document.createElement('div');
            newRoot.id = 'console-root';
            document.body.appendChild(newRoot);
        }

        // Only create new instance if one doesn't exist
        if (!consoleInstance) {
            consoleInstance = new Console({
                initialLogLevel: 'debug',
                maxLogs: 1000
            });
            console.log('[DEBUG] New console instance created');
        }

        // Make console available globally for debugging
        window.appConsole = consoleInstance;

        // Replace console methods to capture logs
        if (typeof replaceConsole === 'function') {
            replaceConsole();
            console.log('[DEBUG] replaceConsole() called');
        } else {
            console.warn('[DEBUG] replaceConsole is not a function');
        }

        // Log a test message
        console.log('Console component initialized');

        // Console is ready but remains hidden by default
        // Users can open it with the hamburger menu or backtick (`) key
        console.log('[DEBUG] Console initialized and ready (hidden by default)');

        return consoleInstance;
    } catch (error) {
        console.error('[DEBUG] Failed to initialize console:', error);
        throw error;
    }
}

// Make sure initializeConsole runs after DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeConsole().catch(e => console.error('[DEBUG] Console init error after DOMContentLoaded:', e));
    });
} else {
    initializeConsole().catch(e => console.error('[DEBUG] Console init error:', e));
}

// Initialize the application when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp().then(initializeConsole).catch(console.error);
    });
} else {
    initializeApp().then(initializeConsole).catch(console.error);
}