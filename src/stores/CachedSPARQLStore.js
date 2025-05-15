import SPARQLStore from './SPARQLStore.js';
import { logger } from '../Utils.js';

export default class CachedSPARQLStore extends SPARQLStore {
    constructor(endpoint, options = {}) {
        super(endpoint, options);
        
        // Cache configuration
        this.cacheEnabled = options.cacheEnabled ?? true;
        this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default
        this.maxCacheSize = options.maxCacheSize || 100;
        
        // Initialize cache
        this.queryCache = new Map();
        this.cacheTimestamps = new Map();
        
        // Start cache cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanupCache();
        }, this.cacheTTL / 2);
    }

    async _executeSparqlQuery(query, endpoint) {
        if (!this.cacheEnabled) {
            return super._executeSparqlQuery(query, endpoint);
        }

        const cacheKey = this._generateCacheKey(query);

        // Check cache
        const cachedResult = this.queryCache.get(cacheKey);
        if (cachedResult) {
            const timestamp = this.cacheTimestamps.get(cacheKey);
            if (Date.now() - timestamp < this.cacheTTL) {
                logger.debug('Cache hit:', cacheKey);
                return JSON.parse(JSON.stringify(cachedResult)); // Deep clone
            }
        }

        // Execute query
        const result = await super._executeSparqlQuery(query, endpoint);
        
        // Cache result
        this.queryCache.set(cacheKey, result);
        this.cacheTimestamps.set(cacheKey, Date.now());
        
        // Manage cache size
        if (this.queryCache.size > this.maxCacheSize) {
            this.cleanupCache();
        }

        return result;
    }

    _generateCacheKey(query) {
        // Normalize query by removing whitespace
        return query.replace(/\s+/g, ' ').trim();
    }

    cleanupCache() {
        const now = Date.now();

        // Remove expired entries
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.cacheTTL) {
                this.queryCache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        }

        // If still over size limit, remove oldest entries
        while (this.queryCache.size > this.maxCacheSize) {
            let oldestKey = null;
            let oldestTime = Infinity;

            for (const [key, timestamp] of this.cacheTimestamps.entries()) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.queryCache.delete(oldestKey);
                this.cacheTimestamps.delete(oldestKey);
            }
        }
    }

    invalidateCache() {
        this.queryCache.clear();
        this.cacheTimestamps.clear();
    }

    async saveMemoryToHistory(memoryStore) {
        // Invalidate cache when data changes
        this.invalidateCache();
        return super.saveMemoryToHistory(memoryStore);
    }

    async close() {
        if (this.cleanupInterval && typeof clearInterval === 'function') {
            try {
                clearInterval(this.cleanupInterval);
            } catch (error) {
                console.warn('Failed to clear interval:', error);
            }
        }
        
        this.invalidateCache();
        return super.close();
    }
}
