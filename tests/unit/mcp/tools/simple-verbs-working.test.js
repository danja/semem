// tests/unit/mcp/tools/simple-verbs-working.test.js
// Working tests for Simple Verbs following exact vitest patterns

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock console to avoid test noise
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Mock the mcpDebugger
const mcpDebugger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock dependencies with simple implementations
const mockMemoryManager = {
  addInteraction: vi.fn().mockResolvedValue({ success: true }),
  store: {
    store: vi.fn().mockResolvedValue({ success: true }),
    search: vi.fn().mockResolvedValue([])
  },
  embeddingHandler: {
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
  },
  llmHandler: {
    generateResponse: vi.fn().mockResolvedValue('Test response'),
    extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2'])
  }
};

const mockSafeOps = {
  storeInteraction: vi.fn().mockResolvedValue({ success: true }),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  extractConcepts: vi.fn().mockResolvedValue(['concept1', 'concept2']),
  generateResponse: vi.fn().mockResolvedValue('Test response'),
  searchSimilar: vi.fn().mockImplementation(async (embedding, limit, threshold) => {
    return [
      { prompt: 'test prompt', response: 'test response' }
    ];
  })
};

const mockZPTService = {
  navigate: vi.fn().mockResolvedValue({
    success: true,
    content: {
      data: [
        { id: 'test1', content: 'test content 1' },
        { id: 'test2', content: 'test content 2' }
      ]
    }
  })
};

// Mock all the modules
vi.mock('../../../../mcp/lib/debug-utils.js', () => ({ mcpDebugger }));
vi.mock('../../../../mcp/lib/initialization.js', () => ({
  initializeServices: vi.fn(),
  getMemoryManager: () => mockMemoryManager
}));
vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
  SafeOperations: vi.fn(() => mockSafeOps)
}));
vi.mock('../../../../mcp/tools/zpt-tools.js', () => ({
  ZPTNavigationService: vi.fn(() => mockZPTService)
}));

