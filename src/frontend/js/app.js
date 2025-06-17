/**
 * Main application initialization
 */
import { setupDebug } from './utils/debug.js';
import { initTabs } from './components/tabs.js';
import { initSettingsForm } from './components/settings.js';
import { checkAPIHealth } from './services/apiService.js';
import { SPARQLBrowser } from './components/sparqlBrowser.js';
import { initMCPClient } from './components/mcpClient.js';

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
    // Setup debug functionality
    setupDebug();
    
    // Initialize Atuin components first
    await initializeAtuin();
    
    // Initialize loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        // Force it to be hidden at startup
        loadingIndicator.style.display = 'none';
        window.showDebug('Loading indicator hidden at initialization');
    }

    window.showDebug('Application initialized');

    // Check API health
    window.showDebug('Checking API health...');
    checkAPIHealth();
    
    // Log the API URL
    const currentPort = window.location.port;
    console.log(`Running on port: ${currentPort}`);
    window.showDebug(`Running on port: ${currentPort}`);
    window.showDebug(`Using same origin for API requests`);

    // Initialize tab navigation
    initTabs();
    
    // Initialize range inputs with value display
    initRangeInputs();
    
    // Initialize API endpoint forms
    initSearchForm();
    initMemoryForms();
    
    // Initialize chat forms and load providers
    initChatForms().then(() => {
        loadChatProviders();
    });
    
    initEmbeddingForm();
    initConceptsForm();
    initIndexForm();
    initSettingsForm();

    // Initialize SPARQL browser with Atuin integration
    await initSPARQLBrowser();

    // Initialize MCP Client
    initMCPClient();

    // Failsafe mechanism to ensure loading indicator doesn't get stuck
    setupFailsafeTimeout();
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

// Placeholder functions for forms that need to be implemented
function initSearchForm() {
    console.log('TODO: Implement search form initialization');
}

function initMemoryForms() {
    console.log('TODO: Implement memory forms initialization');
}

function initChatForms() {
    console.log('TODO: Implement chat forms initialization');
    return Promise.resolve();
}

function loadChatProviders() {
    console.log('TODO: Implement chat providers loading');
}

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
                            console.log('Received RDF content for visualization:', rdfContent);
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