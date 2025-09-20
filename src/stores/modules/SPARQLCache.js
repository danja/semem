import dotenv from 'dotenv';
import Config from '../../Config.js';
import { MEMORY_CONFIG } from '../../../config/preferences.js';
import logger from 'loglevel';

dotenv.config();

/**
 * SPARQLCache module handles query result caching and memory management
 * This module manages the in-memory cache of SPARQL data to avoid frequent queries
 */
export class SPARQLCache {
    constructor(options = {}) {
        this.config = new Config();

        // Cache configuration from preferences
        this.cacheTimeoutMs = options.cacheTimeoutMs || MEMORY_CONFIG.CACHE_TIMEOUT_MS;
        this.maxCacheSize = options.maxCacheSize || MEMORY_CONFIG.MAX_CACHE_SIZE;

        // Memory cache structure
        this._memoryCache = {
            loaded: false,
            lastLoaded: 0,
            cacheTimeoutMs: this.cacheTimeoutMs,
            data: {
                shortTermMemory: [],
                longTermMemory: [],
                embeddings: [],
                timestamps: [],
                accessCounts: [],
                conceptsList: []
            }
        };

        // Query result cache for SPARQL queries
        this._queryCache = new Map();
        this._queryCacheMetadata = new Map(); // Stores timestamp and TTL for each cached query

        // Index persistence timer for debounced saves
        this._indexPersistenceTimer = null;

        logger.info('SPARQLCache initialized');
    }

    /**
     * Check if memory cache is valid and current
     * @returns {boolean} True if cache is valid
     */
    isMemoryCacheValid() {
        const now = Date.now();
        return this._memoryCache.loaded &&
               (now - this._memoryCache.lastLoaded) < this._memoryCache.cacheTimeoutMs;
    }

    /**
     * Get cached memory data
     * @returns {Object} Cached memory data or null if invalid
     */
    getCachedMemoryData() {
        if (this.isMemoryCacheValid()) {
            return this._memoryCache.data;
        }
        return null;
    }

    /**
     * Update memory cache with fresh data
     * @param {Object} memoryData - Memory data to cache
     */
    updateMemoryCache(memoryData) {
        const now = Date.now();

        this._memoryCache.data = {
            shortTermMemory: memoryData.shortTermMemory || [],
            longTermMemory: memoryData.longTermMemory || [],
            embeddings: memoryData.embeddings || [],
            timestamps: memoryData.timestamps || [],
            accessCounts: memoryData.accessCounts || [],
            conceptsList: memoryData.conceptsList || []
        };

        this._memoryCache.loaded = true;
        this._memoryCache.lastLoaded = now;

        logger.info(`Updated memory cache with ${this._memoryCache.data.shortTermMemory.length} short-term memories`);
    }

    /**
     * Add new interaction to memory cache
     * @param {Object} interaction - Interaction to add
     */
    addToMemoryCache(interaction) {
        if (!this._memoryCache.loaded) {
            logger.warn('Attempting to add to unloaded memory cache');
            return;
        }

        const cache = this._memoryCache.data;
        cache.shortTermMemory.push(interaction);
        cache.embeddings.push(interaction.embedding || []);
        cache.timestamps.push(interaction.timestamp || Date.now());
        cache.accessCounts.push(interaction.accessCount || 1);
        cache.conceptsList.push(interaction.concepts || []);

        logger.debug(`Added interaction ${interaction.id} to memory cache`);
    }

    /**
     * Invalidate memory cache
     */
    invalidateMemoryCache() {
        this._memoryCache.loaded = false;
        this._memoryCache.lastLoaded = 0;
        this._memoryCache.data = {
            shortTermMemory: [],
            longTermMemory: [],
            embeddings: [],
            timestamps: [],
            accessCounts: [],
            conceptsList: []
        };

        logger.info('Memory cache invalidated');
    }

    /**
     * Generate cache key for SPARQL queries
     * @param {string} query - SPARQL query
     * @param {string} endpoint - SPARQL endpoint
     * @returns {string} Cache key
     */
    _generateQueryCacheKey(query, endpoint) {
        // Create deterministic key from query and endpoint
        const normalizedQuery = query.replace(/\s+/g, ' ').trim();
        return `${endpoint}:${Buffer.from(normalizedQuery).toString('base64').slice(0, 50)}`;
    }

    /**
     * Cache SPARQL query result
     * @param {string} query - SPARQL query
     * @param {string} endpoint - SPARQL endpoint
     * @param {Object} result - Query result
     * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
     */
    cacheQueryResult(query, endpoint, result, ttl = 300000) {
        const key = this._generateQueryCacheKey(query, endpoint);
        const now = Date.now();

        // Check cache size limit
        if (this._queryCache.size >= this.maxCacheSize) {
            this._evictOldestQueryCacheEntry();
        }

        this._queryCache.set(key, result);
        this._queryCacheMetadata.set(key, {
            timestamp: now,
            ttl: ttl,
            expiresAt: now + ttl
        });

        logger.debug(`Cached query result with key: ${key.slice(0, 20)}...`);
    }

    /**
     * Get cached SPARQL query result
     * @param {string} query - SPARQL query
     * @param {string} endpoint - SPARQL endpoint
     * @returns {Object|null} Cached result or null if not found/expired
     */
    getCachedQueryResult(query, endpoint) {
        const key = this._generateQueryCacheKey(query, endpoint);
        const now = Date.now();

        if (!this._queryCache.has(key)) {
            return null;
        }

        const metadata = this._queryCacheMetadata.get(key);
        if (!metadata || now > metadata.expiresAt) {
            // Expired - remove from cache
            this._queryCache.delete(key);
            this._queryCacheMetadata.delete(key);
            logger.debug(`Removed expired query cache entry: ${key.slice(0, 20)}...`);
            return null;
        }

        logger.debug(`Retrieved cached query result: ${key.slice(0, 20)}...`);
        return this._queryCache.get(key);
    }

