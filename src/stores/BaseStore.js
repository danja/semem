export default class BaseStore {
    async loadHistory() {
        throw new Error('Method loadHistory() must be implemented');
    }

    async saveMemoryToHistory(memoryStore) {
        throw new Error('Method saveMemoryToHistory() must be implemented');
    }

    async beginTransaction() {
        throw new Error('Method beginTransaction() must be implemented');
    }

    async commitTransaction() {
        throw new Error('Method commitTransaction() must be implemented');
    }

    async rollbackTransaction() {
        throw new Error('Method rollbackTransaction() must be implemented');
    }

    async verify() {
        throw new Error('Method verify() must be implemented');
    }

    async close() {
        throw new Error('Method close() must be implemented');
    }
}