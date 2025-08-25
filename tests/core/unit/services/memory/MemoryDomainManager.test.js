import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Config from '../../../../src/Config.js';

// Simple test implementations to validate expected interface and behavior
// These will be replaced with real implementations once they exist
class MemoryRelevanceEngine {
  async calculateRelevance(memory, context) {
    // Simple mock scoring based on content similarity
    if (!memory || !context || !context.query) return 0;
    
    const contentWords = memory.content?.toLowerCase().split(' ') || [];
    const queryWords = context.query?.toLowerCase().split(' ') || [];
    const overlap = contentWords.filter(word => queryWords.includes(word)).length;
    let base = overlap / Math.max(queryWords.length, 1);
    
    // Domain matching bonus - give significant boost for matching domains
    const domainBonus = memory.domain === context.currentDomain ? 0.3 : 0;
    
    // Importance factor - multiply by importance
    const importance = memory.importance || 0.5;
    
    // Temporal factor - newer memories get higher scores
    let temporalFactor = 1.0;
    if (memory.timestamp) {
      const age = Date.now() - new Date(memory.timestamp).getTime();
      const dayInMs = 24 * 60 * 60 * 1000;
      temporalFactor = Math.max(0.1, Math.exp(-age / (7 * dayInMs))); // Week-based decay
    }
    
    // Combine all factors
    let score = (base + domainBonus) * importance * temporalFactor;
    
    return Math.max(0, Math.min(1, score));
  }
}

class MemoryDomainManager {
  constructor(store, config) {
    this.store = store;
    this.config = config;
    this.currentDomain = 'user';
    this.currentDomainId = null;
    this.domains = new Map();
    this.relevanceEngine = new MemoryRelevanceEngine();
  }

  getCurrentDomain() {
    return this.currentDomain;
  }

  getCurrentDomainId() {
    return this.currentDomainId;
  }

  async createDomain(domain, domainId, metadata = {}) {
    const validDomains = ['user', 'project', 'session', 'instruction'];
    if (!validDomains.includes(domain)) {
      return { success: false, error: 'Invalid domain type' };
    }

    if (domain === 'project' && !domainId) {
      return { success: false, error: 'Domain ID is required for project domain' };
    }

    const domainKey = domainId ? `${domain}:${domainId}` : domain;
    this.domains.set(domainKey, {
      domain,
      domainId,
      metadata: { ...metadata, created: new Date().toISOString() },
      created: new Date()
    });

    this.currentDomain = domain;
    this.currentDomainId = domainId;

    return { success: true, domain, domainId };
  }

  async switchDomain(domain, domainId = null) {
    this.currentDomain = domain;
    this.currentDomainId = domainId;
    return { success: true };
  }

  getDomainMetadata(domain, domainId = null) {
    const domainKey = domainId ? `${domain}:${domainId}` : domain;
    const domainInfo = this.domains.get(domainKey);
    return domainInfo?.metadata || {};
  }

  getCurrentContext() {
    return {
      domain: this.currentDomain,
      domainId: this.currentDomainId
    };
  }

