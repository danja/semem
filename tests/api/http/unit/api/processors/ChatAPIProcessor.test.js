import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatAPIProcessor from '../../../../src/api/processors/ChatAPIProcessor.js';

describe('ChatAPIProcessor', () => {
    let processor;
    let mockRegistry;
    let mockChatAPI;

    beforeEach(() => {
        // Create a mock registry with a chat API
        mockChatAPI = {
            executeOperation: vi.fn()
        };
        
        mockRegistry = {
            get: vi.fn((key) => {
                if (key === 'chat') return mockChatAPI;
                throw new Error(`Unexpected key: ${key}`);
            })
        };

        processor = new ChatAPIProcessor();
        processor.registry = mockRegistry;
    });

    describe('process', () => {
        it('should process a valid message successfully', async () => {
            const testMessage = {
                operation: 'send',
                params: { text: 'Hello, world!', userId: '123' }
            };
            
            const expectedResult = { messageId: 'abc123', status: 'sent' };
            mockChatAPI.executeOperation.mockResolvedValue(expectedResult);

            const result = await processor.process(testMessage);

            expect(mockRegistry.get).toHaveBeenCalledWith('chat');
            expect(mockChatAPI.executeOperation).toHaveBeenCalledWith(
                'send', 
                { text: 'Hello, world!', userId: '123' }
            );
            
            expect(result).toEqual({
                ...testMessage,
                result: expectedResult,
                status: 'success',
                timestamp: expect.any(String)
            });
            
            // Verify timestamp is a valid ISO string
            expect(() => new Date(result.timestamp)).not.toThrow();
        });

        it('should handle errors from the chat API', async () => {
            const testMessage = {
                operation: 'invalid',
                params: {}
            };
            
            const error = new Error('Invalid operation');
            mockChatAPI.executeOperation.mockRejectedValue(error);

            const result = await processor.process(testMessage);

            expect(result).toEqual({
                ...testMessage,
                error: 'Invalid operation',
                status: 'error',
                timestamp: expect.any(String)
            });
        });

        it('should handle missing params', async () => {
            const testMessage = {
                operation: 'send' // No params provided
            };
            
            const expectedResult = { status: 'received' };
            mockChatAPI.executeOperation.mockResolvedValue(expectedResult);

            const result = await processor.process(testMessage);

            expect(mockChatAPI.executeOperation).toHaveBeenCalledWith('send', {});
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
            operation: 'send',
            params: { text: 'Original' }
        };
        const messageCopy = { ...originalMessage };
        
        mockChatAPI.executeOperation.mockResolvedValue({});
        
        await processor.process(originalMessage);
        
        // Original message should remain unchanged
        expect(originalMessage).toEqual(messageCopy);
    });
});
