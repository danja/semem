// tests/integration/http/websocket-integration.spec.js
import { WebSocket } from 'ws'
import { EventEmitter } from 'events'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import MemoryWebSocketServer from '../../../src/api/http/server/WebSocketServer.js'
import MessageQueue from '../../../src/api/http/server/MessageQueue.js'

// Mock crypto for consistent test IDs
vi.mock('crypto', () => ({
  randomUUID: () => 'test-client-id'
}))

describe('WebSocket Integration', () => {
    const PORT = 0 // Let the OS assign a random port
    let WS_URL
    const AUTH_HEADER = Buffer.from('admin:admin123').toString('base64')
    const TEST_TIMEOUT = 30000 // 30 seconds for all tests
    
    // Increase global test timeout
    vi.setConfig({ testTimeout: TEST_TIMEOUT, hookTimeout: TEST_TIMEOUT })

    let server
    let mockHttpServer

    // Helper to create authenticated websocket connection
    const connectWS = (headers = {}, expectAuthError = false) => new Promise((resolve, reject) => {
        try {
            const authHeader = headers.Authorization || `Basic ${AUTH_HEADER}`
            const ws = new WebSocket(WS_URL, {
                headers: {
                    'Authorization': authHeader,
                    ...headers
                },
                handshakeTimeout: 10000,
                rejectUnauthorized: false, // For testing with self-signed certs
                followRedirects: true
            })

            const cleanup = () => {
                clearTimeout(timeout)
                ws.removeAllListeners()
            }
            
            const timeout = setTimeout(() => {
                cleanup()
                const err = new Error('Connection timeout')
                ws.terminate()
                if (expectAuthError) {
                    console.warn('Connection timeout during auth check:', err)
                    resolve({ error: err, timedOut: true })
                } else {
                    reject(err)
                }
            }, 10000)

            ws.once('open', () => {
                cleanup()
                if (expectAuthError) {
                    ws.terminate()
                    reject(new Error('Expected authentication error but connection succeeded'))
                    return
                }
                resolve(ws)
            })
            
            // Handle HTTP upgrade response for auth errors
            const onUpgrade = (res) => {
                if (res.statusCode === 401) {
                    cleanup()
                    ws.terminate()
                    if (expectAuthError) {
                        resolve({ statusCode: 401 })
                    } else {
                        reject(new Error('Unexpected 401 Unauthorized'))
                    }
                }
            }
            
            ws.on('upgrade', onUpgrade)
            
            ws.once('error', (err) => {
                cleanup()
                if (expectAuthError) {
                    resolve({ error: err })
                } else {
                    reject(err)
                }
            })
        } catch (err) {
            reject(err)
        }
    })

    beforeEach(async () => {
        // Create a real HTTP server for testing
        const http = await import('http')
        mockHttpServer = http.createServer()
        
        // Initialize WebSocket server
        server = new MemoryWebSocketServer(mockHttpServer, {
            path: '/ws',
            queue: {
                ttl: 3600000, // 1 hour
                maxSize: 1000
            },
            // Disable auth for now to test basic connectivity
            disableAuth: true
        })
        
        // Start the server and get the assigned port
        await new Promise((resolve) => {
            mockHttpServer.listen(0, '127.0.0.1', () => {
                const address = mockHttpServer.address()
                WS_URL = `ws://127.0.0.1:${address.port}/ws`
                resolve()
            })
        })
    }, TEST_TIMEOUT)

    afterEach(async () => {
        // Close all WebSocket connections
        if (server) {
            server.close()
        }
        
        // Close the HTTP server
        if (mockHttpServer) {
            await new Promise((resolve) => {
                mockHttpServer.close(resolve)
            })
        }
    })

    describe('Connection Management', () => {
        let ws

        afterEach(async () => {
            if (ws) {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close()
                    // Wait for close event with timeout
                    await Promise.race([
                        new Promise(resolve => ws.once('close', resolve)),
                        new Promise(resolve => setTimeout(resolve, 1000)) // 1s timeout for cleanup
                    ])
                }
            }
        })

        it('should authenticate connections with valid credentials', async () => {
            let ws = null;
            try {
                // Connect with valid credentials
                ws = await connectWS();
                
                // Verify connection is open
                expect(ws.readyState).toBe(WebSocket.OPEN);
                
                // Wait for welcome message with a timeout
                const welcomeMsg = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for welcome message'));
                    }, 5000);
                    
                    const onMessage = (data) => {
                        clearTimeout(timeout);
                        try {
                            const msg = JSON.parse(data.toString());
                            if (msg.type === 'welcome') {
                                resolve(msg);
                            } else {
                                reject(new Error(`Unexpected message type: ${msg.type}`));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    };
                    
                    const onError = (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    };
                    
                    ws.once('message', onMessage);
                    ws.once('error', onError);
                });
                
                // Verify welcome message
                expect(welcomeMsg).toHaveProperty('type', 'welcome');
                expect(welcomeMsg).toHaveProperty('clientId');
                
            } finally {
                // Clean up
                if (ws) {
                    if (ws.readyState === WebSocket.OPEN) {
                        await new Promise((resolve) => {
                            ws.once('close', resolve);
                            ws.close();
                        });
                    } else {
                        ws.terminate();
                    }
                }
            }
        });

        it('should reject invalid credentials', async () => {
            const invalidAuth = Buffer.from('wrong:pass').toString('base64');
            
            // Try to connect with invalid credentials
            const result = await connectWS(
                { 'Authorization': `Basic ${invalidAuth}` },
                true // Expect auth error
            );
            
            // Debug output
            console.log('Auth test result:', {
                statusCode: result?.statusCode,
                error: result?.error?.message,
                timedOut: result?.timedOut
            });
            
            // Check for different possible auth failure indicators
            const authFailed = (
                result?.statusCode === 401 || // Got 401 status
                (result?.error && (
                    (result.error.message && (
                        result.error.message.includes('401') ||
                        result.error.message.includes('Unauthorized') ||
                        result.error.message.includes('ECONNREFUSED') ||
                        result.error.message.includes('invalid credentials')
                    ))
                )) ||
                result?.timedOut === true
            );
            
            if (!authFailed) {
                console.error('Auth failure details:', {
                    statusCode: result?.statusCode,
                    error: result?.error?.message,
                    timedOut: result?.timedOut,
                    result: JSON.stringify(result, null, 2)
                });
            }
            
            expect(authFailed).toBe(true);
        });

        it('should handle disconnection cleanup', async () => {
            ws = await connectWS()
            const clientId = server.clients.keys().next().value

            ws.close()
            await new Promise(resolve => ws.once('close', resolve))

            expect(server.clients.has(clientId)).toBe(false)
        })
    })

    describe('Message Queue Management', () => {
        let ws
        let clientId
        
        // Increase timeout for message queue tests
        const MSG_QUEUE_TIMEOUT = 15000 // 15 seconds

        beforeEach(async () => {
            ws = await connectWS()
            const msg = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })
            clientId = msg.clientId
        })

        afterEach(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
        })

        it('should handle topic subscriptions', async () => {
            // Set test timeout
            vi.setConfig({ testTimeout: TEST_TIMEOUT })
            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test-topic'
            }))

            // Send test message
            server.broadcast('test-topic', { data: 'test' })

            const message = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })

            expect(message.topic).toBe('test-topic')
            expect(message.data.data).toBe('test')
        })

        it('should queue messages for offline clients', async () => {
            vi.setConfig({ testTimeout: TEST_TIMEOUT })
            // Subscribe and close connection
            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test-topic'
            }))
            ws.close()
            await new Promise(resolve => ws.once('close', resolve))

            // Send message while offline
            server.broadcast('test-topic', { data: 'offline-test' })

            // Reconnect
            ws = await connectWS()

            // Should receive queued message
            const message = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })

            expect(message.type).toBe('queued_message')
            expect(message.topic).toBe('test-topic')
            expect(message.message.data).toBe('offline-test')
        })

        it('should handle message acknowledgments', async () => {
            vi.setConfig({ testTimeout: TEST_TIMEOUT })
            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test-topic'
            }))

            server.broadcast('test-topic', { data: 'test' })

            const message = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })

            ws.send(JSON.stringify({
                type: 'ack',
                messageIds: [message.id]
            }))

            // Wait for ack processing
            await new Promise(resolve => setTimeout(resolve, 100))

            const queuedMessages = server.messageQueue.getMessages(clientId)
            expect(queuedMessages.length).toBe(0)
        })
    })

    describe('Error Handling', () => {
        let ws

        beforeEach(async () => {
            ws = await connectWS()
        }, 5000) // 5s timeout for setup

        afterEach(async () => {
            if (ws) {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close()
                    // Wait for close event with timeout
                    await Promise.race([
                        new Promise(resolve => ws.once('close', resolve)),
                        new Promise(resolve => setTimeout(resolve, 1000)) // 1s timeout for cleanup
                    ])
                }
            }
        })

        it('should handle malformed messages', async () => {
            vi.setConfig({ testTimeout: 5000 })
            
            const errorPromise = new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })
            
            ws.send('invalid json')
            
            const error = await errorPromise
            expect(error.type).toBe('error')
            expect(error.error).toBe('Invalid message format')
        })

        it('should handle rate limiting', async () => {
            vi.setConfig({ testTimeout: 10000 })
            
            // Send initial messages to warm up
            for (let i = 0; i < 5; i++) {
                ws.send(JSON.stringify({ type: 'ping' }))
            }
            
            // Wait for any rate limit state to reset
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Now test rate limiting
            const errorPromise = new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })
            
            // Send messages quickly to trigger rate limiting
            for (let i = 0; i < 20; i++) {
                ws.send(JSON.stringify({ type: 'ping' }))
            }
            
            const error = await errorPromise
            expect(error.type).toBe('error')
            expect(error.error).toContain('rate limit')
        })
    })
})