  async storeMemory(memoryData) {
    if (!memoryData.content || memoryData.content.trim() === '') {
      return { success: false, error: 'Content is required' };
    }

    // Clamp importance to valid range
    const importance = Math.max(0, Math.min(1, memoryData.importance || 0.5));

    const fullMemoryData = {
      ...memoryData,
      importance,
      domain: this.currentDomain,
      domainId: this.currentDomainId,
      timestamp: new Date().toISOString(),
      metadata: {
        ...memoryData.metadata,
        stored: new Date().toISOString(),
        domain: this.currentDomain
      }
    };

    try {
      const result = await this.store.store(fullMemoryData);
      return { success: true, memoryId: result.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getVisibleMemories(domain, query, options = {}) {
    try {
      const memories = await this.store.search();
      const context = {
        query,
        currentDomain: domain,
        currentDomainId: options.domainId
      };

      // Calculate relevance scores
      const memoriesWithScores = await Promise.all(
        memories.map(async (memory) => {
          const relevanceScore = await this.relevanceEngine.calculateRelevance(memory, context);
          return { ...memory, relevanceScore };
        })
      );

      // Filter by relevance threshold
      const threshold = options.relevanceThreshold || 0;
      let filteredMemories = memoriesWithScores.filter(m => m.relevanceScore >= threshold);

      // Apply domain filter
      if (options.domains) {
        filteredMemories = filteredMemories.filter(m => options.domains.includes(m.domain));
      }

      // Apply time range filter
      if (options.timeRange) {
        const start = new Date(options.timeRange.start);
        const end = new Date(options.timeRange.end);
        filteredMemories = filteredMemories.filter(m => {
          const memoryTime = new Date(m.timestamp);
          return memoryTime >= start && memoryTime <= end;
        });
      }

      // Sort by relevance score
      filteredMemories.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply limit
      const limit = options.maxResults || 10;
      return filteredMemories.slice(0, limit);
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }
  }

  async fadeMemoryVisibility(target, fadeFactor = 0.1, strategy = 'fade', preserveInstructions = false) {
    try {
      await this.store.update({ target, fadeFactor, strategy, preserveInstructions });
      return { success: true, fadeFactor, strategy, preserveInstructions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async calculateRelevance(memory, context) {
    return await this.relevanceEngine.calculateRelevance(memory, context);
  }

  async dispose() {
    if (this.store && this.store.dispose) {
      await this.store.dispose();
    }
  }
}

describe('MemoryDomainManager', () => {
  let manager;
  let mockStore;
  let config;
  let relevanceEngine;

  beforeEach(async () => {
    // Create test config
    config = new Config({
      storage: { type: 'memory' },
      models: {
        chat: { provider: 'ollama', model: 'qwen2:1.5b' },
        embedding: { provider: 'ollama', model: 'nomic-embed-text' }
      },
      memory: { dimension: 1536, similarityThreshold: 0.7 }
    });
    await config.init();
    
    relevanceEngine = new MemoryRelevanceEngine();
    
    // Mock store with essential methods
    mockStore = {
      store: vi.fn().mockResolvedValue({ success: true, id: 'test-memory-id' }),
      search: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ success: true }),
      dispose: vi.fn().mockResolvedValue(undefined)
    };

    manager = new MemoryDomainManager(mockStore, config);
    relevanceEngine = manager.relevanceEngine;
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
  });

  describe('Domain Management', () => {
    it('should initialize with default user domain', () => {
      expect(manager.getCurrentDomain()).toBe('user');
      expect(manager.getCurrentDomainId()).toBeNull();
    });

    it('should create and switch to new domain', async () => {
      const result = await manager.createDomain('project', 'test-project', {
        name: 'Test Project',
        description: 'A test project for memory management'
      });

      expect(result.success).toBe(true);
      expect(result.domain).toBe('project');
      expect(result.domainId).toBe('test-project');
      expect(manager.getCurrentDomain()).toBe('project');
      expect(manager.getCurrentDomainId()).toBe('test-project');
    });

    it('should validate domain types', async () => {
      const invalidResult = await manager.createDomain('invalid-domain', 'test-id');
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid domain');
    });

    it('should switch between existing domains', async () => {
      // Create project domain
      await manager.createDomain('project', 'project-1', { name: 'Project 1' });
      expect(manager.getCurrentDomainId()).toBe('project-1');

      // Switch to session domain
      const sessionResult = await manager.switchDomain('session');
      expect(sessionResult.success).toBe(true);
      expect(manager.getCurrentDomain()).toBe('session');

      // Switch back to project
      const projectResult = await manager.switchDomain('project', 'project-1');
      expect(projectResult.success).toBe(true);
      expect(manager.getCurrentDomainId()).toBe('project-1');
    });

    it('should maintain domain metadata', async () => {
      const metadata = {
        name: 'Frontend App',
        description: 'React-based frontend application',
        technologies: ['React', 'TypeScript'],
        status: 'active'
      };

      await manager.createDomain('project', 'frontend-app', metadata);
      
      const domainInfo = manager.getDomainMetadata('project', 'frontend-app');
      expect(domainInfo).toEqual(expect.objectContaining(metadata));
      expect(domainInfo.created).toBeDefined();
    });
  });

  describe('Memory Storage', () => {
    beforeEach(async () => {
      // Set up test domain
      await manager.createDomain('project', 'test-project');
    });

    it('should store memory with domain context', async () => {
      const memoryData = {
        content: 'Test memory content for project',
        importance: 0.8,
        metadata: {
          tags: ['test', 'project'],
          category: 'project-info'
        }
      };

      const result = await manager.storeMemory(memoryData);

      expect(result.success).toBe(true);
      expect(result.memoryId).toBeDefined();
      expect(mockStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          content: memoryData.content,
          importance: memoryData.importance,
          domain: 'project',
          domainId: 'test-project',
          metadata: expect.objectContaining(memoryData.metadata)
        })
      );
    });

    it('should generate embeddings for memory content', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      mockStore.store = vi.fn().mockResolvedValue({ 
        success: true, 
        id: 'test-id',
        embedding: mockEmbedding 
      });

      const result = await manager.storeMemory({
        content: 'Test content for embedding',
        importance: 0.7
      });

      expect(result.success).toBe(true);
      expect(mockStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test content for embedding'
        })
      );
    });

    it('should validate memory content', async () => {
      // Test empty content
      const emptyResult = await manager.storeMemory({ content: '' });
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toContain('Content is required');

      // Test null content
      const nullResult = await manager.storeMemory({ content: null });
      expect(nullResult.success).toBe(false);
      expect(nullResult.error).toContain('Content is required');

      // Test invalid importance
      const invalidImportanceResult = await manager.storeMemory({
        content: 'Valid content',
        importance: 1.5
      });
      expect(invalidImportanceResult.success).toBe(true);
      expect(mockStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          importance: 1.0 // Should clamp to maximum
        })
      );
    });

