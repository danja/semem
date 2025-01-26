// tests/integration/http/websocket-integration.spec.js
import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'events'
import MemoryWebSocketServer from '../../../src/api/http/server/WebSocketServer.js'
import MessageQueue from '../../../src/api/http/server/MessageQueue.js'

describe('WebSocket Integration', () => {
    const PORT = 8081
    const WS_URL = `ws://localhost:${PORT}/ws`
    const AUTH_HEADER = Buffer.from('admin:admin123').toString('base64')

    let server
    let mockHttpServer

    // Helper to create authenticated websocket connection
    const connectWS = (headers = {}) => new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL, {
            headers: {
                'Authorization': `Basic ${AUTH_HEADER}`,
                ...headers
            }
        })
        const timeout = setTimeout(() => {
            ws.close()
            reject(new Error('Connection timeout'))
        }, 2000)

        ws.once('open', () => {
            clearTimeout(timeout)
            resolve(ws)
        })
        ws.once('error', reject)
    })

    beforeEach(() => {
        mockHttpServer = new EventEmitter()
        mockHttpServer.address = () => ({ port: PORT })
        server = new MemoryWebSocketServer(mockHttpServer)
    })

    afterEach(() => {
        server.close()
    })

    describe('Connection Management', () => {
        let ws

        afterEach(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.close()
            }
        })

        it('should authenticate connections with valid credentials', async () => {
            ws = await connectWS()
            expect(ws.readyState).toBe(WebSocket.OPEN)

            // Verify welcome message
            const message = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })
            expect(message.type).toBe('connected')
            expect(message.clientId).toBeDefined()
        })

        it('should reject invalid credentials', async () => {
            const invalidAuth = Buffer.from('wrong:pass').toString('base64')
            await expectAsync(
                connectWS({ 'Authorization': `Basic ${invalidAuth}` })
            ).toBeRejected()
        })

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
        })

        afterEach(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
        })

        it('should handle malformed messages', async () => {
            ws.send('invalid json')

            const error = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })

            expect(error.type).toBe('error')
            expect(error.error).toBe('Invalid message format')
        })

        it('should handle rate limiting', async () => {
            // Send messages rapidly
            for (let i = 0; i < 100; i++) {
                ws.send(JSON.stringify({ type: 'ping' }))
            }

            const error = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
            })

            expect(error.type).toBe('error')
            expect(error.error).toContain('rate limit')
        })
    })
})