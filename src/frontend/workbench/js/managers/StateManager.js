/**
 * State Manager for Semantic Memory Workbench
 * Manages session data, ZPT navigation state, performance metrics, and localStorage persistence
 */

import { formatDuration } from '../utils/domUtils.js';

/**
 * Workbench application state manager
 * Handles session cache, ZPT navigation state, performance tracking, and persistence
 */
export class StateManager {
    constructor() {
        this.state = {
            // Session cache data
            sessionCache: {
                interactions: new Map(),
                concepts: new Set(),
                embeddings: new Map(),
                lastUpdated: null,
                size: 0
            },
            
            // ZPT (Zoom-Pan-Tilt) navigation state
            zpt: {
                zoom: 'entity',      // Current abstraction level
                pan: {               // Domain filters
                    domains: [],
                    keywords: [],
                    entities: [],
                    temporal: {}
                },
                tilt: 'keywords',    // Current view perspective
                query: '',           // Current navigation query
                lastModified: Date.now()
            },
            
            // Performance metrics tracking
            performance: {
                operationTimes: new Map(),
                averageTimes: new Map(),
                totalOperations: 0,
                sessionStartTime: Date.now(),
                lastOperationTime: null
            },
            
            // UI state
            ui: {
                activeTab: 'tell',
                loadingState: {
                    isLoading: false,
                    message: '',
                    operation: null
                },
                notifications: [],
                expandedPanels: new Set(['session-dashboard'])
            },
            
            // Server connection state
            connection: {
                isConnected: false,
                serverInfo: null,
                lastPing: null,
                connectionHistory: []
            }
        };
        
        this.listeners = new Map();
        this.storageKey = 'semem-workbench-state';
        
        // Initialize state from localStorage
        this.loadFromStorage();
    }
    
