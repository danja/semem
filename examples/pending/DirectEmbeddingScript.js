import fetch from 'node-fetch';
import logger from 'loglevel';
import OllamaConnector from '../src/connectors/OllamaConnector.js';

// Configure logging
logger.setLevel('info');

// SPARQL endpoint details
const SPARQL_QUERY_ENDPOINT = 'http://localhost:4030/semem/query';
const SPARQL_UPDATE_ENDPOINT = 'http://localhost:4030/semem/update';
const SPARQL_AUTH = {
    user: 'admin',
    password: 'admin123'
};
const GRAPH_NAME = 'http://danny.ayers.name/content';

// Ollama settings
const EMBEDDING_MODEL = 'nomic-embed-text';

// Initialize Ollama connector
const ollama = new OllamaConnector();

/**
 * Execute a SPARQL query
 */
async function executeSparqlQuery(query) {
    logger.info('Executing SPARQL query...');
    logger.debug(`Query: ${query}`);

    const auth = Buffer.from(`${SPARQL_AUTH.user}:${SPARQL_AUTH.password}`).toString('base64');

    try {
        const response = await fetch(SPARQL_QUERY_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/json'
            },
            body: query
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        logger.error('Error executing SPARQL query:', error);
        throw error;
    }
}

/**
 * Execute a SPARQL update
 */
async function executeSparqlUpdate(update) {
    logger.info('Executing SPARQL update...');
    logger.debug(`Update: ${update}`);

    const auth = Buffer.from(`${SPARQL_AUTH.user}:${SPARQL_AUTH.password}`).toString('base64');

    try {
        const response = await fetch(SPARQL_UPDATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/sparql-update'
            },
            body: update
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`);
        }

        return response;
    } catch (error) {
        logger.error('Error executing SPARQL update:', error);
        throw error;
    }
}

/**
 * Generate an embedding using Ollama
 */
async function generateEmbedding(text) {
    logger.info(`Generating embedding for text (${text.length} characters)...`);

    try {
        const embedding = await ollama.generateEmbedding(EMBEDDING_MODEL, text);
        logger.info(`Generated embedding with ${embedding.length} dimensions`);
        return embedding;
    } catch (error) {
        logger.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Store an embedding for an article in the SPARQL store
 */
async function storeEmbedding(articleUri, embedding) {
    logger.info(`Storing embedding for article: ${articleUri}`);

    // Prepare the embedding to be stored as a JSON string
    const embeddingStr = JSON.stringify(embedding);

    // SPARQL update query to add the embedding to the article
    const updateQuery = `
        PREFIX schema: <http://schema.org/>
        PREFIX emb: <http://example.org/embedding/>
        
        INSERT DATA {
            GRAPH <${GRAPH_NAME}> {
                <${articleUri}> emb:vector """${embeddingStr}""" .
            }
        }
    `;

    return await executeSparqlUpdate(updateQuery);
}

/**
 * Main function
 */
async function main() {
    try {
        // First test: Check if we can execute a simple query
        logger.info('Testing SPARQL query execution...');
        try {
            const testQuery = 'ASK { ?s ?p ?o }';
            const result = await executeSparqlQuery(testQuery);
            logger.info('SPARQL query executed successfully:', result);
        } catch (error) {
            logger.error('SPARQL query test failed. Aborting.');
            return;
        }

        // Check if the content graph exists
        logger.info(`Checking if graph <${GRAPH_NAME}> exists...`);
        try {
            const graphCheckQuery = `ASK { GRAPH <${GRAPH_NAME}> { ?s ?p ?o } }`;
            const graphExists = await executeSparqlQuery(graphCheckQuery);
            if (!graphExists.boolean) {
                logger.error(`Graph <${GRAPH_NAME}> does not exist or is empty. Aborting.`);
                return;
            }
            logger.info(`Graph <${GRAPH_NAME}> exists and contains data.`);
        } catch (error) {
            logger.error('Graph check failed. Aborting.');
            return;
        }

        // Execute the query to get articles - limit to 20 for demo purposes
        const query = `
            SELECT * WHERE {
                GRAPH <${GRAPH_NAME}> {
                    ?article <http://schema.org/articleBody> ?content
                }
            }
           # LIMIT 20
        `;

        const results = await executeSparqlQuery(query);
        const articles = results.results.bindings;

        logger.info(`Found ${articles.length} articles to process`);

        // Track progress and statistics
        const stats = {
            total: articles.length,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        // Check if articles already have embeddings
        logger.info('Checking for existing embeddings...');
        const checkQuery = `
            SELECT ?article WHERE {
                GRAPH <${GRAPH_NAME}> {
                    ?article <http://example.org/embedding/vector> ?embedding .
                }
            }
        `;

        const existingEmbeddings = await executeSparqlQuery(checkQuery);
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

            stats.processed++;

            if (articlesWithEmbeddings.has(articleUri)) {
                logger.info(`Skipping article ${i + 1}/${articles.length} (already has embedding): ${articleUri}`);
                stats.skipped++;
                continue;
            }

            logger.info(`Processing article ${i + 1}/${articles.length}: ${articleUri}`);

            // Validate content
            if (!content || content.trim().length < 10) {
                logger.warn(`Skipping article with insufficient content: ${articleUri}`);
                stats.skipped++;
                continue;
            }

            // Generate embedding for content
            try {
                const embedding = await generateEmbedding(content);

                // Store the embedding in the SPARQL store
                await storeEmbedding(articleUri, embedding);
                logger.info(`Successfully processed article: ${articleUri}`);
                stats.successful++;

                // Space out requests to avoid overloading the embedding service
                if (i < articles.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                logger.error(`Failed to process article ${articleUri}:`, error);
                stats.failed++;
                // Continue with next article despite the error
                continue;
            }

            // Log progress every 10 articles
            if (stats.processed % 10 === 0 || stats.processed === stats.total) {
                logger.info(`Progress: ${stats.processed}/${stats.total} articles (${Math.round(stats.processed / stats.total * 100)}%)`);
                logger.info(`Success: ${stats.successful}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
            }
        }

        logger.info('Completed embedding generation process');
        logger.info(`Final statistics:
- Total articles: ${stats.total}
- Successfully processed: ${stats.successful}
- Failed: ${stats.failed}
- Skipped (already had embeddings): ${stats.skipped}
- Overall completion rate: ${Math.round((stats.successful + stats.skipped) / stats.total * 100)}%
`);
    } catch (error) {
        logger.error('Error during execution:', error);
    }
}

// Run the script
main().catch(error => {
    logger.error('Fatal error:', error);
});