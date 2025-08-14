/**
 * State Management for Semantic Memory Workbench
 * Manages ZPT navigation state and application state
 */

import { apiService } from './ApiService.js';

export class StateManager {
  constructor() {
    this.state = {
      // ZPT Navigation State
      zoom: 'entity',      // entity | unit | text | community | corpus
      pan: {               // Domain filtering
        domains: [],
        keywords: [],
        entities: [],
        temporal: null
      },
      tilt: 'keywords',    // keywords | embedding | graph | temporal
      
      // Session State
      session: {
        startTime: Date.now(),
        interactionsCount: 0,
        conceptsCount: 0,
        duration: 0
      },
      
      // Connection State
      connection: {
        status: 'connecting', // connecting | connected | error
        lastCheck: null,
        error: null
      },
      
      // UI State
      ui: {
        expandedPanels: new Set(),
        activeResults: {},
        loadingStates: {}
      }
    };
    
    this.listeners = new Map();
    this.updateInterval = null;
    this.connectionCheckInterval = null;
    
    this.initialize();
  }

  /**
   * Initialize state manager
   */
  async initialize() {
    // Start session duration counter
    this.startSessionTimer();
    
    // Start periodic connection checks
    this.startConnectionMonitor();
    
    // Load initial state from server
    try {
      await this.syncWithServer();
    } catch (error) {
      console.warn('Failed to sync initial state:', error.message);
    }
  }

  // ===== STATE ACCESS METHODS =====

  /**
   * Get current state
   */
  getState() {
    return structuredClone(this.state);
  }

  /**
   * Get specific state slice
   */
  getStateSlice(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Update state and notify listeners
   */
  setState(updates, notify = true) {
    const oldState = structuredClone(this.state);
    
    // Apply updates
    if (typeof updates === 'function') {
      this.state = updates(this.state);
    } else {
      this.state = this.deepMerge(this.state, updates);
    }
    
    if (notify) {
      this.notifyListeners('stateChange', { oldState, newState: this.state, updates });
    }
  }

  // ===== ZPT NAVIGATION METHODS =====

  /**
   * Update zoom level
   */
  async setZoom(level, query) {
    try {
      this.setLoadingState('zoom', true);
      
      const result = await apiService.zoom({ level, query });
      
      this.setState({
        zoom: level,
        session: { interactionsCount: this.state.session.interactionsCount + 1 }
      });
      
      this.notifyListeners('zoomChange', { level, query, result });
      return result;
    } catch (error) {
      this.notifyListeners('error', { type: 'zoom', error });
      throw error;
    } finally {
      this.setLoadingState('zoom', false);
    }
  }

  /**
   * Update pan filters
   */
  async setPan(panParams, query) {
    try {
      this.setLoadingState('pan', true);
      
      const result = await apiService.pan({ ...panParams, query });
      
      this.setState({
        pan: { ...this.state.pan, ...panParams },
        session: { interactionsCount: this.state.session.interactionsCount + 1 }
      });
      
      this.notifyListeners('panChange', { panParams, query, result });
      return result;
    } catch (error) {
      this.notifyListeners('error', { type: 'pan', error });
      throw error;
    } finally {
      this.setLoadingState('pan', false);
    }
  }

  /**
   * Update tilt style
   */
  async setTilt(style, query) {
    try {
      this.setLoadingState('tilt', true);
      
      const result = await apiService.tilt({ style, query });
      
      this.setState({
        tilt: style,
        session: { interactionsCount: this.state.session.interactionsCount + 1 }
      });
      
      this.notifyListeners('tiltChange', { style, query, result });
      return result;
    } catch (error) {
      this.notifyListeners('error', { type: 'tilt', error });
      throw error;
    } finally {
      this.setLoadingState('tilt', false);
    }
  }

  /**
   * Get current ZPT state as display string
   */
  getZptDisplayString() {
    const panDisplay = this.getPanDisplayString();
    return `${this.state.zoom}/${panDisplay}/${this.state.tilt}`;
  }

  /**
   * Get pan state as display string
   */
  getPanDisplayString() {
    const { domains, keywords, entities } = this.state.pan;
    const filters = [];
    
    if (domains?.length) filters.push(`domains:${domains.length}`);
    if (keywords?.length) filters.push(`keywords:${keywords.length}`);
    if (entities?.length) filters.push(`entities:${entities.length}`);
    
    return filters.length ? filters.join(',') : 'all';
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Start session timer
   */
  startSessionTimer() {
    this.updateInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - this.state.session.startTime) / 1000);
      this.setState({
        session: { ...this.state.session, duration }
      }, false); // Don't notify for timer updates
    }, 1000);
  }

  /**
   * Update session statistics
   */
  updateSessionStats(stats) {
    this.setState({
      session: { ...this.state.session, ...stats }
    });
  }

  /**
   * Format session duration for display
   */
  getFormattedDuration() {
    const { duration } = this.state.session;
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  // ===== CONNECTION MANAGEMENT =====

  /**
   * Start connection monitoring
   */
  startConnectionMonitor() {
    this.connectionCheckInterval = setInterval(async () => {
      await this.checkConnection();
    }, 10000); // Check every 10 seconds
    
    // Initial connection check
    this.checkConnection();
  }

  /**
   * Check server connection
   */
  async checkConnection() {
    try {
      const isConnected = await apiService.testConnection();
      
      this.setState({
        connection: {
          status: isConnected ? 'connected' : 'error',
          lastCheck: Date.now(),
          error: isConnected ? null : 'Connection failed'
        }
      });
      
      return isConnected;
    } catch (error) {
      this.setState({
        connection: {
          status: 'error',
          lastCheck: Date.now(),
          error: error.message
        }
      });
      return false;
    }
  }

  // ===== UI STATE MANAGEMENT =====

  /**
   * Toggle panel expansion
   */
  togglePanel(panelId) {
    const expandedPanels = new Set(this.state.ui.expandedPanels);
    
    if (expandedPanels.has(panelId)) {
      expandedPanels.delete(panelId);
    } else {
      expandedPanels.add(panelId);
    }
    
    this.setState({
      ui: { ...this.state.ui, expandedPanels }
    });
  }

  /**
   * Set loading state for specific operations
   */
  setLoadingState(operation, loading) {
    this.setState({
      ui: {
        ...this.state.ui,
        loadingStates: {
          ...this.state.ui.loadingStates,
          [operation]: loading
        }
      }
    });
  }

  /**
   * Get loading state for operation
   */
  isLoading(operation) {
    return Boolean(this.state.ui.loadingStates[operation]);
  }

  /**
   * Set active results for a verb
   */
  setActiveResults(verb, results) {
    this.setState({
      ui: {
        ...this.state.ui,
        activeResults: {
          ...this.state.ui.activeResults,
          [verb]: results
        }
      }
    });
  }

  // ===== EVENT MANAGEMENT =====

  /**
   * Subscribe to state changes
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  }

  /**
   * Notify event listeners
   */
  notifyListeners(event, data) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // ===== SERVER SYNC =====

  /**
   * Sync state with server
   */
  async syncWithServer() {
    try {
      const serverState = await apiService.getState();
      
      if (serverState.success && serverState.state) {
        const { state } = serverState;
        
        // Update ZPT state from server
        this.setState({
          zoom: state.zoom || this.state.zoom,
          pan: state.pan || this.state.pan,
          tilt: state.tilt || this.state.tilt
        }, false);
      }
    } catch (error) {
      console.warn('Failed to sync with server:', error.message);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    this.listeners.clear();
  }
}

// Create and export singleton instance
export const stateManager = new StateManager();

// Export class for testing or custom instances
export default StateManager;