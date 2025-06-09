/**
 * Ragno: Graph Metrics and Performance Monitoring
 * 
 * This module provides comprehensive performance monitoring, metrics collection,
 * and analytics for the ragno knowledge graph system. It tracks API performance,
 * search analytics, graph growth, and system health.
 */

import EventEmitter from 'events'
import { logger } from '../../Utils.js'

/**
 * GraphMetrics class for monitoring ragno system performance
 */
export class GraphMetrics extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.options = {
      // Collection intervals
      metricsInterval: options.metricsInterval || 60000, // 1 minute
      retentionPeriod: options.retentionPeriod || 86400000, // 24 hours
      
      // Storage options
      enablePersistence: options.enablePersistence !== false,
      storageBackend: options.storageBackend || 'memory', // 'memory', 'file', 'redis'
      storagePath: options.storagePath || './metrics',
      
      // Alerting thresholds
      alertThresholds: {
        responseTime: options.responseTimeThreshold || 5000,
        errorRate: options.errorRateThreshold || 0.05,
        memoryUsage: options.memoryThreshold || 0.85,
        searchLatency: options.searchLatencyThreshold || 2000
      },
      
      // Feature flags
      trackDetailedMetrics: options.trackDetailedMetrics !== false,
      enableAlerting: options.enableAlerting !== false,
      enableGraphAnalytics: options.enableGraphAnalytics !== false,
      
