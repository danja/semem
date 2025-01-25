import MessageQueue from '../../../src/api/http/server/MessageQueue.js';

describe('MessageQueue', () => {
    let queue;
    const clientId = 'test-client';
    const topic = 'test-topic';

    beforeEach(() => {
        queue = new MessageQueue({
            maxQueueSize: 3,
            maxAge: 1000 // 1 second for testing
        });
        jasmine.clock().install();
    });

    afterEach(() => {
        queue.dispose();
        jasmine.clock().uninstall();
    });

    describe('message handling', () => {
        it('should add and retrieve messages', () => {
            queue.addMessage(clientId, topic, { data: 'test' });
            const messages = queue.getMessages(clientId);
            
            expect(messages.length).toBe(1);
            expect(messages[0].message.data).toBe('test');
            expect(messages[0].topic).toBe(topic);
        });

        it('should respect maxQueueSize', () => {
            for (let i = 0; i < 5; i++) {
                queue.addMessage(clientId, topic, { count: i });
            }

            const messages = queue.getMessages(clientId);
            expect(messages.length).toBe(3);
            expect(messages[0].message.count).toBe(2);
        });

        it('should filter by timestamp', () => {
            queue.addMessage(clientId, topic, { data: 'old' });
            jasmine.clock().tick(2000);
            queue.addMessage(clientId, topic, { data: 'new' });

            const messages = queue.getMessages(clientId, null, Date.now() - 1000);
            expect(messages.length).toBe(1);
            expect(messages[0].message.data).toBe('new');
        });

        it('should acknowledge messages', () => {
            queue.addMessage(clientId, topic, { data: 'test1' });
            const messages = queue.getMessages(clientId);
            queue.acknowledgeMessages(clientId, [messages[0].id]);

            expect(queue.getMessages(clientId).length).toBe(0);
        });
    });

    describe('topic management', () => {
        it('should handle topic subscriptions', () => {
            queue.subscribeTopic(clientId, topic);
            expect(queue.getClientTopics(clientId)).toContain(topic);
        });

        it('should handle topic unsubscriptions', () => {
            queue.subscribeTopic(clientId, topic);
            queue.unsubscribeTopic(clientId, topic);
            expect(queue.getClientTopics(clientId)).not.toContain(topic);
        });

        it('should filter messages by topic', () => {
            queue.addMessage(clientId, 'topic1', { data: 't1' });
            queue.addMessage(clientId, 'topic2', { data: 't2' });

            const messages = queue.getMessages(clientId, 'topic1');
            expect(messages.length).toBe(1);
            expect(messages[0].message.data).toBe('t1');
        });
    });

    describe('cleanup', () => {
        it('should remove expired messages', () => {
            queue.addMessage(clientId, topic, { data: 'test' });
            jasmine.clock().tick(2000);
            
            queue.pruneExpiredMessages();
            expect(queue.getMessages(clientId).length).toBe(0);
        });

        it('should cleanup empty queues', () => {
            queue.addMessage(clientId, topic, { data: 'test' });
            jasmine.clock().tick(2000);
            
            queue.pruneExpiredMessages();
            expect(queue.queues.has(clientId)).toBeFalse();
        });

        it('should emit events on message queued', (done) => {
            queue.once('messageQueued', (data) => {
                expect(data.clientId).toBe(clientId);
                expect(data.topic).toBe(topic);
                done();
            });

            queue.addMessage(clientId, topic, { data: 'test' });
        });
    });
});