    /**
     * Invalidate query cache entries matching pattern
     * @param {string|RegExp} pattern - Pattern to match against cache keys
     */
    invalidateQueryCache(pattern = null) {
        if (!pattern) {
            // Clear entire query cache
            this._queryCache.clear();
            this._queryCacheMetadata.clear();
            logger.info('Cleared entire query cache');
            return;
        }

        const keysToDelete = [];
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

        for (const key of this._queryCache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => {
            this._queryCache.delete(key);
            this._queryCacheMetadata.delete(key);
        });

        logger.info(`Invalidated ${keysToDelete.length} query cache entries matching pattern`);
    }

    /**
     * Evict oldest query cache entry to make room
     */
    _evictOldestQueryCacheEntry() {
        let oldestKey = null;
        let oldestTimestamp = Date.now();

        for (const [key, metadata] of this._queryCacheMetadata.entries()) {
            if (metadata.timestamp < oldestTimestamp) {
                oldestTimestamp = metadata.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this._queryCache.delete(oldestKey);
            this._queryCacheMetadata.delete(oldestKey);
            logger.debug(`Evicted oldest query cache entry: ${oldestKey.slice(0, 20)}...`);
        }
    }

    /**
     * Clean up expired query cache entries
     */
    cleanupExpiredQueryCache() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, metadata] of this._queryCacheMetadata.entries()) {
            if (now > metadata.expiresAt) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => {
            this._queryCache.delete(key);
            this._queryCacheMetadata.delete(key);
        });

        if (keysToDelete.length > 0) {
            logger.info(`Cleaned up ${keysToDelete.length} expired query cache entries`);
        }
    }

    /**
     * Schedule debounced index persistence
     * @param {Function} persistCallback - Callback to execute persistence
     * @param {number} debounceMs - Debounce delay in milliseconds
     */
    scheduleIndexPersistence(persistCallback, debounceMs = 60000) {
        if (this._indexPersistenceTimer) {
            clearTimeout(this._indexPersistenceTimer);
        }

        this._indexPersistenceTimer = setTimeout(async () => {
            try {
                await persistCallback();
                logger.info('Index persistence completed');
            } catch (error) {
                logger.error('Failed to persist index:', error);
            } finally {
                this._indexPersistenceTimer = null;
            }
        }, debounceMs);

        logger.debug(`Scheduled index persistence in ${debounceMs}ms`);
    }

    /**
     * Cancel any pending index persistence
     */
    cancelScheduledPersistence() {
        if (this._indexPersistenceTimer) {
            clearTimeout(this._indexPersistenceTimer);
            this._indexPersistenceTimer = null;
            logger.debug('Cancelled scheduled index persistence');
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        let expiredQueryEntries = 0;

        for (const metadata of this._queryCacheMetadata.values()) {
            if (now > metadata.expiresAt) {
                expiredQueryEntries++;
            }
        }

        return {
            memoryCache: {
                loaded: this._memoryCache.loaded,
                valid: this.isMemoryCacheValid(),
                lastLoaded: this._memoryCache.lastLoaded,
                shortTermMemoryCount: this._memoryCache.data.shortTermMemory.length,
                longTermMemoryCount: this._memoryCache.data.longTermMemory.length
            },
            queryCache: {
                totalEntries: this._queryCache.size,
                expiredEntries: expiredQueryEntries,
                activeEntries: this._queryCache.size - expiredQueryEntries,
                maxSize: this.maxCacheSize
            },
            indexPersistence: {
                scheduled: !!this._indexPersistenceTimer
            }
        };
    }

    // ========== Memory Data Access ==========

    getMemoryData() {
        return this._memoryCache.data;
    }

    clearQueryCache() {
        this.invalidateQueryCache();
    }

    // ========== Setter Methods for Memory Management ==========

    setShortTermMemory(shortTermMemory) {
        this._memoryCache.data.shortTermMemory = shortTermMemory || [];
        logger.debug(`Set short-term memory: ${this._memoryCache.data.shortTermMemory.length} items`);
    }

    setLongTermMemory(longTermMemory) {
        this._memoryCache.data.longTermMemory = longTermMemory || [];
        logger.debug(`Set long-term memory: ${this._memoryCache.data.longTermMemory.length} items`);
    }

    setEmbeddings(embeddings) {
        this._memoryCache.data.embeddings = embeddings || [];
        logger.debug(`Set embeddings: ${this._memoryCache.data.embeddings.length} items`);
    }

    setTimestamps(timestamps) {
        this._memoryCache.data.timestamps = timestamps || [];
        logger.debug(`Set timestamps: ${this._memoryCache.data.timestamps.length} items`);
    }

    setAccessCounts(accessCounts) {
        this._memoryCache.data.accessCounts = accessCounts || [];
        logger.debug(`Set access counts: ${this._memoryCache.data.accessCounts.length} items`);
    }

    setConceptsList(conceptsList) {
        this._memoryCache.data.conceptsList = conceptsList || [];
        logger.debug(`Set concepts list: ${this._memoryCache.data.conceptsList.length} items`);
    }

    markLoaded() {
        this._memoryCache.loaded = true;
        this._memoryCache.lastLoaded = Date.now();
        logger.debug('Memory cache marked as loaded');
    }

    /**
     * Dispose of cache resources
     */
    dispose() {
        this.cancelScheduledPersistence();
        this.invalidateMemoryCache();
        this.invalidateQueryCache();

        logger.info('SPARQLCache disposed');
    }
}