import { VectorOperations } from './core/Vectors.js';
import { createUnifiedLogger } from './utils/LoggingConfig.js';

// Unified logger for this module
const logger = createUnifiedLogger('utils');

export { logger };

// Helper functions for vector operations
export const vectorOps = {
    normalize: (vector) => {
        return VectorOperations.normalize(vector);
    },

    cosineSimilarity: (vec1, vec2) => {
        return VectorOperations.cosineSimilarity(vec1, vec2);
    }
};
