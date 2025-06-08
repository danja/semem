import BaseStore from './BaseStore.js'
import logger from 'loglevel'

export default class SPARQLStore extends BaseStore {
    constructor(endpoint, options = {}) {
        super()
        // Robust endpoint handling: allow string or object
        if (typeof endpoint === 'string') {
            this.endpoint = {
                query: endpoint,
                update: endpoint
            }
        } else if (endpoint && typeof endpoint === 'object') {
            this.endpoint = {
                query: endpoint.query || endpoint.update,
                update: endpoint.update || endpoint.query
            }
        } else {
            throw new Error('SPARQLStore: endpoint must be a string or object with query/update URLs')
        }

        // Validate endpoints
        if (!this.endpoint.query || !this.endpoint.update) {
            throw new Error(`SPARQLStore: Both query and update endpoints must be defined. Got: ${JSON.stringify(this.endpoint)}`)
        }

        this.credentials = {
            user: options.user || 'admin',
            password: options.password || 'admin'
        }
        this.graphName = options.graphName || 'http://example.org/mcp/memory'
        this.inTransaction = false
        this.dimension = options.dimension || 1536
    }

    async _executeSparqlQuery(query, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')
        logger.log(`endpoint = ${endpoint}`)
        try {
            logger.error('[SPARQL QUERY]', { endpoint, query })
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: query,
                credentials: 'include'
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL QUERY FAIL]', { endpoint, query, status: response.status, errorText })
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`)
            }

            const json = await response.json()
            logger.error('[SPARQL QUERY SUCCESS]', { endpoint, query, json })
            return json
        } catch (error) {
            logger.error('SPARQL query error:', { endpoint, query, error })
            throw error
        }
    }

    async _executeSparqlUpdate(update, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')

        try {
            logger.error('[SPARQL UPDATE]', { endpoint, update })
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-update',
                    'Accept': 'application/json'
                },
                body: update,
                credentials: 'include'
            })

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL UPDATE FAIL]', { endpoint, update, status: response.status, errorText })
                throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`)
            }

            logger.error('[SPARQL UPDATE SUCCESS]', { endpoint, update })
            return response
        } catch (error) {
            logger.error('SPARQL update error:', { endpoint, update, error })
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
        this.graphName = await Promise.resolve(this.graphName)
        try {
            try {
                const createQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX semem: <http://purl.org/stuff/semem/>
                    
                    CREATE SILENT GRAPH <${this.graphName}>;
                    INSERT DATA { GRAPH <${this.graphName}> {
                        <${this.graphName}> a ragno:Corpus ;
                            rdfs:label "Semem Memory Store" ;
                            skos:prefLabel "Semem Memory Store"@en
                    }}
                `
                logger.error('[VERIFY] Creating graph', { endpoint: this.endpoint.update, createQuery })
                await this._executeSparqlUpdate(createQuery, this.endpoint.update)
            } catch (error) {
                logger.debug('Graph creation skipped:', error.message)
            }

            const checkQuery = `ASK { GRAPH <${this.graphName}> { ?s ?p ?o } }`
            logger.error('[VERIFY] Checking graph', { endpoint: this.endpoint.query, checkQuery })
            const result = await this._executeSparqlQuery(checkQuery, this.endpoint.query)
            return result.boolean
        } catch (error) {
            logger.error('Graph verification failed:', { endpoint: this.endpoint, error })
            throw error
        }
    }

    async loadHistory() {
        await this.verify()

        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT ?id ?prompt ?output ?embedding ?timestamp ?accessCount ?concepts ?decayFactor ?memoryType
            FROM <${this.graphName}>
            WHERE {
                ?interaction a semem:Interaction ;
                    semem:id ?id ;
                    semem:prompt ?prompt ;
                    semem:output ?output ;
                    semem:embedding ?embedding ;
                    semem:timestamp ?timestamp ;
                    semem:accessCount ?accessCount ;
                    semem:decayFactor ?decayFactor ;
                    semem:memoryType ?memoryType .
                OPTIONAL { ?interaction semem:concepts ?concepts }
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
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX semem: <http://purl.org/stuff/semem/>
                
                DELETE {
                    GRAPH <${this.graphName}> {
                        ?interaction ?p ?o
                    }
                } WHERE {
                    GRAPH <${this.graphName}> {
                        ?interaction a semem:Interaction ;
                            ?p ?o
                    }
                }
            `
            await this._executeSparqlUpdate(clearQuery, this.endpoint.update)

            const insertQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                INSERT DATA {
                    GRAPH <${this.graphName}> {
                        ${this._generateInsertStatements(memoryStore.shortTermMemory, 'short-term')}
                        ${this._generateInsertStatements(memoryStore.longTermMemory, 'long-term')}
                        ${this._generateConceptStatements(memoryStore.shortTermMemory)}
                        ${this._generateConceptStatements(memoryStore.longTermMemory)}
                    }
                }
            `

            logger.debug(`SPARQLStore saveMemoryToHistory query = \n${insertQuery}`)
            await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
            await this.commitTransaction()

            logger.info(`Saved memory to SPARQL store ${this.endpoint.update} graph <${this.graphName}>. Stats: ${memoryStore.shortTermMemory.length} short-term, ${memoryStore.longTermMemory.length} long-term memories`)
        } catch (error) {
            await this.rollbackTransaction()
            logger.error('Error saving to SPARQL store:', error)
            throw error
        }
    }

    /*
    _generateInsertStatements(memories, type) {
        return memories.map((interaction, index) => {
            let embeddingStr = '[]'
            if (Array.isArray(interaction.embedding)) {
                try {
                    this.validateEmbedding(interaction.embedding)
                    embeddingStr = JSON.stringify(interaction.embedding)
                } catch (error) {
                    logger.error('Invalid embedding in memory:', error)
                }
            }

            let conceptsStr = '[]'
            if (Array.isArray(interaction.concepts)) {
                conceptsStr = JSON.stringify(interaction.concepts)
            }

            return `
                _:interaction${type}${index} a semem:Interaction, ragno:Unit ;
                    semem:id "${interaction.id}" ;
                    semem:prompt "${this._escapeSparqlString(interaction.prompt)}" ;
                    semem:output "${this._escapeSparqlString(interaction.output)}" ;
                    ragno:content "${this._escapeSparqlString(interaction.prompt + ' ' + interaction.output)}" ;
                    semem:embedding """${embeddingStr}""" ;
                    semem:timestamp "${interaction.timestamp}"^^xsd:integer ;
                    semem:accessCount "${interaction.accessCount}"^^xsd:integer ;
                    semem:concepts """${conceptsStr}""" ;
                    semem:decayFactor "${interaction.decayFactor}"^^xsd:decimal ;
                    semem:memoryType "${type}" ;
                    skos:prefLabel "${this._escapeSparqlString(interaction.prompt.substring(0, 50))}" .
            `
        }).join('\n')
    }
*/
    // Replace the _generateInsertStatements method in SPARQLStore.js

    _generateInsertStatements(memories, type) {
        return memories.map((interaction, index) => {
            // Ensure all required fields have values
            const id = interaction.id || uuidv4()
            const prompt = interaction.prompt || ''
            const output = interaction.output || interaction.response || ''
            const timestamp = interaction.timestamp || Date.now()
            const accessCount = interaction.accessCount || 1
            const decayFactor = interaction.decayFactor || 1.0

            // Handle embeddings
            let embeddingStr = '[]'
            if (Array.isArray(interaction.embedding)) {
                try {
                    this.validateEmbedding(interaction.embedding)
                    embeddingStr = JSON.stringify(interaction.embedding)
                } catch (error) {
                    logger.error('Invalid embedding in memory:', error)
                }
            }

            // Handle concepts
            let conceptsStr = '[]'
            if (Array.isArray(interaction.concepts)) {
                conceptsStr = JSON.stringify(interaction.concepts)
            }

            return `
            _:interaction${type}${index} a semem:Interaction ;
                semem:id "${this._escapeSparqlString(id)}" ;
                semem:prompt "${this._escapeSparqlString(prompt)}" ;
                semem:output "${this._escapeSparqlString(output)}" ;
                semem:embedding """${embeddingStr}""" ;
                semem:timestamp "${timestamp}"^^xsd:integer ;
                semem:accessCount "${accessCount}"^^xsd:integer ;
                semem:concepts """${conceptsStr}""" ;
                semem:decayFactor "${decayFactor}"^^xsd:decimal ;
                semem:memoryType "${type}" .
        `
        }).join('\n')
    }
    /*
    _generateConceptStatements(memories) {
        const conceptStatements = []
        const seenConcepts = new Set()

        memories.forEach((interaction, index) => {
            if (Array.isArray(interaction.concepts)) {
                interaction.concepts.forEach(concept => {
                    const conceptUri = `http://example.org/concept/${encodeURIComponent(concept)}`

                    if (!seenConcepts.has(conceptUri)) {
                        conceptStatements.push(`
                            <${conceptUri}> a skos:Concept, ragno:Element ;
                                skos:prefLabel "${this._escapeSparqlString(concept)}" ;
                                ragno:content "${this._escapeSparqlString(concept)}" .
                        `)
                        seenConcepts.add(conceptUri)
                    }

                    conceptStatements.push(`
                        _:interaction${interaction.id || index} ragno:connectsTo <${conceptUri}> .
                        <${conceptUri}> ragno:connectsTo _:interaction${interaction.id || index} .
                    `)
                })
            }
        })

        return conceptStatements.join('\n')
    }
