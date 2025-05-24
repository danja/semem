// tests/integration/http/websocket-integration.spec.js
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MemoryWebSocketServer from '../../../src/api/http/server/WebSocketServer.js';

// Mock crypto for consistent test IDs
vi.mock('crypto', () => ({
  randomUUID: () => 'test-client-id'
}));

describe('WebSocket Integration', () => {
    const PORT = 0; // Let the OS assign a random port
    const TEST_TIMEOUT = 10000; // 10 seconds for all tests
    const WS_CONNECTION_TIMEOUT = 2000; // 2 seconds for WebSocket connections
    const MESSAGE_TIMEOUT = 2000; // 2 seconds for individual messages
    
    let server;
    let mockHttpServer;
    let wsUrl;

    // Set test timeouts
    vi.setConfig({ 
        testTimeout: TEST_TIMEOUT,
        hookTimeout: TEST_TIMEOUT,
        teardownTimeout: 10000,
        retry: 0, // Disable retries to prevent hanging
    });

    // Helper to create authenticated websocket connection with better error handling
    const connectWS = (headers = {}, expectAuthError = false) => {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': `Basic ${Buffer.from('admin:admin123').toString('base64')}`,
                    ...headers
                }
            });

            const connectionTimeout = setTimeout(() => {
                ws.terminate();
                reject(new Error('WebSocket connection timeout'));
            }, WS_CONNECTION_TIMEOUT);

            ws.on('open', () => {
                clearTimeout(connectionTimeout);
                
                // Set up message handler
                const messageHandler = (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.type === 'connected') {
                            ws.off('message', messageHandler);
                            resolve({ ws, message });
                        }
                    } catch (error) {
                        ws.off('message', messageHandler);
                        reject(error);
                    }
                };

                ws.on('message', messageHandler);
                
                // Set up error handler
                const errorHandler = (error) => {
                    clearTimeout(connectionTimeout);
                    ws.off('error', errorHandler);
                    if (expectAuthError) {
                        resolve({ error });
                    } else {
                        reject(error);
                    }
                };
                
                ws.on('error', errorHandler);
            });

            ws.on('close', () => {
                clearTimeout(connectionTimeout);
                if (expectAuthError) {
                    resolve({ error: new Error('Connection closed') });
                } else {
                    reject(new Error('WebSocket connection closed'));
                }
            });
        });
    };

    beforeEach(async () => {
        // Create a real HTTP server for testing
        const http = await import('http');
        mockHttpServer = http.createServer();
        
        // Start server on random port
        await new Promise((resolve) => {
            mockHttpServer.listen(PORT, '127.0.0.1', () => {
                const address = mockHttpServer.address();
                wsUrl = `ws://${address.address}:${address.port}/ws`;
                resolve();
            });
        });
        
        // Initialize WebSocket server with more verbose logging for debugging
        server = new MemoryWebSocketServer(mockHttpServer, {
            path: '/ws',
            queue: {
                ttl: 3600000, // 1 hour
                maxSize: 1000
            },
            // Enable auth for testing
            disableAuth: false,
            // Add ping/pong for connection health
            pingInterval: 10000,
            pingTimeout: 5000
        });
    });

    afterEach(async () => {
        // Close all WebSocket connections
        if (server && server.clients) {
            for (const ws of server.clients) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.terminate();
                }
            }
        }
        
        // Close the HTTP server
        if (mockHttpServer) {
            await new Promise((resolve) => {
                mockHttpServer.close(() => resolve());
            });
        }
    });

    describe('Connection Management', () => {
        it('should establish WebSocket connection with valid credentials', async () => {
            const { ws, message } = await connectWS();
            
            try {
                expect(ws.readyState).toBe(WebSocket.OPEN);
                expect(message).toHaveProperty('type', 'connected');
                expect(message).toHaveProperty('clientId');
            } finally {
                ws.terminate();
            }
        });

        it('should reject connection with invalid credentials', async () => {
            const { error } = await connectWS(
                { 'Authorization': 'Basic ' + Buffer.from('wrong:credentials').toString('base64') },
                true // Expect auth error
            );
            
            expect(error).toBeDefined();
        });

        it('should handle disconnection cleanup', async () => {
            const { ws, message } = await connectWS();
            const clientId = message.clientId;
            
            try {
                // Verify client exists in server's client map
                expect(server.clients.has(clientId)).toBe(true);
                
                // Close the connection
                ws.close();
                
                // Wait for close event
                await new Promise(resolve => ws.once('close', resolve));
                
                // Verify client was removed from server's client map
                expect(server.clients.has(clientId)).toBe(false);
            } finally {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.terminate();
                }
            }
        });
    });

    describe('Message Handling', () => {
        let ws;
        let clientId;
        
        // Helper to wait for a specific message type
        const waitForMessage = (ws, messageType, timeout = MESSAGE_TIMEOUT) => {
            return new Promise((resolve, reject) => {
                let cleanupCalled = false;
                
                const cleanup = () => {
                    if (!cleanupCalled) {
                        cleanupCalled = true;
                        clearTimeout(timer);
                        ws.off('message', onMessage);
                        ws.off('error', onError);
                    }
                };
                
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error(`Timeout waiting for ${messageType} message`));
                }, timeout);
                
                const onMessage = (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        if (message.type === messageType) {
                            cleanup();
                            resolve(message);
                        }
                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                };
                
                const onError = (error) => {
                    cleanup();
                    reject(error);
                };
                
                ws.on('message', onMessage);
                ws.on('error', onError);
            });
        };

        beforeEach(async () => {
            const result = await connectWS();
            ws = result.ws;
            clientId = result.message.clientId;
        });

        afterEach(() => {
            if (ws) {
                ws.terminate();
                ws = null;
            }
        });

        it('should handle subscription messages', async () => {
            // Subscribe to a topic
            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test-topic'
            }));
            
            // The server doesn't send a response for subscribe, but we can verify
            // the subscription by checking the server state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const client = Array.from(server.clients.values())[0];
            expect(client.topics.has('test-topic')).toBe(true);
        });
        
        it('should handle unsubscription', async () => {
            // First subscribe
            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test-topic'
            }));
            
            // Then unsubscribe
            ws.send(JSON.stringify({
                type: 'unsubscribe',
                topic: 'test-topic'
            }));
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const client = Array.from(server.clients.values())[0];
            expect(client.topics.has('test-topic')).toBe(false);
        });

        it('should handle invalid message format', async () => {
            return new Promise((resolve, reject) => {
                ws.once('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        expect(message.type).toBe('error');
                        expect(message.error).toBe('Invalid message format');
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                });
                
                // Send invalid JSON
                ws.send('invalid-json');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid message format', async () => {
            const { ws } = await connectWS();
            
            try {
                // Send invalid JSON
                ws.send('invalid-json');
                
                // Wait for error response
                const response = await new Promise((resolve) => {
                    ws.once('message', (data) => {
                        resolve(JSON.parse(data.toString()));
                    });
                });
                
                expect(response).toHaveProperty('type', 'error');
                expect(response.error).toBe('Invalid message format');
            } finally {
                ws.terminate();
            }
        });
        
        it('should handle custom message types', async () => {
            const { ws } = await connectWS();
            const testMessage = { type: 'custom', data: 'test' };
            
            try {
                // Set up a one-time handler for the custom message
                const messagePromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for custom message'));
                    }, 1000);
                    
                    server.once('message', (message) => {
                        clearTimeout(timeout);
                        resolve(message);
                    });
                });
                
                // Send the custom message
                ws.send(JSON.stringify(testMessage));
                
                // Wait for the message to be received
                const receivedMessage = await messagePromise;
                expect(receivedMessage).toEqual(testMessage);
            } finally {
                ws.terminate();
            }
        });

        it('should handle client disconnection during message processing', async () => {
            const { ws } = await connectWS();
            
            try {
                // Send a message that will take time to process
                ws.send(JSON.stringify({ type: 'long-running' }));
                
                // Immediately close the connection
                ws.terminate();
                
                // The test will fail if the server crashes
                await new Promise(resolve => setTimeout(resolve, 1000));
            } finally {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.terminate();
                }
            }
        });
    });
});