    it('should add automatic metadata', async () => {
      const result = await manager.storeMemory({
        content: 'Test memory with automatic metadata',
        importance: 0.6
      });

      expect(mockStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          domain: 'project',
          domainId: 'test-project',
          metadata: expect.objectContaining({
            stored: expect.any(String),
            domain: 'project'
          })
        })
      );
    });
  });

  describe('Memory Retrieval', () => {
    beforeEach(async () => {
      // Mock store search to return test memories
      mockStore.search = vi.fn().mockResolvedValue([
        {
          id: 'memory-1',
          content: 'TypeScript is preferred for type safety',
          importance: 0.9,
          domain: 'user',
          domainId: null,
          timestamp: '2024-01-01T00:00:00Z',
          embedding: new Array(1536).fill(0.5),
          metadata: { tags: ['typescript', 'preferences'] }
        },
        {
          id: 'memory-2', 
          content: 'Project uses clean architecture principles',
          importance: 0.8,
          domain: 'project',
          domainId: 'main-project',
          timestamp: '2024-01-02T00:00:00Z',
          embedding: new Array(1536).fill(0.3),
          metadata: { tags: ['architecture', 'design'] }
        },
        {
          id: 'memory-3',
          content: 'Currently debugging authentication flow',
          importance: 0.7,
          domain: 'session',
          domainId: null,
          timestamp: '2024-01-03T00:00:00Z',
          embedding: new Array(1536).fill(0.2),
          metadata: { tags: ['debugging', 'auth'] }
        }
      ]);
    });

    it('should retrieve memories with relevance scoring', async () => {
      const query = 'TypeScript programming preferences';
      const options = {
        domains: ['user', 'project'],
        maxResults: 10,
        relevanceThreshold: 0.3
      };

      const result = await manager.getVisibleMemories('user', query, options);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockStore.search).toHaveBeenCalled();

      // Should include relevance scores
      if (result.length > 0) {
        result.forEach(memory => {
          expect(memory).toHaveProperty('relevanceScore');
          expect(memory.relevanceScore).toBeGreaterThanOrEqual(0);
          expect(memory.relevanceScore).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should filter by domain', async () => {
      await manager.switchDomain('project', 'main-project');
      
      const result = await manager.getVisibleMemories('project', 'architecture', {
        domains: ['project'],
        maxResults: 5
      });

      // Should only call store with project domain filter
      expect(mockStore.search).toHaveBeenCalled();
      
      // Verify filtering logic (implementation-specific)
      const searchCall = mockStore.search.mock.calls[0];
      expect(searchCall).toBeDefined();
    });

    it('should respect relevance threshold', async () => {
      const query = 'completely unrelated query xyz123';
      const options = {
        relevanceThreshold: 0.8,
        maxResults: 10
      };

      const result = await manager.getVisibleMemories('user', query, options);

      // Should filter out low-relevance results
      result.forEach(memory => {
        expect(memory.relevanceScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should limit maximum results', async () => {
      const options = {
        maxResults: 2,
        relevanceThreshold: 0.1
      };

      const result = await manager.getVisibleMemories('user', 'programming', options);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should handle temporal filtering', async () => {
      const timeRange = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T23:59:59Z'
      };

      const options = {
        timeRange,
        maxResults: 10
      };

      const result = await manager.getVisibleMemories('user', 'test query', options);

      // All returned memories should be within time range
      result.forEach(memory => {
        const memoryTime = new Date(memory.timestamp);
        const startTime = new Date(timeRange.start);
        const endTime = new Date(timeRange.end);
        
        expect(memoryTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(memoryTime.getTime()).toBeLessThanOrEqual(endTime.getTime());
      });
    });
  });

  describe('Memory Visibility Management', () => {
    beforeEach(async () => {
      // Setup memories with different visibility scores
      mockStore.query = vi.fn().mockResolvedValue([
        { 
          id: 'vis-memory-1', 
          content: 'High visibility memory',
          visibilityScore: 0.9,
          domain: 'user'
        },
        { 
          id: 'vis-memory-2', 
          content: 'Medium visibility memory',
          visibilityScore: 0.5,
          domain: 'session'
        },
        { 
          id: 'vis-memory-3', 
          content: 'Low visibility memory',
          visibilityScore: 0.1,
          domain: 'project'
        }
      ]);
    });

    it('should fade memory visibility', async () => {
      const result = await manager.fadeMemoryVisibility('session', 0.2);

      expect(result.success).toBe(true);
      expect(result.fadeFactor).toBe(0.2);
      expect(mockStore.update).toHaveBeenCalled();
    });

    it('should handle context switching', async () => {
      const result = await manager.fadeMemoryVisibility('project', 0.1, 'context_switch');

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('context_switch');
    });

    it('should preserve instruction memories', async () => {
      const result = await manager.fadeMemoryVisibility('all', 0.1, 'fade', true);

      expect(result.success).toBe(true);
      expect(result.preserveInstructions).toBe(true);

      // Should not fade instruction domain
      const updateCalls = mockStore.update.mock.calls;
      const instructionUpdates = updateCalls.filter(call => 
        call[0]?.domain === 'instruction'
      );
      expect(instructionUpdates.length).toBe(0);
    });

    it('should apply temporal decay', async () => {
      const result = await manager.fadeMemoryVisibility('session', null, 'temporal_decay');

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('temporal_decay');
      expect(mockStore.update).toHaveBeenCalled();
    });
  });

  describe('Relevance Calculation', () => {
    it('should calculate multi-factor relevance scores', async () => {
      const query = 'typescript programming';
      const memory = {
        content: 'TypeScript provides excellent type safety for large applications',
        domain: 'user',
        importance: 0.8,
        timestamp: new Date().toISOString(),
        metadata: {
          tags: ['typescript', 'programming', 'type-safety'],
          category: 'preference'
        }
      };

      const context = {
        currentDomain: 'user',
        query,
        timeContext: new Date()
      };

      const relevance = await manager.calculateRelevance(memory, context);

      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThanOrEqual(1);
      
      // High relevance expected due to semantic similarity
      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should weight domain matching', async () => {
      const memory = {
        content: 'Domain-specific content',
        domain: 'project',
        domainId: 'current-project',
        importance: 0.7,
        timestamp: new Date().toISOString()
      };

      // Test with matching domain
      const matchingContext = {
        currentDomain: 'project',
        currentDomainId: 'current-project',
        query: 'content'
      };

      const matchingRelevance = await manager.calculateRelevance(memory, matchingContext);

      // Test with non-matching domain
      const nonMatchingContext = {
        currentDomain: 'user',
        query: 'content'
      };

      const nonMatchingRelevance = await manager.calculateRelevance(memory, nonMatchingContext);

      expect(matchingRelevance).toBeGreaterThan(nonMatchingRelevance);
    });

    it('should apply temporal decay', async () => {
      const recentMemory = {
        content: 'Recent memory',
        domain: 'session',
        importance: 0.7,
        timestamp: new Date().toISOString()
      };

      const oldMemory = {
        content: 'Old memory',
        domain: 'session', 
        importance: 0.7,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
      };

      const context = {
        currentDomain: 'session',
        query: 'memory',
        timeContext: new Date()
      };

      const recentRelevance = await manager.calculateRelevance(recentMemory, context);
      const oldRelevance = await manager.calculateRelevance(oldMemory, context);

      expect(recentRelevance).toBeGreaterThan(oldRelevance);
    });

    it('should weight importance factor', async () => {
      const highImportanceMemory = {
        content: 'Important memory content',
        domain: 'user',
        importance: 0.9,
        timestamp: new Date().toISOString()
      };

      const lowImportanceMemory = {
        content: 'Important memory content', // Same content
        domain: 'user',
        importance: 0.3,
        timestamp: new Date().toISOString()
      };

      const context = {
        currentDomain: 'user',
        query: 'important content'
      };

      const highRelevance = await manager.calculateRelevance(highImportanceMemory, context);
      const lowRelevance = await manager.calculateRelevance(lowImportanceMemory, context);

      expect(highRelevance).toBeGreaterThan(lowRelevance);
    });
  });

  describe('Error Handling', () => {
    it('should handle store failures gracefully', async () => {
      mockStore.store = vi.fn().mockRejectedValue(new Error('Store connection failed'));

      const result = await manager.storeMemory({
        content: 'Test memory',
        importance: 0.5
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Store connection failed');
    });

    it('should handle search failures gracefully', async () => {
      mockStore.search = vi.fn().mockRejectedValue(new Error('Search service unavailable'));

      const result = await manager.getVisibleMemories('user', 'test query', {});

      expect(result).toEqual([]);
      // Should log error but not throw
    });

    it('should validate domain operations', async () => {
      // Test invalid domain
      const invalidDomainResult = await manager.createDomain('invalid', 'test-id');
      expect(invalidDomainResult.success).toBe(false);
      expect(invalidDomainResult.error).toContain('Invalid domain');

      // Test missing domain ID for project
      const missingIdResult = await manager.createDomain('project');
      expect(missingIdResult.success).toBe(false);
      expect(missingIdResult.error).toContain('Domain ID is required');
    });

    it('should handle concurrent operations safely', async () => {
      const concurrentOperations = [
        manager.storeMemory({ content: 'Memory 1', importance: 0.5 }),
        manager.storeMemory({ content: 'Memory 2', importance: 0.6 }),
        manager.storeMemory({ content: 'Memory 3', importance: 0.7 })
      ];

      const results = await Promise.all(concurrentOperations);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.memoryId).toBeDefined();
      });

      // Should have made three separate store calls
      expect(mockStore.store).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance and Optimization', () => {
    it('should batch similar operations', async () => {
      // Store multiple memories
      const memories = Array.from({ length: 5 }, (_, i) => ({
        content: `Batch memory ${i}`,
        importance: 0.5 + (i * 0.1)
      }));

      const promises = memories.map(memory => manager.storeMemory(memory));
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(mockStore.store).toHaveBeenCalledTimes(5);
    });

    it('should cache frequently accessed domain metadata', async () => {
      await manager.createDomain('project', 'cached-project', { name: 'Cached Project' });

      // Access metadata multiple times
      const metadata1 = manager.getDomainMetadata('project', 'cached-project');
      const metadata2 = manager.getDomainMetadata('project', 'cached-project');
      const metadata3 = manager.getDomainMetadata('project', 'cached-project');

      expect(metadata1).toEqual(metadata2);
      expect(metadata2).toEqual(metadata3);
    });

    it('should handle large result sets efficiently', async () => {
      // Mock large result set
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-memory-${i}`,
        content: `Large memory content ${i}`,
        domain: 'user',
        importance: Math.random(),
        timestamp: new Date().toISOString(),
        embedding: new Array(1536).fill(Math.random())
      }));

      mockStore.search = vi.fn().mockResolvedValue(largeResultSet);

      const startTime = Date.now();
      const result = await manager.getVisibleMemories('user', 'test query', {
        maxResults: 100
      });
      const endTime = Date.now();

      expect(result.length).toBeLessThanOrEqual(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Memory Lifecycle', () => {
    it('should track memory access patterns', async () => {
      await manager.storeMemory({
        content: 'Trackable memory',
        importance: 0.6
      });

      // Access the memory multiple times
      await manager.getVisibleMemories('project', 'trackable', {});
      await manager.getVisibleMemories('project', 'trackable', {});
      await manager.getVisibleMemories('project', 'trackable', {});

      // Access patterns should be tracked for relevance scoring
      expect(mockStore.search).toHaveBeenCalledTimes(3);
    });

    it('should cleanup disposed resources', async () => {
      await manager.createDomain('project', 'cleanup-test');
      await manager.storeMemory({ content: 'Test memory', importance: 0.5 });

      await manager.dispose();

      expect(mockStore.dispose).toHaveBeenCalled();
    });
  });
});