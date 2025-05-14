// tests/unit/http/message-queue.vitest.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MessageQueue from '../../../src/api/http/server/MessageQueue.js';

describe('MessageQueue', () => {
  let queue;
  const clientId = 'test-client';
  const topic = 'test-topic';
  const mockMessage = { data: 'test' };
  
  beforeEach(() => {
    queue = new MessageQueue({
      maxQueueSize: 3,
      maxAge: 1000 // 1 second for testing
    });
    
    // Use vi.useFakeTimers() instead of jasmine.clock()
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    queue.dispose();
    vi.useRealTimers();
  });
  
  describe('Message Management', () => {
    it('should add and retrieve messages', () => {
      queue.addMessage(clientId, topic, mockMessage);
      const messages = queue.getMessages(clientId);
      
      expect(messages.length).toBe(1);
      expect(messages[0].message).toEqual(mockMessage);
      expect(messages[0].topic).toBe(topic);
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeDefined();
    });
    
    it('should enforce maxQueueSize', () => {
      for (let i = 0; i < 5; i++) {
        queue.addMessage(clientId, topic, { count: i });
      }
      
      const messages = queue.getMessages(clientId);
      expect(messages.length).toBe(3);
      expect(messages[0].message.count).toBe(2);
    });
    
    it('should filter messages by timestamp', () => {
      queue.addMessage(clientId, topic, { age: 'old' });
      vi.advanceTimersByTime(2000); // Use Vitest timer advance
      queue.addMessage(clientId, topic, { age: 'new' });
      
      const messages = queue.getMessages(clientId, null, Date.now() - 1000);
      expect(messages.length).toBe(1);
      expect(messages[0].message.age).toBe('new');
    });
  });
  
  describe('Topic Management', () => {
    it('should handle topic subscriptions', () => {
      queue.subscribeTopic(clientId, topic);
      expect(queue.getClientTopics(clientId)).toContain(topic);
    });
    
    it('should handle topic unsubscriptions', () => {
      queue.subscribeTopic(clientId, topic);
      queue.unsubscribeTopic(clientId, topic);
      expect(queue.getClientTopics(clientId).length).toBe(0);
    });
    
    it('should filter messages by topic', () => {
      queue.addMessage(clientId, 'topic1', { data: 't1' });
      queue.addMessage(clientId, 'topic2', { data: 't2' });
      
      const messages = queue.getMessages(clientId, 'topic1');
      expect(messages.length).toBe(1);
      expect(messages[0].message.data).toBe('t1');
    });
    
    it('should cleanup empty topic subscriptions', () => {
      queue.subscribeTopic(clientId, topic);
      queue.addMessage(clientId, topic, mockMessage);
      queue.acknowledgeMessages(clientId, [queue.getMessages(clientId)[0].id]);
      queue.unsubscribeTopic(clientId, topic);
      
      expect(queue.queues.has(clientId)).toBe(false);
    });
  });
  
  describe('Message Expiration', () => {
    it('should remove expired messages during cleanup', () => {
      queue.addMessage(clientId, topic, mockMessage);
      vi.advanceTimersByTime(2000);
      queue.pruneExpiredMessages();
      
      expect(queue.getMessages(clientId).length).toBe(0);
    });
    
    it('should cleanup empty queues after expiration', () => {
      queue.addMessage(clientId, topic, mockMessage);
      vi.advanceTimersByTime(2000);
      queue.pruneExpiredMessages();
      
      expect(queue.queues.has(clientId)).toBe(false);
    });
    
    it('should retain unexpired messages', () => {
      queue.addMessage(clientId, topic, { age: 'old' });
      vi.advanceTimersByTime(500);
      queue.addMessage(clientId, topic, { age: 'new' });
      queue.pruneExpiredMessages();
      
      const messages = queue.getMessages(clientId);
      expect(messages.length).toBe(2);
    });
  });
  
  describe('Message Acknowledgment', () => {
    it('should remove acknowledged messages', () => {
      queue.addMessage(clientId, topic, mockMessage);
      const messages = queue.getMessages(clientId);
      queue.acknowledgeMessages(clientId, [messages[0].id]);
      
      expect(queue.getMessages(clientId).length).toBe(0);
    });
    
    it('should handle invalid message ids', () => {
      queue.addMessage(clientId, topic, mockMessage);
      queue.acknowledgeMessages(clientId, ['invalid-id']);
      
      expect(queue.getMessages(clientId).length).toBe(1);
    });
    
    it('should handle batch acknowledgments', () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        queue.addMessage(clientId, topic, { count: i });
        ids.push(queue.getMessages(clientId)[i].id);
      }
      
      queue.acknowledgeMessages(clientId, ids);
      expect(queue.getMessages(clientId).length).toBe(0);
    });
  });
  
  describe('Event Emission', () => {
    it('should emit messageQueued event', () => {
      return new Promise((resolve) => {
        queue.once('messageQueued', (data) => {
          expect(data.clientId).toBe(clientId);
          expect(data.topic).toBe(topic);
          expect(data.message).toEqual(mockMessage);
          resolve();
        });
        
        queue.addMessage(clientId, topic, mockMessage);
      });
    });
  });
});