import logger from 'loglevel';
import EmbeddingService from './EmbeddingService.js';
import SPARQLService from './SPARQLService.js';

/**
 * Service to create and store embeddings for articles
 */
class EmbeddingCreator {
    /**
     * Creates a new EmbeddingCreator
     * @param {Object} options - Configuration options
     * @param {EmbeddingService} options.embeddingService - The embedding service to use
     * @param {SPARQLService} options.sparqlService - The SPARQL service to use
     * @param {string} options.graphName - The graph name to work with
     * @param {string} options.contentPredicate - The predicate for content
     * @param {string} options.embeddingPredicate - The predicate for embeddings
     */
    constructor(options = {}) {
        this.embeddingService = options.embeddingService || new EmbeddingService();
        this.sparqlService = options.sparqlService || new SPARQLService();
        this.graphName = options.graphName || 'http://hyperdata.it/content';
        this.contentPredicate = options.contentPredicate || 'http://schema.org/articleBody';
        this.embeddingPredicate = options.embeddingPredicate || 'http://example.org/embedding/vector';

        this.stats = {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        logger.info(`EmbeddingCreator initialized for graph: ${this.graphName}`);
    }

    /**
     * Run the embedding creation process
     * @param {Object} options - Processing options
     * @param {number} options.limit - Maximum number of articles to process (0 for all)
     * @param {number} options.delay - Delay between articles in ms
     * @returns {Promise<Object>} The statistics from the run
     */
    async run(options = {}) {
        const limit = options.limit || 0;
        const delay = options.delay || 500;

        try {
            // First check if the graph exists
            logger.info(`Checking if graph <${this.graphName}> exists...`);

            const graphExists = await this.sparqlService.graphExists(this.graphName);
            if (!graphExists) {
                throw new Error(`Graph ${this.graphName} does not exist or is empty`);
            }

            logger.info(`Graph <${this.graphName}> exists and contains data`);

            // Execute the query to get articles
            const limitClause = limit > 0 ? `LIMIT ${limit}` : '';
            const query = `
                SELECT * WHERE {
                    GRAPH <${this.graphName}> {
                        ?article <${this.contentPredicate}> ?content
                    }
                }
                ${limitClause}
            `;

            const results = await this.sparqlService.executeQuery(query);
            const articles = results.results.bindings;

            this.stats.total = articles.length;
            logger.info(`Found ${articles.length} articles to process`);

            // Check if articles already have embeddings
            logger.info('Checking for existing embeddings...');

            const checkQuery = `
                SELECT ?article WHERE {
                    GRAPH <${this.graphName}> {
                        ?article <${this.embeddingPredicate}> ?embedding .
                    }
                }
            `;

            const existingEmbeddings = await this.sparqlService.executeQuery(checkQuery);
            const articlesWithEmbeddings = new Set();

            existingEmbeddings.results.bindings.forEach(binding => {
                articlesWithEmbeddings.add(binding.article.value);
            });

            logger.info(`Found ${articlesWithEmbeddings.size} articles with existing embeddings`);

            // Process each article
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                const articleUri = article.article.value;
                const content = article.content.value;

                this.stats.processed++;

                if (articlesWithEmbeddings.has(articleUri)) {
                    logger.info(`Skipping article ${i + 1}/${articles.length} (already has embedding): ${articleUri}`);
                    this.stats.skipped++;
                    continue;
                }

                logger.info(`Processing article ${i + 1}/${articles.length}: ${articleUri}`);

                // Validate content
                if (!content || content.trim().length < 10) {
                    logger.warn(`Skipping article with insufficient content: ${articleUri}`);
                    this.stats.skipped++;
                    continue;
                }

                // Generate embedding for content
                try {
                    const embedding = await this.embeddingService.generateEmbedding(content);

                    // Store the embedding in the SPARQL store
                    await this.sparqlService.storeEmbedding(
                        articleUri,
                        embedding,
                        this.graphName,
                        this.embeddingPredicate
                    );

                    logger.info(`Successfully processed article: ${articleUri}`);
                    this.stats.successful++;

                    // Space out requests to avoid overloading the embedding service
                    if (i < articles.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                } catch (error) {
                    logger.error(`Failed to process article ${articleUri}:`, error);
                    this.stats.failed++;
                    continue;
                }

                // Log progress every 10 articles
                if (this.stats.processed % 10 === 0 || this.stats.processed === this.stats.total) {
                    this.logProgress();
                }
            }

            logger.info('Completed embedding generation process');
            this.logFinalStats();

            return this.stats;
        } catch (error) {
            logger.error('Error during embedding creation:', error);
            throw error;
        }
    }

    /**
     * Log current progress
     */
    logProgress() {
        const progressPercent = Math.round(this.stats.processed / this.stats.total * 100);
        logger.info(`Progress: ${this.stats.processed}/${this.stats.total} articles (${progressPercent}%)`);
        logger.info(`Success: ${this.stats.successful}, Failed: ${this.stats.failed}, Skipped: ${this.stats.skipped}`);
    }

    /**
     * Log final statistics
     */
    logFinalStats() {
        const completionRate = Math.round((this.stats.successful + this.stats.skipped) / this.stats.total * 100);

        logger.info(`Final statistics:
- Total articles: ${this.stats.total}
- Successfully processed: ${this.stats.successful}
- Failed: ${this.stats.failed}
- Skipped (already had embeddings): ${this.stats.skipped}
- Overall completion rate: ${completionRate}%
`);
    }
}

export default EmbeddingCreator;