/**
 * MemoryItemProcessor - Process raw RDF content into searchable memory items
 *
 * This service finds unprocessed content (bookmarks, documents, etc.) and
 * processes it through the tell verb to create semem:MemoryItem entities
 * with embeddings and concept extraction.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createUnifiedLogger } from '../../utils/LoggingConfig.js';
import Chunker from '../document/Chunker.js';
import { generateLabel } from '../../utils/KeywordExtractor.js';
import { INGESTION_CONFIG } from '../../../config/preferences.js';

const logger = createUnifiedLogger('MemoryItemProcessor');
const __dirname = dirname(fileURLToPath(import.meta.url));

export default class MemoryItemProcessor {
    /**
     * @param {Object} options - Configuration options
     * @param {Object} options.store - SPARQLStore instance
     * @param {Object} options.simpleVerbsService - SimpleVerbsService instance for tell operations
     * @param {Object} options.config - Config instance
     * @param {string} options.queryDir - Directory containing SPARQL query files
     */
    constructor(options = {}) {
        this.store = options.store;
        this.simpleVerbsService = options.simpleVerbsService;
        this.config = options.config;
        this.queryDir = options.queryDir || join(__dirname, '../../../sparql/queries');

        if (!this.store) {
            throw new Error('SPARQLStore instance required');
        }
        if (!this.simpleVerbsService) {
            throw new Error('SimpleVerbsService instance required');
        }

        // Get chunking configuration from config or use preferences defaults
        const chunkingConfig = this.config?.get('performance.ingestion.chunking') || {
            enabled: true,
            threshold: INGESTION_CONFIG.BOOKMARK.CHUNKING_THRESHOLD,
            maxChunkSize: 2000,
            minChunkSize: 100,
            overlapSize: 100,
            batchSize: INGESTION_CONFIG.BOOKMARK.DEFAULT_BATCH_SIZE
        };

        this.chunkingConfig = chunkingConfig;

        // Processing delays from preferences
        this.chunkProcessingDelay = INGESTION_CONFIG.BOOKMARK.CHUNK_PROCESSING_DELAY;
        this.bookmarkProcessingDelay = INGESTION_CONFIG.BOOKMARK.BOOKMARK_PROCESSING_DELAY;

        // Initialize chunker for large documents
        this.chunker = new Chunker({
            maxChunkSize: chunkingConfig.maxChunkSize,
            minChunkSize: chunkingConfig.minChunkSize,
            overlapSize: chunkingConfig.overlapSize,
            strategy: 'semantic'
        });

        this.stats = {
            found: 0,
            processed: 0,
            failed: 0,
            skipped: 0,
            chunked: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Load a SPARQL query from file
     * @param {string} queryName - Name of query file (without .sparql extension)
     * @returns {string} - SPARQL query template
     */
    loadQuery(queryName) {
        const queryPath = join(this.queryDir, `${queryName}.sparql`);

        try {
            return readFileSync(queryPath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to load SPARQL query ${queryName}: ${error.message}`);
        }
    }

    /**
     * Substitute variables in SPARQL query template
     * @param {string} query - Query template
     * @param {Object} variables - Variable substitutions
     * @returns {string} - Processed query
     */
    substituteVariables(query, variables) {
        let result = query;

        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `\${${key}}`;
            result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        return result;
    }

    /**
     * Find unprocessed bookmarks in the graph
     * @param {Object} options - Query options
     * @param {number} options.limit - Maximum items to return
     * @returns {Promise<Array>} - Array of unprocessed bookmarks
     */
    async findUnprocessedBookmarks(options = {}) {
        const { limit = 100 } = options;

        try {
            const queryTemplate = this.loadQuery('find-unprocessed-bookmarks');
            const query = this.substituteVariables(queryTemplate, {
                graphURI: this.store.graphName,
                limit: limit
            });

            logger.debug('Executing query to find unprocessed bookmarks');
            const response = await this.store.sparqlExecute.executeSparqlQuery(query);

            const bookmarks = response.results.bindings.map(binding => ({
                id: binding.bookmark?.value,
                title: binding.title?.value || 'Untitled',
                content: binding.content?.value,
                target: binding.target?.value,
                fetched: binding.fetched?.value
            }));

            this.stats.found = bookmarks.length;
            logger.info(`Found ${bookmarks.length} unprocessed bookmarks`);

            return bookmarks;

        } catch (error) {
            throw new Error(`Failed to find unprocessed bookmarks: ${error.message}`);
        }
    }

    /**
     * Process a single bookmark through the tell verb with chunking support
     * @param {Object} bookmark - Bookmark object
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Processing result
     */
    async processBookmark(bookmark, options = {}) {
        const { verbose = false, dryRun = false } = options;

        try {
            if (verbose) {
                logger.info(`Processing bookmark: ${bookmark.title}`);
                logger.debug(`  ID: ${bookmark.id}`);
                logger.debug(`  Target: ${bookmark.target}`);
                logger.debug(`  Content length: ${bookmark.content?.length || 0} chars`);
            }

            if (dryRun) {
                const needsChunking = bookmark.content && bookmark.content.length > this.chunkingConfig.threshold;
                return {
                    success: true,
                    dryRun: true,
                    bookmark: bookmark.title,
                    needsChunking,
                    contentLength: bookmark.content?.length || 0
                };
            }

            const content = bookmark.content || '';
            const CHUNK_THRESHOLD = this.chunkingConfig.threshold;

            // If content is small enough, process directly
            if (content.length <= CHUNK_THRESHOLD) {
                const tellResult = await this.simpleVerbsService.tell({
                    content: bookmark.content,
                    metadata: {
                        title: bookmark.title,
                        source: 'bookmark',
                        bookmarkUri: bookmark.id,
                        targetUri: bookmark.target,
                        fetched: bookmark.fetched,
                        type: 'document'
                    }
                });

                if (!tellResult.success) {
                    throw new Error(tellResult.error || 'Tell operation failed');
                }

                // Mark bookmark as processed
                await this.markBookmarkProcessed(bookmark.id);

                if (verbose) {
                    logger.info(`✅ Successfully processed: ${bookmark.title}`);
                }

                this.stats.processed++;

                return {
                    success: true,
                    bookmark: bookmark.title,
                    memoryItemId: tellResult.id,
                    concepts: tellResult.concepts?.length || 0,
                    chunked: false
                };
            }

            // Chunk large content
            if (verbose) {
                logger.info(`  📄 Chunking large document: ${content.length} chars`);
            }

            const chunkingResult = await this.chunker.chunk(content, {
                title: bookmark.title,
                uri: bookmark.id,
                format: 'text'
            });

            if (verbose) {
                logger.info(`  ✂️  Created ${chunkingResult.chunks.length} chunks`);
            }

            this.stats.chunked++;

            // Process chunks in batches
            const BATCH_SIZE = this.chunkingConfig.batchSize;
            const chunkResults = [];

            for (let batchStart = 0; batchStart < chunkingResult.chunks.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, chunkingResult.chunks.length);
                const batch = chunkingResult.chunks.slice(batchStart, batchEnd);

                if (verbose) {
                    logger.debug(`    Processing chunks ${batchStart + 1}-${batchEnd}/${chunkingResult.chunks.length}...`);
                }

                const batchPromises = batch.map((chunk, batchIndex) => {
                    const i = batchStart + batchIndex;

                    // Generate keyword-based label for this chunk
                    const chunkLabel = generateLabel(chunk.content, 5);

                    const chunkParams = {
                        content: chunk.content,
                        metadata: {
                            title: `${bookmark.title} (chunk ${i + 1}/${chunkingResult.chunks.length})`,
                            source: 'bookmark-chunk',
                            bookmarkUri: bookmark.id,
                            bookmarkTitle: bookmark.title,
                            targetUri: bookmark.target,
                            fetched: bookmark.fetched,
                            chunkIndex: i,
                            chunkTotal: chunkingResult.chunks.length,
                            chunkUri: chunk.uri,
                            partOf: chunkingResult.sourceUri,
                            chunkLabel: chunkLabel,
                            type: 'document'
                        }
                    };

                    return this.simpleVerbsService.tell(chunkParams)
                        .then(result => ({ success: true, result, index: i }))
                        .catch(error => ({ success: false, error: error.message, index: i }));
                });

                const batchResults = await Promise.all(batchPromises);
                chunkResults.push(...batchResults);

                const successCount = batchResults.filter(r => r.success).length;
                if (verbose) {
                    logger.debug(`    ✓ Batch complete: ${successCount}/${batchResults.length} successful`);
                }

                // Configurable delay between chunk batches to avoid rate limiting
                if (batchStart + BATCH_SIZE < chunkingResult.chunks.length) {
                    if (verbose) {
                        logger.debug(`    ⏱️  Waiting ${this.chunkProcessingDelay}ms before next batch...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, this.chunkProcessingDelay));
                }
            }

            // Check if all chunks succeeded
            const allSuccess = chunkResults.every(r => r.success);

            if (allSuccess) {
                // Mark bookmark as processed
                await this.markBookmarkProcessed(bookmark.id);

                if (verbose) {
                    logger.info(`✅ Successfully processed: ${bookmark.title} (${chunkResults.length} chunks)`);
                }

                this.stats.processed++;

                return {
                    success: true,
                    bookmark: bookmark.title,
                    chunked: true,
                    chunkCount: chunkResults.length,
                    sourceUri: chunkingResult.sourceUri
                };
            } else {
                const failedCount = chunkResults.filter(r => !r.success).length;
                throw new Error(`Failed to process ${failedCount}/${chunkResults.length} chunks`);
            }

        } catch (error) {
            this.stats.failed++;
            logger.error(`Failed to process bookmark ${bookmark.title}: ${error.message}`);

            return {
                success: false,
                bookmark: bookmark.title,
                error: error.message
            };
        }
    }

    /**
     * Mark a bookmark as processed in the graph
     * @param {string} bookmarkId - Bookmark URI
     */
    async markBookmarkProcessed(bookmarkId) {
        const updateQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>

            INSERT DATA {
                GRAPH <${this.store.graphName}> {
                    <${bookmarkId}> semem:processedToMemory true .
                }
            }
        `;

        await this.store.sparqlExecute.executeSparqlUpdate(updateQuery);
    }

    /**
     * Process multiple bookmarks in batches
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} - Processing results
     */
    async processBatch(options = {}) {
        const {
            limit = 10,
            batchSize = 5,
            verbose = false,
            dryRun = false,
            progressCallback = null
        } = options;

        this.stats = {
            found: 0,
            processed: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            endTime: null
        };

        try {
            // Find unprocessed bookmarks
            const bookmarks = await this.findUnprocessedBookmarks({ limit });

            if (bookmarks.length === 0) {
                logger.info('No unprocessed bookmarks found');
                return {
                    success: true,
                    stats: this.stats,
                    message: 'No unprocessed bookmarks found'
                };
            }

            logger.info(`Processing ${bookmarks.length} bookmarks in batches of ${batchSize}`);

            const results = [];

            // Process in batches
            for (let i = 0; i < bookmarks.length; i += batchSize) {
                const batch = bookmarks.slice(i, Math.min(i + batchSize, bookmarks.length));

                logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bookmarks.length / batchSize)}`);

                // Process batch items sequentially with delays to respect rate limits
                const batchResults = [];
                for (let j = 0; j < batch.length; j++) {
                    const bookmark = batch[j];
                    const result = await this.processBookmark(bookmark, { verbose, dryRun });
                    batchResults.push(result);

                    // Add delay between bookmarks (except after last one in batch)
                    if (j < batch.length - 1 || i + batchSize < bookmarks.length) {
                        if (verbose) {
                            logger.debug(`    ⏱️  Waiting ${this.bookmarkProcessingDelay}ms before next bookmark...`);
                        }
                        await new Promise(resolve => setTimeout(resolve, this.bookmarkProcessingDelay));
                    }
                }

                results.push(...batchResults);

                // Call progress callback if provided
                if (progressCallback) {
                    progressCallback({
                        total: bookmarks.length,
                        processed: i + batch.length,
                        current: batch.length,
                        batchNumber: Math.floor(i / batchSize) + 1
                    });
                }
            }

            this.stats.endTime = Date.now();
            const duration = this.stats.endTime - this.stats.startTime;

            logger.info(`Processing complete: ${this.stats.processed} processed, ${this.stats.failed} failed in ${duration}ms`);

            return {
                success: true,
                stats: this.stats,
                results: results,
                duration: duration,
                message: `Processed ${this.stats.processed} of ${this.stats.found} bookmarks`
            };

        } catch (error) {
            this.stats.endTime = Date.now();
            logger.error(`Batch processing failed: ${error.message}`);

            return {
                success: false,
                stats: this.stats,
                error: error.message
            };
        }
    }

    /**
     * Get processing statistics
     * @returns {Object} - Current statistics
     */
    getStats() {
        return { ...this.stats };
    }
}
