// Base storage class defining interface
export default class BaseStorage {
    async loadHistory() {
        throw new Error('Method loadHistory() must be implemented');
    }

    async saveMemoryToHistory(memoryStore) {
        throw new Error('Method saveMemoryToHistory() must be implemented');
    }
}
