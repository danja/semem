/**
 * SearchService - Unified search across SPARQL and FAISS
 * Handles combined search functionality with proper separation of concerns
 */

import logger from '../utils/logger.js';

export class SearchService {
    constructor(sparqlStore, faissIndex) {
        this.sparqlStore = sparqlStore;
        this.faissIndex = faissIndex;
        // Access in-memory storage from SPARQLStore for FAISS result metadata
        this.memoryStore = sparqlStore;
    }

    /**
     * Unified search across both SPARQL stored embeddings and FAISS index
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum results to return
     * @param {number} threshold - Similarity threshold
     * @returns {Promise<Array>} Combined search results
     */
    async search(queryEmbedding, limit = 10, threshold = 0.3) {
        logger.info(`🔍 [SearchService] Unified search: embedding=${queryEmbedding.length}D, limit=${limit}, threshold=${threshold}`);

        const allResults = [];

        try {
            // 1. Search SPARQL-stored embeddings (old format)
            const sparqlResults = await this.sparqlStore.search(queryEmbedding, limit, threshold);
            logger.info(`📊 [SearchService] SPARQL results: ${sparqlResults.length}`);

            // Mark SPARQL results with source
            sparqlResults.forEach(result => {
                result.source = 'sparql';
                allResults.push(result);
            });

            // 2. Search FAISS index for new embeddings
            if (this.faissIndex && this.faissIndex.ntotal() > 0) {
                const faissResults = await this.searchFaissIndex(queryEmbedding, limit, threshold);
                logger.info(`🏃 [SearchService] FAISS results: ${faissResults.length}`);

                // Mark FAISS results with source
                faissResults.forEach(result => {
                    result.source = 'faiss';
                    allResults.push(result);
                });
            } else {
                logger.info(`⚠️ [SearchService] FAISS index empty or unavailable`);
            }

            // 3. Combine and rank all results
            const combinedResults = this.combineAndRankResults(allResults, threshold);
            logger.info(`✅ [SearchService] Combined results: ${combinedResults.length} (threshold: ${threshold})`);

            return combinedResults.slice(0, limit);

        } catch (error) {
            logger.error('❌ [SearchService] Search error:', error);
            return [];
        }
    }

    /**
     * Search the FAISS index for similar vectors
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum results
     * @param {number} threshold - Similarity threshold
     * @returns {Promise<Array>} FAISS search results
     */
    async searchFaissIndex(queryEmbedding, limit, threshold) {
        try {
            if (!this.faissIndex || this.faissIndex.ntotal() === 0) {
                return [];
            }

            // Perform FAISS search
            const k = Math.min(limit * 2, this.faissIndex.ntotal()); // Search more than needed for filtering
            const results = this.faissIndex.search(queryEmbedding, k);

            const faissResults = [];

            // Convert FAISS distances to similarities and filter by threshold
            for (let i = 0; i < results.labels.length; i++) {
                const distance = results.distances[i];
                const similarity = this.convertDistanceToSimilarity(distance);

                if (similarity >= threshold) {
                    const index = results.labels[i];

                    // Try to get actual content from in-memory store if available
                    let prompt = "Recent content";
                    let response = "Content indexed in FAISS";
                    let content = "Recently stored content";

                    // Access in-memory arrays from SPARQLStore if they exist
                    if (this.memoryStore.shortTermMemory && index >= 0 && index < this.memoryStore.shortTermMemory.length) {
                        const memoryItem = this.memoryStore.shortTermMemory[index];
                        if (memoryItem) {
                            prompt = memoryItem.prompt || prompt;
                            response = memoryItem.response || response;
                            content = memoryItem.content || memoryItem.prompt || content;

                            // Debug: Log successful mapping
                            console.log(`✅ [SearchService] FAISS index ${index} mapped to content: "${content.substring(0, 50)}..."`);
                        } else {
                            console.log(`⚠️ [SearchService] FAISS index ${index} found null memoryItem`);
                        }
                    } else {
                        console.log(`⚠️ [SearchService] FAISS index ${index} out of bounds (shortTermMemory length: ${this.memoryStore.shortTermMemory?.length || 0})`);
                    }

                    faissResults.push({
                        id: `faiss_${index}`,
                        prompt: prompt,
                        response: response,
                        content: content,
                        similarity: similarity,
                        metadata: {
                            format: 'faiss',
                            index: index,
                            distance: distance
                        }
                    });
                }
            }

            return faissResults;

        } catch (error) {
            logger.error('❌ [SearchService] FAISS search error:', error);
            return [];
        }
    }

    /**
     * Convert FAISS L2 distance to similarity score
     * @param {number} distance - L2 distance from FAISS
     * @returns {number} Similarity score (0-1)
     */
    convertDistanceToSimilarity(distance) {
        // For L2 distance, smaller is better. Convert to similarity (0-1)
        // This is a simple conversion - could be improved with domain-specific logic
        return Math.exp(-distance / 2);
    }

    /**
     * Combine and rank results from different sources
     * @param {Array} allResults - Results from all sources
     * @param {number} threshold - Similarity threshold
     * @returns {Array} Ranked and filtered results
     */
    combineAndRankResults(allResults, threshold) {
        // Filter by threshold
        const filteredResults = allResults.filter(result => result.similarity >= threshold);

        // Sort by similarity (highest first) with source priority
        filteredResults.sort((a, b) => {
            // Slight preference for FAISS (newer) results if similarities are close
            if (Math.abs(a.similarity - b.similarity) < 0.01) {
                if (a.source === 'faiss' && b.source === 'sparql') return -1;
                if (a.source === 'sparql' && b.source === 'faiss') return 1;
            }

            return b.similarity - a.similarity;
        });

        return filteredResults;
    }
}