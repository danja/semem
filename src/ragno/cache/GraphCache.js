/**
 * Graph Cache Implementation
 * Provides caching for graph operations and queries
 */

export default class GraphCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 60000; // 1 minute default TTL
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key, value, ttl = this.ttl) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}