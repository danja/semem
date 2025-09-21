/**
 * EmbeddingMigration - One-time utility to clean up invalid embedding dimensions
 *
 * This utility removes entries with incorrect embedding dimensions (e.g., 1536D when expecting 768D)
 * to ensure proper FAISS index synchronization with shortTermMemory arrays.
 *
 * Usage:
 *   node -e "import('./src/utils/EmbeddingMigration.js').then(m => m.runMigration())"
 *
 * Or from code:
 *   const migration = new EmbeddingMigration(sparqlStore);
 *   await migration.runMigration();
 */

import logger from './logger.js';

export class EmbeddingMigration {
    constructor(endpoint, credentials, expectedDimension) {
        this.endpoint = endpoint;
        this.credentials = credentials;
        this.expectedDimension = expectedDimension;
        this.graphName = 'http://hyperdata.it/content'; // HARDCODED URI - WRONG
        this.stats = {
            totalItems: 0,
            validItems: 0,
            removedItems: 0,
            expectedDimension: expectedDimension,
            dimensionCounts: {}
        };
    }

    /**
     * Run the embedding dimension migration
     * @param {Object} options - Migration options
     * @param {boolean} options.dryRun - Only analyze, don't modify data
     * @param {boolean} options.persistResults - Save cleaned data back to SPARQL
     * @returns {Promise<Object>} Migration statistics
     */
    async runMigration(options = {}) {
        const { dryRun = false, persistResults = true } = options;

        console.log('🚀 Starting embedding dimension migration...');
        console.log(`Expected dimension: ${this.stats.expectedDimension}`);
        console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);

