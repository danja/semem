import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import MessageQueue from './MessageQueue.js';

export default class MemoryWebSocketServer extends EventEmitter {
    constructor(server, options = {}) {
        super();
        this.wss = new WebSocketServer({ 
            server,
            path: options.path || '/ws'
        });
        
        this.messageQueue = new MessageQueue(options.queue);
        this.clients = new Map(); // clientId -> {ws, lastSeen, topics}
        this.setupHandlers();
    }

    setupHandlers() {
        this.wss.on('connection', (ws, req) => {
            if (!this.authenticateConnection(ws, req)) return;

            const clientId = crypto.randomUUID();
            this.clients.set(clientId, {
                ws,
                lastSeen: Date.now(),
                topics: new Set(['system', 'memory'])
            });

            // Send queued messages
            this.sendQueuedMessages(clientId);

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(clientId, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => this.handleDisconnect(clientId));

            // Send connection confirmation
            ws.send(JSON.stringify({
                type: 'connected',
                clientId,
                timestamp: Date.now()
            }));
        });
    }

    authenticateConnection(ws, req) {
        const authHeader = req.headers['authorization'];
        if (authHeader) {
            try {
                const [type, credentials] = authHeader.split(' ');
                if (type === 'Basic') {
                    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
                    const [username, password] = decoded.split(':');
                    if (username !== 'admin' || password !== 'admin123') {
                        ws.close(1008, 'Invalid credentials');
                        return false;
                    }
                }
            } catch (error) {
                ws.close(1008, 'Invalid authorization');
                return false;
            }
        }
        return true;
    }

    handleClientMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.lastSeen = Date.now();

        switch (data.type) {
            case 'subscribe':
                this.messageQueue.subscribeTopic(clientId, data.topic);
                client.topics.add(data.topic);
                break;

            case 'unsubscribe':
                this.messageQueue.unsubscribeTopic(clientId, data.topic);
                client.topics.delete(data.topic);
                break;

            case 'ack':
                if (Array.isArray(data.messageIds)) {
                    this.messageQueue.acknowledgeMessages(clientId, data.messageIds);
                }
                break;

            default:
                this.emit('message', data, client.ws);
        }
    }

    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Keep subscriptions in message queue for reconnect
        this.clients.delete(clientId);
        this.emit('clientDisconnected', clientId);
    }

    async sendQueuedMessages(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const messages = this.messageQueue.getMessages(
            clientId, 
            null,
            Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
        );

        for (const msg of messages) {
            if (client.topics.has(msg.topic)) {
                client.ws.send(JSON.stringify({
                    type: 'queued_message',
                    ...msg
                }));
            }
        }
    }

    broadcast(topic, data) {
        const message = JSON.stringify({ 
            type: 'broadcast',
            topic,
            data,
            timestamp: Date.now()
        });

        // Queue for offline clients and send to connected ones
        for (const [clientId, client] of this.clients) {
            if (client.topics.has(topic)) {
                if (client.ws.readyState === 1) { // OPEN
                    client.ws.send(message);
                } else {
                    this.messageQueue.addMessage(clientId, topic, data);
                }
            }
        }
    }

    notifyUpdate(interaction) {
        this.broadcast('memory', {
            type: 'interaction_added',
            data: interaction
        });
    }

    close() {
        for (const [clientId, client] of this.clients) {
            client.ws.close(1000, 'Server shutting down');
        }
        this.clients.clear();
        this.messageQueue.dispose();
        this.wss.close();
    }
}