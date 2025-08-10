// tests/unit/mcp/tools/simple-verbs.test.js
// Tests for Simple Verbs MCP tools

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimpleVerbsService, ZPTStateManager } from '../../../../mcp/tools/simple-verbs.js';

// Mock the logger to prevent console output during tests
vi.mock('loglevel', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock the MCP debug utilities
vi.mock('../../../../mcp/lib/debug-utils.js', () => ({
    mcpDebugger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock initialization services
const mockMemoryManager = {
    addInteraction: vi.fn(),
    store: {
        store: vi.fn(),
        search: vi.fn()
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
    searchSimilar: vi.fn().mockResolvedValue([
        { prompt: 'test prompt', response: 'test response' }
    ])
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

vi.mock('../../../../mcp/lib/initialization.js', () => ({
    initializeServices: vi.fn(),
    getMemoryManager: vi.fn(() => mockMemoryManager)
}));

vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
    SafeOperations: vi.fn(() => mockSafeOps)
}));

vi.mock('../../../../mcp/tools/zpt-tools.js', () => ({
    ZPTNavigationService: vi.fn(() => mockZPTService)
}));

// Mock Ragno augment function
vi.mock('../../../../src/ragno/augmentWithAttributes.js', () => ({
    augmentWithAttributes: vi.fn().mockResolvedValue([
        { id: 'attr1', value: 'augmented' }
    ])
}));

describe('ZPTStateManager', () => {
    let stateManager;

    beforeEach(() => {
        vi.clearAllMocks();
        stateManager = new ZPTStateManager(mockMemoryManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with default state', () => {
        const state = stateManager.getState();
        
        expect(state.zoom).toBe('entity');
        expect(state.pan).toEqual({});
        expect(state.tilt).toBe('keywords');
        expect(state.lastQuery).toBe('');
        expect(state.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
    });

    it('should update zoom level', async () => {
        const newZoom = 'unit';
        const query = 'test query';
        
        const result = await stateManager.setZoom(newZoom, query);
        
        expect(result.zoom).toBe(newZoom);
        expect(result.lastQuery).toBe(query);
        expect(mockSafeOps.storeInteraction).toHaveBeenCalledWith(
            expect.stringContaining('ZPT State Change'),
            expect.any(String),
            expect.objectContaining({
                type: 'zpt_state',
                stateChange: true
            })
        );
    });

    it('should update pan filters', async () => {
        const panParams = {
            domains: ['technology'],
            keywords: ['AI', 'ML'],
            temporal: { start: '2023-01-01' }
        };
        
        const result = await stateManager.setPan(panParams);
        
        expect(result.pan.domains).toEqual(['technology']);
        expect(result.pan.keywords).toEqual(['AI', 'ML']);
        expect(result.pan.temporal.start).toBe('2023-01-01');
    });

    it('should update tilt style', async () => {
        const newTilt = 'embedding';
        const query = 'test query';
        
        const result = await stateManager.setTilt(newTilt, query);
        
        expect(result.tilt).toBe(newTilt);
        expect(result.lastQuery).toBe(query);
    });

    it('should reset state to defaults', async () => {
        // First modify state
        await stateManager.setZoom('unit');
        await stateManager.setPan({ domains: ['test'] });
        
        // Then reset
        const result = await stateManager.resetState();
        
        expect(result.zoom).toBe('entity');
        expect(result.pan).toEqual({});
        expect(result.tilt).toBe('keywords');
        expect(result.lastQuery).toBe('');
    });

    it('should generate navigation parameters from current state', async () => {
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

    it('should maintain state history', async () => {
        await stateManager.setZoom('unit');
        await stateManager.setZoom('community');
        
        expect(stateManager.stateHistory).toHaveLength(2);
        expect(stateManager.stateHistory[0].current.zoom).toBe('unit');
        expect(stateManager.stateHistory[1].current.zoom).toBe('community');
    });

    it('should limit history size', async () => {
        stateManager.maxHistorySize = 2;
        
        await stateManager.setZoom('unit');
        await stateManager.setZoom('community');
        await stateManager.setZoom('corpus');
        
        expect(stateManager.stateHistory).toHaveLength(2);
        expect(stateManager.stateHistory[0].current.zoom).toBe('community');
        expect(stateManager.stateHistory[1].current.zoom).toBe('corpus');
    });
});

describe('SimpleVerbsService', () => {
    let simpleVerbsService;

    beforeEach(async () => {
        vi.clearAllMocks();
        simpleVerbsService = new SimpleVerbsService();
        await simpleVerbsService.initialize();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('tell verb', () => {
        it('should store interaction content', async () => {
            const content = 'This is a test interaction';
            const type = 'interaction';
            const metadata = { source: 'test' };

            const result = await simpleVerbsService.tell({ content, type, metadata });

            expect(result.success).toBe(true);
            expect(result.verb).toBe('tell');
            expect(result.type).toBe(type);
            expect(result.contentLength).toBe(content.length);
            expect(mockSafeOps.storeInteraction).toHaveBeenCalledWith(
                expect.stringContaining('User input'),
                content,
                expect.objectContaining({
                    source: 'test',
                    type: 'tell_interaction'
                })
            );
        });

        it('should store document content', async () => {
            const content = 'This is a test document';
            const type = 'document';
            const metadata = { title: 'Test Doc' };

            const result = await simpleVerbsService.tell({ content, type, metadata });

            expect(result.success).toBe(true);
            expect(result.type).toBe('document');
            expect(mockSafeOps.storeInteraction).toHaveBeenCalledWith(
                'Document: Test Doc',
                content,
                expect.objectContaining({
                    title: 'Test Doc',
                    type: 'tell_document'
                })
            );
        });

        it('should store concept content', async () => {
            const content = 'Machine learning is a subset of AI';
            const type = 'concept';
            const metadata = { name: 'Machine Learning' };

            const result = await simpleVerbsService.tell({ content, type, metadata });

            expect(result.success).toBe(true);
            expect(result.type).toBe('concept');
            expect(mockSafeOps.generateEmbedding).toHaveBeenCalledWith(content);
        });

        it('should handle tell errors gracefully', async () => {
            mockSafeOps.storeInteraction.mockRejectedValueOnce(new Error('Storage error'));

            const result = await simpleVerbsService.tell({ 
                content: 'test', 
                type: 'interaction' 
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Storage error');
            expect(result.verb).toBe('tell');
        });

        it('should reject unknown content types', async () => {
            const result = await simpleVerbsService.tell({ 
                content: 'test', 
                type: 'unknown' 
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Unknown tell type: unknown');
        });
    });

    describe('ask verb', () => {
        it('should answer question with context', async () => {
            simpleVerbsService.stateManager.state.lastQuery = 'previous query';
            
            const question = 'What is machine learning?';
            const result = await simpleVerbsService.ask({ question, useContext: true });

            expect(result.success).toBe(true);
            expect(result.verb).toBe('ask');
            expect(result.question).toBe(question);
            expect(result.usedContext).toBe(true);
            expect(mockZPTService.navigate).toHaveBeenCalled();
        });

        it('should answer question without context', async () => {
            const question = 'What is machine learning?';
            const result = await simpleVerbsService.ask({ question, useContext: false });

            expect(result.success).toBe(true);
            expect(result.usedContext).toBe(false);
            expect(result.memories).toBe(1); // mockSafeOps.searchSimilar returns 1 item
            expect(mockSafeOps.generateEmbedding).toHaveBeenCalledWith(question);
            expect(mockSafeOps.searchSimilar).toHaveBeenCalled();
        });

        it('should update lastQuery in state', async () => {
            const question = 'What is AI?';
            await simpleVerbsService.ask({ question, useContext: false });

            expect(simpleVerbsService.stateManager.state.lastQuery).toBe(question);
        });

        it('should handle ask errors gracefully', async () => {
            mockSafeOps.generateResponse.mockRejectedValueOnce(new Error('LLM error'));

            const result = await simpleVerbsService.ask({ 
                question: 'test question', 
                useContext: false 
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('LLM error');
        });

        it('should handle navigation failure with context', async () => {
            mockZPTService.navigate.mockResolvedValueOnce({ success: false });
            simpleVerbsService.stateManager.state.lastQuery = 'previous';

            const result = await simpleVerbsService.ask({ 
                question: 'test', 
                useContext: true 
            });

            expect(result.success).toBe(true);
            expect(result.contextItems).toBe(0);
            expect(mockSafeOps.generateResponse).toHaveBeenCalled();
        });
    });

    describe('augment verb', () => {
        it('should extract concepts', async () => {
            const target = 'Machine learning is powerful';
            const result = await simpleVerbsService.augment({ 
                target, 
                operation: 'concepts' 
            });

            expect(result.success).toBe(true);
            expect(result.verb).toBe('augment');
            expect(result.operation).toBe('concepts');
            expect(mockSafeOps.extractConcepts).toHaveBeenCalledWith(target);
        });

        it('should augment with attributes using Ragno', async () => {
            const target = 'Test content';
            const result = await simpleVerbsService.augment({ 
                target, 
                operation: 'attributes' 
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('attributes');
            // Note: Ragno import might fail in test environment, so we test the fallback
        });

        it('should generate relationships using ZPT', async () => {
            const target = 'Test relationship target';
            const result = await simpleVerbsService.augment({ 
                target, 
                operation: 'relationships' 
            });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('relationships');
            expect(mockZPTService.navigate).toHaveBeenCalled();
        });

        it('should perform auto augmentation', async () => {
            const target = 'Test auto augmentation';
            const result = await simpleVerbsService.augment({ target });

            expect(result.success).toBe(true);
            expect(result.operation).toBe('auto');
            expect(result.result.concepts).toEqual(['concept1', 'concept2']);
            expect(result.result.embedding).toHaveProperty('dimension', 1536);
            expect(mockSafeOps.extractConcepts).toHaveBeenCalledWith(target);
            expect(mockSafeOps.generateEmbedding).toHaveBeenCalledWith(target);
        });

        it('should handle augment errors gracefully', async () => {
            mockSafeOps.extractConcepts.mockRejectedValueOnce(new Error('Extraction error'));

            const result = await simpleVerbsService.augment({ 
                target: 'test', 
                operation: 'concepts' 
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Extraction error');
        });
    });

    describe('zoom verb', () => {
        it('should set zoom level', async () => {
            const level = 'unit';
            const result = await simpleVerbsService.zoom({ level });

            expect(result.success).toBe(true);
            expect(result.verb).toBe('zoom');
            expect(result.level).toBe(level);
            expect(simpleVerbsService.stateManager.state.zoom).toBe(level);
        });

        it('should set zoom level and navigate with query', async () => {
            const level = 'community';
            const query = 'test query';
            const result = await simpleVerbsService.zoom({ level, query });

            expect(result.success).toBe(true);
            expect(result.navigation).toBeDefined();
            expect(result.query).toBe(query);
            expect(mockZPTService.navigate).toHaveBeenCalled();
        });

        it('should include previous zoom level in result', async () => {
            // Set initial zoom
            await simpleVerbsService.stateManager.setZoom('unit');
            
            // Change zoom
            const result = await simpleVerbsService.zoom({ level: 'entity' });

            expect(result.previousLevel).toBe('unit');
        });

        it('should handle zoom errors gracefully', async () => {
            // Mock state manager to throw error
            const mockError = new Error('State error');
            vi.spyOn(simpleVerbsService.stateManager, 'setZoom').mockRejectedValueOnce(mockError);

            const result = await simpleVerbsService.zoom({ level: 'unit' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('State error');
        });
    });

    describe('pan verb', () => {
        it('should set pan parameters', async () => {
            const panParams = {
                domains: ['technology'],
                keywords: ['AI', 'machine learning'],
                temporal: { start: '2023-01-01', end: '2023-12-31' }
            };

            const result = await simpleVerbsService.pan(panParams);

            expect(result.success).toBe(true);
            expect(result.verb).toBe('pan');
            expect(result.panParams).toEqual(panParams);
            expect(simpleVerbsService.stateManager.state.pan).toEqual(panParams);
        });

        it('should re-navigate when lastQuery exists', async () => {
            simpleVerbsService.stateManager.state.lastQuery = 'test query';
            
            const result = await simpleVerbsService.pan({ domains: ['test'] });

            expect(result.success).toBe(true);
            expect(result.reNavigated).toBe(true);
            expect(result.navigation).toBeDefined();
            expect(mockZPTService.navigate).toHaveBeenCalled();
        });

        it('should handle pan errors gracefully', async () => {
            const mockError = new Error('Pan error');
            vi.spyOn(simpleVerbsService.stateManager, 'setPan').mockRejectedValueOnce(mockError);

            const result = await simpleVerbsService.pan({ domains: ['test'] });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Pan error');
        });
    });

    describe('tilt verb', () => {
        it('should set tilt style', async () => {
            const style = 'embedding';
            const result = await simpleVerbsService.tilt({ style });

            expect(result.success).toBe(true);
            expect(result.verb).toBe('tilt');
            expect(result.style).toBe(style);
            expect(simpleVerbsService.stateManager.state.tilt).toBe(style);
        });

        it('should set tilt style and navigate with query', async () => {
            const style = 'graph';
            const query = 'test query';
            const result = await simpleVerbsService.tilt({ style, query });

            expect(result.success).toBe(true);
            expect(result.navigation).toBeDefined();
            expect(result.query).toBe(query);
            expect(mockZPTService.navigate).toHaveBeenCalled();
        });

        it('should navigate with existing lastQuery', async () => {
            simpleVerbsService.stateManager.state.lastQuery = 'existing query';
            
            const result = await simpleVerbsService.tilt({ style: 'temporal' });

            expect(result.success).toBe(true);
            expect(result.navigation).toBeDefined();
            expect(result.query).toBe('existing query');
        });

        it('should include previous tilt style in result', async () => {
            // Set initial tilt
            await simpleVerbsService.stateManager.setTilt('embedding');
            
            // Change tilt
            const result = await simpleVerbsService.tilt({ style: 'graph' });

            expect(result.previousStyle).toBe('embedding');
        });

        it('should handle tilt errors gracefully', async () => {
            const mockError = new Error('Tilt error');
            vi.spyOn(simpleVerbsService.stateManager, 'setTilt').mockRejectedValueOnce(mockError);

            const result = await simpleVerbsService.tilt({ style: 'graph' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Tilt error');
        });
    });

    describe('service initialization', () => {
        it('should initialize service dependencies', async () => {
            const newService = new SimpleVerbsService();
            
            expect(newService.memoryManager).toBeNull();
            expect(newService.safeOps).toBeNull();
            
            await newService.initialize();
            
            expect(newService.memoryManager).toBeDefined();
            expect(newService.safeOps).toBeDefined();
            expect(newService.zptService).toBeDefined();
            expect(newService.stateManager).toBeDefined();
        });

        it('should only initialize once', async () => {
            const service = new SimpleVerbsService();
            
            await service.initialize();
            const firstMemoryManager = service.memoryManager;
            
            await service.initialize();
            const secondMemoryManager = service.memoryManager;
            
            expect(firstMemoryManager).toBe(secondMemoryManager);
        });
    });

    describe('ZPT state integration', () => {
        it('should include ZPT state in all verb responses', async () => {
            const tellResult = await simpleVerbsService.tell({ content: 'test' });
            const askResult = await simpleVerbsService.ask({ question: 'test?' });
            const augmentResult = await simpleVerbsService.augment({ target: 'test' });
            const zoomResult = await simpleVerbsService.zoom({ level: 'entity' });
            const panResult = await simpleVerbsService.pan({ domains: ['test'] });
            const tiltResult = await simpleVerbsService.tilt({ style: 'keywords' });

            expect(tellResult.zptState).toBeDefined();
            expect(askResult.zptState).toBeDefined();
            expect(augmentResult.zptState).toBeDefined();
            expect(zoomResult.zptState).toBeDefined();
            expect(panResult.zptState).toBeDefined();
            expect(tiltResult.zptState).toBeDefined();

            // All should have the same session ID (same service instance)
            expect(tellResult.zptState.sessionId).toBe(askResult.zptState.sessionId);
        });

        it('should update lastQuery appropriately', async () => {
            // Ask should update lastQuery
            await simpleVerbsService.ask({ question: 'What is AI?', useContext: false });
            expect(simpleVerbsService.stateManager.state.lastQuery).toBe('What is AI?');

            // Zoom with query should update lastQuery
            await simpleVerbsService.zoom({ level: 'unit', query: 'Machine learning' });
            expect(simpleVerbsService.stateManager.state.lastQuery).toBe('Machine learning');

            // Tell should not update lastQuery
            await simpleVerbsService.tell({ content: 'Test content' });
            expect(simpleVerbsService.stateManager.state.lastQuery).toBe('Machine learning');
        });
    });
});