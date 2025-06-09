/**
 * Ragno: Graph Cache - High-Performance Caching Layer
 * 
 * This module provides a comprehensive caching system for ragno operations,
 * supporting multiple backends and intelligent cache management with TTL,
 * invalidation strategies, and performance optimization.
 */

import EventEmitter from 'events'
import crypto from 'crypto'
import { logger } from '../../Utils.js'

/**
 * GraphCache class providing multi-tier caching for ragno operations
 */
export class GraphCache extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.options = {
      // Cache configuration
      backend: options.backend || 'memory', // 'memory', 'redis', 'hybrid'
      maxSize: options.maxSize || 10000, // Maximum number of cached items
      maxMemory: options.maxMemory || 100 * 1024 * 1024, // 100MB
      
      // TTL configuration (in milliseconds)
      defaultTTL: options.defaultTTL || 300000, // 5 minutes
      ttlByType: {
        search: options.searchTTL || 300000,        // 5 minutes
        entity: options.entityTTL || 600000,        // 10 minutes
        stats: options.statsTTL || 180000,          // 3 minutes
        graph: options.graphTTL || 900000,          // 15 minutes
        embeddings: options.embeddingsTTL || 3600000, // 1 hour
        ...options.ttlByType
      },
      
      // Performance options
      enableCompression: options.enableCompression !== false,
      enableMetrics: options.enableMetrics !== false,
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      
      // Invalidation strategies
      enableSmartInvalidation: options.enableSmartInvalidation !== false,
      invalidationPatterns: options.invalidationPatterns || [
        { pattern: /^search:/, dependencies: ['graph:', 'entity:'] },
        { pattern: /^entity:/, dependencies: ['search:', 'stats:'] },
        { pattern: /^graph:/, dependencies: ['search:', 'stats:', 'entity:'] }
      ],
      
      // Redis configuration (if using Redis backend)
      redis: {
        host: options.redisHost || 'localhost',
        port: options.redisPort || 6379,
        db: options.redisDB || 0,
        keyPrefix: options.redisPrefix || 'ragno:cache:',
        ...options.redis
      },
      
