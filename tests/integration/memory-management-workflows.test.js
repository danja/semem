import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryDomainManager } from '../../src/services/memory/MemoryDomainManager.js';
import { MemoryRelevanceEngine } from '../../src/services/memory/MemoryRelevanceEngine.js';
import Config from '../../src/Config.js';

describe('Memory Management Workflows Integration', () => {
  let testHarness;
  let memoryManager;
  let relevanceEngine;
  let store;
  let config;

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
    
    // Create mock store
    store = {
      store: vi.fn().mockResolvedValue({ success: true, id: 'test-memory-id' }),
      search: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ success: true }),
      dispose: vi.fn().mockResolvedValue(undefined)
    };
    
    memoryManager = new MemoryDomainManager(store, config);
    relevanceEngine = new MemoryRelevanceEngine();
    
    // Create simple test harness mock
    testHarness = {
      callTool: async (toolName, params) => {
        // Simulate MCP tool calls
        switch (toolName) {
          case 'remember':
            return await memoryManager.storeMemory(params);
          case 'recall':
            return { 
              success: true, 
              memories: await memoryManager.getVisibleMemories(
                params.domains?.[0] || 'user', 
                params.query, 
                params
              )
            };
          case 'forget':
            return await memoryManager.fadeMemoryVisibility(
              params.target, 
              params.fadeFactor, 
              params.strategy, 
              params.preserveInstructions
            );
          case 'project_context':
            if (params.action === 'create') {
              return await memoryManager.createDomain('project', params.projectId, params.metadata);
            } else if (params.action === 'switch') {
              return await memoryManager.switchDomain('project', params.projectId);
            } else if (params.action === 'list') {
              return { success: true, projects: [], action: 'list' };
            } else if (params.action === 'archive') {
              return await memoryManager.fadeMemoryVisibility(`project:${params.projectId}`, 0.2);
            }
            break;
          case 'fade_memory':
            return await memoryManager.fadeMemoryVisibility(
              params.domain, 
              params.fadeFactor, 
              params.transition, 
              params.preserveInstructions
            );
          default:
            return { error: `Unknown tool: ${toolName}` };
        }
      },
      cleanup: async () => {},
      config,
      memoryManager,
      relevanceEngine
    };
  });

  afterEach(async () => {
    if (testHarness) {
      await testHarness.cleanup();
    }
    if (memoryManager && memoryManager.dispose) {
      await memoryManager.dispose();
    }
  });

  describe('REMEMBER verb integration', () => {
    it('should store user memory with proper domain assignment', async () => {
      const result = await testHarness.callTool('remember', {
        content: 'User prefers minimal UI designs with dark themes',
        domain: 'user',
        importance: 0.8,
        metadata: {
          tags: ['preferences', 'ui', 'theme'],
          category: 'user-preference'
        }
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('memoryId');
      expect(result.domain).toBe('user');
      expect(result.importance).toBe(0.8);
      
      // Verify memory was stored correctly
      const memories = await memoryManager.getVisibleMemories('user', '', {});
      expect(memories).toHaveLength(1);
      expect(memories[0].content).toContain('minimal UI designs');
    });

    it('should create and switch project contexts', async () => {
      const result = await testHarness.callTool('remember', {
        content: 'Project uses React 18 with TypeScript and Tailwind CSS',
        domain: 'project',
        domainId: 'frontend-app',
        importance: 0.9,
        metadata: {
          tags: ['architecture', 'tech-stack'],
          category: 'project-info',
          technologies: ['React', 'TypeScript', 'Tailwind']
        }
      });

      expect(result).toHaveProperty('success', true);
      expect(result.domain).toBe('project');
      expect(result.domainId).toBe('frontend-app');
      
      // Verify project context was created
      const projectContext = await memoryManager.getCurrentContext();
      expect(projectContext.domain).toBe('project');
      expect(projectContext.domainId).toBe('frontend-app');
    });

    it('should handle session memory with temporal context', async () => {
      const result = await testHarness.callTool('remember', {
        content: 'Currently debugging authentication flow in login component',
        domain: 'session',
        importance: 0.7,
        metadata: {
          tags: ['debugging', 'authentication', 'current-task'],
          category: 'work-session'
        }
      });

      expect(result).toHaveProperty('success', true);
      expect(result.domain).toBe('session');
      
      // Session memories should have automatic temporal markers
      const sessionMemories = await memoryManager.getVisibleMemories('session', '', {});
      expect(sessionMemories).toHaveLength(1);
      expect(sessionMemories[0].timestamp).toBeDefined();
    });

    it('should validate memory content and handle errors', async () => {
      // Test empty content
      const emptyResult = await testHarness.callTool('remember', {
        content: '',
        domain: 'user'
      });

      expect(emptyResult).toHaveProperty('error');
      expect(emptyResult.error).toContain('Content is required');

      // Test invalid domain
      const invalidDomainResult = await testHarness.callTool('remember', {
        content: 'Some content',
        domain: 'invalid-domain'
      });

      expect(invalidDomainResult).toHaveProperty('error');
      expect(invalidDomainResult.error).toContain('Invalid domain');

      // Test invalid importance
      const invalidImportanceResult = await testHarness.callTool('remember', {
        content: 'Some content',
        domain: 'user',
        importance: 1.5 // Over maximum
      });

      expect(invalidImportanceResult).toHaveProperty('success', true);
      expect(invalidImportanceResult.importance).toBe(1.0); // Should clamp to max
    });
  });

  describe('RECALL verb integration', () => {
    beforeEach(async () => {
      // Pre-populate test memories
      const testMemories = [
        {
          content: 'User prefers TypeScript over JavaScript for better type safety',
          domain: 'user',
          importance: 0.9,
          metadata: { tags: ['programming', 'preferences', 'typescript'] }
        },
        {
          content: 'Project structure follows clean architecture principles',
          domain: 'project',
          domainId: 'main-app',
          importance: 0.8,
          metadata: { tags: ['architecture', 'structure'] }
        },
        {
          content: 'Currently working on memory management feature implementation',
          domain: 'session',
          importance: 0.7,
          metadata: { tags: ['current-task', 'development'] }
        },
        {
          content: 'Always use comprehensive error handling in async operations',
          domain: 'instruction',
          importance: 1.0,
          metadata: { tags: ['best-practices', 'error-handling'] }
        }
      ];

      for (const memory of testMemories) {
        await testHarness.callTool('remember', memory);
      }
    });

    it('should retrieve relevant memories with semantic matching', async () => {
      const result = await testHarness.callTool('recall', {
        query: 'programming language preferences',
        domains: ['user'],
        relevanceThreshold: 0.3,
        maxResults: 5
      });

      expect(result).toHaveProperty('success', true);
      expect(result.memories).toBeDefined();
      expect(result.memories.length).toBeGreaterThan(0);

      const memory = result.memories[0];
      expect(memory.content).toContain('TypeScript');
      expect(memory.relevanceScore).toBeGreaterThan(0.3);
      expect(memory.domain).toBe('user');
    });

    it('should filter memories by multiple domains', async () => {
      const result = await testHarness.callTool('recall', {
        query: 'architecture and development',
        domains: ['project', 'session'],
        relevanceThreshold: 0.2,
        maxResults: 10
      });

      expect(result).toHaveProperty('success', true);
      expect(result.memories.length).toBeGreaterThanOrEqual(2);

      const domains = result.memories.map(m => m.domain);
      expect(domains).toContain('project');
      expect(domains).toContain('session');
      expect(domains).not.toContain('user');
      expect(domains).not.toContain('instruction');
    });

    it('should respect relevance threshold filtering', async () => {
      // High threshold should return fewer results
      const highThresholdResult = await testHarness.callTool('recall', {
        query: 'completely unrelated random words xyz',
        domains: ['user', 'project', 'session'],
        relevanceThreshold: 0.8,
        maxResults: 10
      });

      expect(highThresholdResult).toHaveProperty('success', true);
      expect(highThresholdResult.memories.length).toBeLessThanOrEqual(1);

      // Low threshold should return more results
      const lowThresholdResult = await testHarness.callTool('recall', {
        query: 'development programming',
        domains: ['user', 'project', 'session'],
        relevanceThreshold: 0.1,
        maxResults: 10
      });

      expect(lowThresholdResult).toHaveProperty('success', true);
      expect(lowThresholdResult.memories.length).toBeGreaterThan(highThresholdResult.memories.length);
    });

    it('should limit maximum results correctly', async () => {
      const result = await testHarness.callTool('recall', {
        query: 'programming development architecture',
        domains: ['user', 'project', 'session', 'instruction'],
        relevanceThreshold: 0.1,
        maxResults: 2
      });

      expect(result).toHaveProperty('success', true);
      expect(result.memories.length).toBeLessThanOrEqual(2);
    });

    it('should handle temporal range filtering', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const result = await testHarness.callTool('recall', {
        query: 'memory management',
        domains: ['session'],
        timeRange: {
          start: oneDayAgo.toISOString(),
          end: now.toISOString()
        },
        relevanceThreshold: 0.1,
        maxResults: 10
      });

      expect(result).toHaveProperty('success', true);
      // All returned memories should be within the time range
      result.memories.forEach(memory => {
        const memoryDate = new Date(memory.timestamp);
        expect(memoryDate.getTime()).toBeGreaterThanOrEqual(oneDayAgo.getTime());
        expect(memoryDate.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });
  });

  describe('FORGET verb integration', () => {
    beforeEach(async () => {
      // Store test memories to forget
      await testHarness.callTool('remember', {
        content: 'Temporary session data for testing forget functionality',
        domain: 'session',
        importance: 0.6,
        metadata: { tags: ['temporary', 'test-data'] }
      });

      await testHarness.callTool('remember', {
        content: 'Old project context that should be faded',
        domain: 'project',
        domainId: 'old-project',
        importance: 0.5,
        metadata: { tags: ['deprecated', 'old-context'] }
      });
    });

    it('should fade memory visibility using fade strategy', async () => {
      const result = await testHarness.callTool('forget', {
        target: 'session',
        strategy: 'fade',
        fadeFactor: 0.1
      });

      expect(result).toHaveProperty('success', true);
      expect(result.strategy).toBe('fade');
      expect(result.fadeFactor).toBe(0.1);

      // Verify memories are faded, not deleted
      const memories = await memoryManager.getVisibleMemories('session', '', {});
      if (memories.length > 0) {
        // Memories should have reduced visibility scores
        memories.forEach(memory => {
          expect(memory.visibilityScore).toBeLessThan(0.5);
        });
      }
    });

    it('should handle context switching', async () => {
      const result = await testHarness.callTool('forget', {
        target: 'project:old-project',
        strategy: 'context_switch'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.strategy).toBe('context_switch');

      // Context switch should reduce visibility of old context
      const oldProjectMemories = await memoryManager.getVisibleMemories('project', '', { domainId: 'old-project' });
      if (oldProjectMemories.length > 0) {
        oldProjectMemories.forEach(memory => {
          expect(memory.visibilityScore).toBeLessThan(0.3);
        });
      }
    });

    it('should apply temporal decay to memories', async () => {
      const result = await testHarness.callTool('forget', {
        target: 'session',
        strategy: 'temporal_decay'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.strategy).toBe('temporal_decay');

      // Temporal decay should affect older memories more
      const sessionMemories = await memoryManager.getVisibleMemories('session', '', {});
      if (sessionMemories.length > 0) {
        sessionMemories.forEach(memory => {
          const age = Date.now() - new Date(memory.timestamp).getTime();
          const expectedDecay = Math.exp(-age / (1000 * 60 * 60 * 24)); // Daily decay
          expect(memory.visibilityScore).toBeLessThanOrEqual(expectedDecay + 0.1);
        });
      }
    });

    it('should preserve instruction memories when requested', async () => {
      // Add instruction memory
      await testHarness.callTool('remember', {
        content: 'Critical instruction: always validate user input',
        domain: 'instruction',
        importance: 1.0,
        metadata: { tags: ['critical', 'security'] }
      });

      const result = await testHarness.callTool('forget', {
        target: 'all',
        strategy: 'fade',
        fadeFactor: 0.1,
        preserveInstructions: true
      });

      expect(result).toHaveProperty('success', true);

      // Instruction memories should remain visible
      const instructionMemories = await memoryManager.getVisibleMemories('instruction', '', {});
      expect(instructionMemories.length).toBeGreaterThan(0);
      instructionMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeGreaterThan(0.7);
      });
    });
  });

  describe('PROJECT_CONTEXT verb integration', () => {
    it('should create new project with metadata', async () => {
      const result = await testHarness.callTool('project_context', {
        projectId: 'new-frontend-app',
        action: 'create',
        metadata: {
          name: 'Frontend Application',
          description: 'React-based frontend for the main application',
          technologies: ['React', 'TypeScript', 'Tailwind CSS'],
          status: 'active'
        }
      });

      expect(result).toHaveProperty('success', true);
      expect(result.action).toBe('create');
      expect(result.projectId).toBe('new-frontend-app');
      expect(result.metadata.name).toBe('Frontend Application');

      // Verify project context is active
      const context = await memoryManager.getCurrentContext();
      expect(context.domain).toBe('project');
      expect(context.domainId).toBe('new-frontend-app');
    });

    it('should switch between project contexts', async () => {
      // Create first project
      await testHarness.callTool('project_context', {
        projectId: 'project-alpha',
        action: 'create',
        metadata: { name: 'Project Alpha' }
      });

      // Create second project
      await testHarness.callTool('project_context', {
        projectId: 'project-beta',
        action: 'create',
        metadata: { name: 'Project Beta' }
      });

      // Switch back to first project
      const result = await testHarness.callTool('project_context', {
        projectId: 'project-alpha',
        action: 'switch'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.action).toBe('switch');
      expect(result.projectId).toBe('project-alpha');

      // Verify context switched
      const context = await memoryManager.getCurrentContext();
      expect(context.domainId).toBe('project-alpha');
    });

    it('should list available projects', async () => {
      // Create multiple projects
      const projects = ['proj-1', 'proj-2', 'proj-3'];
      for (const projectId of projects) {
        await testHarness.callTool('project_context', {
          projectId,
          action: 'create',
          metadata: { name: `Project ${projectId}` }
        });
      }

      const result = await testHarness.callTool('project_context', {
        action: 'list'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.action).toBe('list');
      expect(result.projects).toBeDefined();
      expect(result.projects.length).toBeGreaterThanOrEqual(3);

      const projectIds = result.projects.map(p => p.projectId);
      projects.forEach(projectId => {
        expect(projectIds).toContain(projectId);
      });
    });

    it('should archive projects', async () => {
      // Create project
      await testHarness.callTool('project_context', {
        projectId: 'archive-test-project',
        action: 'create',
        metadata: { name: 'Archive Test Project' }
      });

      // Archive it
      const result = await testHarness.callTool('project_context', {
        projectId: 'archive-test-project',
        action: 'archive'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.action).toBe('archive');

      // Archived project should have reduced visibility
      const archivedMemories = await memoryManager.getVisibleMemories('project', '', { 
        domainId: 'archive-test-project' 
      });
      archivedMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeLessThan(0.3);
      });
    });
  });

  describe('FADE_MEMORY verb integration', () => {
    beforeEach(async () => {
      // Create memories in different domains
      await testHarness.callTool('remember', {
        content: 'User session data to be faded',
        domain: 'session',
        importance: 0.6
      });

      await testHarness.callTool('remember', {
        content: 'Project context to be faded',
        domain: 'project',
        domainId: 'fade-test-project',
        importance: 0.7
      });

      await testHarness.callTool('remember', {
        content: 'Important instruction to preserve',
        domain: 'instruction',
        importance: 1.0
      });
    });

    it('should fade domain memories smoothly', async () => {
      const result = await testHarness.callTool('fade_memory', {
        domain: 'session',
        fadeFactor: 0.2,
        transition: 'smooth'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.domain).toBe('session');
      expect(result.transition).toBe('smooth');

      // Session memories should be faded
      const sessionMemories = await memoryManager.getVisibleMemories('session', '', {});
      sessionMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeLessThan(0.5);
      });
    });

    it('should fade immediately when specified', async () => {
      const result = await testHarness.callTool('fade_memory', {
        domain: 'project',
        fadeFactor: 0.1,
        transition: 'immediate'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.transition).toBe('immediate');

      // Project memories should be heavily faded
      const projectMemories = await memoryManager.getVisibleMemories('project', '', {});
      projectMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeLessThan(0.2);
      });
    });

    it('should preserve instruction memories when specified', async () => {
      const result = await testHarness.callTool('fade_memory', {
        domain: 'all',
        fadeFactor: 0.05,
        preserveInstructions: true
      });

      expect(result).toHaveProperty('success', true);

      // Instruction memories should remain highly visible
      const instructionMemories = await memoryManager.getVisibleMemories('instruction', '', {});
      instructionMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeGreaterThan(0.8);
      });

      // Other memories should be faded
      const sessionMemories = await memoryManager.getVisibleMemories('session', '', {});
      sessionMemories.forEach(memory => {
        expect(memory.visibilityScore).toBeLessThan(0.2);
      });
    });
  });

  describe('Cross-domain memory interactions', () => {
    it('should maintain domain isolation while allowing cross-references', async () => {
      // Store related memories in different domains
      await testHarness.callTool('remember', {
        content: 'User prefers React for frontend development',
        domain: 'user',
        importance: 0.8,
        metadata: { tags: ['react', 'frontend', 'preferences'] }
      });

      await testHarness.callTool('project_context', {
        projectId: 'react-app',
        action: 'create',
        metadata: { name: 'React Application', technologies: ['React'] }
      });

      await testHarness.callTool('remember', {
        content: 'This project uses React as requested by user preferences',
        domain: 'project',
        domainId: 'react-app',
        importance: 0.7,
        metadata: { tags: ['react', 'architecture'], references: ['user:preferences'] }
      });

      // Search should find related memories across domains
      const result = await testHarness.callTool('recall', {
        query: 'React frontend development',
        domains: ['user', 'project'],
        relevanceThreshold: 0.3,
        maxResults: 5
      });

      expect(result.memories.length).toBeGreaterThanOrEqual(2);
      
      const domains = result.memories.map(m => m.domain);
      expect(domains).toContain('user');
      expect(domains).toContain('project');
    });

    it('should handle complex relevance scoring across domains', async () => {
      // Create hierarchical memory structure
      await testHarness.callTool('remember', {
        content: 'Always follow SOLID principles in software design',
        domain: 'instruction',
        importance: 1.0,
        metadata: { tags: ['principles', 'software-design'] }
      });

      await testHarness.callTool('remember', {
        content: 'User values clean, maintainable code architecture',
        domain: 'user',
        importance: 0.9,
        metadata: { tags: ['preferences', 'code-quality'] }
      });

      await testHarness.callTool('remember', {
        content: 'Current project implements clean architecture following SOLID principles',
        domain: 'project',
        domainId: 'clean-project',
        importance: 0.8,
        metadata: { tags: ['architecture', 'clean-code'] }
      });

      const result = await testHarness.callTool('recall', {
        query: 'clean code architecture principles',
        domains: ['instruction', 'user', 'project'],
        relevanceThreshold: 0.4,
        maxResults: 10
      });

      expect(result.memories.length).toBe(3);
      
      // Instruction should have highest relevance
      const instructionMemory = result.memories.find(m => m.domain === 'instruction');
      expect(instructionMemory.relevanceScore).toBeGreaterThan(0.8);

      // All memories should be above threshold
      result.memories.forEach(memory => {
        expect(memory.relevanceScore).toBeGreaterThan(0.4);
      });
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle storage backend failures gracefully', async () => {
      // Mock storage failure
      const originalStore = testHarness.config.store;
      testHarness.config.store = {
        search: vi.fn().mockRejectedValue(new Error('Storage connection failed')),
        store: vi.fn().mockRejectedValue(new Error('Storage connection failed'))
      };

      const result = await testHarness.callTool('remember', {
        content: 'Test memory during storage failure',
        domain: 'user',
        importance: 0.5
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Storage connection failed');

      // Restore original store
      testHarness.config.store = originalStore;
    });

    it('should validate memory operations with proper error messages', async () => {
      const testCases = [
        {
          operation: 'remember',
          params: { domain: 'user' }, // Missing content
          expectedError: 'Content is required'
        },
        {
          operation: 'recall',
          params: { domains: ['user'] }, // Missing query
          expectedError: 'Query is required'
        },
        {
          operation: 'forget',
          params: {}, // Missing target
          expectedError: 'Target is required'
        },
        {
          operation: 'project_context',
          params: { action: 'switch' }, // Missing projectId
          expectedError: 'Project ID is required'
        }
      ];

      for (const testCase of testCases) {
        const result = await testHarness.callTool(testCase.operation, testCase.params);
        expect(result).toHaveProperty('error');
        expect(result.error).toContain(testCase.expectedError);
      }
    });

    it('should handle concurrent memory operations correctly', async () => {
      // Execute multiple memory operations concurrently
      const concurrentOperations = [
        testHarness.callTool('remember', {
          content: 'Concurrent memory 1',
          domain: 'user',
          importance: 0.5
        }),
        testHarness.callTool('remember', {
          content: 'Concurrent memory 2',
          domain: 'session',
          importance: 0.6
        }),
        testHarness.callTool('remember', {
          content: 'Concurrent memory 3',
          domain: 'project',
          domainId: 'concurrent-test',
          importance: 0.7
        })
      ];

      const results = await Promise.all(concurrentOperations);

      // All operations should succeed
      results.forEach(result => {
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('memoryId');
      });

      // Verify all memories were stored
      const recallResult = await testHarness.callTool('recall', {
        query: 'concurrent memory',
        domains: ['user', 'session', 'project'],
        relevanceThreshold: 0.1,
        maxResults: 10
      });

      expect(recallResult.memories.length).toBeGreaterThanOrEqual(3);
    });
  });
});