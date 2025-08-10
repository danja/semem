// tests/unit/mcp/tools/simple-verbs-state.test.js
// Focused tests for ZPT State Management in Simple Verbs

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZPTStateManager } from '../../../../mcp/tools/simple-verbs.js';

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

// Mock SafeOperations
const mockSafeOps = {
    storeInteraction: vi.fn().mockResolvedValue({ success: true })
};

vi.mock('../../../../mcp/lib/safe-operations.js', () => ({
    SafeOperations: vi.fn(() => mockSafeOps)
}));

describe('ZPTStateManager - Detailed State Management Tests', () => {
    let stateManager;
    let mockMemoryManager;

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockMemoryManager = {
            addInteraction: vi.fn().mockResolvedValue({ success: true })
        };
        
        stateManager = new ZPTStateManager(mockMemoryManager);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization and Default State', () => {
        it('should initialize with correct default values', () => {
            const state = stateManager.getState();
            
            expect(state.zoom).toBe('entity');
            expect(state.pan).toEqual({});
            expect(state.tilt).toBe('keywords');
            expect(state.lastQuery).toBe('');
            expect(state.sessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
            expect(new Date(state.timestamp)).toBeInstanceOf(Date);
        });

        it('should initialize with empty state history', () => {
            expect(stateManager.stateHistory).toEqual([]);
            expect(stateManager.maxHistorySize).toBe(10);
        });

        it('should generate unique session IDs', () => {
            const manager1 = new ZPTStateManager(mockMemoryManager);
            const manager2 = new ZPTStateManager(mockMemoryManager);
            
            expect(manager1.getState().sessionId).not.toBe(manager2.getState().sessionId);
        });

        it('should have consistent timestamp format', () => {
            const state = stateManager.getState();
            const timestamp = new Date(state.timestamp);
            
            expect(timestamp.toISOString()).toBe(state.timestamp);
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('Zoom Level Management', () => {
        it('should update zoom level correctly', async () => {
            const newZoom = 'unit';
            const query = 'test query for zoom';
            
            const result = await stateManager.setZoom(newZoom, query);
            
            expect(result.zoom).toBe(newZoom);
            expect(result.lastQuery).toBe(query);
            expect(result.timestamp).not.toBe(stateManager.stateHistory[0]?.previous?.timestamp);
        });

        it('should update zoom without query', async () => {
            const newZoom = 'community';
            
            const result = await stateManager.setZoom(newZoom);
            
            expect(result.zoom).toBe(newZoom);
            expect(result.lastQuery).toBe(''); // Should remain unchanged
        });

        it('should handle all valid zoom levels', async () => {
            const validZooms = ['entity', 'unit', 'text', 'community', 'corpus', 'micro'];
            
            for (const zoom of validZooms) {
                const result = await stateManager.setZoom(zoom);
                expect(result.zoom).toBe(zoom);
            }
        });

        it('should preserve other state properties when changing zoom', async () => {
            // Set initial pan and tilt
            await stateManager.setPan({ domains: ['tech'], keywords: ['AI'] });
            await stateManager.setTilt('embedding');
            
            // Change zoom
            const result = await stateManager.setZoom('unit');
            
            expect(result.zoom).toBe('unit');
            expect(result.pan.domains).toEqual(['tech']);
            expect(result.pan.keywords).toEqual(['AI']);
            expect(result.tilt).toBe('embedding');
        });

        it('should call persistState when zoom changes', async () => {
            const spy = vi.spyOn(stateManager, 'persistState');
            
            await stateManager.setZoom('unit');
            
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(expect.objectContaining({
                zoom: 'entity' // Previous state
            }));
        });
    });

    describe('Pan Filter Management', () => {
        it('should update pan parameters correctly', async () => {
            const panParams = {
                domains: ['technology', 'science'],
                keywords: ['AI', 'ML', 'neural networks'],
                temporal: {
                    start: '2020-01-01',
                    end: '2024-01-01'
                },
                entities: ['entity1', 'entity2']
            };
            
            const result = await stateManager.setPan(panParams);
            
            expect(result.pan.domains).toEqual(panParams.domains);
            expect(result.pan.keywords).toEqual(panParams.keywords);
            expect(result.pan.temporal).toEqual(panParams.temporal);
            expect(result.pan.entities).toEqual(panParams.entities);
        });

        it('should merge new pan parameters with existing ones', async () => {
            // Set initial pan parameters
            await stateManager.setPan({
                domains: ['tech'],
                keywords: ['AI']
            });
            
            // Update with additional parameters
            const result = await stateManager.setPan({
                keywords: ['ML', 'DL'], // Should replace existing keywords
                temporal: { start: '2023-01-01' }
            });
            
            expect(result.pan.domains).toEqual(['tech']); // Should be preserved
            expect(result.pan.keywords).toEqual(['ML', 'DL']); // Should be replaced
            expect(result.pan.temporal).toEqual({ start: '2023-01-01' }); // Should be added
        });

        it('should handle empty pan parameters', async () => {
            await stateManager.setPan({ domains: ['test'] });
            
            const result = await stateManager.setPan({});
            
            expect(result.pan.domains).toEqual(['test']); // Should be preserved
        });

        it('should handle partial pan parameter updates', async () => {
            await stateManager.setPan({
                domains: ['tech'],
                keywords: ['AI'],
                temporal: { start: '2020-01-01', end: '2024-01-01' }
            });
            
            // Update only temporal
            const result = await stateManager.setPan({
                temporal: { start: '2023-01-01' } // end should be replaced
            });
            
            expect(result.pan.domains).toEqual(['tech']);
            expect(result.pan.keywords).toEqual(['AI']);
            expect(result.pan.temporal).toEqual({ start: '2023-01-01' });
        });

        it('should preserve other state when updating pan', async () => {
            await stateManager.setZoom('unit');
            await stateManager.setTilt('graph');
            
            const result = await stateManager.setPan({ domains: ['test'] });
            
            expect(result.zoom).toBe('unit');
            expect(result.tilt).toBe('graph');
            expect(result.pan.domains).toEqual(['test']);
        });
    });

    describe('Tilt Style Management', () => {
        it('should update tilt style correctly', async () => {
            const newTilt = 'embedding';
            const query = 'test query for tilt';
            
            const result = await stateManager.setTilt(newTilt, query);
            
            expect(result.tilt).toBe(newTilt);
            expect(result.lastQuery).toBe(query);
        });

        it('should update tilt without query', async () => {
            const newTilt = 'graph';
            
            const result = await stateManager.setTilt(newTilt);
            
            expect(result.tilt).toBe(newTilt);
            expect(result.lastQuery).toBe(''); // Should remain unchanged
        });

        it('should handle all valid tilt styles', async () => {
            const validTilts = ['keywords', 'embedding', 'graph', 'temporal'];
            
            for (const tilt of validTilts) {
                const result = await stateManager.setTilt(tilt);
                expect(result.tilt).toBe(tilt);
            }
        });

        it('should preserve other state when changing tilt', async () => {
            await stateManager.setZoom('community');
            await stateManager.setPan({ domains: ['science'] });
            
            const result = await stateManager.setTilt('temporal');
            
            expect(result.zoom).toBe('community');
            expect(result.pan.domains).toEqual(['science']);
            expect(result.tilt).toBe('temporal');
        });
    });

    describe('State History Management', () => {
        it('should record state changes in history', async () => {
            await stateManager.setZoom('unit');
            await stateManager.setTilt('embedding');
            
            expect(stateManager.stateHistory).toHaveLength(2);
            
            const firstChange = stateManager.stateHistory[0];
            expect(firstChange.previous.zoom).toBe('entity');
            expect(firstChange.current.zoom).toBe('unit');
            
            const secondChange = stateManager.stateHistory[1];
            expect(secondChange.previous.zoom).toBe('unit');
            expect(secondChange.current.tilt).toBe('embedding');
        });

        it('should limit history size to maxHistorySize', async () => {
            stateManager.maxHistorySize = 3;
            
            // Make more changes than the history limit
            await stateManager.setZoom('unit');
            await stateManager.setZoom('community');
            await stateManager.setZoom('corpus');
            await stateManager.setZoom('text'); // Should cause oldest to be removed
            
            expect(stateManager.stateHistory).toHaveLength(3);
            expect(stateManager.stateHistory[0].current.zoom).toBe('community');
            expect(stateManager.stateHistory[2].current.zoom).toBe('text');
        });

        it('should maintain correct temporal order in history', async () => {
            const changes = ['unit', 'community', 'corpus'];
            const startTime = Date.now();
            
            for (const zoom of changes) {
                await stateManager.setZoom(zoom);
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 1));
            }
            
            // Verify timestamps are in ascending order
            for (let i = 1; i < stateManager.stateHistory.length; i++) {
                const prev = new Date(stateManager.stateHistory[i - 1].timestamp);
                const curr = new Date(stateManager.stateHistory[i].timestamp);
                expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
            }
        });

        it('should include timestamps in history entries', async () => {
            await stateManager.setZoom('unit');
            
            const historyEntry = stateManager.stateHistory[0];
            expect(historyEntry.timestamp).toBeDefined();
            expect(new Date(historyEntry.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe('State Reset', () => {
        it('should reset all state to defaults', async () => {
            // Modify state
            await stateManager.setZoom('community');
            await stateManager.setPan({ domains: ['test'], keywords: ['AI'] });
            await stateManager.setTilt('graph', 'test query');
            
            // Reset
            const result = await stateManager.resetState();
            
            expect(result.zoom).toBe('entity');
            expect(result.pan).toEqual({});
            expect(result.tilt).toBe('keywords');
            expect(result.lastQuery).toBe('');
        });

        it('should generate new session ID on reset', async () => {
            const originalSessionId = stateManager.getState().sessionId;
            
            await stateManager.resetState();
            
            const newSessionId = stateManager.getState().sessionId;
            expect(newSessionId).not.toBe(originalSessionId);
            expect(newSessionId).toMatch(/^session_\d+_[a-z0-9]{6}$/);
        });

        it('should record reset in history', async () => {
            await stateManager.setZoom('unit'); // Make a change first
            
            await stateManager.resetState();
            
            expect(stateManager.stateHistory).toHaveLength(2);
            const resetEntry = stateManager.stateHistory[1];
            expect(resetEntry.current.zoom).toBe('entity');
            expect(resetEntry.current.pan).toEqual({});
        });
    });

    describe('Navigation Parameters Generation', () => {
        it('should generate correct navigation parameters', async () => {
            await stateManager.setZoom('unit');
            await stateManager.setPan({ 
                domains: ['tech'], 
                keywords: ['AI'],
                temporal: { start: '2023-01-01' }
            });
            await stateManager.setTilt('embedding');
            
            const navParams = stateManager.getNavigationParams('test query');
            
            expect(navParams).toEqual({
                query: 'test query',
                zoom: 'unit',
                pan: {
                    domains: ['tech'],
                    keywords: ['AI'],
                    temporal: { start: '2023-01-01' }
                },
                tilt: 'embedding'
            });
        });

        it('should use lastQuery when no query provided', async () => {
            await stateManager.setZoom('entity', 'stored query');
            
            const navParams = stateManager.getNavigationParams();
            
            expect(navParams.query).toBe('stored query');
        });

        it('should use empty string when no query available', async () => {
            const navParams = stateManager.getNavigationParams();
            
            expect(navParams.query).toBe('');
        });

        it('should prioritize provided query over lastQuery', async () => {
            await stateManager.setZoom('entity', 'stored query');
            
            const navParams = stateManager.getNavigationParams('override query');
            
            expect(navParams.query).toBe('override query');
        });
    });

    describe('State Persistence', () => {
        it('should call persistState with previous state', async () => {
            const spy = vi.spyOn(stateManager, 'persistState');
            const initialState = stateManager.getState();
            
            await stateManager.setZoom('unit');
            
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    zoom: 'entity',
                    sessionId: initialState.sessionId
                })
            );
        });

        it('should store interaction via SafeOperations when memory manager available', async () => {
            await stateManager.setZoom('unit');
            
            expect(mockSafeOps.storeInteraction).toHaveBeenCalledWith(
                expect.stringContaining('ZPT State Change'),
                expect.any(String), // JSON stringified state
                expect.objectContaining({
                    type: 'zpt_state',
                    stateChange: true
                })
            );
        });

        it('should not throw when persistence fails', async () => {
            mockSafeOps.storeInteraction.mockRejectedValueOnce(new Error('Storage error'));
            
            // Should not throw
            await expect(stateManager.setZoom('unit')).resolves.toBeDefined();
            
            // Should log warning
            expect(mockMcpDebugger.warn).toHaveBeenCalledWith(
                'Failed to persist ZPT state',
                expect.any(Error)
            );
        });

        it('should handle memory manager without addInteraction method', async () => {
            const stateManagerWithoutAdd = new ZPTStateManager({});
            
            // Should not throw
            await expect(stateManagerWithoutAdd.setZoom('unit')).resolves.toBeDefined();
        });
    });

    describe('Concurrent State Changes', () => {
        it('should handle concurrent state modifications', async () => {
            // Start multiple state changes concurrently
            const promises = [
                stateManager.setZoom('unit'),
                stateManager.setPan({ domains: ['tech'] }),
                stateManager.setTilt('embedding')
            ];
            
            const results = await Promise.all(promises);
            
            // All should succeed
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.timestamp).toBeDefined();
            });
            
            // Final state should have all changes
            const finalState = stateManager.getState();
            expect(finalState.zoom).toBe('unit');
            expect(finalState.pan.domains).toEqual(['tech']);
            expect(finalState.tilt).toBe('embedding');
        });

        it('should maintain history consistency with concurrent changes', async () => {
            // Make concurrent changes
            await Promise.all([
                stateManager.setZoom('unit'),
                stateManager.setPan({ keywords: ['AI'] }),
                stateManager.setTilt('graph')
            ]);
            
            // Should have recorded all changes
            expect(stateManager.stateHistory.length).toBeGreaterThan(0);
            
            // All history entries should have valid structure
            stateManager.stateHistory.forEach(entry => {
                expect(entry.previous).toBeDefined();
                expect(entry.current).toBeDefined();
                expect(entry.timestamp).toBeDefined();
            });
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle null/undefined parameters gracefully', async () => {
            await expect(stateManager.setZoom(null)).resolves.toBeDefined();
            await expect(stateManager.setPan(null)).resolves.toBeDefined();
            await expect(stateManager.setTilt(null)).resolves.toBeDefined();
        });

        it('should handle empty string queries', async () => {
            const result = await stateManager.setZoom('unit', '');
            expect(result.lastQuery).toBe('');
            
            const navParams = stateManager.getNavigationParams('');
            expect(navParams.query).toBe('');
        });

        it('should maintain state integrity after errors', async () => {
            const originalState = stateManager.getState();
            
            // Simulate error in persistence
            vi.spyOn(stateManager, 'persistState').mockRejectedValueOnce(new Error('Persist error'));
            
            await stateManager.setZoom('unit');
            
            // State should still be updated despite persistence error
            expect(stateManager.getState().zoom).toBe('unit');
            expect(stateManager.getState().sessionId).toBe(originalState.sessionId);
        });

        it('should handle very large history sizes', async () => {
            stateManager.maxHistorySize = 1000;
            
            // Make many changes
            for (let i = 0; i < 50; i++) {
                await stateManager.setZoom(i % 2 === 0 ? 'unit' : 'entity');
            }
            
            expect(stateManager.stateHistory.length).toBeLessThanOrEqual(1000);
            expect(stateManager.stateHistory.length).toBe(50);
        });
    });
});