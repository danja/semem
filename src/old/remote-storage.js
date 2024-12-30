import BaseStorage from './storage.js';
import { logger } from './utils.js';

export default class RemoteStorage extends BaseStorage {
    constructor(options = {}) {
        super();
        this.endpoint = options.endpoint || 'http://localhost:8080';
        this.apiKey = options.apiKey;
        this.timeout = options.timeout || 5000;
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.endpoint}/memory`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return [
                data.shortTermMemory || [],
                data.longTermMemory || []
            ];
        } catch (error) {
            logger.error('Error loading remote history:', error);
            throw error;
        }
    }

    async saveMemoryToHistory(memoryStore) {
        try {
            const history = {
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
                longTermMemory: memoryStore.longTermMemory
            };

            const response = await fetch(`${this.endpoint}/memory`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(history),
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            logger.info(`Saved memory to remote storage. Short-term: ${history.shortTermMemory.length}, Long-term: ${history.longTermMemory.length}`);
        } catch (error) {
            logger.error('Error saving to remote storage:', error);
            throw error;
        }
    }
}
