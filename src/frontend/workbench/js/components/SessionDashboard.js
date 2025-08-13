/**
 * Session Dashboard Component
 * Manages the session cache visualization and system status display
 */

import { formatDuration, formatBytes, escapeHtml, showToast } from '../utils/domUtils.js';

/**
 * SessionDashboard manages the session cache display panel
 * Shows real-time session statistics, performance metrics, and system status
 */
export class SessionDashboard {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        this.updateInterval = null;
        this.isExpanded = true;
        
        // Bind methods
        this.update = this.update.bind(this);
        this.toggleExpansion = this.toggleExpansion.bind(this);
        this.clearSession = this.clearSession.bind(this);
        this.refreshSession = this.refreshSession.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize component and start auto-updates
     */
    initialize() {
        this.render();
        this.startAutoUpdate();
        
        // Listen for state changes
        this.stateManager.on('sessionCacheUpdated', this.update);
        this.stateManager.on('performanceRecorded', this.update);
        this.stateManager.on('connectionChanged', this.update);
    }
    
    /**
     * Initialize event listeners for UI interactions
     */
    initializeEventListeners() {
        document.addEventListener('click', (event) => {
            if (event.target.matches('#session-toggle')) {
                event.preventDefault();
                this.toggleExpansion();
            }
            
            if (event.target.matches('#clear-session')) {
                event.preventDefault();
                this.clearSession();
            }
            
            if (event.target.matches('#refresh-session')) {
                event.preventDefault();
                this.refreshSession();
            }
        });
    }
    