      ...options
    }
    
    // Cache storage
    this.cache = new Map()
    this.metadata = new Map() // Store TTL and other metadata
    this.accessTimes = new Map() // For LRU eviction
    this.dependencies = new Map() // For smart invalidation
    
    // Metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0
    }
    
    // Timers
    this.cleanupTimer = null
    this.metricsTimer = null
    
    // Redis client (if using Redis)
    this.redisClient = null
    
    this.initialized = false
  }
  
  /**
   * Initialize the cache system
   */
  async initialize() {
    if (this.initialized) return
    
    logger.info(`Initializing Graph Cache (backend: ${this.options.backend})...`)
    
    // Initialize backend
    switch (this.options.backend) {
      case 'redis':
        await this._initializeRedis()
        break
      case 'hybrid':
        await this._initializeRedis() // Redis for persistence, memory for speed
        break
      case 'memory':
      default:
        // Memory backend is already initialized
        break
    }
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this._cleanup()
    }, 60000) // Clean up every minute
    
    // Start metrics collection
    if (this.options.enableMetrics) {
      this.metricsTimer = setInterval(() => {
        this._updateMetrics()
      }, 30000) // Update metrics every 30 seconds
    }
    
    this.initialized = true
    logger.info('Graph Cache initialized successfully')
  }
  
  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.initialized) {
      throw new Error('Cache not initialized')
    }
    
    try {
      let value = null
      let hit = false
      
      // Try memory cache first (for hybrid mode)
      if (this.cache.has(key)) {
        const item = this.cache.get(key)
        const meta = this.metadata.get(key)
        
        // Check if expired
        if (!meta || Date.now() < meta.expires) {
          value = item
          hit = true
          
          // Update access time for LRU
          this.accessTimes.set(key, Date.now())
        } else {
          // Expired, remove from memory
          this._deleteFromMemory(key)
        }
      }
      
      // Try Redis if not found in memory (for Redis/hybrid mode)
      if (!hit && (this.options.backend === 'redis' || this.options.backend === 'hybrid')) {
        value = await this._getFromRedis(key)
        hit = value !== null
        
        // Cache in memory for future access (hybrid mode)
        if (hit && this.options.backend === 'hybrid') {
          this._setInMemory(key, value, this._getTTL(key))
        }
      }
      
      // Update metrics
      if (hit) {
        this.metrics.hits++
        this.emit('hit', key)
      } else {
        this.metrics.misses++
        this.emit('miss', key)
      }
      
      return hit ? await this._decompress(value) : null
      
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error)
      this.metrics.misses++
      return null
    }
  }
  
  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    if (!this.initialized) {
      throw new Error('Cache not initialized')
    }
    
    try {
      const actualTTL = ttl || this._getTTL(key)
      const compressedValue = await this._compress(value)
      
      // Set in memory cache
      this._setInMemory(key, compressedValue, actualTTL)
      
      // Set in Redis (for Redis/hybrid mode)
      if (this.options.backend === 'redis' || this.options.backend === 'hybrid') {
        await this._setInRedis(key, compressedValue, actualTTL)
      }
      
      // Update dependencies for smart invalidation
      if (this.options.enableSmartInvalidation) {
        this._updateDependencies(key)
      }
      
      this.metrics.sets++
      this.emit('set', key, value)
      
      // Check if eviction is needed
      this._checkEviction()
      
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error)
      throw error
    }
  }
  
  /**
   * Delete value from cache
   */
  async delete(key) {
    if (!this.initialized) {
      throw new Error('Cache not initialized')
    }
    
    try {
      // Delete from memory
      const memoryDeleted = this._deleteFromMemory(key)
      
      // Delete from Redis
      let redisDeleted = false
      if (this.options.backend === 'redis' || this.options.backend === 'hybrid') {
        redisDeleted = await this._deleteFromRedis(key)
      }
      
      const deleted = memoryDeleted || redisDeleted
      
      if (deleted) {
        this.metrics.deletes++
        this.emit('delete', key)
      }
      
      return deleted
      
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }
  
  /**
   * Clear all cache entries
   */
  async clear() {
    if (!this.initialized) {
      throw new Error('Cache not initialized')
    }
    
    try {
      const size = this.cache.size
      
      // Clear memory cache
      this.cache.clear()
      this.metadata.clear()
      this.accessTimes.clear()
      this.dependencies.clear()
      
      // Clear Redis cache
      if (this.options.backend === 'redis' || this.options.backend === 'hybrid') {
        await this._clearRedis()
      }
      
      logger.info(`Cleared ${size} cache entries`)
      this.emit('clear', size)
      
    } catch (error) {
      logger.error('Cache clear error:', error)
      throw error
    }
  }
  
  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern) {
    if (!this.initialized) {
      throw new Error('Cache not initialized')
    }
    
    try {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
      const toDelete = []
      
      // Find matching keys in memory
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          toDelete.push(key)
        }
      }
      
      // Delete matching keys
      const deletePromises = toDelete.map(key => this.delete(key))
      await Promise.all(deletePromises)
      
      logger.debug(`Invalidated ${toDelete.length} cache entries matching pattern: ${pattern}`)
      this.emit('invalidate', pattern, toDelete.length)
      
      return toDelete.length
      
    } catch (error) {
      logger.error(`Cache invalidation error for pattern ${pattern}:`, error)
      return 0
    }
  }
  
  /**
   * Smart invalidation based on dependencies
   */
  async smartInvalidate(key) {
    if (!this.options.enableSmartInvalidation) return 0
    
    let totalInvalidated = 0
    
    for (const rule of this.options.invalidationPatterns) {
      if (rule.pattern.test(key)) {
        for (const depPattern of rule.dependencies) {
          const invalidated = await this.invalidatePattern(depPattern)
          totalInvalidated += invalidated
        }
      }
    }
    
    if (totalInvalidated > 0) {
      logger.debug(`Smart invalidation for ${key}: ${totalInvalidated} entries invalidated`)
    }
    
    return totalInvalidated
  }
  
  /**
   * Get cache statistics
   */
  async getStatistics() {
    const stats = {
      ...this.metrics,
      hitRate: this.metrics.hits + this.metrics.misses > 0 ? 
        this.metrics.hits / (this.metrics.hits + this.metrics.misses) : 0,
      memoryEntries: this.cache.size,
      redisEntries: 0,
      memoryUsageBytes: this._calculateMemoryUsage(),
      backend: this.options.backend,
      timestamp: new Date().toISOString()
    }
    
    // Get Redis stats if applicable
    if (this.redisClient) {
      try {
        stats.redisEntries = await this._getRedisSize()
      } catch (error) {
        logger.warn('Failed to get Redis stats:', error.message)
      }
    }
    
    return stats
  }
  
  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmupData) {
    if (!Array.isArray(warmupData)) {
      throw new Error('Warmup data must be an array of {key, value, ttl} objects')
    }
    
    logger.info(`Warming cache with ${warmupData.length} entries...`)
    
    const setPromises = warmupData.map(async ({ key, value, ttl }) => {
      try {
        await this.set(key, value, ttl)
      } catch (error) {
        logger.warn(`Failed to warm cache for key ${key}:`, error.message)
      }
    })
    
    await Promise.all(setPromises)
    
    logger.info('Cache warming completed')
    this.emit('warmed', warmupData.length)
  }
  
  /**
   * Internal helper methods
   */
  
  _setInMemory(key, value, ttl) {
    // Check size limits before adding
    if (this.cache.size >= this.options.maxSize) {
      this._evictLRU()
    }
    
    const expires = Date.now() + ttl
    this.cache.set(key, value)
    this.metadata.set(key, { expires, size: this._getValueSize(value) })
    this.accessTimes.set(key, Date.now())
  }
  
  _deleteFromMemory(key) {
    const deleted = this.cache.delete(key)
    this.metadata.delete(key)
    this.accessTimes.delete(key)
    this.dependencies.delete(key)
    return deleted
  }
  
  async _setInRedis(key, value, ttl) {
    if (!this.redisClient) return
    
    const redisKey = this.options.redis.keyPrefix + key
    await this.redisClient.setex(redisKey, Math.ceil(ttl / 1000), JSON.stringify(value))
  }
  
  async _getFromRedis(key) {
    if (!this.redisClient) return null
    
    const redisKey = this.options.redis.keyPrefix + key
    const value = await this.redisClient.get(redisKey)
    return value ? JSON.parse(value) : null
  }
  
  async _deleteFromRedis(key) {
    if (!this.redisClient) return false
    
    const redisKey = this.options.redis.keyPrefix + key
    const result = await this.redisClient.del(redisKey)
    return result > 0
  }
  
  async _clearRedis() {
    if (!this.redisClient) return
    
    const pattern = this.options.redis.keyPrefix + '*'
    const keys = await this.redisClient.keys(pattern)
    
    if (keys.length > 0) {
      await this.redisClient.del(...keys)
    }
  }
  
  async _getRedisSize() {
    if (!this.redisClient) return 0
    
    const pattern = this.options.redis.keyPrefix + '*'
    const keys = await this.redisClient.keys(pattern)
    return keys.length
  }
  
  async _initializeRedis() {
    try {
      // Import Redis dynamically
      const Redis = await import('redis').then(m => m.default)
      
      this.redisClient = Redis.createClient(this.options.redis)
      
      this.redisClient.on('error', (error) => {
        logger.error('Redis cache error:', error)
        this.emit('redisError', error)
      })
      
      this.redisClient.on('connect', () => {
        logger.info('Redis cache connected')
        this.emit('redisConnect')
      })
      
      await this.redisClient.connect()
      
    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error)
      
      // Fallback to memory cache
      if (this.options.backend === 'redis') {
        logger.warn('Falling back to memory cache')
        this.options.backend = 'memory'
      }
    }
  }
  
  _getTTL(key) {
    // Determine TTL based on key pattern
    for (const [type, ttl] of Object.entries(this.options.ttlByType)) {
      if (key.startsWith(type + ':')) {
        return ttl
      }
    }
    return this.options.defaultTTL
  }
  
  async _compress(value) {
    if (!this.options.enableCompression) {
      return value
    }
    
    const serialized = JSON.stringify(value)
    
    if (serialized.length < this.options.compressionThreshold) {
      return value
    }
    
    try {
      const zlib = await import('zlib')
      const compressed = zlib.gzipSync(serialized)
      
      return {
        __compressed: true,
        data: compressed.toString('base64')
      }
    } catch (error) {
      logger.warn('Compression failed, storing uncompressed:', error.message)
      return value
    }
  }
  
  async _decompress(value) {
    if (!value || !value.__compressed) {
      return value
    }
    
    try {
      const zlib = await import('zlib')
      const buffer = Buffer.from(value.data, 'base64')
      const decompressed = zlib.gunzipSync(buffer)
      
      return JSON.parse(decompressed.toString())
    } catch (error) {
      logger.error('Decompression failed:', error)
      return null
    }
  }
  
  _evictLRU() {
    if (this.cache.size === 0) return
    
    // Find least recently used key
    let oldestTime = Date.now()
    let oldestKey = null
    
    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }
    
    if (oldestKey) {
      this._deleteFromMemory(oldestKey)
      this.metrics.evictions++
      this.emit('evict', oldestKey)
    }
  }
  
  _checkEviction() {
    const memoryUsage = this._calculateMemoryUsage()
    
    while (memoryUsage > this.options.maxMemory && this.cache.size > 0) {
      this._evictLRU()
    }
  }
  
  _calculateMemoryUsage() {
    let total = 0
    
    for (const meta of this.metadata.values()) {
      total += meta.size || 0
    }
    
    return total
  }
  
  _getValueSize(value) {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate for UTF-16
    } catch (error) {
      return 0
    }
  }
  
  _updateDependencies(key) {
    const deps = new Set()
    
    for (const rule of this.options.invalidationPatterns) {
      if (rule.pattern.test(key)) {
        for (const dep of rule.dependencies) {
          deps.add(dep)
        }
      }
    }
    
    this.dependencies.set(key, deps)
  }
  
  _cleanup() {
    const now = Date.now()
    const toDelete = []
    
    // Find expired entries
    for (const [key, meta] of this.metadata) {
      if (meta.expires <= now) {
        toDelete.push(key)
      }
    }
    
    // Delete expired entries
    for (const key of toDelete) {
      this._deleteFromMemory(key)
    }
    
    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} expired cache entries`)
    }
  }
  
  _updateMetrics() {
    this.metrics.size = this.cache.size
    this.metrics.memoryUsage = this._calculateMemoryUsage()
    
    this.emit('metricsUpdate', this.metrics)
  }
  
  /**
   * Shutdown the cache system
   */
  async shutdown() {
    logger.info('Shutting down Graph Cache...')
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }
    
    if (this.redisClient) {
      try {
        await this.redisClient.quit()
      } catch (error) {
        logger.warn('Error closing Redis connection:', error.message)
      }
    }
    
    this.initialized = false
    logger.info('Graph Cache shutdown complete')
  }
}

export default GraphCache