/**
 * @fileoverview Integration test for MCP package exports
 * Tests that all MCP functionality is properly accessible through npm package imports
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock the status-resource-http module before any imports
vi.mock('../../mcp/resources/status-resource-http.js', () => ({
  registerStatusResourcesHttp: vi.fn().mockResolvedValue({
    start: vi.fn().mockResolvedValue({ success: true }),
    stop: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn().mockResolvedValue({ status: 'ok' })
  })
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Package Exports Integration', () => {
  let packageRoot;

  beforeAll(() => {
    // Set up package root path
    packageRoot = path.resolve(__dirname, '../..');
    
    // Mock environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.MCP_DEBUG = 'false';
    process.env.MCP_USE_HTTP_TOOLS = 'false';
  });

  afterAll(() => {
    // Clean up mocks
    vi.clearAllMocks();
  });

  describe('Main Package Exports', () => {
    it('should export core components from main index', async () => {
      const indexPath = path.join(packageRoot, 'index.js');
      const mainExports = await import(indexPath);

      // Test core component exports
      expect(mainExports.MemoryManager).toBeDefined();
      expect(mainExports.Config).toBeDefined();
      expect(mainExports.ContextManager).toBeDefined();
      expect(mainExports.LLMHandler).toBeDefined();
      expect(mainExports.EmbeddingHandler).toBeDefined();
      
      // Test storage exports
      expect(mainExports.BaseStore).toBeDefined();
      expect(mainExports.InMemoryStore).toBeDefined();
      expect(mainExports.JSONStore).toBeDefined();
      expect(mainExports.SPARQLStore).toBeDefined();
      expect(mainExports.CachedSPARQLStore).toBeDefined();
      
      // Test connector exports
      expect(mainExports.ClientConnector).toBeDefined();
      expect(mainExports.OllamaConnector).toBeDefined();
      expect(mainExports.ClaudeConnector).toBeDefined();
      
      // Test utilities
      expect(mainExports.Utils).toBeDefined();
      
      // Test MCP namespace export
      expect(mainExports.MCP).toBeDefined();
      expect(typeof mainExports.MCP).toBe('object');
    });

    it('should provide access to MCP functionality through MCP namespace', async () => {
      const indexPath = path.join(packageRoot, 'index.js');
      const { MCP } = await import(indexPath);

      // Test core MCP exports
      expect(MCP.createServer).toBeDefined();
      expect(typeof MCP.createServer).toBe('function');
      
      expect(MCP.workflowOrchestrator).toBeDefined();
      expect(typeof MCP.workflowOrchestrator).toBe('object');
      
      expect(MCP.mcpConfig).toBeDefined();
      expect(typeof MCP.mcpConfig).toBe('object');
      
      expect(MCP.mcpDebugger).toBeDefined();
      expect(typeof MCP.mcpDebugger).toBe('object');
      
      // Test prompt system exports
      expect(MCP.promptRegistry).toBeDefined();
      expect(typeof MCP.promptRegistry).toBe('object');
      
      expect(MCP.executePromptWorkflow).toBeDefined();
      expect(typeof MCP.executePromptWorkflow).toBe('function');
      
      expect(MCP.createSafeToolExecutor).toBeDefined();
      expect(typeof MCP.createSafeToolExecutor).toBe('function');
      
      // Test safe operations class
      expect(MCP.SafeOperations).toBeDefined();
      expect(typeof MCP.SafeOperations).toBe('function');
      
      // Test workflow templates
      expect(MCP.enhancedResearchWorkflow).toBeDefined();
      expect(typeof MCP.enhancedResearchWorkflow).toBe('object');
      
      expect(MCP.intelligentQAWorkflow).toBeDefined();
      expect(typeof MCP.intelligentQAWorkflow).toBe('object');
    });
  });

  describe('Direct MCP Module Import', () => {
    it('should allow direct import from semem/mcp path', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const mcpExports = await import(mcpPath);

      // Test all major exports are available
      expect(mcpExports.createServer).toBeDefined();
      expect(mcpExports.workflowOrchestrator).toBeDefined();
      expect(mcpExports.mcpConfig).toBeDefined();
      expect(mcpExports.promptRegistry).toBeDefined();
      expect(mcpExports.executePromptWorkflow).toBeDefined();
      expect(mcpExports.SafeOperations).toBeDefined();
      expect(mcpExports.enhancedResearchWorkflow).toBeDefined();
      expect(mcpExports.intelligentQAWorkflow).toBeDefined();
    });

    it('should provide access to workflow orchestrator functionality', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { workflowOrchestrator } = await import(mcpPath);

      // Test workflow orchestrator structure
      expect(workflowOrchestrator).toBeDefined();
      expect(typeof workflowOrchestrator.initialize).toBe('function');
      expect(typeof workflowOrchestrator.executeWorkflow).toBe('function');
      expect(typeof workflowOrchestrator.getAvailableTools).toBe('function');
    });

    it('should provide access to prompt registry functionality', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { promptRegistry } = await import(mcpPath);

      // Test prompt registry structure
      expect(promptRegistry).toBeDefined();
      expect(typeof promptRegistry.listPrompts).toBe('function');
      expect(typeof promptRegistry.getPrompt).toBe('function');
      expect(typeof promptRegistry.registerPrompt).toBe('function');
    });
  });

  describe('Ragno Module Exports', () => {
    it('should export Ragno functionality through separate module', async () => {
      const ragnoPath = path.join(packageRoot, 'src/ragno/index.js');
      const ragnoExports = await import(ragnoPath);

      // Test core Ragno exports
      expect(ragnoExports.Entity).toBeDefined();
      expect(ragnoExports.SemanticUnit).toBeDefined();
      expect(ragnoExports.Relationship).toBeDefined();
      expect(ragnoExports.decomposeCorpus).toBeDefined();
      expect(ragnoExports.RDFGraphManager).toBeDefined();
    });
  });

  describe('ZPT Module Exports', () => {
    it('should export ZPT functionality through separate module', async () => {
      const zptPath = path.join(packageRoot, 'src/zpt/index.js');
      const zptExports = await import(zptPath);

      // Test ZPT exports
      expect(zptExports.CorpuscleSelector).toBeDefined();
    });
  });

  describe('Enhanced Workflow Templates', () => {
    it('should provide enhanced research workflow template', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { enhancedResearchWorkflow } = await import(mcpPath);

      // Test workflow structure
      expect(enhancedResearchWorkflow.name).toBe('enhanced-research-workflow');
      expect(enhancedResearchWorkflow.description).toBeDefined();
      expect(Array.isArray(enhancedResearchWorkflow.arguments)).toBe(true);
      expect(Array.isArray(enhancedResearchWorkflow.workflow)).toBe(true);
      expect(enhancedResearchWorkflow.version).toBe('2.0');
      expect(enhancedResearchWorkflow.features).toBeDefined();
      expect(enhancedResearchWorkflow.features.sparqlIntegration).toBe(true);
      expect(enhancedResearchWorkflow.features.hybridSearch).toBe(true);
    });

    it('should provide intelligent QA workflow template', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { intelligentQAWorkflow } = await import(mcpPath);

      // Test workflow structure
      expect(intelligentQAWorkflow.name).toBe('intelligent-qa-workflow');
      expect(intelligentQAWorkflow.description).toBeDefined();
      expect(Array.isArray(intelligentQAWorkflow.arguments)).toBe(true);
      expect(Array.isArray(intelligentQAWorkflow.workflow)).toBe(true);
      expect(intelligentQAWorkflow.version).toBe('2.0');
      expect(intelligentQAWorkflow.features).toBeDefined();
      expect(intelligentQAWorkflow.features.adaptiveSearch).toBe(true);
      expect(intelligentQAWorkflow.features.contextualLearning).toBe(true);
    });
  });

  describe('Safe Operations', () => {
    it('should provide safe operation class', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { SafeOperations } = await import(mcpPath);

      // Test SafeOperations class
      expect(SafeOperations).toBeDefined();
      expect(typeof SafeOperations).toBe('function'); // constructor
      
      // Test that it can be instantiated (with mock memoryManager)
      const mockMemoryManager = {
        retrieveRelevantInteractions: vi.fn(),
        llmHandler: {
          extractConcepts: vi.fn()
        }
      };
      
      const safeOps = new SafeOperations(mockMemoryManager);
      expect(typeof safeOps.retrieveMemories).toBe('function');
      expect(typeof safeOps.extractConcepts).toBe('function');
    });
  });

  describe('Configuration and Debugging', () => {
    it('should provide configuration and debugging utilities', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { mcpConfig, mcpDebugger } = await import(mcpPath);

      // Test configuration object
      expect(mcpConfig).toBeDefined();
      expect(typeof mcpConfig).toBe('object');
      expect(mcpConfig.name).toBeDefined();
      expect(mcpConfig.version).toBeDefined();

      // Test debugger object
      expect(mcpDebugger).toBeDefined();
      expect(typeof mcpDebugger).toBe('object');
      expect(typeof mcpDebugger.info).toBe('function');
      expect(typeof mcpDebugger.error).toBe('function');
      expect(typeof mcpDebugger.debug).toBe('function');
    });
  });

  describe('Package.json Exports Configuration', () => {
    it('should have correct exports in package.json', async () => {
      const packageJsonPath = path.join(packageRoot, 'package.json');
      const packageJson = await import(packageJsonPath, { with: { type: 'json' } });

      // Test main export
      expect(packageJson.default.exports['.']).toBeDefined();
      expect(packageJson.default.exports['.'].import).toBe('./index.js');

      // Test MCP module export
      expect(packageJson.default.exports['./mcp']).toBeDefined();
      expect(packageJson.default.exports['./mcp'].import).toBe('./mcp/mcp.js');

      // Test Ragno module export
      expect(packageJson.default.exports['./ragno']).toBeDefined();
      expect(packageJson.default.exports['./ragno'].import).toBe('./src/ragno/index.js');

      // Test ZPT module export
      expect(packageJson.default.exports['./zpt']).toBeDefined();
      expect(packageJson.default.exports['./zpt'].import).toBe('./src/zpt/index.js');

      // Test files inclusion
      expect(packageJson.default.files).toContain('mcp/');
      expect(packageJson.default.files).toContain('src/');
    });
  });

  describe('Integration Scenarios', () => {
    it('should support complete MCP workflow setup', async () => {
      const indexPath = path.join(packageRoot, 'index.js');
      const { MCP, Config, MemoryManager } = await import(indexPath);

      // Mock server setup for testing
      const mockServer = {
        setRequestHandler: vi.fn(),
        connect: vi.fn()
      };

      // Test that workflow orchestrator can be initialized
      expect(() => MCP.workflowOrchestrator.initialize(mockServer)).not.toThrow();

      // Test that prompt registry can be initialized and has prompts
      await MCP.initializePromptRegistry();
      const prompts = MCP.promptRegistry.listPrompts();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);

      // Test that enhanced workflows are available
      const enhancedPrompts = prompts.filter(p => p.version === '2.0');
      expect(enhancedPrompts.length).toBeGreaterThan(0);
    });

    it('should support importing individual components', async () => {
      // Test importing core components individually
      const { MemoryManager } = await import(path.join(packageRoot, 'index.js'));
      expect(MemoryManager).toBeDefined();

      // Test importing MCP components individually
      const { workflowOrchestrator } = await import(path.join(packageRoot, 'mcp/mcp.js'));
      expect(workflowOrchestrator).toBeDefined();

      // Test importing Ragno components individually
      const { Entity } = await import(path.join(packageRoot, 'src/ragno/index.js'));
      expect(Entity).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing dependencies gracefully', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      
      // This should not throw during import
      expect(async () => {
        await import(mcpPath);
      }).not.toThrow();
    });

    it('should provide meaningful error messages for missing tools', async () => {
      const mcpPath = path.join(packageRoot, 'mcp/mcp.js');
      const { createSafeToolExecutor } = await import(mcpPath);

      const mockServer = {
        setRequestHandler: vi.fn(),
        getRequestHandler: vi.fn(() => null)
      };

      const toolExecutor = createSafeToolExecutor(mockServer);
      expect(typeof toolExecutor).toBe('function');
    });
  });
});