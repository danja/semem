import BaseStore from './BaseStore.js';
import { logger } from '../Utils.js';

export default class InMemoryStore extends BaseStore {
    constructor() {
        super();
        this.history = {
            shortTermMemory: [],
            longTermMemory: []
        };
        this.transactionInProgress = false;
    }

    async loadHistory() {
        logger.info('Loading history from in-memory storage');
        return [
            this.history.shortTermMemory || [],
            this.history.longTermMemory || []
        ];
    }

    async saveMemoryToHistory(memoryStore) {
        logger.info('Saving history to in-memory storage');

        this.history = {
            shortTermMemory: memoryStore.shortTermMemory.map((item, idx) => ({
                id: item.id,
                prompt: item.prompt,
                output: item.output,
                embedding: Array.from(memoryStore.embeddings[idx].flat()),
                timestamp: memoryStore.timestamps[idx],
                accessCount: memoryStore.accessCounts[idx],
                concepts: Array.from(memoryStore.conceptsList[idx]),
                decayFactor: item.decayFactor || 1.0
            })),
            longTermMemory: [...memoryStore.longTermMemory]
        };

        logger.info(`Saved ${this.history.shortTermMemory.length} short-term and ${this.history.longTermMemory.length} long-term memories`);
    }

    async beginTransaction() {
        if (this.transactionInProgress) {
            throw new Error('Transaction already in progress');
        }
        this.transactionInProgress = true;
        this.transactionSnapshot = JSON.parse(JSON.stringify(this.history));
    }

    async commitTransaction() {
        if (!this.transactionInProgress) {
            throw new Error('No transaction in progress');
        }
        this.transactionInProgress = false;
        delete this.transactionSnapshot;
    }

    async rollbackTransaction() {
        if (!this.transactionInProgress) {
            throw new Error('No transaction in progress');
        }
        if (this.transactionSnapshot) {
            this.history = JSON.parse(JSON.stringify(this.transactionSnapshot));
        }
        this.transactionInProgress = false;
        delete this.transactionSnapshot;
    }

    async verify() {
        // For in-memory store, verification always succeeds
        return true;
    }

    async close() {
        // Clean up any resources (none in this case)
        this.history = {
            shortTermMemory: [],
            longTermMemory: []
        };
    }
}
