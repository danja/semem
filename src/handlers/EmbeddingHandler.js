import { Embeddings } from '../core/Embeddings.js';
import EmbeddingsAPIBridge from '../services/EmbeddingsAPIBridge.js';

export default class EmbeddingHandler {
    constructor(config, options = {}) {
        this.coreEmbeddings = new Embeddings(config, options);
        this.apiBridge = new EmbeddingsAPIBridge(config, options);
    }

    async generateEmbedding(text, options = {}) {
        return this.apiBridge.generateEmbedding(text, options);
    }

    validateEmbedding(embedding) {
        return this.coreEmbeddings.validateEmbedding(embedding);
    }

    standardizeEmbedding(embedding) {
        return this.coreEmbeddings.standardizeEmbedding(embedding);
    }
}