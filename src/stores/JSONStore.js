import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import BaseStore from './BaseStore.js';
import { logger } from '../Utils.js';

export default class JSONStore extends BaseStore {
    constructor(filePath = 'interaction_history.json') {
        super();
        this.filePath = filePath;
        this.tempPath = null;
        this.backupPath = `${filePath}.bak`;
        this.inTransaction = false;
    }

    async ensureDirectory() {
        const dir = dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    async loadHistory() {
        try {
            await this.ensureDirectory();
            const exists = await fs.access(this.filePath).then(() => true).catch(() => false);

            if (!exists) {
                logger.info('No existing interaction history found in JSON. Starting fresh.');
                return [[], []];
            }

            // Try to read main file
            try {
                logger.info('Loading existing interaction history from JSON...');
                const data = await fs.readFile(this.filePath, 'utf8');
                const history = JSON.parse(data);
                return [
                    history.shortTermMemory || [],
                    history.longTermMemory || []
                ];
            } catch (mainError) {
                // If main file is corrupted, try backup
                logger.warn('Main file corrupted, attempting to load backup...');
                const backupExists = await fs.access(this.backupPath).then(() => true).catch(() => false);

                if (backupExists) {
                    const backupData = await fs.readFile(this.backupPath, 'utf8');
                    const history = JSON.parse(backupData);
                    // Restore from backup
                    await fs.copyFile(this.backupPath, this.filePath);
                    return [
                        history.shortTermMemory || [],
                        history.longTermMemory || []
                    ];
                }

                throw mainError;
            }
        } catch (error) {
            logger.error('Error loading history:', error);
            return [[], []];
        }
    }

    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress');
        }
        this.inTransaction = true;
        this.tempPath = `${this.filePath}.tmp`;
    }

    async commitTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        try {
            // First backup the current file if it exists
            const exists = await fs.access(this.filePath).then(() => true).catch(() => false);
            if (exists) {
                await fs.copyFile(this.filePath, this.backupPath);
            }

            // Atomically rename temp file to main file
            await fs.rename(this.tempPath, this.filePath);

            // Clean up
            if (exists) {
                await fs.unlink(this.backupPath).catch(() => { });
            }
        } finally {
            this.inTransaction = false;
            this.tempPath = null;
        }
    }

    async rollbackTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        try {
            if (this.tempPath) {
                await fs.unlink(this.tempPath).catch(() => { });
            }
        } finally {
            this.inTransaction = false;
            this.tempPath = null;
        }
    }

    async verify() {
        try {
            const data = await fs.readFile(this.filePath, 'utf8');
            JSON.parse(data); // Try to parse
            return true;
        } catch {
            return false;
        }
    }

    async saveMemoryToHistory(memoryStore) {
        try {
            await this.ensureDirectory();
            await this.beginTransaction();

            const history = {
                shortTermMemory: memoryStore.shortTermMemory.map((item, idx) => ({
                    id: item.id,
                    prompt: item.prompt,
                    output: item.output,
                    embedding: Array.from(memoryStore.embeddings[idx]),
                    timestamp: memoryStore.timestamps[idx],
                    accessCount: memoryStore.accessCounts[idx],
                    concepts: Array.from(memoryStore.conceptsList[idx]),
                    decayFactor: item.decayFactor || 1.0
                })),
                longTermMemory: memoryStore.longTermMemory
            };

            // Write to temp file first
            await fs.writeFile(this.tempPath, JSON.stringify(history, null, 2));

            // Verify the written file
            if (!await this.verify()) {
                throw new Error('Data verification failed');
            }

            // Commit the transaction
            await this.commitTransaction();

            logger.info(`Saved interaction history to JSON. Short-term: ${history.shortTermMemory.length}, Long-term: ${history.longTermMemory.length}`);
        } catch (error) {
            await this.rollbackTransaction();
            logger.error('Error saving history:', error);
            throw error;
        }
    }

    async close() {
        if (this.inTransaction) {
            await this.rollbackTransaction();
        }
        return Promise.resolve();
    }
}