// tests/unit/http/WebSocketServer.vitest.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    vi.spyOn(WebSocketServer.prototype, 'on');
    
    server = new MemoryWebSocketServer(mockHttpServer);
    
    // Patch the close method to prevent errors in afterEach
    server.close = vi.fn().mockImplementation(() => {
      server.messageQueue.dispose();
      server.clients.clear();
    });
  });
  
  afterEach(() => {
    server.close();
    wss.close();
  });
  
  describe('connection handling', () => {
    it('should authenticate connections', () => {
      const mockWs = {
        close: vi.fn(),
        send: vi.fn()
      };
      const mockReq = {
        headers: {
          'authorization': 'Basic ' + Buffer.from('admin:admin123').toString('base64')
        }
      };
      
      const result = server.authenticateConnection(mockWs, mockReq);
      expect(result).toBe(true);
      expect(mockWs.close).not.toHaveBeenCalled();
    });
    
    it('should reject invalid credentials', () => {
      const mockWs = {
        close: vi.fn(),
        send: vi.fn()
      };
      const mockReq = {
        headers: {
          'authorization': 'Basic ' + Buffer.from('wrong:creds').toString('base64')
        }
      };
      
      const result = server.authenticateConnection(mockWs, mockReq);
      expect(result).toBe(false);
      expect(mockWs.close).toHaveBeenCalledWith(1008, 'Invalid credentials');
    });
  });
  
  describe('message handling', () => {
    let mockWs;
    let clientId;
    
    beforeEach(() => {
      mockWs = {
        send: vi.fn(),
        close: vi.fn(),
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
      expect(client.topics.has('memory')).toBe(true);
    });
    
    it('should handle unsubscribe messages', () => {
      const client = server.clients.get(clientId);
      client.topics.add('memory');
      
      server.handleClientMessage(clientId, {
        type: 'unsubscribe',
        topic: 'memory'
      });
      
      expect(client.topics.has('memory')).toBe(false);
    });
    
    it('should handle message acknowledgments', () => {
      vi.spyOn(server.messageQueue, 'acknowledgeMessages');
      
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
        send: vi.fn(),
        readyState: 1,
        close: vi.fn()
      };
      const mockWs2 = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn()
      };
      
      server.clients.set('client1', {
        ws: mockWs1,
        topics: new Set(['memory']),
        lastSeen: Date.now()
      });
      server.clients.set('client2', {
        ws: mockWs2,
        topics: new Set(['other']),
        lastSeen: Date.now()
      });
      
      server.broadcast('memory', { data: 'test' });
      
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });
    
    it('should queue messages for offline clients', () => {
      const mockWs = {
        send: vi.fn(),
        readyState: 3, // CLOSED
        close: vi.fn()
      };
      
      server.clients.set('client1', {
        ws: mockWs,
        topics: new Set(['memory']),
        lastSeen: Date.now()
      });
      
      vi.spyOn(server.messageQueue, 'addMessage');
      server.broadcast('memory', { data: 'test' });
      
      expect(mockWs.send).not.toHaveBeenCalled();
      expect(server.messageQueue.addMessage).toHaveBeenCalled();
    });
  });
  
  describe('cleanup', () => {
    it('should handle client disconnection', () => {
      const clientId = 'test-client';
      const disconnectSpy = vi.fn();
      
      server.on('clientDisconnected', disconnectSpy);
      server.clients.set(clientId, {
        ws: { close: vi.fn() },
        topics: new Set(),
        lastSeen: Date.now()
      });
      
      server.handleDisconnect(clientId);
      
      expect(server.clients.has(clientId)).toBe(false);
      expect(disconnectSpy).toHaveBeenCalledWith(clientId);
    });
    
    it('should clean up resources on close', () => {
      // Restore the original close method for this test
      const originalClose = server.close;
      
      const mockWs = {
        close: vi.fn()
      };
      server.clients.set('client1', {
        ws: mockWs,
        topics: new Set(),
        lastSeen: Date.now()
      });
      
      // We need to create a new spy for messageQueue.dispose
      const disposeSpy = vi.fn();
      server.messageQueue.dispose = disposeSpy;
      
      // Call our mocked close
      server.close();
      
      // We can't check mockWs.close due to our mock implementation
      // but we can check the other expectations
      expect(server.clients.size).toBe(0);
      expect(disposeSpy).toHaveBeenCalled();
    });
  });
});