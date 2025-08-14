/**
 * Main Workbench Module - ES Modules Version
 * Orchestrates all components of the Semantic Memory Workbench
 */

import { StateManager } from './managers/StateManager.js';
import { SettingsManager } from './managers/SettingsManager.js';
import { ApiService } from './services/ApiService.js';
import { SessionDashboard } from './components/SessionDashboard.js';
import { TellController } from './components/TellController.js';
import { AskController } from './components/AskController.js';
import { NavigateController } from './components/NavigateController.js';
import { SettingsController } from './components/SettingsController.js';
import { SPARQLController } from './components/SPARQLController.js';
import { 
    switchTab, 
    showToast, 
    showLoading, 
    addEventListenerWithCleanup,
    getElementById 
} from './utils/domUtils.js';

/**
 * Main Workbench Application Class
 * Coordinates all components and manages the overall application state
 */
class SemanticMemoryWorkbench {
    constructor() {
        // Core services
        this.stateManager = new StateManager();
        this.apiService = new ApiService();
        this.settingsManager = null; // Will be initialized after StateManager
        
        // UI Components
        this.sessionDashboard = null;
        this.tellController = null;
        this.askController = null;
        this.navigateController = null;
        this.settingsController = null;
        this.sparqlController = null;
        
        // Application state
        this.isInitialized = false;
        this.currentTab = 'workbench';
        this.cleanupFunctions = [];
        
        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.handleTabSwitch = this.handleTabSwitch.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        this.checkServerConnection = this.checkServerConnection.bind(this);
    }
    
    /**
     * Initialize the workbench application
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('Workbench already initialized');
            return;
        }
        
        try {
            console.log('Initializing Semantic Memory Workbench...');
            
            // Show loading state
            showLoading(true, 'Initializing workbench...');
            
            // Initialize core services
            await this.initializeServices();
            
            // Initialize UI components
            await this.initializeComponents();
            
            // Set up global event handlers
            this.setupGlobalEventHandlers();
            
            // Restore previous session state
            this.restoreSessionState();
            
            // Check server connection
            await this.checkServerConnection();
            
            // Hide loading state
            showLoading(false);
            
            this.isInitialized = true;
            console.log('Workbench initialized successfully');
            
            // Show welcome message
            showToast('Semantic Memory Workbench loaded successfully', 'success', 3000);
            
        } catch (error) {
            console.error('Failed to initialize workbench:', error);
            showLoading(false);
            showToast('Failed to initialize workbench: ' + error.message, 'error', 10000);
            throw error;
        }
    }
    
    /**
     * Initialize core services
     */
    async initializeServices() {
        console.log('Initializing services...');
        
        // Initialize SettingsManager after StateManager
        this.settingsManager = new SettingsManager(this.stateManager, this.apiService);
        
        // Set up cross-service communication
        this.stateManager.on('stateChange', (event) => {
            console.debug('State changed:', event.path, event.value);
        });
        
        this.stateManager.on('performanceRecorded', (event) => {
            console.debug('Performance recorded:', event.operation, event.duration);
        });
        
        // Settings manager events
        this.settingsManager.on('settingChanged', (event) => {
            console.debug('Setting changed:', event.path, event.value);
        });
        
        this.settingsManager.on('modelConfigChanged', (event) => {
            console.debug('Model config changed:', event);
            showToast('Model configuration updated', 'info', 2000);
        });
        
        console.log('Services initialized');
    }
    
    /**
     * Initialize UI components
     */
    async initializeComponents() {
        console.log('Initializing UI components...');
        
        // Create component instances
        this.sessionDashboard = new SessionDashboard(this.stateManager, this.apiService);
        this.tellController = new TellController(this.stateManager, this.apiService);
        this.askController = new AskController(this.stateManager, this.apiService);
        this.navigateController = new NavigateController(this.stateManager, this.apiService);
        this.settingsController = new SettingsController(this.stateManager, this.apiService, this.settingsManager);
        this.sparqlController = new SPARQLController(this.stateManager, this.apiService, this.settingsManager);
        
        // Initialize components
        this.sessionDashboard.initialize();
        this.tellController.initialize();
        this.askController.initialize();
        this.navigateController.initialize();
        this.settingsController.initialize();
        this.sparqlController.initialize();
        
        console.log('UI components initialized');
    }
    
