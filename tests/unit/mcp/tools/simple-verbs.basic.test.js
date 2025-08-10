// tests/unit/mcp/tools/simple-verbs.basic.test.js
// Basic tests for Simple Verbs without complex mocking

import { describe, it, expect } from 'vitest';

describe('Simple Verbs Basic Tests', () => {
    it('should import simple verbs module without errors', async () => {
        // This test just ensures the module can be imported
        const simpleVerbsModule = await import('../../../../mcp/tools/simple-verbs.js');
        
        expect(simpleVerbsModule).toBeDefined();
        expect(simpleVerbsModule.SimpleVerbsService).toBeDefined();
        expect(simpleVerbsModule.ZPTStateManager).toBeDefined();
        expect(simpleVerbsModule.registerSimpleVerbs).toBeDefined();
        expect(simpleVerbsModule.SimpleVerbToolNames).toBeDefined();
    });

    it('should export correct tool names', async () => {
        const { SimpleVerbToolNames } = await import('../../../../mcp/tools/simple-verbs.js');
        
        expect(SimpleVerbToolNames.TELL).toBe('tell');
        expect(SimpleVerbToolNames.ASK).toBe('ask');
        expect(SimpleVerbToolNames.AUGMENT).toBe('augment');
        expect(SimpleVerbToolNames.ZOOM).toBe('zoom');
        expect(SimpleVerbToolNames.PAN).toBe('pan');
        expect(SimpleVerbToolNames.TILT).toBe('tilt');
    });

    it('should have all expected tool names', async () => {
        const { SimpleVerbToolNames } = await import('../../../../mcp/tools/simple-verbs.js');
        
        const expectedNames = ['TELL', 'ASK', 'AUGMENT', 'ZOOM', 'PAN', 'TILT'];
        const actualNames = Object.keys(SimpleVerbToolNames);
        
        expect(actualNames.sort()).toEqual(expectedNames.sort());
    });

    it('should export SimpleVerbsService class', async () => {
        const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
        
        expect(typeof SimpleVerbsService).toBe('function');
        expect(SimpleVerbsService.name).toBe('SimpleVerbsService');
        
        // Should be able to instantiate
        const service = new SimpleVerbsService();
        expect(service).toBeDefined();
        expect(service.constructor.name).toBe('SimpleVerbsService');
    });

    it('should export ZPTStateManager class', async () => {
        const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
        
        expect(typeof ZPTStateManager).toBe('function');
        expect(ZPTStateManager.name).toBe('ZPTStateManager');
        
        // Should be able to instantiate with null memory manager
        const stateManager = new ZPTStateManager(null);
        expect(stateManager).toBeDefined();
        expect(stateManager.constructor.name).toBe('ZPTStateManager');
    });

    it('should export registerSimpleVerbs function', async () => {
        const { registerSimpleVerbs } = await import('../../../../mcp/tools/simple-verbs.js');
        
        expect(typeof registerSimpleVerbs).toBe('function');
        expect(registerSimpleVerbs.name).toBe('registerSimpleVerbs');
    });

    describe('ZPTStateManager Basic Functionality', () => {
        it('should initialize with default state', async () => {
            const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
            const stateManager = new ZPTStateManager(null);
            
            const state = stateManager.getState();
            
            expect(state.zoom).toBe('entity');
            expect(state.pan).toEqual({});
            expect(state.tilt).toBe('keywords');
            expect(state.lastQuery).toBe('');
            expect(state.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
            expect(typeof state.timestamp).toBe('string');
        });

        it('should generate unique session IDs', async () => {
            const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
            
            const manager1 = new ZPTStateManager(null);
            const manager2 = new ZPTStateManager(null);
            
            expect(manager1.getState().sessionId).not.toBe(manager2.getState().sessionId);
        });

        it('should have expected methods', async () => {
            const { ZPTStateManager } = await import('../../../../mcp/tools/simple-verbs.js');
            const stateManager = new ZPTStateManager(null);
            
            expect(typeof stateManager.setZoom).toBe('function');
            expect(typeof stateManager.setPan).toBe('function');
            expect(typeof stateManager.setTilt).toBe('function');
            expect(typeof stateManager.getState).toBe('function');
            expect(typeof stateManager.resetState).toBe('function');
            expect(typeof stateManager.getNavigationParams).toBe('function');
        });
    });

    describe('SimpleVerbsService Basic Functionality', () => {
        it('should have expected methods', async () => {
            const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
            const service = new SimpleVerbsService();
            
            expect(typeof service.initialize).toBe('function');
            expect(typeof service.tell).toBe('function');
            expect(typeof service.ask).toBe('function');
            expect(typeof service.augment).toBe('function');
            expect(typeof service.zoom).toBe('function');
            expect(typeof service.pan).toBe('function');
            expect(typeof service.tilt).toBe('function');
        });

        it('should initialize with null dependencies', async () => {
            const { SimpleVerbsService } = await import('../../../../mcp/tools/simple-verbs.js');
            const service = new SimpleVerbsService();
            
            expect(service.memoryManager).toBeNull();
            expect(service.safeOps).toBeNull();
            expect(service.zptService).toBeNull();
            expect(service.stateManager).toBeNull();
        });
    });

    describe('Schema and Type Validation', () => {
        it('should import zod schemas correctly', async () => {
            // This implicitly tests that the zod imports work
            const simpleVerbsModule = await import('../../../../mcp/tools/simple-verbs.js');
            expect(simpleVerbsModule).toBeDefined();
        });
    });
});