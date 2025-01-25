import { EventEmitter } from 'events';

export default class MessageQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        this.maxQueueSize = options.maxQueueSize || 1000;
        this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours
        this.queues = new Map();
        this.setupCleanup();
    }

    setupCleanup() {
        setInterval(() => this.pruneExpiredMessages(), this.maxAge / 4);
    }

    pruneExpiredMessages() {
        const now = Date.now();
        for (const [clientId, queue] of this.queues) {
            queue.messages = queue.messages.filter(msg => 
                now - msg.timestamp < this.maxAge
            );
            if (queue.messages.length === 0) {
                this.queues.delete(clientId);
            }
        }
    }

    addMessage(clientId, topic, message) {
        if (!this.queues.has(clientId)) {
            this.queues.set(clientId, { 
                messages: [],
                topics: new Set([topic])
            });
        }

        const queue = this.queues.get(clientId);
        queue.topics.add(topic);

        queue.messages.push({
            topic,
            message,
            timestamp: Date.now(),
            id: crypto.randomUUID()
        });

        // Enforce queue size limit
        if (queue.messages.length > this.maxQueueSize) {
            queue.messages.shift();
        }

        this.emit('messageQueued', { clientId, topic, message });
    }

    getMessages(clientId, topic = null, since = 0) {
        const queue = this.queues.get(clientId);
        if (!queue) return [];

        return queue.messages
            .filter(msg => 
                msg.timestamp > since && 
                (!topic || msg.topic === topic)
            )
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    subscribeTopic(clientId, topic) {
        if (!this.queues.has(clientId)) {
            this.queues.set(clientId, { 
                messages: [],
                topics: new Set([topic])
            });
        } else {
            this.queues.get(clientId).topics.add(topic);
        }
    }

    unsubscribeTopic(clientId, topic) {
        const queue = this.queues.get(clientId);
        if (queue) {
            queue.topics.delete(topic);
            if (queue.topics.size === 0 && queue.messages.length === 0) {
                this.queues.delete(clientId);
            }
        }
    }

    getClientTopics(clientId) {
        return Array.from(this.queues.get(clientId)?.topics || []);
    }

    acknowledgeMessages(clientId, messageIds) {
        const queue = this.queues.get(clientId);
        if (!queue) return;

        queue.messages = queue.messages.filter(msg => 
            !messageIds.includes(msg.id)
        );

        if (queue.messages.length === 0 && queue.topics.size === 0) {
            this.queues.delete(clientId);
        }
    }

    dispose() {
        this.queues.clear();
        this.removeAllListeners();
    }
}