    /**
     * Set up global event handlers
     */
    setupGlobalEventHandlers() {
        console.log('Setting up global event handlers...');
        
        // Tab navigation
        const cleanup1 = addEventListenerWithCleanup(document, 'click', (event) => {
            const navBtn = event.target.closest('.nav-btn');
            if (navBtn) {
                const tabName = navBtn.dataset.tab;
                if (tabName) {
                    this.handleTabSwitch(tabName);
                }
            }
        });
        this.cleanupFunctions.push(cleanup1);
        
        // Keyboard shortcuts
        const cleanup2 = addEventListenerWithCleanup(document, 'keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
        this.cleanupFunctions.push(cleanup2);
        
        // Page visibility changes
        const cleanup3 = addEventListenerWithCleanup(document, 'visibilitychange', this.handleVisibilityChange);
        this.cleanupFunctions.push(cleanup3);
        
        // Before page unload
        const cleanup4 = addEventListenerWithCleanup(window, 'beforeunload', this.handleBeforeUnload);
        this.cleanupFunctions.push(cleanup4);
        
        // Periodic connection checks
        this.connectionCheckInterval = setInterval(this.checkServerConnection, 30000); // Every 30 seconds
        
        console.log('Global event handlers set up');
    }
    
    /**
     * Handle tab switching
     * @param {string} tabName - Name of the tab to switch to
     */
    handleTabSwitch(tabName) {
        if (this.currentTab === tabName) return;
        
        console.log(`Switching to tab: ${tabName}`);
        
        // Update state
        this.currentTab = tabName;
        this.stateManager.set('ui.activeTab', tabName);
        
        // Switch UI
        switchTab(tabName);
        
        // Focus appropriate element for each tab
        setTimeout(() => {
            switch (tabName) {
                case 'tell':
                    const tellContent = getElementById('tell-content');
                    if (tellContent) tellContent.focus();
                    break;
                case 'ask':
                    const askQuery = getElementById('ask-query');
                    if (askQuery) askQuery.focus();
                    break;
                case 'navigate':
                    // Focus will be handled by NavigateController
                    break;
                case 'settings':
                    // Focus will be handled by SettingsController
                    break;
                case 'sparql':
                    // Focus will be handled by SPARQLController
                    break;
            }
        }, 100);
    }
    
    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Only handle shortcuts when not in input elements
        if (event.target.matches('input, textarea, select')) {
            return;
        }
        
        // Ctrl/Cmd + number keys for tab switching
        if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '4') {
            event.preventDefault();
            const tabMap = {
                '1': 'workbench', // Main 7 Simple Verbs interface
                '2': 'monitor',   // System monitor
                '3': 'settings',  // Settings
                '4': 'sparql'     // SPARQL browser
            };
            
            const tabName = tabMap[event.key];
            if (tabName) {
                this.handleTabSwitch(tabName);
            }
        }
        
        // Escape key to clear/reset current tab content
        if (event.key === 'Escape') {
            const activeTab = this.currentTab;
            switch (activeTab) {
                case 'workbench':
                    // Clear based on active column in workbench
                    const activeColumn = document.querySelector('.workflow-column.active');
                    if (activeColumn?.classList.contains('tell-column')) {
                        this.tellController?.clearContent();
                    } else if (activeColumn?.classList.contains('ask-column')) {
                        this.askController?.clearQuery();
                    } else if (activeColumn?.classList.contains('navigate-column')) {
                        this.navigateController?.resetNavigation();
                    }
                    break;
                case 'settings':
                    this.settingsController?.resetToDefaults();
                    break;
                case 'sparql':
                    this.sparqlController?.clearQuery();
                    break;
            }
        }
        
