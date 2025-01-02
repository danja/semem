import BaseStore from './BaseStore.js';
import { logger } from '../Utils.js';

export default class SPARQLStore extends BaseStore {
    constructor(endpoint, options = {}) {
        super();
        this.endpoint = endpoint;
        this.credentials = {
            user: options.user || 'admin',
            password: options.password || 'admin'
        };
        this.graphName = options.graphName || 'http://example.org/mcp/memory';
        this.inTransaction = false;
    }

    async _executeSparqlQuery(query, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: query,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            logger.error('SPARQL query error:', error);
            throw error;
        }
    }

    async _executeSparqlUpdate(update, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-update',
                    'Accept': 'application/json'
                },
                body: update,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`);
            }

            return response;
        } catch (error) {
            logger.error('SPARQL update error:', error);
            throw error;
        }
    }

    async verify() {
        try {
            // First try to create graph if it doesn't exist
            try {
                const createQuery = `
                    CREATE SILENT GRAPH <${this.graphName}>;
                    INSERT DATA { GRAPH <${this.graphName}> {
                        <${this.graphName}> a <http://example.org/mcp/MemoryStore>
                    }}
                `;
                await this._executeSparqlUpdate(createQuery, this.endpoint.update);
            } catch (error) {
                // Ignore errors, graph might already exist
                logger.debug('Graph creation skipped:', error.message);
            }

            // Verify graph exists
            const checkQuery = `ASK { GRAPH <${this.graphName}> { ?s ?p ?o } }`;
            const result = await this._executeSparqlQuery(checkQuery, this.endpoint.query);
            return result.boolean;
        } catch (error) {
            logger.error('Graph verification failed:', error);
            throw error;
        }
    }

    async loadHistory() {
        await this.verify();

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
            }`;

        try {
            const result = await this._executeSparqlQuery(query, this.endpoint.query);
            const shortTermMemory = [];
            const longTermMemory = [];

            result.results.bindings.forEach(binding => {
                try {
                    const interaction = {
                        id: binding.id.value,
                        prompt: binding.prompt.value,
                        output: binding.output.value,
                        embedding: binding.embedding ? JSON.parse(binding.embedding.value.trim()) : new Array(1536).fill(0),
                        timestamp: parseInt(binding.timestamp.value) || Date.now(),
                        accessCount: parseInt(binding.accessCount.value) || 1,
                        concepts: binding.concepts ? JSON.parse(binding.concepts.value.trim()) : [],
                        decayFactor: parseFloat(binding.decayFactor.value) || 1.0
                    };

                    if (binding.memoryType.value === 'short-term') {
                        shortTermMemory.push(interaction);
                    } else {
                        longTermMemory.push(interaction);
                    }
                } catch (parseError) {
                    logger.error('Failed to parse interaction:', parseError, binding);
                }
            });

            logger.info(`Loaded ${shortTermMemory.length} short-term and ${longTermMemory.length} long-term memories from store ${this.endpoint.query} graph <${this.graphName}>`);
            return [shortTermMemory, longTermMemory];
        } catch (error) {
            logger.error('Error loading history from SPARQL store:', error);
            throw error;
        }
    }

    async saveMemoryToHistory(memoryStore) {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress');
        }

        try {
            await this.verify();
            await this.beginTransaction();

            // Clear existing data
            const clearQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                CLEAR GRAPH <${this.graphName}>
            `;
            await this._executeSparqlUpdate(clearQuery, this.endpoint.update);

            // Insert new data
            const insertQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                INSERT DATA {
                    GRAPH <${this.graphName}> {
                        ${this._generateInsertStatements(memoryStore.shortTermMemory, 'short-term')}
                        ${this._generateInsertStatements(memoryStore.longTermMemory, 'long-term')}
                    }
                }
            `;

            await this._executeSparqlUpdate(insertQuery, this.endpoint.update);
            await this.commitTransaction();

            logger.info(`Saved memory to SPARQL store ${this.endpoint.update} graph <${this.graphName}>. Stats: ${memoryStore.shortTermMemory.length} short-term, ${memoryStore.longTermMemory.length} long-term memories`);
        } catch (error) {
            await this.rollbackTransaction();
            logger.error('Error saving to SPARQL store:', error);
            throw error;
        }
    }

    _generateInsertStatements(memories, type) {
        return memories.map((interaction, index) => `
            _:interaction${type}${index} a mcp:Interaction ;
                mcp:id "${interaction.id}" ;
                mcp:prompt "${this._escapeSparqlString(interaction.prompt)}" ;
                mcp:output "${this._escapeSparqlString(interaction.output)}" ;
                mcp:embedding """${JSON.stringify(interaction.embedding)}""" ;
                mcp:timestamp "${interaction.timestamp}"^^xsd:integer ;
                mcp:accessCount "${interaction.accessCount}"^^xsd:integer ;
                mcp:concepts """${JSON.stringify(interaction.concepts)}""" ;
                mcp:decayFactor "${interaction.decayFactor}"^^xsd:decimal ;
                mcp:memoryType "${type}" .
        `).join('\n');
    }

    _escapeSparqlString(str) {
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n');
    }

    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress');
        }

        this.inTransaction = true;

        // Create backup
        const backupQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            COPY GRAPH <${this.graphName}> TO GRAPH <${this.graphName}.backup>
        `;
        await this._executeSparqlUpdate(backupQuery, this.endpoint.update);
    }

    async commitTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        try {
            // Remove backup
            const dropBackup = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                DROP SILENT GRAPH <${this.graphName}.backup>
            `;
            await this._executeSparqlUpdate(dropBackup, this.endpoint.update);
        } finally {
            this.inTransaction = false;
        }
    }

    async rollbackTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        try {
            // Restore from backup
            const restoreQuery = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                DROP SILENT GRAPH <${this.graphName}> ;
                MOVE GRAPH <${this.graphName}.backup> TO GRAPH <${this.graphName}>
            `;
            await this._executeSparqlUpdate(restoreQuery, this.endpoint.update);
        } finally {
            this.inTransaction = false;
        }
    }

    async close() {
        if (this.inTransaction) {
            await this.rollbackTransaction();
        }
    }
}