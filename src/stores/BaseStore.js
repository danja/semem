export default class BaseStore {
    /**
     * Load memory history from storage
     * @returns {Promise<Array>} Promise resolving to [shortTermMemory, longTermMemory]
     */
    async loadHistory() {
        throw new Error('Method loadHistory() must be implemented');
    }

    /**
     * Save memory state to storage
     * @param {Object} memoryStore The memory store to save
     * @returns {Promise<void>}
     */
    async saveMemoryToHistory(memoryStore) {
        throw new Error('Method saveMemoryToHistory() must be implemented');
    }

    /**
     * Begin atomic operation
     * @returns {Promise<void>}
     */
    async beginTransaction() {
        throw new Error('Method beginTransaction() must be implemented');
    }

    /**
     * Commit atomic operation
     * @returns {Promise<void>}
     */
    async commitTransaction() {
        throw new Error('Method commitTransaction() must be implemented');
    }

    /**
     * Rollback atomic operation
     * @returns {Promise<void>}
     */
    async rollbackTransaction() {
        throw new Error('Method rollbackTransaction() must be implemented');
    }

    /**
     * Ensure data integrity
     * @returns {Promise<boolean>}
     */
    async verify() {
        throw new Error('Method verify() must be implemented');
    }

    /**
     * Close storage connections
     * @returns {Promise<void>}
     */
    async close() {
        throw new Error('Method close() must be implemented');
    }
}