describe('Simple Verbs Working Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock implementations to ensure consistent behavior
    mockSafeOps.storeInteraction.mockResolvedValue({ success: true });
    mockSafeOps.generateEmbedding.mockResolvedValue(new Array(1536).fill(0.1));
    mockSafeOps.extractConcepts.mockResolvedValue(['concept1', 'concept2']);
    mockSafeOps.generateResponse.mockResolvedValue('Test response');
    mockSafeOps.searchSimilar.mockImplementation(async (embedding, limit, threshold) => {
      return [
        { prompt: 'test prompt', response: 'test response' }
      ];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ZPTStateManager', () => {
    it('should initialize with default state', async () => {
      const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
      const stateManager = new ZPTStateManager(mockMemoryManager);
      
      const state = stateManager.getState();
      
      expect(state.zoom).toBe('entity');
      expect(state.pan).toEqual({});
      expect(state.tilt).toBe('keywords');
      expect(state.lastQuery).toBe('');
      expect(state.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
    });

    it('should update zoom level', async () => {
      const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
      const stateManager = new ZPTStateManager(mockMemoryManager);
      
      const result = await stateManager.setZoom('unit', 'test query');
      
      expect(result.zoom).toBe('unit');
      expect(result.lastQuery).toBe('test query');
    });

    it('should update pan filters', async () => {
      const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
      const stateManager = new ZPTStateManager(mockMemoryManager);
      
      const panParams = {
        domains: ['technology'],
        keywords: ['AI', 'ML']
      };
      
      const result = await stateManager.setPan(panParams);
      
      expect(result.pan.domains).toEqual(['technology']);
      expect(result.pan.keywords).toEqual(['AI', 'ML']);
    });

    it('should update tilt style', async () => {
      const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
      const stateManager = new ZPTStateManager(mockMemoryManager);
      
      const result = await stateManager.setTilt('embedding', 'test query');
      
      expect(result.tilt).toBe('embedding');
      expect(result.lastQuery).toBe('test query');
    });

    it('should generate navigation parameters', async () => {
      const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
      const stateManager = new ZPTStateManager(mockMemoryManager);
      
      await stateManager.setZoom('unit');
      await stateManager.setPan({ domains: ['tech'] });
      await stateManager.setTilt('graph');
      
      const navParams = stateManager.getNavigationParams('test query');
      
      expect(navParams).toEqual({
        query: 'test query',
        zoom: 'unit',
        pan: { domains: ['tech'] },
        tilt: 'graph'
      });
    });
  });

  describe('SimpleVerbsService', () => {
    it('should initialize service', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      
      await service.initialize();
      
      expect(service.memoryManager).toBeDefined();
      expect(service.safeOps).toBeDefined();
      expect(service.zptService).toBeDefined();
      expect(service.stateManager).toBeDefined();
    });

    it('should handle tell verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.tell({
        content: 'Test content',
        type: 'interaction'
      });
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('tell');
      expect(result.type).toBe('interaction');
      expect(mockSafeOps.storeInteraction).toHaveBeenCalled();
    });

    it('should handle ask verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.ask({
        question: 'What is AI?',
        useContext: false
      });
      
      console.log('Ask result:', result); // Debug log
      
      if (!result.success) {
        console.log('Ask error:', result.error);
      }
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('ask');
      expect(result.question).toBe('What is AI?');
      expect(result.answer).toBe('Test response');
      expect(result.usedContext).toBe(false);
      expect(result.memories).toBe(1); // Should match mockSafeOps.searchSimilar return length
    });

    it('should handle augment verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.augment({
        target: 'Test content',
        operation: 'concepts'
      });
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('augment');
      expect(result.operation).toBe('concepts');
      expect(mockSafeOps.extractConcepts).toHaveBeenCalledWith('Test content');
    });

    it('should handle zoom verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.zoom({ level: 'unit' });
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('zoom');
      expect(result.level).toBe('unit');
    });

    it('should handle pan verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.pan({ domains: ['tech'] });
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('pan');
      expect(result.panParams.domains).toEqual(['tech']);
    });

    it('should handle tilt verb', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      const result = await service.tilt({ style: 'embedding' });
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('tilt');
      expect(result.style).toBe('embedding');
    });
  });

  describe('Tool Registration', () => {
    it('should register all simple verbs', async () => {
      const { registerSimpleVerbs, SimpleVerbToolNames } = await import('../../../../mcp/tools/simple-verbs.js');
      
      const mockServer = {
        setRequestHandler: vi.fn()
      };
      
      registerSimpleVerbs(mockServer);
      
      // Simple Verbs now use centralized tool registration
      // The registration just initializes the service
      expect(() => registerSimpleVerbs(mockServer)).not.toThrow();
      
      // Verify service and tool names are available
      expect(SimpleVerbToolNames.TELL).toBe('tell');
      expect(SimpleVerbToolNames.ASK).toBe('ask');
      expect(SimpleVerbToolNames.AUGMENT).toBe('augment');
      expect(SimpleVerbToolNames.ZOOM).toBe('zoom');
      expect(SimpleVerbToolNames.PAN).toBe('pan');
      expect(SimpleVerbToolNames.TILT).toBe('tilt');
    });
  });

  describe('Error Handling', () => {
    it('should handle tell errors gracefully', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      // Mock an error
      mockSafeOps.storeInteraction.mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await service.tell({
        content: 'test',
        type: 'interaction'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle ask errors gracefully', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      // Mock an error in the embedding generation step
      mockSafeOps.generateEmbedding.mockRejectedValueOnce(new Error('LLM error'));
      
      const result = await service.ask({
        question: 'test',
        useContext: false
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM error');
    });
  });

  describe('State Integration', () => {
    it('should maintain state across verb calls', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      // Set zoom
      const zoomResult = await service.zoom({ level: 'unit' });
      expect(zoomResult.zptState.zoom).toBe('unit');
      
      // Tell should preserve state
      const tellResult = await service.tell({ content: 'test' });
      expect(tellResult.zptState.zoom).toBe('unit');
      
      // Ask should update lastQuery when useContext is false
      const askResult = await service.ask({ question: 'test?', useContext: false });
      expect(askResult.zptState.zoom).toBe('unit');
      // The lastQuery is updated directly in state manager, check the service's state manager
      expect(service.stateManager.state.lastQuery).toBe('test?');
    });

    it('should use context in ask when available', async () => {
      const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
      const service = new SimpleVerbsService();
      await service.initialize();
      
      // Set up context by setting lastQuery
      service.stateManager.state.lastQuery = 'previous query';
      
      // Mock navigation to return successful result with data
      mockZPTService.navigate.mockResolvedValueOnce({
        success: true,
        content: {
          data: [
            { id: 'test1', content: 'contextual content 1' },
            { id: 'test2', content: 'contextual content 2' }
          ]
        }
      });
      
      const result = await service.ask({
        question: 'follow-up question',
        useContext: true
      });
      
      expect(result.success).toBe(true);
      expect(result.usedContext).toBe(true);
      expect(result.contextItems).toBe(2);
      expect(mockZPTService.navigate).toHaveBeenCalled();
      expect(mockSafeOps.generateResponse).toHaveBeenCalledWith('follow-up question', expect.stringContaining('contextual content'));
    });
  });
});