    /**
     * Start automatic updates
     */
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.update();
        }, 2000); // Update every 2 seconds
    }
    
    /**
     * Stop automatic updates
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    /**
     * Update dashboard display with current state
     */
    update() {
        const summary = this.stateManager.getSummary();
        const performance = this.stateManager.getPerformanceMetrics();
        
        this.updateSessionStats(summary.sessionCache);
        this.updatePerformanceMetrics(performance);
        this.updateConnectionStatus(summary.connection);
        this.updateZPTStatus(summary.zpt);
    }
    
    /**
     * Render initial dashboard HTML
     */
    render() {
        const dashboardElement = document.getElementById('session-dashboard');
        if (!dashboardElement) {
            console.error('Session dashboard element not found');
            return;
        }
        
        dashboardElement.innerHTML = `
            <div class="dashboard-header">
                <h3>
                    <button id="session-toggle" class="toggle-btn" title="Toggle session dashboard">
                        <span class="toggle-icon">${this.isExpanded ? '▼' : '▶'}</span>
                        Session Cache
                    </button>
                </h3>
                <div class="dashboard-actions">
                    <button id="refresh-session" class="action-btn" title="Refresh session data">
                        🔄
                    </button>
                    <button id="clear-session" class="action-btn warning" title="Clear session cache">
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="dashboard-content" ${this.isExpanded ? '' : 'style="display: none;"'}>
                <div class="stats-grid">
                    <div class="stat-group">
                        <h4>Cache Statistics</h4>
                        <div id="cache-stats" class="stats-list">
                            <div class="stat-item">
                                <span class="stat-label">Interactions:</span>
                                <span id="interactions-count" class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Concepts:</span>
                                <span id="concepts-count" class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Embeddings:</span>
                                <span id="embeddings-count" class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Cache Size:</span>
                                <span id="cache-size" class="stat-value">0 B</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Last Updated:</span>
                                <span id="last-updated" class="stat-value">Never</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-group">
                        <h4>Performance</h4>
                        <div id="performance-stats" class="stats-list">
                            <div class="stat-item">
                                <span class="stat-label">Operations:</span>
                                <span id="total-operations" class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Session Time:</span>
                                <span id="session-duration" class="stat-value">0ms</span>
                            </div>
                            <div id="operation-times" class="operation-times"></div>
                        </div>
                    </div>
                    
                    <div class="stat-group">
                        <h4>Connection</h4>
                        <div id="connection-stats" class="stats-list">
                            <div class="stat-item">
                                <span class="stat-label">Status:</span>
                                <span id="connection-status" class="stat-value status">Disconnected</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Last Ping:</span>
                                <span id="last-ping" class="stat-value">Never</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Server:</span>
                                <span id="server-info" class="stat-value">Unknown</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-group">
                        <h4>ZPT State</h4>
                        <div id="zpt-stats" class="stats-list">
                            <div class="stat-item">
                                <span class="stat-label">Zoom:</span>
                                <span id="zpt-zoom" class="stat-value">entity</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Tilt:</span>
                                <span id="zpt-tilt" class="stat-value">keywords</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Filters:</span>
                                <span id="zpt-filters" class="stat-value">None</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Query:</span>
                                <span id="zpt-query" class="stat-value">None</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initial update
        this.update();
    }
    
    /**
     * Update session cache statistics
     * @param {object} cacheStats - Session cache statistics
     */
    updateSessionStats(cacheStats) {
        const elements = {
            interactions: document.getElementById('interactions-count'),
            concepts: document.getElementById('concepts-count'),
            embeddings: document.getElementById('embeddings-count'),
            cacheSize: document.getElementById('cache-size'),
            lastUpdated: document.getElementById('last-updated')
        };
        
        if (elements.interactions) elements.interactions.textContent = cacheStats.interactions;
        if (elements.concepts) elements.concepts.textContent = cacheStats.concepts;
        if (elements.embeddings) elements.embeddings.textContent = cacheStats.embeddings;
        if (elements.cacheSize) elements.cacheSize.textContent = formatBytes(cacheStats.size);
        if (elements.lastUpdated) elements.lastUpdated.textContent = cacheStats.lastUpdated;
    }
    
    /**
     * Update performance metrics display
     * @param {object} performance - Performance metrics
     */
    updatePerformanceMetrics(performance) {
        const totalOpsElement = document.getElementById('total-operations');
        const durationElement = document.getElementById('session-duration');
        const operationTimesElement = document.getElementById('operation-times');
        
        if (totalOpsElement) {
            totalOpsElement.textContent = performance.totalOperations || 0;
        }
        
        if (durationElement && performance.sessionDuration !== undefined) {
            durationElement.textContent = formatDuration(performance.sessionDuration);
        }
        
        if (operationTimesElement && performance.operations) {
            const operationHTML = Object.entries(performance.operations)
                .map(([op, metrics]) => {
                    const trendIcon = this.getTrendIcon(metrics.recentTrend);
                    return `
                        <div class="operation-metric">
                            <span class="op-name">${op}:</span>
                            <span class="op-time" title="${metrics.totalCalls} calls">
                                ${metrics.formattedAverage} ${trendIcon}
                            </span>
                        </div>
                    `;
                })
                .join('');
            
            operationTimesElement.innerHTML = operationHTML;
        }
    }
    
    /**
     * Get trend icon for performance metrics
     * @param {string} trend - Trend indicator
     * @returns {string} - Trend icon
     */
    getTrendIcon(trend) {
        switch (trend) {
            case 'improving': return '📈';
            case 'degrading': return '📉';
            default: return '📊';
        }
    }
    
    /**
     * Update connection status display
     * @param {object} connection - Connection status
     */
    updateConnectionStatus(connection) {
        const statusElement = document.getElementById('connection-status');
        const pingElement = document.getElementById('last-ping');
        const serverElement = document.getElementById('server-info');
        
        if (statusElement) {
            statusElement.textContent = connection.isConnected ? 'Connected' : 'Disconnected';
            statusElement.className = `stat-value status ${connection.isConnected ? 'connected' : 'disconnected'}`;
        }
        
        if (pingElement) {
            pingElement.textContent = connection.lastPing;
        }
        
        if (serverElement) {
            const serverInfo = connection.serverInfo;
            if (serverInfo) {
                serverElement.textContent = `${serverInfo.name || 'MCP Server'} v${serverInfo.version || 'unknown'}`;
                serverElement.title = JSON.stringify(serverInfo.capabilities || [], null, 2);
            } else {
                serverElement.textContent = 'Unknown';
                serverElement.title = '';
            }
        }
    }
    
    /**
     * Update ZPT navigation state display
     * @param {object} zpt - ZPT state
     */
    updateZPTStatus(zpt) {
        const zoomElement = document.getElementById('zpt-zoom');
        const tiltElement = document.getElementById('zpt-tilt');
        const filtersElement = document.getElementById('zpt-filters');
        const queryElement = document.getElementById('zpt-query');
        
        if (zoomElement) {
            zoomElement.textContent = zpt.zoom || 'entity';
        }
        
        if (tiltElement) {
            tiltElement.textContent = zpt.tilt || 'keywords';
        }
        
        if (filtersElement && zpt.pan) {
            const filters = [];
            if (zpt.pan.domains && zpt.pan.domains.length > 0) {
                filters.push(`domains: ${zpt.pan.domains.length}`);
            }
            if (zpt.pan.keywords && zpt.pan.keywords.length > 0) {
                filters.push(`keywords: ${zpt.pan.keywords.length}`);
            }
            if (zpt.pan.entities && zpt.pan.entities.length > 0) {
                filters.push(`entities: ${zpt.pan.entities.length}`);
            }
            
            filtersElement.textContent = filters.length > 0 ? filters.join(', ') : 'None';
        }
        
        if (queryElement) {
            const query = zpt.query || '';
            queryElement.textContent = query.length > 30 ? query.substring(0, 30) + '...' : query || 'None';
            queryElement.title = query;
        }
    }
    
    /**
     * Toggle dashboard expansion
     */
    toggleExpansion() {
        this.isExpanded = !this.isExpanded;
        
        const content = document.querySelector('.dashboard-content');
        const toggleIcon = document.querySelector('.toggle-icon');
        
        if (content) {
            content.style.display = this.isExpanded ? 'block' : 'none';
        }
        
        if (toggleIcon) {
            toggleIcon.textContent = this.isExpanded ? '▼' : '▶';
        }
        
        // Update state manager
        const expandedPanels = this.stateManager.get('ui.expandedPanels');
        if (this.isExpanded) {
            expandedPanels.add('session-dashboard');
        } else {
            expandedPanels.delete('session-dashboard');
        }
        
        this.stateManager.set('ui.expandedPanels', expandedPanels);
    }
    
    /**
     * Clear session cache
     */
    async clearSession() {
        if (!confirm('Are you sure you want to clear the session cache? This will remove all stored interactions and concepts.')) {
            return;
        }
        
        try {
            // Reset state manager session cache
            this.stateManager.updateSessionCache({
                interactions: {},
                concepts: [],
                embeddings: {},
                size: 0
            });
            
            showToast('Session cache cleared', 'success');
            this.update();
        } catch (error) {
            console.error('Error clearing session:', error);
            showToast('Failed to clear session cache', 'error');
        }
    }
    
    /**
     * Refresh session data from server
     */
    async refreshSession() {
        try {
            // Test connection and get server info
            const connection = await this.apiService.testConnection();
            this.stateManager.updateConnection(connection);
            
            // Try to inspect session state if available
            try {
                const sessionData = await this.apiService.inspect('session', true);
                if (sessionData.success && sessionData.data) {
                    this.stateManager.updateSessionCache({
                        interactions: sessionData.data.interactions || {},
                        concepts: sessionData.data.concepts || [],
                        embeddings: sessionData.data.embeddings || {},
                        size: sessionData.data.size || 0
                    });
                }
            } catch (inspectError) {
                // Inspect might not be available via REST API
                console.log('Session inspect not available via REST API');
            }
            
            showToast('Session data refreshed', 'success');
            this.update();
        } catch (error) {
            console.error('Error refreshing session:', error);
            showToast('Failed to refresh session data', 'error');
        }
    }
    
    /**
     * Destroy component and cleanup
     */
    destroy() {
        this.stopAutoUpdate();
        this.stateManager.off('sessionCacheUpdated', this.update);
        this.stateManager.off('performanceRecorded', this.update);
        this.stateManager.off('connectionChanged', this.update);
    }
}