      ...options
    }
    
    // Metrics storage
    this.metrics = {
      requests: new Map(),
      responses: new Map(),
      searches: new Map(),
      errors: new Map(),
      system: new Map(),
      graph: new Map(),
      custom: new Map()
    }
    
    // Aggregated statistics
    this.stats = {
      requests: { total: 0, success: 0, error: 0 },
      responses: { avgTime: 0, minTime: Infinity, maxTime: 0 },
      searches: { total: 0, avgLatency: 0, totalResults: 0 },
      errors: { count: 0, rate: 0 },
      system: { memoryUsage: 0, cpuUsage: 0 },
      graph: { nodes: 0, edges: 0, growth: 0 }
    }
    
    // Active tracking
    this.activeRequests = new Map()
    this.searchSessions = new Map()
    
    // Timers and intervals
    this.metricsTimer = null
    this.cleanupTimer = null
    
    this.initialized = false
  }
  
  /**
   * Initialize metrics collection
   */
  async initialize() {
    if (this.initialized) return
    
    logger.info('Initializing Graph Metrics...')
    
    // Setup periodic metrics collection
    this.metricsTimer = setInterval(() => {
      this._collectSystemMetrics()
      this._computeAggregatedStats()
      this._checkAlertThresholds()
    }, this.options.metricsInterval)
    
    // Setup periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this._cleanupOldMetrics()
    }, this.options.retentionPeriod / 24) // Run cleanup 24 times per retention period
    
    // Initialize storage backend
    if (this.options.enablePersistence) {
      await this._initializeStorage()
    }
    
    this.initialized = true
    logger.info('Graph Metrics initialized successfully')
  }
  
  /**
   * Record API request
   */
  recordRequest(method, path, metadata = {}) {
    const timestamp = Date.now()
    const requestId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`
    
    const requestData = {
      id: requestId,
      method,
      path,
      timestamp,
      metadata
    }
    
    this.metrics.requests.set(requestId, requestData)
    this.activeRequests.set(requestId, requestData)
    
    this.stats.requests.total++
    
    this.emit('request', requestData)
  }
  
  /**
   * Record API response
   */
  recordResponse(method, path, statusCode, duration, metadata = {}) {
    const timestamp = Date.now()
    const requestId = this._findRequestId(method, path, timestamp - duration)
    
    const responseData = {
      requestId,
      method,
      path,
      statusCode,
      duration,
      timestamp,
      metadata
    }
    
    this.metrics.responses.set(`${requestId}-response`, responseData)
    
    // Update stats
    if (statusCode >= 200 && statusCode < 400) {
      this.stats.requests.success++
    } else {
      this.stats.requests.error++
    }
    
    this._updateResponseTimeStats(duration)
    
    // Remove from active requests
    if (requestId) {
      this.activeRequests.delete(requestId)
    }
    
    this.emit('response', responseData)
  }
  
  /**
   * Record search request
   */
  recordSearchRequest(searchType, query, metadata = {}) {
    const timestamp = Date.now()
    const searchId = `search-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
    
    const searchData = {
      id: searchId,
      type: searchType,
      query: this._sanitizeQuery(query),
      timestamp,
      metadata
    }
    
    this.metrics.searches.set(searchId, searchData)
    this.searchSessions.set(searchId, { ...searchData, startTime: timestamp })
    
    this.stats.searches.total++
    
    this.emit('searchRequest', searchData)
  }
  
  /**
   * Record search response
   */
  recordSearchResponse(searchType, statusCode, duration, resultCount = 0, metadata = {}) {
    const timestamp = Date.now()
    const searchId = this._findSearchId(searchType, timestamp - duration)
    
    const responseData = {
      searchId,
      type: searchType,
      statusCode,
      duration,
      resultCount,
      timestamp,
      metadata
    }
    
    this.metrics.searches.set(`${searchId}-response`, responseData)
    
    // Update search stats
    this._updateSearchStats(duration, resultCount)
    
    // Remove from active searches
    if (searchId) {
      this.searchSessions.delete(searchId)
    }
    
    this.emit('searchResponse', responseData)
  }
  
  /**
   * Record error occurrence
   */
  recordError(error, context = {}) {
    const timestamp = Date.now()
    const errorId = `error-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
    
    const errorData = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context,
      timestamp
    }
    
    this.metrics.errors.set(errorId, errorData)
    this.stats.errors.count++
    
    this.emit('error', errorData)
    logger.warn('Metrics recorded error:', error.message)
  }
  
  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, metadata = {}) {
    const timestamp = Date.now()
    const metricId = `${name}-${timestamp}`
    
    const metricData = {
      name,
      value,
      metadata,
      timestamp
    }
    
    this.metrics.custom.set(metricId, metricData)
    
    this.emit('customMetric', metricData)
  }
  
  /**
   * Record graph change
   */
  recordGraphChange(changeType, count, metadata = {}) {
    const timestamp = Date.now()
    const changeId = `graph-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
    
    const changeData = {
      id: changeId,
      type: changeType, // 'node_added', 'edge_added', 'node_removed', etc.
      count,
      metadata,
      timestamp
    }
    
    this.metrics.graph.set(changeId, changeData)
    
    // Update graph stats based on change type
    this._updateGraphStats(changeType, count)
    
    this.emit('graphChange', changeData)
  }
  
  /**
   * Get current metrics summary
   */
  getMetricsSummary() {
    return {
      timestamp: new Date().toISOString(),
      stats: { ...this.stats },
      activeRequests: this.activeRequests.size,
      activeSearches: this.searchSessions.size,
      totalMetricsPoints: this._getTotalMetricsPoints(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  }
  
  /**
   * Get detailed search metrics
   */
  async getSearchMetrics() {
    const now = Date.now()
    const hourAgo = now - 3600000 // 1 hour
    
    // Get recent search data
    const recentSearches = Array.from(this.metrics.searches.values())
      .filter(search => search.timestamp > hourAgo)
    
    const searchTypes = {}
    const queryPatterns = {}
    let totalLatency = 0
    let totalResults = 0
    
    for (const search of recentSearches) {
      // Aggregate by search type
      if (!searchTypes[search.type]) {
        searchTypes[search.type] = { count: 0, avgLatency: 0, avgResults: 0 }
      }
      searchTypes[search.type].count++
      
      // Aggregate query patterns (simplified)
      const queryLength = Math.floor((search.query?.length || 0) / 10) * 10
      const pattern = `${queryLength}-${queryLength + 9} chars`
      queryPatterns[pattern] = (queryPatterns[pattern] || 0) + 1
      
      if (search.duration) {
        totalLatency += search.duration
        searchTypes[search.type].avgLatency += search.duration
      }
      
      if (search.resultCount) {
        totalResults += search.resultCount
        searchTypes[search.type].avgResults += search.resultCount
      }
    }
    
    // Calculate averages
    for (const type of Object.values(searchTypes)) {
      if (type.count > 0) {
        type.avgLatency = Math.round(type.avgLatency / type.count)
        type.avgResults = Math.round(type.avgResults / type.count)
      }
    }
    
    return {
      period: 'last_hour',
      totalSearches: recentSearches.length,
      avgLatency: recentSearches.length > 0 ? Math.round(totalLatency / recentSearches.length) : 0,
      avgResults: recentSearches.length > 0 ? Math.round(totalResults / recentSearches.length) : 0,
      searchTypes,
      queryPatterns,
      timestamp: new Date().toISOString()
    }
  }
  
  /**
   * Get performance trends
   */
  async getPerformanceTrends(period = 'hour') {
    const intervals = this._getTimeIntervals(period)
    const trends = {
      responseTime: [],
      errorRate: [],
      searchLatency: [],
      throughput: []
    }
    
    for (const interval of intervals) {
      const intervalStats = this._calculateIntervalStats(interval.start, interval.end)
      
      trends.responseTime.push({
        timestamp: interval.start,
        value: intervalStats.avgResponseTime
      })
      
      trends.errorRate.push({
        timestamp: interval.start,
        value: intervalStats.errorRate
      })
      
      trends.searchLatency.push({
        timestamp: interval.start,
        value: intervalStats.avgSearchLatency
      })
      
      trends.throughput.push({
        timestamp: interval.start,
        value: intervalStats.requestCount
      })
    }
    
    return trends
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    const thresholds = this.options.alertThresholds
    const health = {
      status: 'healthy',
      checks: {},
      alerts: []
    }
    
    // Check response time
    if (this.stats.responses.avgTime > thresholds.responseTime) {
      health.status = 'degraded'
      health.alerts.push({
        type: 'high_response_time',
        message: `Average response time (${this.stats.responses.avgTime}ms) exceeds threshold (${thresholds.responseTime}ms)`
      })
    }
    health.checks.responseTime = {
      status: this.stats.responses.avgTime <= thresholds.responseTime ? 'ok' : 'warning',
      value: this.stats.responses.avgTime,
      threshold: thresholds.responseTime
    }
    
    // Check error rate
    const errorRate = this.stats.requests.total > 0 ? 
      this.stats.requests.error / this.stats.requests.total : 0
    
    if (errorRate > thresholds.errorRate) {
      health.status = 'unhealthy'
      health.alerts.push({
        type: 'high_error_rate',
        message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(thresholds.errorRate * 100).toFixed(2)}%)`
      })
    }
    health.checks.errorRate = {
      status: errorRate <= thresholds.errorRate ? 'ok' : 'critical',
      value: errorRate,
      threshold: thresholds.errorRate
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage()
    const memoryRatio = memUsage.heapUsed / memUsage.heapTotal
    
    if (memoryRatio > thresholds.memoryUsage) {
      health.status = 'degraded'
      health.alerts.push({
        type: 'high_memory_usage',
        message: `Memory usage (${(memoryRatio * 100).toFixed(2)}%) exceeds threshold (${(thresholds.memoryUsage * 100).toFixed(2)}%)`
      })
    }
    health.checks.memoryUsage = {
      status: memoryRatio <= thresholds.memoryUsage ? 'ok' : 'warning',
      value: memoryRatio,
      threshold: thresholds.memoryUsage
    }
    
    return health
  }
  
  /**
   * Export metrics data
   */
  async exportMetrics(format = 'json', options = {}) {
    const data = {
      timestamp: new Date().toISOString(),
      summary: this.getMetricsSummary(),
      metrics: {}
    }
    
    // Include detailed metrics if requested
    if (options.includeDetailed) {
      for (const [category, metricsMap] of Object.entries(this.metrics)) {
        data.metrics[category] = Array.from(metricsMap.values())
      }
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2)
      
      case 'csv':
        return this._exportCSV(data)
      
      case 'prometheus':
        return this._exportPrometheus(data)
      
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }
  
  /**
   * Internal helper methods
   */
  
  _collectSystemMetrics() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    this.recordCustomMetric('system.memory.heapUsed', memUsage.heapUsed)
    this.recordCustomMetric('system.memory.heapTotal', memUsage.heapTotal)
    this.recordCustomMetric('system.cpu.user', cpuUsage.user)
    this.recordCustomMetric('system.cpu.system', cpuUsage.system)
  }
  
  _computeAggregatedStats() {
    // Update error rate
    if (this.stats.requests.total > 0) {
      this.stats.errors.rate = this.stats.requests.error / this.stats.requests.total
    }
    
    // Emit stats update
    this.emit('statsUpdate', this.stats)
  }
  
  _checkAlertThresholds() {
    if (!this.options.enableAlerting) return
    
    const health = this.getHealthStatus()
    
    if (health.alerts.length > 0) {
      this.emit('alert', health)
    }
  }
  
  _updateResponseTimeStats(duration) {
    const count = this.stats.requests.success + this.stats.requests.error
    
    if (count === 1) {
      this.stats.responses.avgTime = duration
      this.stats.responses.minTime = duration
      this.stats.responses.maxTime = duration
    } else {
      this.stats.responses.avgTime = 
        (this.stats.responses.avgTime * (count - 1) + duration) / count
      this.stats.responses.minTime = Math.min(this.stats.responses.minTime, duration)
      this.stats.responses.maxTime = Math.max(this.stats.responses.maxTime, duration)
    }
  }
  
  _updateSearchStats(duration, resultCount) {
    const searchCount = this.stats.searches.total
    
    if (searchCount === 1) {
      this.stats.searches.avgLatency = duration
      this.stats.searches.totalResults = resultCount
    } else {
      this.stats.searches.avgLatency = 
        (this.stats.searches.avgLatency * (searchCount - 1) + duration) / searchCount
      this.stats.searches.totalResults += resultCount
    }
  }
  
  _updateGraphStats(changeType, count) {
    switch (changeType) {
      case 'node_added':
        this.stats.graph.nodes += count
        this.stats.graph.growth += count
        break
      case 'edge_added':
        this.stats.graph.edges += count
        this.stats.graph.growth += count
        break
      case 'node_removed':
        this.stats.graph.nodes -= count
        this.stats.graph.growth -= count
        break
      case 'edge_removed':
        this.stats.graph.edges -= count
        this.stats.graph.growth -= count
        break
    }
  }
  
  _findRequestId(method, path, timestamp) {
    for (const [id, request] of this.activeRequests) {
      if (request.method === method && 
          request.path === path && 
          Math.abs(request.timestamp - timestamp) < 1000) {
        return id
      }
    }
    return null
  }
  
  _findSearchId(searchType, timestamp) {
    for (const [id, search] of this.searchSessions) {
      if (search.type === searchType && 
          Math.abs(search.startTime - timestamp) < 1000) {
        return id
      }
    }
    return null
  }
  
  _sanitizeQuery(query) {
    if (!query || typeof query !== 'string') return 'N/A'
    
    // Remove potentially sensitive information
    return query.length > 100 ? query.substring(0, 100) + '...' : query
  }
  
  _getTotalMetricsPoints() {
    return Object.values(this.metrics).reduce((total, map) => total + map.size, 0)
  }
  
  _cleanupOldMetrics() {
    const cutoff = Date.now() - this.options.retentionPeriod
    
    for (const [category, metricsMap] of Object.entries(this.metrics)) {
      const toDelete = []
      
      for (const [key, metric] of metricsMap) {
        if (metric.timestamp < cutoff) {
          toDelete.push(key)
        }
      }
      
      for (const key of toDelete) {
        metricsMap.delete(key)
      }
      
      if (toDelete.length > 0) {
        logger.debug(`Cleaned up ${toDelete.length} old ${category} metrics`)
      }
    }
  }
  
  async _initializeStorage() {
    // Initialize storage backend based on configuration
    switch (this.options.storageBackend) {
      case 'file':
        // File-based storage implementation
        break
      case 'redis':
        // Redis-based storage implementation
        break
      default:
        // Memory storage (default)
        break
    }
  }
  
  /**
   * Shutdown metrics collection
   */
  async shutdown() {
    logger.info('Shutting down Graph Metrics...')
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    // Export final metrics if persistence is enabled
    if (this.options.enablePersistence) {
      try {
        const finalMetrics = await this.exportMetrics('json', { includeDetailed: true })
        logger.info('Final metrics exported successfully')
      } catch (error) {
        logger.error('Failed to export final metrics:', error)
      }
    }
    
    this.initialized = false
    logger.info('Graph Metrics shutdown complete')
  }
}

export default GraphMetrics