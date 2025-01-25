import MemoryWebSocketServer from '../../../src/api/http/server/WebSocketServer.js';
import MessageQueue from '../../../src/api/http/server/MessageQueue.js';
import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';

describe('MemoryWebSocketServer', () => {
    let server;
    let wss;
    let mockHttpServer;

    beforeEach(() => {
        mockHttpServer = new EventEmitter();
        mockHttpServer.address = () => ({ port: 8080 });

        // Mock WebSocketServer
        wss = new WebSocketServer({ noServer: true });
        spyOn(WebSocketServer.prototype, 'on').and.callThrough();
        
        server = new MemoryWebSocketServer(mockHttpServer);
    });

    afterEach(() => {
        server.close();
        wss.close();
    });

    describe('connection handling', () => {
        it('should authenticate connections', () => {
            const mockWs = {
                close: jasmine.createSpy('close'),
                send: jasmine.createSpy('send')
            };
            const mockReq = {
                headers: {
                    'authorization': 'Basic ' + Buffer.from('admin:admin123').toString('base64')
                }
            };

            const result = server.authenticateConnection(mockWs, mockReq);
            expect(result).toBeTrue();
            expect(mockWs.close).not.toHaveBeenCalled();
        });

        it('should reject invalid credentials', () => {
            const mockWs = {
                close: jasmine.createSpy('close'),
                send: jasmine.createSpy('send')
            };
            const mockReq = {
                headers: {
                    'authorization': 'Basic ' + Buffer.from('wrong:creds').toString('base64')
                }
            };

            const result = server.authenticateConnection(mockWs, mockReq);
            expect(result).toBeFalse();
            expect(mockWs.close).toHaveBeenCalledWith(1008, 'Invalid credentials');
        });
    });

    describe('message handling', () => {
        let mockWs;
        let clientId;

        beforeEach(() => {
            mockWs = {
                send: jasmine.createSpy('send'),
                close: jasmine.createSpy('close'),
                readyState: 1
            };
            clientId = 'test-client';
            server.clients.set(clientId, {
                ws: mockWs,
                lastSeen: Date.now(),
                topics: new Set(['system'])
            });
        });

        it('should handle subscribe messages', () => {
            server.handleClientMessage(clientId, {
                type: 'subscribe',
                topic: 'memory'
            });

            const client = server.clients.get(clientId);
            expect(client.topics.has('memory')).toBeTrue();
        });

        it('should handle unsubscribe messages', () => {
            const client = server.clients.get(clientId);
            client.topics.add('memory');

            server.handleClientMessage(clientId, {
                type: 'unsubscribe',
                topic: 'memory'
            });

            expect(client.topics.has('memory')).toBeFalse();
        });

        it('should handle message acknowledgments', () => {
            spyOn(server.messageQueue, 'acknowledgeMessages');
            
            server.handleClientMessage(clientId, {
                type: 'ack',
                messageIds: ['msg1', 'msg2']
            });

            expect(server.messageQueue.acknowledgeMessages)
                .toHaveBeenCalledWith(clientId, ['msg1', 'msg2']);
        });
    });

    describe('broadcasting', () => {
        it('should broadcast messages to subscribed clients', () => {
            const mockWs1 = {
                send: jasmine.createSpy('send'),
                readyState: 1
            };
            const mockWs2 = {
                send: jasmine.createSpy('send'),
                readyState: 1
            };

            server.clients.set('client1', {
                ws: mockWs1,
                topics: new Set(['memory'])
            });
            server.clients.set('client2', {
                ws: mockWs2,
                topics: new Set(['other'])
            });

            server.broadcast('memory', { data: 'test' });

            expect(mockWs1.send).toHaveBeenCalled();
            expect(mockWs2.send).not.toHaveBeenCalled();
        });

        it('should queue messages for offline clients', () => {
            const mockWs = {
                send: jasmine.createSpy('send'),
                readyState: 3 // CLOSED
            };

            server.clients.set('client1', {
                ws: mockWs,
                topics: new Set(['memory'])
            });

            spyOn(server.messageQueue, 'addMessage');
            server.broadcast('memory', { data: 'test' });

            expect(mockWs.send).not.toHaveBeenCalled();
            expect(server.messageQueue.addMessage).toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('should handle client disconnection', () => {
            const clientId = 'test-client';
            const disconnectSpy = jasmine.createSpy('clientDisconnected');
            
            server.on('clientDisconnected', disconnectSpy);
            server.clients.set(clientId, {
                ws: { close: () => {} },
                topics: new Set()
            });

            server.handleDisconnect(clientId);

            expect(server.clients.has(clientId)).toBeFalse();
            expect(disconnectSpy).toHaveBeenCalledWith(clientId);
        });

        it('should clean up resources on close', () => {
            const mockWs = {
                close: jasmine.createSpy('close')
            };
            server.clients.set('client1', {
                ws: mockWs,
                topics: new Set()
            });

            spyOn(server.messageQueue, 'dispose');
            server.close();

            expect(mockWs.close).toHaveBeenCalled();
            expect(server.clients.size).toBe(0);
            expect(server.messageQueue.dispose).toHaveBeenCalled();
        });
    });
});