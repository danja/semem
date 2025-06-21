/**
 * Graph Metrics Implementation
 * Provides monitoring and metrics collection for graph operations
 */

export default class GraphMetrics {
  constructor() {
    this.metrics = {
      nodeCount: 0,
      edgeCount: 0,
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0,
      lastUpdate: Date.now()
    };
  }

  updateNodeCount(count) {
    this.metrics.nodeCount = count;
    this.metrics.lastUpdate = Date.now();
  }

  updateEdgeCount(count) {
    this.metrics.edgeCount = count;
    this.metrics.lastUpdate = Date.now();
  }

  recordQuery(duration) {
    this.metrics.queryCount++;
    this.metrics.avgQueryTime = (this.metrics.avgQueryTime + duration) / 2;
    this.metrics.lastUpdate = Date.now();
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
    this.metrics.lastUpdate = Date.now();
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
    this.metrics.lastUpdate = Date.now();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      nodeCount: 0,
      edgeCount: 0,
      queryCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgQueryTime: 0,
      lastUpdate: Date.now()
    };
  }
}