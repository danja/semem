import HTTPServer from '../../../src/api/http/server/HTTPServer.js';
import { WebSocket } from 'ws';
import Config from '../../../src/Config.js';

describe('WebSocket Integration', () => {
    const PORT = 8081;
    const WS_URL = `ws://localhost:${PORT}/ws`;
    const AUTH_HEADER = Buffer.from('admin:admin123').toString('base64');
    
    let httpServer;
    let config;

    const connectWS = (headers = {}) => new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL, { 
            headers: { 
                'Authorization': `Basic ${AUTH_HEADER}`,
                ...headers 
            }
        });
        const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Connection timeout'));
        }, 2000);

        ws.once('open', () => {
            clearTimeout(timeout);
            resolve(ws);
        });
        ws.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });

    const waitForMessage = (ws, predicate) => new Promise((resolve) => {
        const handler = (data) => {
            const msg = JSON.parse(data.toString());
            if (predicate(msg)) {
                ws.off('message', handler);
                resolve(msg);
            }
        };
        ws.on('message', handler);
    });

    beforeAll(async () => {
        config = new Config({ port: PORT });
        httpServer = new HTTPServer(config);
        await httpServer.initialize();
    });

    afterAll(async () => {
        await httpServer.shutdown();
    });

    describe('connection management', () => {
        let ws;
        
        afterEach(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        it('establishes authenticated connection', async () => {
            ws = await connectWS();
            const msg = await waitForMessage(ws, m => m.type === 'connected');
            expect(msg.clientId).toBeTruthy();
        });

        it('rejects invalid credentials', async () => {
            await expectAsync(
                connectWS({ 'Authorization': 'Basic invalid' })
            ).toBeRejectedWithError();
        });

        it('handles connection limits', async () => {
            const connections = await Promise.all(
                Array(5).fill(0).map(() => connectWS())
            );
            await expectAsync(connectWS()).toBeRejectedWithError();
            connections.forEach(ws => ws.close());
        });
    });

    describe('messaging protocol', () => {
        let ws;
        let clientId;

        beforeEach(async () => {
            ws = await connectWS();
            const msg = await waitForMessage(ws, m => m.type === 'connected');
            clientId = msg.clientId;
        });

        afterEach(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        it('handles topic subscription lifecycle', async () => {
            const topic = 'test-topic';
            const testData = { value: 'test' };

            // Subscribe
            ws.send(JSON.stringify({ type: 'subscribe', topic }));
            
            // Broadcast and verify
            httpServer.wsServer.broadcast(topic, testData);
            const broadcastMsg = await waitForMessage(
                ws, 
                m => m.type === 'broadcast' && m.topic === topic
            );
            expect(broadcastMsg.data).toEqual(testData);

            // Unsubscribe
            ws.send(JSON.stringify({ type: 'unsubscribe', topic }));
            
            // Should not receive after unsubscribe
            httpServer.wsServer.broadcast(topic, { value: 'ignored' });
            await new Promise(resolve => setTimeout(resolve, 100));
        });

        it('manages offline message queue', async () => {
            const topic = 'test-topic';
            const testData = { value: 'offline' };

            // Subscribe and disconnect
            ws.send(JSON.stringify({ type: 'subscribe', topic }));
            ws.close();
            await new Promise(resolve => 
                ws.once('close', resolve)
            );

            // Send while offline
            httpServer.wsServer.broadcast(topic, testData);

            // Reconnect and verify queued message
            ws = await connectWS();
            const queuedMsg = await waitForMessage(
                ws,
                m => m.type === 'queued_message' && m.topic === topic
            );
            expect(queuedMsg.message).toEqual(testData);
        });

        it('processes message acknowledgments', async () => {
            const topic = 'test-topic';
            
            // Subscribe and receive message
            ws.send(JSON.stringify({ type: 'subscribe', topic }));
            httpServer.wsServer.broadcast(topic, { value: 'test' });
            
            const msg = await waitForMessage(
                ws,
                m => m.type === 'broadcast' && m.topic === topic
            );

            // Acknowledge
            ws.send(JSON.stringify({
                type: 'ack',
                messageIds: [msg.id]
            }));

            // Verify acknowledgment
            await new Promise(resolve => setTimeout(resolve, 100));
            const queuedMessages = httpServer.wsServer.messageQueue
                .getMessages(clientId);
            expect(queuedMessages.length).toBe(0);
        });
    });

    describe('error handling', () => {
        let ws;

        afterEach(() => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        it('handles malformed messages', async () => {
            ws = await connectWS();
            ws.send('invalid json');
            
            const errorMsg = await waitForMessage(
                ws,
                m => m.type === 'error'
            );
            expect(errorMsg.error).toBe('Invalid message format');
        });

        it('handles unknown message types', async () => {
            ws = await connectWS();
            ws.send(JSON.stringify({ type: 'unknown' }));
            
            const errorMsg = await waitForMessage(
                ws,
                m => m.type === 'error'
            );
            expect(errorMsg.error).toBe('Unknown message type');
        });
    });
});