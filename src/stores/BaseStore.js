// Base storage class defining interface
export default class BaseStore {
    async loadHistory() {
        throw new Error('Method loadHistory() must be implemented');
    }

    async saveMemoryToHistory(memoryStore) {
        throw new Error('Method saveMemoryToHistory() must be implemented');
    }
}
