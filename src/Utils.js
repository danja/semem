import { VectorOperations } from './core/Vectors.js';

// Logging utility
export const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

// Helper functions for vector operations
export const vectorOps = {
    normalize: (vector) => {
        return VectorOperations.normalize(vector);
    },

    cosineSimilarity: (vec1, vec2) => {
        return VectorOperations.cosineSimilarity(vec1, vec2);
    }
};