*/
    _generateConceptStatements(memories) {
        const conceptStatements = []
        const seenConcepts = new Set()

        memories.forEach((interaction, index) => {
            if (Array.isArray(interaction.concepts)) {
                interaction.concepts.forEach(concept => {
                    const conceptUri = `http://example.org/concept/${encodeURIComponent(concept)}`

                    if (!seenConcepts.has(conceptUri)) {
                        conceptStatements.push(`
                            <${conceptUri}> a skos:Concept, ragno:Element ;
                                skos:prefLabel "${this._escapeSparqlString(concept)}" ;
                                ragno:content "${this._escapeSparqlString(concept)}" .
                        `)
                        seenConcepts.add(conceptUri)
                    }

                    conceptStatements.push(`
                        _:interaction${interaction.id || index} ragno:connectsTo <${conceptUri}> .
                        <${conceptUri}> ragno:connectsTo _:interaction${interaction.id || index} .
                    `)
                })
            }
        })

        return conceptStatements.join('\n')
    }
    /*
    _escapeSparqlString(str) {
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n')
    }
*/
    _escapeSparqlString(str) {
        // Ensure str is a string
        if (typeof str !== 'string') {
            str = String(str);
        }
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n')
    }

    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress')
        }

        this.inTransaction = true

        const backupQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
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
                PREFIX semem: <http://purl.org/stuff/semem/>
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
                PREFIX semem: <http://purl.org/stuff/semem/>
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