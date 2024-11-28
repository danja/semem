import { promises as fs } from 'fs';
import BaseStorage from './storage.js';
import { logger } from './utils.js';

export default class JSONStorage extends BaseStorage {
    constructor(filePath = 'interaction_history.json') {
        super();
        this.filePath = filePath;
    }

    async loadHistory() {
        try {
            const exists = await fs.access(this.filePath).then(() => true).catch(() => false);
            if (exists) {
                logger.info('Loading existing interaction history from JSON...');
                const data = await fs.readFile(this.filePath, 'utf8');
                const history = JSON.parse(data);
                return [
                    history.shortTermMemory || [],
                    history.longTermMemory || []
                ];
            }
            logger.info('No existing interaction history found in JSON. Starting fresh.');
            return [[], []];
        } catch (error) {
            logger.error('Error loading history:', error);
            return [[], []];
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

            await fs.writeFile(this.filePath, JSON.stringify(history, null, 2));
            logger.info(`Saved interaction history to JSON. Short-term: ${history.shortTermMemory.length}, Long-term: ${history.longTermMemory.length}`);
        } catch (error) {
            logger.error('Error saving history:', error);
            throw error;
        }
    }
}