        // F5 or Ctrl+R for refresh (prevent default and do custom refresh)
        if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
            event.preventDefault();
            this.refreshWorkbench();
        }
    }
    
    /**
     * Handle page visibility changes (tab switching, minimizing, etc.)
     * @param {Event} event - Visibility change event
     */
    handleVisibilityChange(event) {
        if (document.hidden) {
            console.log('Workbench hidden - pausing updates');
            this.sessionDashboard?.stopAutoUpdate();
        } else {
            console.log('Workbench visible - resuming updates');
            this.sessionDashboard?.startAutoUpdate();
            this.checkServerConnection();
        }
    }
    
    /**
     * Handle before page unload
     * @param {BeforeUnloadEvent} event - Before unload event
     */
    handleBeforeUnload(event) {
        // Save current state
        try {
            this.saveSessionState();
        } catch (error) {
            console.warn('Failed to save session state on unload:', error);
        }
        
        // No confirmation dialog for now
        // event.preventDefault();
        // return 'Are you sure you want to leave?';
    }
    
    /**
     * Check server connection
     */
    async checkServerConnection() {
        try {
            const connectionTest = await this.apiService.testConnection();
            this.stateManager.updateConnection(connectionTest);
            
            if (!connectionTest.success) {
                console.warn('Server connection failed:', connectionTest.error);
            }
        } catch (error) {
            console.warn('Connection check failed:', error);
            this.stateManager.updateConnection({
                isConnected: false,
                error: error.message
            });
        }
    }
    
    /**
     * Refresh the entire workbench
     */
    async refreshWorkbench() {
        console.log('Refreshing workbench...');
        showLoading(true, 'Refreshing workbench...');
        
        try {
            // Refresh session data
            await this.sessionDashboard?.refreshSession();
            
            // Check server connection
            await this.checkServerConnection();
            
            showToast('Workbench refreshed', 'success', 2000);
        } catch (error) {
            console.error('Failed to refresh workbench:', error);
            showToast('Refresh failed: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
    
    /**
     * Save current session state
     */
    saveSessionState() {
        try {
            const sessionState = {
                currentTab: this.currentTab,
                timestamp: Date.now(),
                components: {
                    tell: this.tellController?.getState(),
                    ask: this.askController?.getState(),
                    navigate: this.navigateController?.getState(),
                    settings: this.settingsController?.getState(),
                    sparql: this.sparqlController?.getState()
                }
            };
            
            localStorage.setItem('semem-workbench-session', JSON.stringify(sessionState));
            console.log('Session state saved');
        } catch (error) {
            console.warn('Failed to save session state:', error);
        }
    }
    
    /**
     * Restore previous session state
     */
    restoreSessionState() {
        try {
            const stored = localStorage.getItem('semem-workbench-session');
            if (!stored) return;
            
            const sessionState = JSON.parse(stored);
            
            // Restore tab
            if (sessionState.currentTab && sessionState.currentTab !== this.currentTab) {
                this.handleTabSwitch(sessionState.currentTab);
            }
            
            // Restore component states
            if (sessionState.components) {
                if (sessionState.components.tell) {
                    this.tellController?.setState(sessionState.components.tell);
                }
                if (sessionState.components.ask) {
                    this.askController?.setState(sessionState.components.ask);
                }
                if (sessionState.components.navigate) {
                    this.navigateController?.setState(sessionState.components.navigate);
                }
                if (sessionState.components.settings) {
                    this.settingsController?.setState(sessionState.components.settings);
                }
                if (sessionState.components.sparql) {
                    this.sparqlController?.setState(sessionState.components.sparql);
                }
            }
            
            console.log('Session state restored');
        } catch (error) {
            console.warn('Failed to restore session state:', error);
        }
    }
    
    /**
     * Get workbench status and health information
     * @returns {object} - Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            currentTab: this.currentTab,
            stateManager: {
                summary: this.stateManager.getSummary()
            },
            components: {
                sessionDashboard: !!this.sessionDashboard,
                tellController: !!this.tellController,
                askController: !!this.askController,
                navigateController: !!this.navigateController,
                settingsController: !!this.settingsController,
                sparqlController: !!this.sparqlController
            },
            performance: this.stateManager.getPerformanceMetrics()
        };
    }
    
    /**
     * Cleanup and destroy the workbench
     */
    destroy() {
        console.log('Destroying workbench...');
        
        // Save current state
        this.saveSessionState();
        
        // Clear intervals
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        // Cleanup event listeners
        this.cleanupFunctions.forEach(cleanup => cleanup());
        this.cleanupFunctions = [];
        
        // Destroy components
        this.sessionDashboard?.destroy();
        this.settingsController?.destroy();
        this.sparqlController?.destroy();
        this.tellController = null;
        this.askController = null;
        this.navigateController = null;
        this.settingsController = null;
        this.sparqlController = null;
        this.sessionDashboard = null;
        
        this.isInitialized = false;
        console.log('Workbench destroyed');
    }
}

// Create and expose global workbench instance
let workbenchInstance = null;

/**
 * Initialize the workbench application
 */
export async function initializeWorkbench() {
    if (workbenchInstance) {
        console.warn('Workbench already initialized');
        return workbenchInstance;
    }
    
    workbenchInstance = new SemanticMemoryWorkbench();
    await workbenchInstance.initialize();
    
    // Expose to window for debugging
    window.workbench = workbenchInstance;
    
    return workbenchInstance;
}

/**
 * Get the current workbench instance
 */
export function getWorkbench() {
    return workbenchInstance;
}

/**
 * Destroy the workbench instance
 */
export function destroyWorkbench() {
    if (workbenchInstance) {
        workbenchInstance.destroy();
        workbenchInstance = null;
        delete window.workbench;
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWorkbench);
} else {
    // DOM is already ready
    initializeWorkbench();
}

// Export the main class for advanced usage
export { SemanticMemoryWorkbench };