        try {
            // Load current memory state directly from SPARQL
            await this.loadEmbeddingData();

            // Analyze current state
            await this.analyzeEmbeddings();

            if (this.stats.removedItems === 0) {
                console.log('✅ No invalid embeddings found - migration not needed');
                return this.stats;
            }

            this.logAnalysis();

            if (dryRun) {
                console.log('🔍 Dry run completed - no changes made');
                return this.stats;
            }

            // Perform cleanup
            await this.cleanupEmbeddings();

            // Data is already cleaned in SPARQL - no additional persistence needed
            if (persistResults) {
                console.log('✅ Data already cleaned in SPARQL');
            }

            console.log('✅ Embedding migration completed successfully');
            return this.stats;

        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute SPARQL query directly
     */
    async executeSparqlQuery(query) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64');

        const response = await fetch(this.endpoint.query, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/json'
            },
            body: query
        });

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Execute SPARQL update directly
     */
    async executeSparqlUpdate(update) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64');

        const response = await fetch(this.endpoint.update, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/sparql-update'
            },
            body: update
        });

        if (!response.ok) {
            throw new Error(`SPARQL update failed: ${response.status} ${response.statusText}`);
        }
    }

    /**
     * Load embedding data directly from SPARQL
     */
    async loadEmbeddingData() {
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

            SELECT ?interaction ?prompt ?embedding WHERE {
                GRAPH <${this.graphName}> {
                    ?interaction semem:embedding ?embedding .
                    OPTIONAL { ?interaction skos:prefLabel ?prompt }
                    OPTIONAL { ?interaction ragno:content ?prompt }
                }
            }
        `;

        console.log('📊 Loading embedding data from SPARQL...');
        const result = await this.executeSparqlQuery(query);

        this.rawData = [];
        for (const binding of result.results.bindings) {
            try {
                let embedding = [];
                if (binding.embedding?.value && binding.embedding.value !== 'undefined') {
                    embedding = JSON.parse(binding.embedding.value.trim());
                }

                this.rawData.push({
                    id: binding.id?.value || 'unknown',
                    prompt: binding.prompt?.value || '',
                    embedding: embedding,
                    bindingUri: binding.interaction?.value
                });
            } catch (parseError) {
                console.log(`⚠️ Failed to parse embedding for item: ${parseError.message}`);
            }
        }

        console.log(`📊 Loaded ${this.rawData.length} items from SPARQL`);
    }

    /**
     * Analyze current embedding dimensions
     */
    async analyzeEmbeddings() {
        this.stats.totalItems = this.rawData.length;
        this.stats.dimensionCounts = {};
        let validCount = 0;

        for (const item of this.rawData) {
            const embedding = item.embedding;

            if (!Array.isArray(embedding)) {
                this.stats.dimensionCounts['invalid'] = (this.stats.dimensionCounts['invalid'] || 0) + 1;
                continue;
            }

            const dim = embedding.length;
            this.stats.dimensionCounts[dim] = (this.stats.dimensionCounts[dim] || 0) + 1;

            if (dim === this.stats.expectedDimension) {
                validCount++;
            }
        }

        this.stats.validItems = validCount;
        this.stats.removedItems = this.stats.totalItems - validCount;
    }

    /**
     * Log analysis results
     */
    logAnalysis() {
        console.log('\n📊 Analysis Results:');
        console.log(`Total items: ${this.stats.totalItems}`);
        console.log(`Valid items (${this.stats.expectedDimension}D): ${this.stats.validItems}`);
        console.log(`Items to remove: ${this.stats.removedItems}`);

        console.log('\n📈 Dimension distribution:');
        Object.entries(this.stats.dimensionCounts).forEach(([dim, count]) => {
            const percentage = ((count / this.stats.totalItems) * 100).toFixed(1);
            const marker = dim == this.stats.expectedDimension ? '✅' : '❌';
            console.log(`  ${marker} ${dim}D: ${count} items (${percentage}%)`);
        });
    }

    /**
     * Clean up invalid embeddings by deleting them from SPARQL
     */
    async cleanupEmbeddings() {
        console.log('\n🧹 Cleaning up invalid embeddings...');

        const invalidItems = this.rawData.filter(item => {
            const embedding = item.embedding;
            return !Array.isArray(embedding) || embedding.length !== this.stats.expectedDimension;
        });

        if (invalidItems.length === 0) {
            console.log('✅ No invalid embeddings to clean up');
            return;
        }

        console.log(`🗑️ Deleting ${invalidItems.length} items with invalid embeddings...`);

        // Build SPARQL DELETE query for invalid items
        const deleteQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            DELETE {
                GRAPH <${this.graphName}> {
                    ?interaction ?p ?o .
                }
            }
            WHERE {
                GRAPH <${this.graphName}> {
                    VALUES ?interaction {
                        ${invalidItems.map(item => `<${item.bindingUri || item.id}>`).join('\n                        ')}
                    }
                    ?interaction ?p ?o .
                }
            }
        `;

        await this.executeSparqlUpdate(deleteQuery);

        console.log(`✅ Deleted ${invalidItems.length} invalid embedding entries from SPARQL`);
        console.log(`✅ Remaining valid items: ${this.stats.validItems}`);
    }

    /**
     * Persist cleaned data back to SPARQL store
     */
    async persistCleanedData() {
        console.log('\n💾 Persisting cleaned data to SPARQL store...');

        try {
            // Create mock memory store for compatibility
            const mockMemoryStore = {
                shortTermMemory: this.sparqlStore.shortTermMemory,
                longTermMemory: this.sparqlStore.longTermMemory
            };

            // Clear existing data first
            await this.clearExistingData();

            // Save cleaned data
            await this.sparqlStore.saveMemoryToHistory(mockMemoryStore);

            console.log('✅ Cleaned data persisted successfully');

        } catch (error) {
            console.error('❌ Failed to persist cleaned data:', error.message);
            throw error;
        }
    }

    /**
     * Clear existing memory data from SPARQL store
     */
    async clearExistingData() {
        const clearQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            DELETE {
                GRAPH <${this.sparqlStore.graphName}> {
                    ?interaction ?p ?o .
                }
            }
            WHERE {
                GRAPH <${this.sparqlStore.graphName}> {
                    ?interaction a ragno:Element ;
                                 ?p ?o .
                }
            }
        `;

        await this.sparqlStore._executeSparqlUpdate(clearQuery, this.sparqlStore.endpoint.update);
        console.log('🗑️ Cleared existing memory data from SPARQL store');
    }
}

/**
 * Standalone migration runner
 * Usage: node -e "import('./src/utils/EmbeddingMigration.js').then(m => m.runMigration())"
 */
export async function runMigration(options = {}) {
    console.log('🔧 Initializing migration configuration...');

    // Import dependencies
    const Config = (await import('../Config.js')).default;

    // Initialize config
    const config = new Config('./config/config.json');
    await config.init();

    const storageConfig = config.get('storage.options');
    const expectedDimension = config.get('llmProviders')?.find(p => p.capabilities?.includes('embedding'))?.embeddingDimension || 768;

    // Create migration instance
    const migration = new EmbeddingMigration(
        {
            query: storageConfig.query,
            update: storageConfig.update
        },
        {
            user: storageConfig.user,
            password: storageConfig.password
        },
        expectedDimension
    );

    // Run migration
    const stats = await migration.runMigration(options);

    console.log('\n📋 Final Statistics:');
    console.log(JSON.stringify(stats, null, 2));

    return stats;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const options = {
        dryRun: process.argv.includes('--dry-run'),
        persistResults: !process.argv.includes('--no-persist')
    };

    runMigration(options)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}