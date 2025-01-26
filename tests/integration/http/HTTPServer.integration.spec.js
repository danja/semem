// tests/integration/http/HTTPServer.integration.spec.js
import HTTPServer from '../../../src/api/http/server/HTTPServer.js'
import fetch from 'node-fetch'
import WebSocket from 'ws'

describe('HTTPServer Integration', () => {
    let server
    let baseUrl
    const PORT = 8082
    const AUTH_HEADER = Buffer.from('admin:admin123').toString('base64')

    beforeAll(async () => {
        server = new HTTPServer({ port: PORT })
        await server.initialize()
        baseUrl = `http://localhost:${PORT}`
    })

    afterAll(async () => {
        await server.shutdown()
    })

    describe('REST API', () => {
        it('should handle memory operations', async () => {
            const interaction = {
                prompt: 'test prompt',
                output: 'test output',
                embedding: new Array(1536).fill(0),
                timestamp: Date.now(),
                concepts: ['test']
            }

            const saveResponse = await fetch(`${baseUrl}/api/memory`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${AUTH_HEADER}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(interaction)
            })
            expect(saveResponse.ok).toBeTrue()

            const searchResponse = await fetch(
                `${baseUrl}/api/memory/search?text=test&limit=1`,
                {
                    headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
                }
            )
            const results = await searchResponse.json()
            expect(results.success).toBeTrue()
            expect(results.data.length).toBe(1)
        })

        it('should handle chat operations', async () => {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${AUTH_HEADER}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: 'Hello',
                    model: 'qwen2:1.5b'
                })
            })

            const result = await response.json()
            expect(result.success).toBeTrue()
            expect(result.data).toBeTruthy()
        })

        it('should enforce rate limits', async () => {
            const requests = Array(101).fill().map(() =>
                fetch(`${baseUrl}/api/health`)
            )

            const responses = await Promise.all(requests)
            const blocked = responses.filter(r => r.status === 429)
            expect(blocked.length).toBeGreaterThan(0)
        })
    })

    describe('Authentication', () => {
        it('should reject invalid credentials', async () => {
            const invalidAuth = Buffer.from('wrong:pass').toString('base64')
            const response = await fetch(`${baseUrl}/api/memory`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${invalidAuth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(401)
        })

        it('should allow public health endpoints', async () => {
            const response = await fetch(`${baseUrl}/api/health`)
            expect(response.ok).toBeTrue()

            const health = await response.json()
            expect(health.status).toBe('healthy')
        })
    })

    describe('WebSocket Integration', () => {
        it('should handle WebSocket connections', async () => {
            const ws = new WebSocket(`ws://localhost:${PORT}/ws`, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })

            const connected = await new Promise(resolve => {
                ws.once('open', () => resolve(true))
                ws.once('error', () => resolve(false))
            })

            expect(connected).toBeTrue()
            ws.close()
        })

        it('should handle message broadcasts', async () => {
            const ws = new WebSocket(`ws://localhost:${PORT}/ws`, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })

            await new Promise(resolve => ws.once('open', resolve))

            ws.send(JSON.stringify({
                type: 'subscribe',
                topic: 'test'
            }))

            const message = await new Promise(resolve => {
                ws.once('message', data => {
                    resolve(JSON.parse(data.toString()))
                })
                server.wsServer.broadcast('test', { data: 'test' })
            })

            expect(message.topic).toBe('test')
            ws.close()
        })
    })

    describe('Error Handling', () => {
        it('should handle validation errors', async () => {
            const response = await fetch(`${baseUrl}/api/memory`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${AUTH_HEADER}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    invalid: 'data'
                })
            })

            const error = await response.json()
            expect(error.success).toBeFalse()
            expect(error.error).toBeTruthy()
        })

        it('should handle malformed requests', async () => {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${AUTH_HEADER}`,
                    'Content-Type': 'application/json'
                },
                body: 'invalid json'
            })

            expect(response.status).toBe(400)
        })
    })

    describe('Metrics', () => {
        it('should collect request metrics', async () => {
            await fetch(`${baseUrl}/api/metrics`, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })

            const metricsResponse = await fetch(`${baseUrl}/api/metrics`, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })
            const metrics = await metricsResponse.json()

            expect(metrics.success).toBeTrue()
            expect(metrics.data.http).toBeDefined()
            expect(metrics.data.http.requests).toBeGreaterThan(0)
        })

        it('should track response codes', async () => {
            const invalidPath = `${baseUrl}/api/invalid`
            await fetch(invalidPath, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })

            const metricsResponse = await fetch(`${baseUrl}/api/metrics`, {
                headers: { 'Authorization': `Basic ${AUTH_HEADER}` }
            })
            const metrics = await metricsResponse.json()

            expect(metrics.data.http.status['404']).toBeGreaterThan(0)
        })
    })
})