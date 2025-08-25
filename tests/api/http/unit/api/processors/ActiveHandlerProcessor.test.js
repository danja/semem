import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActiveHandlerProcessor from '../../../../src/api/processors/ActiveHandlerProcessor.js';

describe('ActiveHandlerProcessor', () => {
    let processor;
    let mockRegistry;
    let mockActiveHandler;

    beforeEach(() => {
        // Create a mock registry with an active handler
        mockActiveHandler = {
            executeOperation: vi.fn()
        };
        
        mockRegistry = {
            get: vi.fn((key) => {
                if (key === 'active') return mockActiveHandler;
                throw new Error(`Unexpected key: ${key}`);
            })
        };

        processor = new ActiveHandlerProcessor();
        processor.registry = mockRegistry;
    });

    describe('process', () => {
        it('should process a valid message with operation and params', async () => {
            const testMessage = {
                operation: 'startSession',
                params: { userId: 'user123', sessionId: 'sess_abc' }
            };
            
            const expectedResult = { sessionId: 'sess_abc', status: 'active' };
            mockActiveHandler.executeOperation.mockResolvedValue(expectedResult);

            const result = await processor.process(testMessage);

            expect(mockRegistry.get).toHaveBeenCalledWith('active');
            expect(mockActiveHandler.executeOperation).toHaveBeenCalledWith(
                'startSession', 
                { userId: 'user123', sessionId: 'sess_abc' }
            );
            
            expect(result).toEqual({
                ...testMessage,
                result: expectedResult,
                status: 'success',
                timestamp: expect.any(String)
            });
        });

        it('should handle operation errors gracefully', async () => {
            const testMessage = {
                operation: 'invalidOperation',
                params: {}
            };
            
            const error = new Error('Operation not supported');
            mockActiveHandler.executeOperation.mockRejectedValue(error);

            const result = await processor.process(testMessage);

            expect(result).toEqual({
                ...testMessage,
                error: 'Operation not supported',
                status: 'error',
                timestamp: expect.any(String)
            });
        });

        it('should handle missing params with default empty object', async () => {
            const testMessage = {
                operation: 'getStatus'
            };
            
            const expectedResult = { status: 'idle' };
            mockActiveHandler.executeOperation.mockResolvedValue(expectedResult);

            const result = await processor.process(testMessage);

            expect(mockActiveHandler.executeOperation).toHaveBeenCalledWith('getStatus', {});
            expect(result).toMatchObject({
                ...testMessage,
                result: expectedResult,
                status: 'success'
            });
            expect(result.params).toBeUndefined();
        });
    });

    it('should not modify the original message', async () => {
        const originalMessage = {
            operation: 'update',
            params: { setting: 'value' }
        };
        const messageCopy = { ...originalMessage };
        
        mockActiveHandler.executeOperation.mockResolvedValue({});
        
        await processor.process(originalMessage);
        
        // Original message should remain unchanged
        expect(originalMessage).toEqual(messageCopy);
    });

    it('should handle complex nested parameters', async () => {
        const complexParams = {
            userId: 'user123',
            preferences: {
                notifications: true,
                theme: 'dark',
                settings: {
                    fontSize: 14,
                    language: 'en'
                }
            }
        };
        
        const testMessage = {
            operation: 'updateUser',
            params: complexParams
        };
        
        const expectedResult = { success: true, updated: true };
        mockActiveHandler.executeOperation.mockResolvedValue(expectedResult);

        const result = await processor.process(testMessage);

        expect(mockActiveHandler.executeOperation).toHaveBeenCalledWith(
            'updateUser',
            complexParams
        );
        
        expect(result).toMatchObject({
            ...testMessage,
            result: expectedResult,
            status: 'success'
        });
    });
});
