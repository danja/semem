import BaseStore from './BaseStore.js';
import { logger } from '../Utils.js';

export default class InMemoryStore extends BaseStore {
    constructor() {
        super();
        this.history = {
            shortTermMemory: [],
            longTermMemory: []
        };
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
}
