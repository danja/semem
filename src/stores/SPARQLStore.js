import BaseStore from './BaseStore.js'
import logger from 'loglevel'

export default class SPARQLStore extends BaseStore {
    constructor(endpoint, options = {}) {
        super()
        this.endpoint = {
            query: endpoint,
            update: options.updateEndpoint || endpoint
        }
        this.credentials = {
            user: options.user || 'admin',
            password: options.password || 'admin'
        }
        this.graphName = options.graphName || 'http://example.org/mcp/memory'
        this.inTransaction = false
        this.dimension = options.dimension || 1536
        
        logger.debug('SPARQLStore initialized with endpoints:', {
            query: this.endpoint.query,
            update: this.endpoint.update,
            graphName: this.graphName
        })
    }

    async _executeSparqlQuery(query, endpoint) {
        const auth = this.credentials.user && this.credentials.password ? 
            `Basic ${Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')}` : null;
            
        logger.debug(`Executing SPARQL query on ${endpoint}`);
        logger.debug(`Query: ${query}`);
        
        try {
            const headers = {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            };
            
            if (auth) {
                headers['Authorization'] = auth;
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: query,
                // Don't include credentials by default as it can cause CORS issues
                credentials: 'omit',
                // Add timeout for the request (30 seconds)
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`SPARQL query failed (${response.status}): ${errorText}`);
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            logger.debug('SPARQL query successful, results:', result.results.bindings.length);
            return result;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('SPARQL query timed out after 30 seconds');
                throw new Error('SPARQL query timed out');
            }
            logger.error('SPARQL query error:', error);
            throw error;
        }
    }

    async _executeSparqlUpdate(update, endpoint) {
        const auth = this.credentials.user && this.credentials.password ? 
            `Basic ${Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')}` : null;
            
        logger.debug(`Executing SPARQL update on ${endpoint}`);
        logger.debug(`Update: ${update}`);
        
        try {
            const headers = {
                'Content-Type': 'application/sparql-update',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            };
            
            if (auth) {
                headers['Authorization'] = auth;
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: update,
                // Don't include credentials by default as it can cause CORS issues
                credentials: 'omit',
                // Add timeout for the request (30 seconds)
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`SPARQL update failed (${response.status}): ${errorText}`);
                throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`);
            }

            return response
        } catch (error) {
            logger.error('SPARQL update error:', error)
            throw error
        }
    }

    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new TypeError('Embedding must be an array')
        }
        if (embedding.length !== this.dimension) {
            throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`)
        }
        if (!embedding.every(x => typeof x === 'number' && !isNaN(x))) {
            throw new TypeError('Embedding must contain only valid numbers')
        }
    }

    async verify() {
        this.graphName = await Promise.resolve(this.graphName); // TODO: Consider removing this hack
        
        try {
            logger.debug(`Verifying SPARQL store connection to graph: ${this.graphName}`);
            
            // First, try to create the graph if it doesn't exist
            try {
                const createQuery = `
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX dcterms: <http://purl.org/dc/terms/>
                    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                    
                    CREATE SILENT GRAPH <${this.graphName}>;
                    INSERT DATA { 
                        GRAPH <${this.graphName}> {
                            <${this.graphName}> a <http://example.org/mcp/MemoryStore> ;
                                          rdfs:label "Semem Memory Store"@en ;
                                          dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                        }
                    }`;
                
                logger.debug('Creating graph if not exists...');
                await this._executeSparqlUpdate(createQuery, this.endpoint.update);
                logger.debug('Graph creation/verification completed');
            } catch (error) {
                logger.debug('Graph creation/verification skipped:', error.message);
                // Continue to check if the graph exists even if creation failed
            }

            // Check if the graph exists and is accessible
            const checkQuery = `
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                
                SELECT (COUNT(*) as ?count) 
                WHERE {
                    GRAPH <${this.graphName}> { 
                        ?s ?p ?o 
                    }
                }`;
                
            logger.debug('Checking graph contents...');
            const result = await this._executeSparqlQuery(checkQuery, this.endpoint.query);
            const count = parseInt(result.results.bindings[0].count.value, 10);
            logger.debug(`Graph contains ${count} triples`);
            
            return count >= 0; // If we got here, the query succeeded
            
        } catch (error) {
            logger.error('Graph verification failed:', error);
            throw new Error(`Failed to verify SPARQL store: ${error.message}`);
        }
    }

    async loadHistory() {
        await this.verify()

        const query = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT ?id ?prompt ?output ?embedding ?timestamp ?accessCount ?concepts ?decayFactor ?memoryType
            FROM <${this.graphName}>
            WHERE {
                ?interaction a mcp:Interaction ;
                    mcp:id ?id ;
                    mcp:prompt ?prompt ;
                    mcp:output ?output ;
                    mcp:embedding ?embedding ;
                    mcp:timestamp ?timestamp ;
                    mcp:accessCount ?accessCount ;
                    mcp:decayFactor ?decayFactor ;
                    mcp:memoryType ?memoryType .
                OPTIONAL { ?interaction mcp:concepts ?concepts }
            }`

        try {
            const result = await this._executeSparqlQuery(query, this.endpoint.query)
            const shortTermMemory = []
            const longTermMemory = []

            for (const binding of result.results.bindings) {
                try {
                    let embedding = new Array(this.dimension).fill(0)
                    if (binding.embedding?.value && binding.embedding.value !== 'undefined') {
                        try {
                            embedding = JSON.parse(binding.embedding.value.trim())
                            this.validateEmbedding(embedding)
                        } catch (embeddingError) {
                            logger.error('Invalid embedding format:', embeddingError)
                        }
                    }

                    let concepts = []
                    if (binding.concepts?.value && binding.concepts.value !== 'undefined') {
                        try {
                            concepts = JSON.parse(binding.concepts.value.trim())
                            if (!Array.isArray(concepts)) {
                                throw new Error('Concepts must be an array')
                            }
                        } catch (conceptsError) {
                            logger.error('Invalid concepts format:', conceptsError)
                        }
                    }

                    const interaction = {
                        id: binding.id.value,
                        prompt: binding.prompt.value,
                        output: binding.output.value,
                        embedding,
                        timestamp: parseInt(binding.timestamp.value) || Date.now(),
                        accessCount: parseInt(binding.accessCount.value) || 1,
                        concepts,
                        decayFactor: parseFloat(binding.decayFactor.value) || 1.0
                    }

                    if (binding.memoryType.value === 'short-term') {
                        shortTermMemory.push(interaction)
                    } else {
                        longTermMemory.push(interaction)
                    }
                } catch (parseError) {
                    logger.error('Failed to parse interaction:', parseError, binding)
                }
            }

            logger.info(`Loaded ${shortTermMemory.length} short-term and ${longTermMemory.length} long-term memories from store ${this.endpoint.query} graph <${this.graphName}>`)
            return [shortTermMemory, longTermMemory]
        } catch (error) {
            logger.error('Error loading history:', error)
            return [[], []]
        }
    }

    async saveMemoryToHistory(memoryStore) {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress')
        }

        try {
            await this.verify()
            await this.beginTransaction()

            const clearQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                CLEAR GRAPH <${this.graphName}>
            `
            await this._executeSparqlUpdate(clearQuery, this.endpoint.update)

            const insertQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                INSERT DATA {
                    GRAPH <${this.graphName}> {
                        ${this._generateInsertStatements(memoryStore.shortTermMemory, 'short-term')}
                        ${this._generateInsertStatements(memoryStore.longTermMemory, 'long-term')}
                    }
                }
            `

            logger.debug(`SPARQLStoresave.MemoryToHistory query = \n${insertQuery}`)
            await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
            await this.commitTransaction()

            logger.info(`Saved memory to SPARQL store ${this.endpoint.update} graph <${this.graphName}>. Stats: ${memoryStore.shortTermMemory.length} short-term, ${memoryStore.longTermMemory.length} long-term memories`)
        } catch (error) {
            await this.rollbackTransaction()
            logger.error('Error saving to SPARQL store:', error)
            throw error
        }
    }

    _generateInsertStatements(memories, type) {
        return memories.map((interaction, index) => {
            // Ensure embedding is valid before saving
            let embeddingStr = '[]'
            if (Array.isArray(interaction.embedding)) {
                try {
                    this.validateEmbedding(interaction.embedding)
                    embeddingStr = JSON.stringify(interaction.embedding)
                } catch (error) {
                    logger.error('Invalid embedding in memory:', error)
                }
            }

            // Ensure concepts is valid before saving
            let conceptsStr = '[]'
            if (Array.isArray(interaction.concepts)) {
                conceptsStr = JSON.stringify(interaction.concepts)
            }

            return `
                _:interaction${type}${index} a mcp:Interaction ;
                    mcp:id "${interaction.id}" ;
                    mcp:prompt "${this._escapeSparqlString(interaction.prompt)}" ;
                    mcp:output "${this._escapeSparqlString(interaction.output)}" ;
                    mcp:embedding """${embeddingStr}""" ;
                    mcp:timestamp "${interaction.timestamp}"^^xsd:integer ;
                    mcp:accessCount "${interaction.accessCount}"^^xsd:integer ;
                    mcp:concepts """${conceptsStr}""" ;
                    mcp:decayFactor "${interaction.decayFactor}"^^xsd:decimal ;
                    mcp:memoryType "${type}" .
            `
        }).join('\n')
    }

    _escapeSparqlString(str) {
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n')
    }

    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress')
        }

        this.inTransaction = true

        const backupQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            COPY GRAPH <${this.graphName}> TO GRAPH <${this.graphName}.backup>
        `
        await this._executeSparqlUpdate(backupQuery, this.endpoint.update)
    }

    async commitTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress')
        }

        try {
            const dropBackup = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                DROP SILENT GRAPH <${this.graphName}.backup>
            `
            await this._executeSparqlUpdate(dropBackup, this.endpoint.update)
        } finally {
            this.inTransaction = false
        }
    }

    async rollbackTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress')
        }

        try {
            const restoreQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                DROP SILENT GRAPH <${this.graphName}> ;
                MOVE GRAPH <${this.graphName}.backup> TO GRAPH <${this.graphName}>
            `
            await this._executeSparqlUpdate(restoreQuery, this.endpoint.update)
        } finally {
            this.inTransaction = false
        }
    }

    async close() {
        if (this.inTransaction) {
            await this.rollbackTransaction()
        }
    }
}