    /**
     * Get current state or specific state path
     * @param {string} path - Optional dot-notation path to specific state
     * @returns {any} - State value
     */
    get(path = null) {
        if (!path) return this.state;
        
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, this.state);
    }
    
    /**
     * Set state value at specific path
     * @param {string} path - Dot-notation path to state property
     * @param {any} value - Value to set
     * @param {boolean} persist - Whether to persist to localStorage
     */
    set(path, value, persist = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        // Navigate to parent object
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.state);
        
        // Set the value
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // Emit change event
        this.emit('stateChange', { path, value, oldValue });
        
        // Persist to localStorage if requested
        if (persist) {
            this.saveToStorage();
        }
    }
    
    /**
     * Update session cache data
     * @param {object} cacheData - Session cache update data
     */
    updateSessionCache(cacheData) {
        const cache = this.state.sessionCache;
        
        if (cacheData.interactions) {
            cache.interactions.clear();
            Object.entries(cacheData.interactions).forEach(([key, value]) => {
                cache.interactions.set(key, value);
            });
        }
        
        if (cacheData.concepts) {
            cache.concepts.clear();
            cacheData.concepts.forEach(concept => cache.concepts.add(concept));
        }
        
        if (cacheData.embeddings) {
            cache.embeddings.clear();
            Object.entries(cacheData.embeddings).forEach(([key, value]) => {
                cache.embeddings.set(key, value);
            });
        }
        
        cache.size = cacheData.size || 0;
        cache.lastUpdated = Date.now();
        
        this.emit('sessionCacheUpdated', cache);
        this.saveToStorage();
    }
    
    /**
     * Update ZPT navigation state
     * @param {object} zptUpdate - ZPT state updates
     */
    updateZPT(zptUpdate) {
        const zpt = this.state.zpt;
        
        if (zptUpdate.zoom !== undefined) {
            zpt.zoom = zptUpdate.zoom;
        }
        
        if (zptUpdate.pan !== undefined) {
            Object.assign(zpt.pan, zptUpdate.pan);
        }
        
        if (zptUpdate.tilt !== undefined) {
            zpt.tilt = zptUpdate.tilt;
        }
        
        if (zptUpdate.query !== undefined) {
            zpt.query = zptUpdate.query;
        }
        
        zpt.lastModified = Date.now();
        
        this.emit('zptStateChanged', zpt);
        this.saveToStorage();
    }
    
    /**
     * Record operation performance metrics
     * @param {string} operation - Operation name (tell, ask, zoom, etc.)
     * @param {number} duration - Operation duration in milliseconds
     * @param {object} metadata - Additional performance metadata
     */
    recordPerformance(operation, duration, metadata = {}) {
        const perf = this.state.performance;
        
        // Store individual operation time
        if (!perf.operationTimes.has(operation)) {
            perf.operationTimes.set(operation, []);
        }
        perf.operationTimes.get(operation).push({
            duration,
            timestamp: Date.now(),
            ...metadata
        });
        
        // Keep only last 100 operations per type
        const times = perf.operationTimes.get(operation);
        if (times.length > 100) {
            times.splice(0, times.length - 100);
        }
        
        // Calculate average time
        const avgDuration = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
        perf.averageTimes.set(operation, avgDuration);
        
        perf.totalOperations++;
        perf.lastOperationTime = Date.now();
        
        this.emit('performanceRecorded', { operation, duration, avgDuration });
        this.saveToStorage();
    }
    
    /**
     * Get performance metrics for specific operation
     * @param {string} operation - Operation name
     * @returns {object} - Performance metrics
     */
    getPerformanceMetrics(operation = null) {
        const perf = this.state.performance;
        
        if (operation) {
            const times = perf.operationTimes.get(operation) || [];
            const avgTime = perf.averageTimes.get(operation) || 0;
            
            return {
                operation,
                totalCalls: times.length,
                averageDuration: avgTime,
                lastDuration: times.length > 0 ? times[times.length - 1].duration : 0,
                formattedAverage: formatDuration(avgTime),
                recentTrend: this.calculateTrend(times.slice(-10))
            };
        }
        
        // Return all metrics
        const metrics = {};
        for (const [op, times] of perf.operationTimes.entries()) {
            metrics[op] = this.getPerformanceMetrics(op);
        }
        
        return {
            operations: metrics,
            totalOperations: perf.totalOperations,
            sessionDuration: Date.now() - perf.sessionStartTime,
            lastOperationTime: perf.lastOperationTime
        };
    }
    
    /**
     * Calculate performance trend for recent operations
     * @param {Array} recentTimes - Array of recent operation times
     * @returns {string} - Trend indicator ('improving', 'stable', 'degrading')
     */
    calculateTrend(recentTimes) {
        if (recentTimes.length < 5) return 'stable';
        
        const firstHalf = recentTimes.slice(0, Math.floor(recentTimes.length / 2));
        const secondHalf = recentTimes.slice(Math.floor(recentTimes.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, t) => sum + t.duration, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, t) => sum + t.duration, 0) / secondHalf.length;
        
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (change < -10) return 'improving';
        if (change > 10) return 'degrading';
        return 'stable';
    }
    
    /**
     * Update server connection state
     * @param {object} connectionInfo - Connection information
     */
    updateConnection(connectionInfo) {
        const conn = this.state.connection;
        
        conn.isConnected = connectionInfo.isConnected;
        conn.serverInfo = connectionInfo.serverInfo || null;
        conn.lastPing = Date.now();
        
        // Track connection history
        conn.connectionHistory.push({
            timestamp: Date.now(),
            connected: connectionInfo.isConnected,
            latency: connectionInfo.latency || null
        });
        
        // Keep only last 50 connection events
        if (conn.connectionHistory.length > 50) {
            conn.connectionHistory.splice(0, conn.connectionHistory.length - 50);
        }
        
        this.emit('connectionChanged', conn);
    }
    
    /**
     * Update UI state
     * @param {string} component - UI component name
     * @param {object} updates - State updates
     */
    updateUI(component, updates) {
        if (!this.state.ui[component]) {
            this.state.ui[component] = {};
        }
        
        Object.assign(this.state.ui[component], updates);
        this.emit('uiStateChanged', { component, updates });
        
        // Don't persist loading states
        if (component !== 'loadingState') {
            this.saveToStorage();
        }
    }
    
    /**
     * Set loading state
     * @param {boolean} isLoading - Loading status
     * @param {string} message - Loading message
     * @param {string} operation - Current operation
     */
    setLoading(isLoading, message = '', operation = null) {
        this.state.ui.loadingState = {
            isLoading,
            message,
            operation,
            startTime: isLoading ? Date.now() : null
        };
        
        this.emit('loadingStateChanged', this.state.ui.loadingState);
    }
    
    /**
     * Add notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, error, warning)
     * @param {number} duration - Auto-dismiss duration in ms
     */
    addNotification(message, type = 'info', duration = 5000) {
        const notification = {
            id: Date.now().toString(),
            message,
            type,
            timestamp: Date.now(),
            duration
        };
        
        this.state.ui.notifications.push(notification);
        this.emit('notificationAdded', notification);
        
        // Auto-remove notification
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, duration);
        }
    }
    
    /**
     * Remove notification
     * @param {string} id - Notification ID
     */
    removeNotification(id) {
        const index = this.state.ui.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
            const notification = this.state.ui.notifications.splice(index, 1)[0];
            this.emit('notificationRemoved', notification);
        }
    }
    
    /**
     * Clear all notifications
     */
    clearNotifications() {
        this.state.ui.notifications = [];
        this.emit('notificationsCleared');
    }
    
    /**
     * Reset state to initial values
     * @param {boolean} keepPerformance - Whether to preserve performance metrics
     */
    reset(keepPerformance = false) {
        const performance = keepPerformance ? this.state.performance : {
            operationTimes: new Map(),
            averageTimes: new Map(),
            totalOperations: 0,
            sessionStartTime: Date.now(),
            lastOperationTime: null
        };
        
        this.state = {
            sessionCache: {
                interactions: new Map(),
                concepts: new Set(),
                embeddings: new Map(),
                lastUpdated: null,
                size: 0
            },
            zpt: {
                zoom: 'entity',
                pan: {
                    domains: [],
                    keywords: [],
                    entities: [],
                    temporal: {}
                },
                tilt: 'keywords',
                query: '',
                lastModified: Date.now()
            },
            performance,
            ui: {
                activeTab: 'tell',
                loadingState: {
                    isLoading: false,
                    message: '',
                    operation: null
                },
                notifications: [],
                expandedPanels: new Set(['session-dashboard'])
            },
            connection: {
                isConnected: false,
                serverInfo: null,
                lastPing: null,
                connectionHistory: []
            }
        };
        
        this.emit('stateReset');
        this.saveToStorage();
    }
    
    /**
     * Load state from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                
                // Restore serializable data
                if (data.zpt) this.state.zpt = data.zpt;
                if (data.ui) {
                    this.state.ui = {
                        ...this.state.ui,
                        ...data.ui,
                        // Ensure Sets are properly restored
                        expandedPanels: new Set(data.ui.expandedPanels || [])
                    };
                }
                if (data.connection) this.state.connection = data.connection;
                
                // Restore performance data
                if (data.performance) {
                    this.state.performance = {
                        ...this.state.performance,
                        ...data.performance,
                        // Restore Maps
                        operationTimes: new Map(data.performance.operationTimes || []),
                        averageTimes: new Map(data.performance.averageTimes || [])
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to load state from storage:', error);
        }
    }
    
    /**
     * Save current state to localStorage
     */
    saveToStorage() {
        try {
            const toSave = {
                zpt: this.state.zpt,
                ui: {
                    ...this.state.ui,
                    // Convert Set to Array for serialization
                    expandedPanels: Array.from(this.state.ui.expandedPanels),
                    // Don't persist notifications or loading state
                    notifications: [],
                    loadingState: {
                        isLoading: false,
                        message: '',
                        operation: null
                    }
                },
                connection: this.state.connection,
                performance: {
                    ...this.state.performance,
                    // Convert Maps to Arrays for serialization
                    operationTimes: Array.from(this.state.performance.operationTimes.entries()),
                    averageTimes: Array.from(this.state.performance.averageTimes.entries())
                }
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
        } catch (error) {
            console.warn('Failed to save state to storage:', error);
        }
    }
    
    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * Emit event to all listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Get state summary for debugging
     * @returns {object} - State summary
     */
    getSummary() {
        const cache = this.state.sessionCache;
        const perf = this.state.performance;
        const conn = this.state.connection;
        
        return {
            sessionCache: {
                interactions: cache.interactions.size,
                concepts: cache.concepts.size,
                embeddings: cache.embeddings.size,
                size: cache.size,
                lastUpdated: cache.lastUpdated ? new Date(cache.lastUpdated).toLocaleTimeString() : 'Never'
            },
            zpt: {
                ...this.state.zpt,
                lastModified: new Date(this.state.zpt.lastModified).toLocaleTimeString()
            },
            performance: {
                totalOperations: perf.totalOperations,
                sessionDuration: formatDuration(Date.now() - perf.sessionStartTime),
                operationTypes: Array.from(perf.operationTimes.keys()),
                lastOperation: perf.lastOperationTime ? new Date(perf.lastOperationTime).toLocaleTimeString() : 'None'
            },
            connection: {
                isConnected: conn.isConnected,
                serverInfo: conn.serverInfo,
                lastPing: conn.lastPing ? new Date(conn.lastPing).toLocaleTimeString() : 'Never',
                connectionEvents: conn.connectionHistory.length
            },
            ui: {
                activeTab: this.state.ui.activeTab,
                expandedPanels: Array.from(this.state.ui.expandedPanels),
                notifications: this.state.ui.notifications.length,
                isLoading: this.state.ui.loadingState.isLoading
            }
        };
    }
}