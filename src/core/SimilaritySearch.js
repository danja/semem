// SimilaritySearch.js
// Consolidated module for embeddings-based and vector search functionality

import { VectorOperations } from './Vectors.js';
import { Embeddings } from './Embeddings.js';

/**
 * SimilaritySearch class
 * Handles vector-based similarity search using embeddings and Faiss.
 */
export class SimilaritySearch {
    constructor(config) {
        this.config = config;
        this.embeddings = new Embeddings(config);
        this.index = null; // Placeholder for Faiss index
    }

    /**
     * Initialize the Faiss index
     * @param {number} dimension - Dimension of the embeddings
     */
    initializeIndex(dimension) {
        // Initialize Faiss index here
        this.index = new Faiss.IndexFlatIP(dimension);
    }

    /**
     * Add embeddings to the index
     * @param {Array<number[]>} embeddings - Array of embedding vectors
     */
    addEmbeddings(embeddings) {
        embeddings.forEach(embedding => {
            if (VectorOperations.isValidEmbedding(embedding)) {
                this.index.add(embedding);
            }
        });
    }

    /**
     * Perform similarity search
     * @param {number[]} queryEmbedding - Query embedding vector
     * @param {number} topK - Number of top results to return
     * @returns {Array} - Search results
     */
    search(queryEmbedding, topK) {
        if (!this.index) {
            throw new Error('Index not initialized');
        }
        return this.index.search(queryEmbedding, topK);
    }
}