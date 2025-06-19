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

// Placeholder functions for forms that need to be implemented
function initSearchForm() {
    console.log('TODO: Implement search form initialization');
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