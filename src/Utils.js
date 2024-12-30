// Logging utility
export const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args)
};

// Helper functions for vector operations
export const vectorOps = {
    normalize: (vector) => {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / magnitude);
    },
    
    cosineSimilarity: (vec1, vec2) => {
        const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
        const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (mag1 * mag2);
    }
};
