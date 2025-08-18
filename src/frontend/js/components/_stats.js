/**
 * Statistics Component - Display storage and vocabulary statistics
 */

import log from 'loglevel';

const logger = log.getLogger('stats');

class StatsComponent {
    constructor() {
        this.initialized = false;
        this.refreshButton = null;
        this.lastUpdatedSpan = null;
        this.errorDiv = null;
        this.loadingDiv = null;
        
        // Stat value elements
        this.statElements = {};
        
        // Auto-refresh interval (5 minutes)
        this.autoRefreshInterval = null;
        this.autoRefreshMs = 5 * 60 * 1000;
    }

    /**
     * Initialize the stats component
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Get DOM elements
            this.refreshButton = document.getElementById('refresh-stats-btn');
            this.lastUpdatedSpan = document.getElementById('stats-last-updated');
            this.errorDiv = document.getElementById('stats-error');
            this.loadingDiv = document.getElementById('stats-loading');
            
            // Cache all stat value elements
            this.cacheStatElements();
            
            // Set up event listeners
            if (this.refreshButton) {
                this.refreshButton.addEventListener('click', () => this.refreshStats());
            }
            
            // Load initial stats
            await this.refreshStats();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            this.initialized = true;
            logger.info('Stats component initialized');
        } catch (error) {
            logger.error('Failed to initialize stats component:', error);
            this.showError('Failed to initialize statistics component');
        }
    }

    /**
     * Cache stat element references for better performance
     */
    cacheStatElements() {
        const statIds = [
            'stat-storage-type',
            'stat-total-items', 
            'stat-storage-size',
            'stat-memory-prompts',
            'stat-memory-responses', 
            'stat-memory-embeddings',
            'stat-rdf-triples',
            'stat-rdf-graphs',
            'stat-rdf-entities',
            'stat-rdf-relationships',
            'stat-search-indexed',
            'stat-search-dimension',
            'stat-search-type'
        ];
        
        statIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.statElements[id] = element;
            }
        });
        
        // Special elements
        this.sparqlStatsSection = document.getElementById('sparql-stats-section');
        this.recentActivityTable = document.getElementById('recent-activity-table');
    }

    /**
     * Refresh statistics from the API
     */
    async refreshStats() {
        try {
            this.showLoading(true);
            this.hideError();
            
            logger.info('Fetching statistics...');
            
            const response = await fetch('/api/stats', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch statistics');
            }

            this.updateStatsDisplay(result.data);
            this.updateLastUpdated(result.data.lastUpdated);
            
            logger.info('Statistics updated successfully');
            
        } catch (error) {
            logger.error('Error fetching statistics:', error);
            this.showError(`Error fetching statistics: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Update the statistics display with new data
     */
    updateStatsDisplay(data) {
        // Storage type
        this.updateStat('stat-storage-type', data.storage?.type || 'Unknown');
        
        // Search statistics
        if (data.search) {
            this.updateStat('stat-search-indexed', data.search.indexedItems || 0);
            this.updateStat('stat-search-dimension', data.search.dimension || 'N/A');
            this.updateStat('stat-search-type', data.search.indexType || 'N/A');
        }
        
        // SPARQL statistics (main focus)
        if (data.sparql) {
            // Show SPARQL section
            if (this.sparqlStatsSection) {
                this.sparqlStatsSection.style.display = 'block';
            }
            
            // Update SPARQL stats
            this.updateStat('stat-rdf-triples', this.formatNumber(data.sparql.totalTriples || 0));
            this.updateStat('stat-rdf-graphs', this.formatNumber(data.sparql.namedGraphs || 0));
            this.updateStat('stat-rdf-entities', this.formatNumber(data.sparql.ragnoEntities || 0));
            this.updateStat('stat-rdf-relationships', this.formatNumber(data.sparql.ragnoRelationships || 0));
            
            // Update memory-related stats
            this.updateStat('stat-memory-prompts', this.formatNumber(data.sparql.memoryItems || 0));
            this.updateStat('stat-memory-responses', this.formatNumber(data.sparql.memoryItems || 0)); // Same count
            this.updateStat('stat-memory-embeddings', this.formatNumber(data.sparql.resourcesWithEmbeddings || 0));
            
            // Calculate and show totals
            const totalItems = (data.sparql.ragnoEntities || 0) + 
                             (data.sparql.ragnoRelationships || 0) + 
                             (data.sparql.memoryItems || 0) +
                             (data.sparql.zptResources || 0);
            this.updateStat('stat-total-items', this.formatNumber(totalItems));
            
            // Update recent activity table
            this.updateRecentActivityTable(data.sparql.recentActivity || []);
        } else {
            // Hide SPARQL section if not using SPARQL store
            if (this.sparqlStatsSection) {
                this.sparqlStatsSection.style.display = 'none';
            }
            
            // Set default values
            this.updateStat('stat-total-items', '0');
            this.updateStat('stat-memory-prompts', '0');
            this.updateStat('stat-memory-responses', '0');
            this.updateStat('stat-memory-embeddings', '0');
        }
        
        // Storage size estimation (basic calculation)
        const storageSize = this.estimateStorageSize(data);
        this.updateStat('stat-storage-size', storageSize);
    }

    /**
     * Update a single stat element
     */
    updateStat(elementId, value) {
        const element = this.statElements[elementId];
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Update the recent activity table
     */
    updateRecentActivityTable(activities) {
        if (!this.recentActivityTable) return;
        
        const tbody = this.recentActivityTable.querySelector('tbody');
        if (!tbody) return;
        
        // Clear existing rows
        tbody.innerHTML = '';
        
        if (activities.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.className = 'no-data';
            cell.textContent = 'No recent activity';
            return;
        }
        
        // Add activity rows
        activities.forEach(activity => {
            const row = tbody.insertRow();
            
            // Type
            const typeCell = row.insertCell();
            typeCell.textContent = activity.type;
            
            // Count
            const countCell = row.insertCell();
            countCell.textContent = this.formatNumber(activity.count);
            
            // Last Updated
            const timeCell = row.insertCell();
            timeCell.textContent = this.formatDateTime(activity.lastUpdated);
        });
    }

    /**
     * Estimate storage size based on item counts
     */
    estimateStorageSize(data) {
        if (data.sparql) {
            // Rough estimation: each triple ~100 bytes on average
            const triples = data.sparql.totalTriples || 0;
            const bytes = triples * 100;
            return this.formatBytes(bytes);
        }
        return 'Unknown';
    }

    /**
     * Format large numbers with commas
     */
    formatNumber(num) {
        if (typeof num !== 'number') return num;
        return num.toLocaleString();
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format datetime for display
     */
    formatDateTime(isoString) {
        if (!isoString) return 'Unknown';
        try {
            const date = new Date(isoString);
            return date.toLocaleString();
        } catch (error) {
            return 'Invalid date';
        }
    }

    /**
     * Update the last updated timestamp
     */
    updateLastUpdated(timestamp) {
        if (this.lastUpdatedSpan && timestamp) {
            this.lastUpdatedSpan.textContent = `Last updated: ${this.formatDateTime(timestamp)}`;
        }
    }

    /**
     * Show loading indicator
     */
    showLoading(show) {
        if (this.loadingDiv) {
            this.loadingDiv.classList.toggle('hidden', !show);
        }
        if (this.refreshButton) {
            this.refreshButton.disabled = show;
            this.refreshButton.textContent = show ? 'Loading...' : 'Refresh Statistics';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.errorDiv) {
            this.errorDiv.textContent = message;
            this.errorDiv.classList.remove('hidden');
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        if (this.errorDiv) {
            this.errorDiv.classList.add('hidden');
        }
    }

    /**
     * Set up auto-refresh interval
     */
    setupAutoRefresh() {
        // Clear existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Set new interval
        this.autoRefreshInterval = setInterval(() => {
            logger.debug('Auto-refreshing statistics...');
            this.refreshStats();
        }, this.autoRefreshMs);
    }

    /**
     * Cleanup when component is destroyed
     */
    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        this.initialized = false;
    }
}

// Create and export singleton instance
const statsComponent = new StatsComponent();

export default statsComponent;