import BaseStore from './BaseStore.js'
import logger from 'loglevel'
import { SPARQLQueryService } from '../services/sparql/SPARQLQueryService.js'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SPARQL_CONFIG } from '../../config/preferences.js'
import { WorkflowLogger, workflowLoggerRegistry } from '../utils/WorkflowLogger.js'
import SPARQLTemplateLoader from './SPARQLTemplateLoader.js'

// Enhanced SPARQL Store imports for in-memory capabilities
import faiss from 'faiss-node'
import { kmeans } from 'ml-kmeans'
import graphology from 'graphology'
import { vectorOps } from '../Utils.js'
const { Graph } = graphology

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load ZPT Query Templates from files
function loadZPTQueryTemplates() {
    const templatesDir = join(__dirname, '../../sparql/templates/zpt')
    const templateNames = ['micro', 'entity', 'relationship', 'community', 'corpus']
    const templates = {}
    
    for (const name of templateNames) {
        try {
            const templatePath = join(templatesDir, `${name}.sparql`)
            templates[name] = readFileSync(templatePath, 'utf8')
        } catch (error) {
            logger.error(`Failed to load ZPT template ${name}:`, error)
            throw new Error(`Could not load ZPT template: ${name}`)
        }
    }
    
    return templates
}

// ZPT Query Templates for different zoom levels and data types (loaded from files)
const ZPT_QUERY_TEMPLATES = loadZPTQueryTemplates()

export default class SPARQLStore extends BaseStore {
    constructor(endpoint, options = {}, config = null) {
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
        this.graphName = options.graphName || 'http://tensegrity.it/semem/content'
        this.inTransaction = false
        this.dimension = options.dimension || 768  // Default for nomic-embed-text (should be set via config)
        this.queryService = new SPARQLQueryService()

        // PREVENTION: Configuration limits to prevent triple explosion
        this.maxConceptsPerInteraction = options.maxConceptsPerInteraction || 10
        this.maxConnectionsPerEntity = options.maxConnectionsPerEntity || 100
        this.config = config
        this.baseUri = config?.get?.('baseUri') || config?.baseUri || 'http://tensegrity.it/semem/'

        // Simple resilience configuration (opt-in)
        this.resilience = {
            enabled: options.enableResilience === true, // Default disabled for backward compatibility
            maxRetries: options.maxRetries || 3,
            timeoutMs: options.timeoutMs || 30000,
            retryDelayMs: options.retryDelayMs || 1000,
            enableFallbacks: options.enableFallbacks !== false,
            ...options.resilience
        }

        // Workflow logging for SPARQL operations
        this.workflowLogger = new WorkflowLogger('SPARQLStore')
        workflowLoggerRegistry.register('SPARQLStore', this.workflowLogger)

        // Initialize SPARQL template loader
        this.templateLoader = new SPARQLTemplateLoader()

        // ============================================================================
        // IN-MEMORY CAPABILITIES - Integrated from MemoryStore
        // ============================================================================

        // Initialize FAISS index for fast similarity search
        this.initializeIndex()

        // In-memory structures for performance
        this.shortTermMemory = []
        this.longTermMemory = []
        this.embeddings = []
        this.timestamps = []
        this.accessCounts = []
        this.conceptsList = []

        // Concept graph for spreading activation
        this.graph = new Graph({ multi: true, allowSelfLoops: false })
        this.semanticMemory = new Map()
        this.clusterLabels = []

        // Memory classification configuration
        this.promotionThreshold = config?.get?.('memory.promotionThreshold') || 5.0
        this.classificationChance = config?.get?.('memory.classificationChance') || 0.1

        // Cache for loaded data to avoid frequent SPARQL queries
        this._memoryCache = {
            lastLoaded: 0,
            cacheTimeoutMs: options.cacheTimeoutMs || 300000, // 5 minutes
            loaded: false
        }
    }

    async _executeSparqlQuery(query, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')

        try {
            logger.debug('[SPARQL QUERY]', endpoint)

            // Ensure fetch is available
            if (typeof fetch === 'undefined') {
                throw new Error('fetch is not available in this environment')
            }

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

            if (!response) {
                throw new Error('fetch returned null/undefined response')
            }

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL QUERY FAIL]', { endpoint, query, status: response.status, errorText })
                throw new Error(`SPARQL query failed: ${response.status} - ${errorText}`)
            }

            const json = await response.json()
            logger.debug('[SPARQL QUERY SUCCESS]', endpoint)
            return json
        } catch (error) {
            logger.error('SPARQL query error:', { endpoint, query, error: error.message })
            throw error
        }
    }

    async _executeSparqlUpdate(update, endpoint) {
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')

        try {
            logger.debug('[SPARQL UPDATE]', endpoint)

            // Ensure fetch is available
            if (typeof fetch === 'undefined') {
                throw new Error('fetch is not available in this environment')
            }

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

            if (!response) {
                throw new Error('fetch returned null/undefined response')
            }

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL UPDATE FAIL]', { endpoint, update, status: response.status, errorText })
                throw new Error(`SPARQL update failed: ${response.status} - ${errorText}`)
            }

            logger.debug('[SPARQL UPDATE SUCCESS]', endpoint)
            return response
        } catch (error) {
            logger.error('SPARQL update error:', { endpoint, update, error: error.message })
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
        console.log('[DEBUG] verify() called')
        this.graphName = await Promise.resolve(this.graphName)
        try {
            try {
                let createQuery = await this.templateLoader.loadAndInterpolate('store', 'init-graph', {
                    graphName: this.graphName
                })

                if (!createQuery) {
                    // Fallback to inline query if template not found
                    createQuery = `
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
                }
                logger.error('[VERIFY] Creating graph', this.endpoint.update, { endpoint: this.endpoint.update, graph: this.graphName }) //  { endpoint: this.endpoint.update, createQuery }
                await this._executeSparqlUpdate(createQuery, this.endpoint.update)
            } catch (error) {
                logger.debug('Graph creation skipped:', error.message)
            }

            const checkQuery = `ASK { GRAPH <${this.graphName}> { ?s ?p ?o } }`
            logger.error('[VERIFY] ASKing graph', this.endpoint.query, { endpoint: this.endpoint.query, graph: this.graphName }) // { endpoint: this.endpoint.query, checkQuery }
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
            PREFIX dcterms: <http://purl.org/dc/terms/>

            SELECT ?id ?prompt ?output ?embedding ?timestamp ?accessCount ?concepts ?decayFactor ?memoryType
            FROM <${this.graphName}>
            WHERE {
                {
                    # New format: semem:Interaction objects
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
                }
                UNION
                {
                    # Old format: ragno:Element objects with legacy embedding property
                    ?interaction a ragno:Element ;
                        ragno:embedding ?embedding .
                    OPTIONAL { ?interaction skos:prefLabel ?prompt }
                    OPTIONAL { ?interaction ragno:content ?content }
                    OPTIONAL { ?interaction dcterms:created ?timestamp }
                    BIND(CONCAT("element-", SUBSTR(STR(?interaction), 1+STRLEN(STR(?interaction))-8)) AS ?id)
                    BIND(0 AS ?accessCount)
                    BIND("[]" AS ?concepts)
                    BIND(1.0 AS ?decayFactor)
                    BIND("short-term" AS ?memoryType)
                    # Use prompt as output when ragno:content is null (for simple definitions)
                    BIND(IF(BOUND(?content), ?content, ?prompt) AS ?output)
                }
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

        // Start workflow tracking for SPARQL persistence
        const operationId = this.workflowLogger.startOperation(
            null,
            'storage',
            'Persisting memories to SPARQL knowledge graph',
            {
                shortTermMemories: memoryStore.shortTermMemory.length,
                longTermMemories: memoryStore.longTermMemory.length,
                totalMemories: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length,
                graphName: this.graphName,
                endpoint: this.endpoint.update
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);

        try {
            // Step 1: Verify connection
            opLogger.step(
                'verify_connection',
                '🔌 Verifying SPARQL endpoint connection',
                `[SPARQLStore] verify() - checking connectivity to ${this.endpoint.update}`,
                { endpoint: this.endpoint.update }
            );
            await this.verify()

            // Step 2: Begin transaction
            opLogger.step(
                'begin_transaction',
                '🚀 Starting database transaction',
                '[SPARQLStore] beginTransaction() - ensuring atomic operation',
                { transactionId: this.transactionId }
            );
            await this.beginTransaction()

            // Step 3: Clear existing interactions
            opLogger.step(
                'clear_existing',
                '🧹 Clearing existing interactions from graph',
                `[SPARQLStore] DELETE operation on graph <${this.graphName}>`,
                { graphName: this.graphName }
            );

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

            // Step 4: Generate RDF triples
            opLogger.step(
                'generate_rdf',
                '🏗️ Generating RDF triples for memories',
                `[SPARQLStore] _generateInsertStatements() - creating triples for ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} interactions`,
                { 
                    shortTermTriples: memoryStore.shortTermMemory.length,
                    longTermTriples: memoryStore.longTermMemory.length
                }
            );

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

            // Step 5: Execute INSERT operation
            opLogger.step(
                'execute_insert',
                '📤 Executing SPARQL INSERT operation',
                `[SPARQLStore] _executeSparqlUpdate() - inserting ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} interactions with embeddings`,
                { 
                    queryLength: insertQuery.length,
                    totalInteractions: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length
                }
            );

            logger.debug(`SPARQLStore saveMemoryToHistory query = \n${insertQuery}`)
            await this._executeSparqlUpdate(insertQuery, this.endpoint.update)

            // Step 6: Commit transaction
            opLogger.step(
                'commit_transaction',
                '✅ Committing transaction to knowledge graph',
                '[SPARQLStore] commitTransaction() - finalizing atomic operation',
                { graphName: this.graphName }
            );
            await this.commitTransaction()

            // Complete operation successfully
            opLogger.complete(
                `Successfully persisted ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} memories to SPARQL store`,
                {
                    shortTermMemories: memoryStore.shortTermMemory.length,
                    longTermMemories: memoryStore.longTermMemory.length,
                    totalMemories: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length,
                    graphName: this.graphName,
                    endpoint: this.endpoint.update
                }
            );

            logger.info(`Saved memory to SPARQL store ${this.endpoint.update} graph <${this.graphName}>. Stats: ${memoryStore.shortTermMemory.length} short-term, ${memoryStore.longTermMemory.length} long-term memories`)
        } catch (error) {
            // Step 7: Handle errors and rollback
            opLogger.step(
                'rollback_transaction',
                '🔄 Rolling back transaction due to error',
                `[SPARQLStore] rollbackTransaction() - error: ${error.message}`,
                { error: error.message }
            );
            await this.rollbackTransaction()
            
            // Handle string length errors specifically
            if (error instanceof RangeError && error.message.includes('string length')) {
                const detailedError = new Error(`String length error in SPARQL store: ${error.message}. This usually indicates content is too large for processing. Consider chunking the content first.`);
                detailedError.code = 'CONTENT_TOO_LARGE';
                
                opLogger.fail(detailedError, {
                    errorType: 'CONTENT_TOO_LARGE',
                    shortTermCount: memoryStore.shortTermMemory.length,
                    longTermCount: memoryStore.longTermMemory.length,
                    suggestion: 'Consider chunking large content before storing'
                });

                logger.error('String length error in SPARQL store - content too large:', {
                    originalError: error.message,
                    shortTermCount: memoryStore.shortTermMemory.length,
                    longTermCount: memoryStore.longTermMemory.length,
                    suggestion: 'Consider chunking large content before storing'
                });
                throw detailedError;
            }
            
            // Handle general errors
            opLogger.fail(error, {
                shortTermMemories: memoryStore.shortTermMemory.length,
                longTermMemories: memoryStore.longTermMemory.length,
                endpoint: this.endpoint.update,
                graphName: this.graphName
            });

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
            let prompt = interaction.prompt || ''
            let output = interaction.output || interaction.response || ''
            const timestamp = interaction.timestamp || Date.now()
            const accessCount = interaction.accessCount || 1
            const decayFactor = interaction.decayFactor || 1.0

            // Add length validation to prevent string length errors
            const MAX_CONTENT_LENGTH = 50000; // Conservative limit to prevent RangeError
            const MAX_EMBEDDING_LENGTH = 500000; // Higher limit for embedding vectors (1536 * ~20 chars per float)
            
            if (prompt.length > MAX_CONTENT_LENGTH) {
                logger.warn(`Truncating prompt from ${prompt.length} to ${MAX_CONTENT_LENGTH} characters to prevent string length error`);
                prompt = prompt.substring(0, MAX_CONTENT_LENGTH) + '... [TRUNCATED]';
            }
            
            if (output.length > MAX_CONTENT_LENGTH) {
                logger.warn(`Truncating output from ${output.length} to ${MAX_CONTENT_LENGTH} characters to prevent string length error`);
                output = output.substring(0, MAX_CONTENT_LENGTH) + '... [TRUNCATED]';
            }

            // Handle embeddings
            let embeddingStr = '[]'
            if (Array.isArray(interaction.embedding)) {
                try {
                    this.validateEmbedding(interaction.embedding)
                    const jsonStr = JSON.stringify(interaction.embedding);
                    if (jsonStr.length > MAX_EMBEDDING_LENGTH) {
                        logger.warn(`Embedding JSON too large (${jsonStr.length} chars), truncating to preserve vector integrity`);
                        // Instead of empty array, try to preserve the embedding by compressing precision
                        const compressedEmbedding = interaction.embedding.map(x => Math.round(x * 10000) / 10000);
                        const compressedStr = JSON.stringify(compressedEmbedding);
                        embeddingStr = compressedStr.length > MAX_EMBEDDING_LENGTH ? '[]' : compressedStr;
                    } else {
                        embeddingStr = jsonStr;
                    }
                } catch (error) {
                    logger.error('Invalid embedding in memory:', error)
                }
            }

            // Handle concepts
            let conceptsStr = '[]'
            if (Array.isArray(interaction.concepts)) {
                try {
                    const jsonStr = JSON.stringify(interaction.concepts);
                    if (jsonStr.length > MAX_CONTENT_LENGTH) {
                        logger.warn(`Concepts JSON too large (${jsonStr.length} chars), using empty array`);
                        conceptsStr = '[]';
                    } else {
                        conceptsStr = jsonStr;
                    }
                } catch (error) {
                    logger.error('Error stringifying concepts:', error);
                    conceptsStr = '[]';
                }
            }

            // Use proper interaction URI instead of blank node to prevent phantom node creation
            const interactionUri = `${this.baseUri}interaction/${id}`
            
            return `
            <${interactionUri}> a semem:Interaction ;
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
                    const conceptUri = `${this.baseUri}concept/${encodeURIComponent(concept)}`

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
                // Use proper interaction URI instead of blank node to prevent phantom node creation
                const interactionUri = `${this.baseUri}interaction/${interaction.id || index}`
                
                // CONSTRAINT: Limit concepts per interaction to prevent connection explosion
                const limitedConcepts = interaction.concepts.slice(0, this.maxConceptsPerInteraction);
                
                limitedConcepts.forEach(concept => {
                    const conceptUri = `${this.baseUri}concept/${encodeURIComponent(concept)}`

                    if (!seenConcepts.has(conceptUri)) {
                        conceptStatements.push(`
                            <${conceptUri}> a skos:Concept, ragno:Element ;
                                skos:prefLabel "${this._escapeSparqlString(concept)}" ;
                                ragno:content "${this._escapeSparqlString(concept)}" .
                        `)
                        seenConcepts.add(conceptUri)
                    }

                    // FIX: Use proper URIs instead of blank nodes to prevent phantom node explosion
                    // Only create bidirectional connections if both entities are legitimate
                    conceptStatements.push(`
                        <${interactionUri}> ragno:connectsTo <${conceptUri}> .
                        <${conceptUri}> ragno:connectsTo <${interactionUri}> .
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
        
        // Prevent string length errors by truncating extremely long strings
        const MAX_SPARQL_STRING_LENGTH = 100000; // Conservative limit for SPARQL strings
        if (str.length > MAX_SPARQL_STRING_LENGTH) {
            logger.warn(`Truncating string from ${str.length} to ${MAX_SPARQL_STRING_LENGTH} characters in SPARQL escape`);
            str = str.substring(0, MAX_SPARQL_STRING_LENGTH) + '... [TRUNCATED]';
        }
        
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    }

    /**
     * Escape text for use in SPARQL triple-quoted literals
     * Triple-quoted literals can contain newlines and quotes but need backslashes escaped
     */
    _escapeTripleQuotedString(str) {
        // Ensure str is a string
        if (typeof str !== 'string') {
            str = String(str);
        }
        
        // Prevent string length errors by truncating extremely long strings
        const MAX_SPARQL_STRING_LENGTH = 100000; // Conservative limit for SPARQL strings
        if (str.length > MAX_SPARQL_STRING_LENGTH) {
            logger.warn(`Truncating string from ${str.length} to ${MAX_SPARQL_STRING_LENGTH} characters in triple-quoted SPARQL escape`);
            str = str.substring(0, MAX_SPARQL_STRING_LENGTH) + '... [TRUNCATED]';
        }
        
        // For SPARQL triple-quoted strings, we need to:
        // 1. Escape backslashes 
        // 2. Escape triple quotes
        // 3. Handle control characters that can break SPARQL parsing
        
        return str
            .replace(/\\/g, '\\\\')           // Escape backslashes first
            .replace(/"""/g, '\\"\\"\\"')     // Escape triple quotes 
            .replace(/\r\n/g, '\\n')          // Convert CRLF to escaped newlines
            .replace(/\r/g, '\\n')            // Convert CR to escaped newlines  
            .replace(/\n/g, '\\n')            // Convert LF to escaped newlines
            .replace(/\t/g, '\\t')            // Escape tabs
            .replace(/\f/g, '\\f')            // Escape form feeds
            .replace(/\v/g, '\\v')            // Escape vertical tabs
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove other control chars
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

    // ============================================================================
    // ZPT INTEGRATION METHODS - Ragno Vocabulary Support
    // ============================================================================

    /**
     * Store a ragno:Entity with full metadata and relationships
     * @param {Object} entity - Entity data with id, label, type, embedding, etc.
     * @returns {Promise<void>}
     */
    async storeEntity(entity) {
        if (!entity || !entity.id) {
            throw new Error('Entity must have an id field')
        }

        const entityUri = `<${entity.id}>`
        const embeddingStr = Array.isArray(entity.embedding) ? JSON.stringify(entity.embedding) : '[]'

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${entityUri} a ragno:Entity ;
                        rdfs:label "${this._escapeSparqlString(entity.label || entity.name || '')}" ;
                        rdf:type ragno:${entity.subType || 'Entity'} ;
                        skos:prefLabel "${this._escapeSparqlString(entity.prefLabel || entity.label || '')}" ;
                        semem:embedding """${embeddingStr}""" ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        ragno:frequency "${entity.frequency || 1}"^^xsd:integer ;
                        ragno:centrality "${entity.centrality || 0.0}"^^xsd:decimal ;
                        ragno:isEntryPoint "${entity.isEntryPoint || false}"^^xsd:boolean .
                    ${entity.description ? `${entityUri} rdfs:comment "${this._escapeSparqlString(entity.description)}" .` : ''}
                    ${entity.metadata ? Object.entries(entity.metadata).map(([key, value]) =>
                        `${entityUri} ragno:${key} "${this._escapeSparqlString(String(value))}" .`
                    ).join('\n') : ''}
                }
            }
        `

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
        logger.info(`Stored ragno:Entity ${entity.id}`)
    }

    /**
     * Store a ragno:SemanticUnit with content and relationships
     * @param {Object} unit - Semantic unit data with content, entities, embedding
     * @returns {Promise<void>}
     */
    async storeSemanticUnit(unit) {
        if (!unit || !unit.id) {
            throw new Error('SemanticUnit must have an id field')
        }

        const unitUri = `<${unit.id}>`
        const embeddingStr = Array.isArray(unit.embedding) ? JSON.stringify(unit.embedding) : '[]'

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${unitUri} a ragno:SemanticUnit ;
                        ragno:hasContent "${this._escapeSparqlString(unit.content || '')}" ;
                        rdfs:label "${this._escapeSparqlString(unit.summary || unit.content?.substring(0, 100) || '')}" ;
                        semem:embedding """${embeddingStr}""" ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        ragno:tokenCount "${unit.tokenCount || 0}"^^xsd:integer ;
                        ragno:importance "${unit.importance || 0.5}"^^xsd:decimal .
                    ${unit.entities ? unit.entities.map(entityId =>
                        `${unitUri} ragno:relatedTo <${entityId}> .`
                    ).join('\n') : ''}
                    ${unit.partOf ? `${unitUri} ragno:partOf <${unit.partOf}> .` : ''}
                }
            }
        `

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
        logger.info(`Stored ragno:SemanticUnit ${unit.id}`)
    }

    /**
     * Store a ragno:Relationship with source, target and properties
     * @param {Object} relationship - Relationship data with source, target, type
     * @returns {Promise<void>}
     */
    async storeRelationship(relationship) {
        if (!relationship || !relationship.id || !relationship.source || !relationship.target) {
            throw new Error('Relationship must have id, source, and target fields')
        }

        const relUri = `<${relationship.id}>`

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${relUri} a ragno:Relationship ;
                        rdfs:label "${this._escapeSparqlString(relationship.label || relationship.type || '')}" ;
                        ragno:source <${relationship.source}> ;
                        ragno:target <${relationship.target}> ;
                        rdf:type ragno:${relationship.type || 'Relationship'} ;
                        ragno:weight "${relationship.weight || 1.0}"^^xsd:decimal ;
                        ragno:confidence "${relationship.confidence || 1.0}"^^xsd:decimal ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                    ${relationship.properties ? Object.entries(relationship.properties).map(([key, value]) =>
                        `${relUri} ragno:${key} "${this._escapeSparqlString(String(value))}" .`
                    ).join('\n') : ''}
                }
            }
        `

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
        logger.info(`Stored ragno:Relationship ${relationship.id}`)
    }

    /**
     * Store a ragno:Community with members and aggregation data
     * @param {Object} community - Community data with members and statistics
     * @returns {Promise<void>}
     */
    async storeCommunity(community) {
        if (!community || !community.id) {
            throw new Error('Community must have an id field')
        }

        const communityUri = `<${community.id}>`

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${communityUri} a ragno:Community ;
                        rdfs:label "${this._escapeSparqlString(community.label || community.name || '')}" ;
                        ragno:cohesion "${community.cohesion || 0.5}"^^xsd:decimal ;
                        ragno:size "${community.size || (community.members ? community.members.length : 0)}"^^xsd:integer ;
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                    ${community.members ? community.members.map(memberId =>
                        `${communityUri} ragno:hasMember <${memberId}> .`
                    ).join('\n') : ''}
                    ${community.description ? `${communityUri} rdfs:comment "${this._escapeSparqlString(community.description)}" .` : ''}
                }
            }
        `

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
        logger.info(`Stored ragno:Community ${community.id}`)
    }

    /**
     * Execute ZPT query by zoom level with filters
     * @param {Object} queryConfig - Configuration with zoomLevel, filters, limit
     * @returns {Promise<Array>} Query results
     */
    async queryByZoomLevel(queryConfig) {
        const { zoomLevel, filters = {}, limit = 25 } = queryConfig
        
        const template = ZPT_QUERY_TEMPLATES[zoomLevel]
        if (!template) {
            throw new Error(`Unknown zoom level: ${zoomLevel}`)
        }

        // Build filter clauses
        const filterClauses = this._buildFilterClauses(filters)
        
        // Replace template variables
        const query = template
            .replace(/\{\{graphName\}\}/g, this.graphName)
            .replace(/\{\{filters\}\}/g, filterClauses)
            .replace(/\{\{limit\}\}/g, limit)

        logger.debug(`Executing ZPT query for zoom level: ${zoomLevel}`)
        const result = await this._executeSparqlQuery(query, this.endpoint.query)
        
        return this._parseQueryResults(result, zoomLevel)
    }

    /**
     * Build SPARQL filter clauses from ZPT pan parameters
     * @param {Object} filters - Filter configuration (domains, keywords, temporal, etc.)
     * @returns {string} SPARQL filter clauses
     */
    _buildFilterClauses(filters) {
        const clauses = []

        // Domain filtering
        if (filters.domains && filters.domains.length > 0) {
            const domainPattern = filters.domains.map(d => `"${this._escapeSparqlString(d)}"`).join('|')
            clauses.push(`FILTER(REGEX(?label, "${domainPattern}", "i"))`)
        }

        // Keyword filtering  
        if (filters.keywords && filters.keywords.length > 0) {
            const keywordPattern = filters.keywords.map(k => `"${this._escapeSparqlString(k)}"`).join('|')
            clauses.push(`FILTER(REGEX(?content, "${keywordPattern}", "i") || REGEX(?label, "${keywordPattern}", "i"))`)
        }

        // Entity filtering
        if (filters.entities && filters.entities.length > 0) {
            const entityValues = filters.entities.map(e => `<${e}>`).join(' ')
            clauses.push(`VALUES ?relatedEntity { ${entityValues} }`)
            clauses.push(`?uri ragno:connectsTo ?relatedEntity`)
        }

        // Temporal filtering
        if (filters.temporal && (filters.temporal.start || filters.temporal.end)) {
            if (filters.temporal.start) {
                clauses.push(`FILTER(?timestamp >= "${filters.temporal.start}"^^xsd:dateTime)`)
            }
            if (filters.temporal.end) {
                clauses.push(`FILTER(?timestamp <= "${filters.temporal.end}"^^xsd:dateTime)`)
            }
        }

        // Geographic filtering (if coordinates provided)
        if (filters.geographic && filters.geographic.boundingBox) {
            const { north, south, east, west } = filters.geographic.boundingBox
            clauses.push(`
                ?uri geo:lat ?lat ; geo:long ?long .
                FILTER(?lat >= ${south} && ?lat <= ${north})
                FILTER(?long >= ${west} && ?long <= ${east})
            `)
        }

        // Similarity threshold filtering
        if (filters.similarityThreshold) {
            clauses.push(`FILTER(?similarity >= ${filters.similarityThreshold})`)
        }

        return clauses.join('\n                ')
    }

    /**
     * Parse SPARQL query results into ZPT corpuscle format
     * @param {Object} result - SPARQL query result
     * @param {string} zoomLevel - The zoom level for result interpretation
     * @returns {Array<Object>} Parsed corpuscles
     */
    _parseQueryResults(result, zoomLevel) {
        const corpuscles = []

        for (const binding of result.results.bindings) {
            try {
                const corpuscle = {
                    id: binding.uri.value,
                    type: zoomLevel,
                    timestamp: binding.timestamp?.value || new Date().toISOString()
                }

                // Add type-specific properties
                switch (zoomLevel) {
                    case 'micro':
                        corpuscle.content = binding.content?.value || ''
                        corpuscle.metadata = this._parseJsonValue(binding.metadata?.value)
                        corpuscle.similarity = parseFloat(binding.similarity?.value) || 0
                        break

                    case 'entity':
                        corpuscle.label = binding.label?.value || ''
                        corpuscle.entityType = binding.type?.value || ''
                        corpuscle.prefLabel = binding.prefLabel?.value || ''
                        corpuscle.frequency = parseInt(binding.frequency?.value) || 0
                        corpuscle.centrality = parseFloat(binding.centrality?.value) || 0
                        break

                    case 'relationship':
                        corpuscle.label = binding.label?.value || ''
                        corpuscle.source = binding.source?.value || ''
                        corpuscle.target = binding.target?.value || ''
                        corpuscle.relationshipType = binding.type?.value || ''
                        corpuscle.weight = parseFloat(binding.weight?.value) || 0
                        break

                    case 'community':
                        corpuscle.label = binding.label?.value || ''
                        corpuscle.memberCount = parseInt(binding.memberCount?.value) || 0
                        corpuscle.avgSimilarity = parseFloat(binding.avgSimilarity?.value) || 0
                        corpuscle.cohesion = parseFloat(binding.cohesion?.value) || 0
                        break

                    case 'corpus':
                        corpuscle.label = binding.label?.value || ''
                        corpuscle.entityCount = parseInt(binding.entityCount?.value) || 0
                        corpuscle.unitCount = parseInt(binding.unitCount?.value) || 0
                        corpuscle.relationshipCount = parseInt(binding.relationshipCount?.value) || 0
                        corpuscle.avgConnectivity = parseFloat(binding.avgConnectivity?.value) || 0
                        break
                }

                corpuscles.push(corpuscle)
            } catch (parseError) {
                logger.error('Failed to parse corpuscle:', parseError, binding)
            }
        }

        logger.info(`Parsed ${corpuscles.length} corpuscles for zoom level: ${zoomLevel}`)
        return corpuscles
    }

    /**
     * Advanced similarity search with SPARQL-based cosine similarity
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum results
     * @param {number} threshold - Similarity threshold
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array>} Similar elements with similarity scores
     */
    async findSimilarElements(queryEmbedding, limit = SPARQL_CONFIG.SIMILARITY.DEFAULT_LIMIT, threshold = SPARQL_CONFIG.SIMILARITY.FINDALL_THRESHOLD, filters = {}) {
        // Add protective limits to prevent segfaults using configuration
        const maxLimit = Math.min(limit, SPARQL_CONFIG.SIMILARITY.MAX_QUERY_LIMIT)
        const maxResultsToProcess = Math.min(limit * 2, SPARQL_CONFIG.SIMILARITY.MAX_RESULTS_TO_PROCESS)

        const embeddingStr = JSON.stringify(queryEmbedding)
        const filterClauses = this._buildFilterClauses(filters)

        // Use template-based query instead of hardcoded SPARQL
        const queryTemplate = await this.queryService.loadQuery('semantic-search')
        if (!queryTemplate) {
            throw new Error('semantic-search query template not found')
        }

        const query = queryTemplate
            .replace('${graphName}', this.graphName)
            .replace('${filters}', filterClauses)
            .replace('${limit}', maxResultsToProcess)

        try {
            // Add timeout to prevent hanging queries using configuration
            const queryPromise = this._executeSparqlQuery(query, this.endpoint.query)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), SPARQL_CONFIG.SIMILARITY.QUERY_TIMEOUT_MS)
            )

            const result = await Promise.race([queryPromise, timeoutPromise])
            const similarElements = []
            let processedCount = 0

            // Limit processing to prevent memory exhaustion using configuration
            const bindingsToProcess = result.results.bindings.slice(0, maxResultsToProcess)

            for (const binding of bindingsToProcess) {
                // Add progress check to prevent hanging loops using configuration
                if (processedCount++ > SPARQL_CONFIG.SIMILARITY.MAX_PROCESSING_ITERATIONS) {
                    logger.warn(`Limiting similarity search processing to ${SPARQL_CONFIG.SIMILARITY.MAX_PROCESSING_ITERATIONS} results to prevent memory issues`)
                    break
                }
                try {
                    let embedding = []

                    // Handle two embedding formats:
                    // 1. semem vocabulary: embedding value is JSON array string
                    // 2. ragno vocabulary: embedding is URI, embeddingVector has the actual vector
                    if (binding.embeddingVector?.value && binding.embeddingVector.value !== 'undefined') {
                        // Ragno format: embedding stored as URI reference with vector data
                        const embeddingStr = binding.embeddingVector.value.trim()
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    } else if (binding.embedding?.value && binding.embedding.value !== 'undefined' && binding.embedding.type === 'literal') {
                        // Semem format: embedding value is the JSON array string
                        const embeddingStr = binding.embedding.value.trim()
                        // Add protection against extremely large JSON strings that could cause segfaults
                        if (embeddingStr.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_STRING_LENGTH) {
                            logger.warn(`Skipping embedding parsing - string too large: ${embeddingStr.length} chars`)
                            continue
                        }
                        embedding = JSON.parse(embeddingStr)
                    }

                    // Additional protection: check embedding array size
                    if (embedding.length > SPARQL_CONFIG.SIMILARITY.MAX_EMBEDDING_DIMENSIONS) {
                        logger.warn(`Skipping embedding - vector too large: ${embedding.length} dimensions`)
                        continue
                    }

                    if (embedding.length === queryEmbedding.length && embedding.length > 0) {
                        const similarity = this._calculateCosineSimilarity(queryEmbedding, embedding)
                        
                        if (similarity >= threshold) {
                            similarElements.push({
                                id: binding.uri.value,
                                label: binding.label.value,
                                type: binding.type?.value || 'unknown',
                                similarity: similarity,
                                embedding: embedding
                            })
                        }
                    }
                } catch (parseError) {
                    logger.error('Failed to parse similarity result:', parseError)
                }
            }

            // Sort by similarity (highest first) and limit results
            similarElements.sort((a, b) => b.similarity - a.similarity)
            const results = similarElements.slice(0, limit)

            logger.info(`Found ${results.length} similar elements above threshold ${threshold}`)
            return results
        } catch (error) {
            logger.error('Error in similarity search:', error)
            return []
        }
    }

    /**
     * Graph traversal query with configurable depth
     * @param {string} startNodeId - Starting node URI
     * @param {number} depth - Maximum traversal depth
     * @param {Object} options - Traversal options (direction, relationTypes)
     * @returns {Promise<Object>} Graph structure with nodes and edges
     */
    async traverseGraph(startNodeId, depth = 2, options = {}) {
        const { direction = 'both', relationTypes = [] } = options
        
        // Build property path for traversal
        let propertyPath = 'ragno:connectsTo'
        if (direction === 'outgoing') {
            propertyPath = 'ragno:connectsTo'
        } else if (direction === 'incoming') {
            propertyPath = '^ragno:connectsTo'
        } else {
            propertyPath = 'ragno:connectsTo|^ragno:connectsTo'
        }

        // Add specific relation types if specified
        if (relationTypes.length > 0) {
            const typeConstraints = relationTypes.map(t => `ragno:${t}`).join('|')
            propertyPath = `(${typeConstraints})`
        }

        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT DISTINCT ?node ?label ?type ?distance WHERE {
                GRAPH <${this.graphName}> {
                    <${startNodeId}> (${propertyPath}){0,${depth}} ?node .
                    ?node rdfs:label ?label .
                    OPTIONAL { ?node rdf:type ?type }
                    
                    # Calculate distance (approximation)
                    {
                        SELECT ?node (COUNT(?intermediate) AS ?distance) WHERE {
                            <${startNodeId}> (${propertyPath})* ?intermediate .
                            ?intermediate (${propertyPath})* ?node .
                        }
                        GROUP BY ?node
                    }
                }
            }
            ORDER BY ?distance ?label
        `

        try {
            const result = await this._executeSparqlQuery(query, this.endpoint.query)
            const nodes = new Map()
            const edges = []

            // Process nodes
            for (const binding of result.results.bindings) {
                const nodeId = binding.node.value
                nodes.set(nodeId, {
                    id: nodeId,
                    label: binding.label.value,
                    type: binding.type?.value || 'unknown',
                    distance: parseInt(binding.distance?.value) || 0
                })
            }

            // Get edges between discovered nodes
            const nodeIds = Array.from(nodes.keys())
            if (nodeIds.length > 1) {
                const edgeQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

                    SELECT ?source ?target ?label ?type WHERE {
                        GRAPH <${this.graphName}> {
                            ?source ragno:connectsTo ?target .
                            ?source rdfs:label ?sourceLabel .
                            ?target rdfs:label ?targetLabel .
                            OPTIONAL { ?source rdfs:label ?label }
                            OPTIONAL { ?source rdf:type ?type }
                            
                            VALUES ?source { ${nodeIds.map(id => `<${id}>`).join(' ')} }
                            VALUES ?target { ${nodeIds.map(id => `<${id}>`).join(' ')} }
                        }
                    }
                `

                const edgeResult = await this._executeSparqlQuery(edgeQuery, this.endpoint.query)
                for (const binding of edgeResult.results.bindings) {
                    edges.push({
                        source: binding.source.value,
                        target: binding.target.value,
                        label: binding.label?.value || '',
                        type: binding.type?.value || 'connection'
                    })
                }
            }

            logger.info(`Traversed graph from ${startNodeId}: ${nodes.size} nodes, ${edges.length} edges`)
            return {
                nodes: Array.from(nodes.values()),
                edges: edges,
                startNode: startNodeId,
                depth: depth
            }
        } catch (error) {
            logger.error('Error in graph traversal:', error)
            return { nodes: [], edges: [], startNode: startNodeId, depth: depth }
        }
    }

    /**
     * Get corpus health and statistics
     * @returns {Promise<Object>} Health check results with statistics
     */
    async validateCorpus() {
        const healthQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT 
                (COUNT(DISTINCT ?entity) AS ?entityCount)
                (COUNT(DISTINCT ?unit) AS ?unitCount) 
                (COUNT(DISTINCT ?relationship) AS ?relationshipCount)
                (COUNT(DISTINCT ?community) AS ?communityCount)
                (COUNT(DISTINCT ?embedding) AS ?embeddingCount)
            WHERE {
                GRAPH <${this.graphName}> {
                    OPTIONAL { ?entity a ragno:Entity }
                    OPTIONAL { ?unit a ragno:SemanticUnit }
                    OPTIONAL { ?relationship a ragno:Relationship }
                    OPTIONAL { ?community a ragno:Community }
                    OPTIONAL { ?item semem:embedding ?embedding }
                }
            }
        `

        try {
            const result = await this._executeSparqlQuery(healthQuery, this.endpoint.query)
            const binding = result.results.bindings[0]

            const stats = {
                entityCount: parseInt(binding.entityCount?.value) || 0,
                unitCount: parseInt(binding.unitCount?.value) || 0,
                relationshipCount: parseInt(binding.relationshipCount?.value) || 0,
                communityCount: parseInt(binding.communityCount?.value) || 0,
                embeddingCount: parseInt(binding.embeddingCount?.value) || 0
            }

            // Calculate health score
            const totalElements = stats.entityCount + stats.unitCount + stats.relationshipCount
            const embeddingCoverage = totalElements > 0 ? stats.embeddingCount / totalElements : 0
            const connectivity = stats.relationshipCount > 0 ? stats.relationshipCount / stats.entityCount : 0

            const healthy = totalElements > 0 && embeddingCoverage > SPARQL_CONFIG.HEALTH.MIN_EMBEDDING_COVERAGE && connectivity > SPARQL_CONFIG.HEALTH.MIN_CONNECTIVITY

            const recommendations = []
            if (embeddingCoverage < SPARQL_CONFIG.HEALTH.MIN_EMBEDDING_COVERAGE) {
                recommendations.push('Low embedding coverage - consider regenerating embeddings')
            }
            if (connectivity < SPARQL_CONFIG.HEALTH.MIN_CONNECTIVITY) {
                recommendations.push('Low graph connectivity - consider adding more relationships')
            }
            if (stats.communityCount === 0) {
                recommendations.push('No communities detected - consider running community detection')
            }

            logger.info(`Corpus health check: ${totalElements} elements, ${embeddingCoverage.toFixed(2)} embedding coverage`)
            return {
                healthy,
                stats,
                embeddingCoverage,
                connectivity,
                recommendations
            }
        } catch (error) {
            logger.error('Error in corpus validation:', error)
            return {
                healthy: false,
                stats: {},
                error: error.message,
                recommendations: ['Unable to validate corpus - check SPARQL endpoint']
            }
        }
    }

    /**
     * Parse JSON value safely, returning empty object/array on failure
     * @param {string} jsonStr - JSON string to parse
     * @returns {any} Parsed value or default
     */
    _parseJsonValue(jsonStr) {
        if (!jsonStr || jsonStr === 'undefined') return {}
        try {
            return JSON.parse(jsonStr.trim())
        } catch (error) {
            logger.debug('Failed to parse JSON value:', error)
            return {}
        }
    }

    /**
     * Store an entity or memory item with embedding
     * @param {Object} data - Data to store (must have id, embedding, etc.)
     */
    async store(data) {
        if (!data || !data.id) {
            throw new Error('Data must have an id field')
        }

        const entityUri = `<${data.id}>`
        
        // Use graph from metadata if provided, otherwise use default
        const targetGraph = (data.metadata && data.metadata.graph) ? data.metadata.graph : this.graphName;

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${targetGraph}> {
                    ${entityUri} a ragno:Element ;
                        ragno:content "${this._escapeSparqlString(data.response || data.content || '')}" ;
                        skos:prefLabel "${this._escapeSparqlString(data.prompt || '')}" ;
                        ragno:embedding """${JSON.stringify(data.embedding || [])}""" ; # DEPRECATED: Use ragno:hasEmbedding → ragno:vectorContent pattern instead
                        dcterms:created "${new Date().toISOString()}"^^xsd:dateTime ;
                        ragno:timestamp "${data.timestamp || new Date().toISOString()}" .
                    ${data.concepts ? data.concepts.map(concept =>
            `${entityUri} ragno:connectsTo "${this._escapeSparqlString(concept)}" .`
        ).join('\n') : ''}
                    ${data.metadata ? Object.entries(data.metadata).map(([key, value]) =>
            `${entityUri} ragno:${key} "${this._escapeSparqlString(String(value))}" .`
        ).join('\n') : ''}
                }
            }
        `

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)

        // **FIX**: Also add to FAISS index for similarity search
        if (Array.isArray(data.embedding) && data.embedding.length === this.dimension) {
            this.index.add(data.embedding)
            logger.info(`Added embedding to FAISS index: ${data.embedding.length}D`)

            // Schedule index persistence
            this._scheduleIndexPersistence()
        } else if (data.embedding) {
            logger.warn(`Embedding dimension mismatch: expected ${this.dimension}, got ${data.embedding.length}`)
        }

        logger.info(`Stored entity ${data.id} in SPARQL store`)
    }

    /**
     * Store extracted concepts as proper RDF entities with relationships
     * @param {Array} concepts - Array of concept objects from extraction
     * @param {string} sourceEntityUri - URI of the entity these concepts were extracted from
     */
    async storeConcepts(concepts, sourceEntityUri) {
        if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
            return;
        }

        const conceptStatements = [];
        const relationshipStatements = [];

        for (const concept of concepts) {
            const conceptUri = this.generateConceptURI(concept.label);
            
            // Store concept as ragno:Concept entity
            conceptStatements.push(`
                <${conceptUri}> a ragno:Concept ;
                    rdfs:label "${this._escapeSparqlString(concept.label)}" ;
                    ragno:confidence "${concept.confidence || 0.5}"^^xsd:decimal ;
                    ragno:frequency "${concept.frequency || 1}"^^xsd:integer ;
                    ragno:conceptCategory "${concept.category || 'general'}" ;
                    ragno:extractedFrom <${sourceEntityUri}> ;
                    dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
            `);

            // Create conceptual relationship between source entity and concept
            relationshipStatements.push(`
                <${sourceEntityUri}> ragno:hasConceptualRelation <${conceptUri}> .
            `);

            // Store concept embedding if available
            if (concept.embedding && Array.isArray(concept.embedding)) {
                const embeddingUri = `${conceptUri}/embedding`;
                conceptStatements.push(`
                    <${conceptUri}> ragno:hasEmbedding <${embeddingUri}> .
                    <${embeddingUri}> a ragno:ConceptEmbedding ;
                        ragno:vectorData """${JSON.stringify(concept.embedding)}""" ;
                        ragno:dimension "${concept.embedding.length}"^^xsd:integer .
                `);
            }
        }

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${conceptStatements.join('\n')}
                    ${relationshipStatements.join('\n')}
                }
            }
        `;

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update);
        logger.info(`Stored ${concepts.length} concepts for entity ${sourceEntityUri}`);
    }

    /**
     * Store concept relationships discovered through analysis
     * @param {Array} relationships - Array of relationship objects
     */
    async storeConceptRelationships(relationships) {
        if (!relationships || !Array.isArray(relationships) || relationships.length === 0) {
            return;
        }

        const relationshipStatements = [];

        for (const rel of relationships) {
            const sourceUri = this.generateConceptURI(rel.source);
            const targetUri = this.generateConceptURI(rel.target);
            const relationshipUri = `${sourceUri}/relationship/${encodeURIComponent(rel.target)}`;

            relationshipStatements.push(`
                <${sourceUri}> ragno:hasConceptualRelation <${targetUri}> .
                <${relationshipUri}> a ragno:ConceptualRelationship ;
                    ragno:source <${sourceUri}> ;
                    ragno:target <${targetUri}> ;
                    ragno:relationType "${rel.type || 'related'}" ;
                    ragno:relationStrength "${rel.strength || 0.5}"^^xsd:decimal ;
                    ragno:bidirectional "${rel.bidirectional || false}"^^xsd:boolean ;
                    dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
            `);
        }

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    ${relationshipStatements.join('\n')}
                }
            }
        `;

        await this._executeSparqlUpdate(insertQuery, this.endpoint.update);
        logger.info(`Stored ${relationships.length} concept relationships`);
    }

    /**
     * Generate a consistent URI for a concept based on its label
     */
    generateConceptURI(label) {
        const sanitized = label.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `http://purl.org/stuff/ragno/concept/${sanitized}`;
    }

    /**
     * Query concepts by category, confidence, or relationships
     */
    async queryConceptsByFilter(filters = {}) {
        const filterClauses = [];
        
        if (filters.category) {
            filterClauses.push(`FILTER (?category = "${filters.category}")`);
        }
        
        if (filters.minConfidence) {
            filterClauses.push(`FILTER (?confidence >= ${filters.minConfidence})`);
        }
        
        if (filters.relatedTo) {
            const relatedUri = this.generateConceptURI(filters.relatedTo);
            filterClauses.push(`?concept ragno:hasConceptualRelation <${relatedUri}> .`);
        }

        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT DISTINCT ?concept ?label ?category ?confidence ?frequency ?embedding
            WHERE {
                GRAPH <${this.graphName}> {
                    ?concept a ragno:Concept ;
                             rdfs:label ?label ;
                             ragno:conceptCategory ?category ;
                             ragno:confidence ?confidence ;
                             ragno:frequency ?frequency .
                    
                    OPTIONAL { 
                        ?concept ragno:hasEmbedding ?embResource .
                        ?embResource ragno:vectorData ?embedding 
                    }
                    
                    ${filterClauses.join('\n                    ')}
                }
            }
            ORDER BY DESC(?confidence) DESC(?frequency)
            LIMIT ${filters.limit || 100}
        `;

        const result = await this._executeSparqlQuery(query, this.endpoint.query);
        
        return result.results.bindings.map(binding => ({
            uri: binding.concept?.value,
            label: binding.label?.value,
            category: binding.category?.value,
            confidence: parseFloat(binding.confidence?.value || 0),
            frequency: parseInt(binding.frequency?.value || 1),
            embedding: binding.embedding?.value ? JSON.parse(binding.embedding.value) : null
        }));
    }

    /**
     * Search for similar items using basic string matching
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} limit - Maximum number of results
     * @param {number} threshold - Similarity threshold (not used in this basic implementation)
     * @returns {Array<Object>} Search results
     */
    // TODO: LEGACY METHOD - Consider removing after SearchService implementation is complete
    // This method only searches SPARQL-stored embeddings and doesn't include FAISS index
    // Use SearchService for unified search across both SPARQL and FAISS
    async search(queryEmbedding, limit = SPARQL_CONFIG.SIMILARITY.DEFAULT_LIMIT, threshold = SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD) {
        logger.info(`🔍 Search called with embedding length: ${queryEmbedding.length}, limit: ${limit}, threshold: ${threshold}`);
        const searchQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT ?entity ?prompt ?content ?embedding ?timestamp ?type ?format ?response
            FROM <${this.graphName}>
            WHERE {
                {
                    # Search in regular ragno:Element objects (old format) - DEPRECATED
                    ?entity a ragno:Element ;
                        skos:prefLabel ?prompt ;
                        ragno:content ?content ;
                        ragno:embedding ?embedding ;
                        ragno:timestamp ?timestamp .
                    OPTIONAL { ?entity ragno:type ?type }
                    BIND("old" AS ?format)
                    BIND(?content AS ?response)
                } UNION {
                    # Search in ragno:Unit chunks (new format)
                    ?entity a ragno:Unit ;
                        ragno:content ?content .
                    ?entity ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embedding .
                    OPTIONAL { ?entity dcterms:created ?timestamp }
                    BIND("Chunk" AS ?type)
                    BIND("new" AS ?format)
                    BIND(CONCAT("Document chunk: ", SUBSTR(?content, 1, 50), "...") AS ?prompt)
                    BIND(?content AS ?response)
                } UNION {
                    # Search in ragno:Concept embeddings (new format)
                    ?entity a ragno:Concept ;
                        skos:prefLabel ?prompt .
                    ?entity ragno:hasEmbedding ?embeddingUri .
                    ?embeddingUri ragno:vectorContent ?embedding .
                    OPTIONAL { ?entity dcterms:created ?timestamp }
                    BIND("Concept" AS ?type)
                    BIND("new" AS ?format)
                    BIND(?prompt AS ?content)
                    BIND(?prompt AS ?response)
                } UNION {
                    # Search in semem:Interaction objects (memory interactions)
                    ?entity a semem:Interaction ;
                        semem:prompt ?prompt ;
                        semem:output ?response ;
                        semem:embedding ?embedding ;
                        semem:timestamp ?timestamp .
                    BIND("Interaction" AS ?type)
                    BIND("memory" AS ?format)
                    BIND(CONCAT(?prompt, " ", ?response) AS ?content)
                }
            }
            LIMIT ${limit * 2}
        `

        try {
            const result = await this._executeSparqlQuery(searchQuery, this.endpoint.query)
            const searchResults = []

            for (const binding of result.results.bindings) {
                try {
                    let embedding = []
                    if (binding.embedding?.value && binding.embedding.value !== 'undefined') {
                        try {
                            const embeddingStr = binding.embedding.value.trim()
                            // Handle both formats: direct JSON array or vector content with brackets
                            if (embeddingStr.startsWith('[') && embeddingStr.endsWith(']')) {
                                embedding = JSON.parse(embeddingStr)
                            } else {
                                // Try to parse as simple comma-separated values wrapped in brackets
                                const cleaned = embeddingStr.replace(/^\[|\]$/g, '')
                                embedding = cleaned.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x))
                            }
                        } catch (embeddingError) {
                            logger.warn('Invalid embedding format:', embeddingError)
                        }
                    }

                    // Enhanced similarity calculation (cosine similarity)
                    let similarity = SPARQL_CONFIG.HEALTH.FAILED_SIMILARITY_SCORE
                    logger.info(`📐 Processing embedding: queryLen=${queryEmbedding.length}, storedLen=${embedding.length}, entity=${binding.entity.value}`)

                    if (embedding.length > 0 && queryEmbedding.length > 0) {
                        if (embedding.length === queryEmbedding.length) {
                            // Exact length match - use full cosine similarity
                            similarity = this._calculateCosineSimilarity(queryEmbedding, embedding)
                            logger.info(`✅ Exact length match similarity: ${similarity}`)
                        } else {
                            // Length mismatch - try to salvage by truncating/padding to match
                            logger.info(`⚠️ Embedding length mismatch: query=${queryEmbedding.length}, stored=${embedding.length}, attempting repair`);
                            const adjustedEmbedding = this._adjustEmbeddingLength(embedding, queryEmbedding.length);
                            similarity = this._calculateCosineSimilarity(queryEmbedding, adjustedEmbedding);
                            logger.info(`🔧 Adjusted length similarity: ${similarity}`)
                        }
                    } else {
                        logger.info(`❌ Empty embeddings: queryLen=${queryEmbedding.length}, storedLen=${embedding.length}`)
                    }

                    logger.info(`🎯 Final similarity: ${similarity}, threshold: ${threshold}, passes: ${similarity >= threshold}`);

                    if (similarity >= threshold) {
                        const format = binding.format?.value || 'unknown';
                        
                        // Log deprecation warning for old format
                        if (format === 'old') {
                            logger.warn('DEPRECATED: Found result using old ragno:embedding format. Consider migrating to ragno:hasEmbedding → ragno:vectorContent pattern.', {
                                entity: binding.entity.value,
                                type: binding.type?.value
                            });
                        }
                        
                        searchResults.push({
                            id: binding.entity.value,
                            prompt: binding.prompt.value,
                            response: binding.response?.value || binding.content.value,
                            similarity: similarity,
                            timestamp: binding.timestamp.value,
                            metadata: {
                                type: binding.type?.value || 'unknown',
                                format: format
                            }
                        })
                    }
                } catch (parseError) {
                    logger.error('Failed to parse search result:', parseError, binding)
                }
            }

            // Sort by format (new format first) then by similarity (highest first)
            searchResults.sort((a, b) => {
                // Prioritize new format over old format
                const formatPriorityA = a.metadata.format === 'new' ? 1 : 0;
                const formatPriorityB = b.metadata.format === 'new' ? 1 : 0;
                
                if (formatPriorityA !== formatPriorityB) {
                    return formatPriorityB - formatPriorityA; // New format first
                }
                
                // If same format, sort by similarity
                return b.similarity - a.similarity;
            })

            logger.info(`Found ${searchResults.length} similar items`)
            return searchResults.slice(0, limit)
        } catch (error) {
            logger.error('Error searching:', error)
            return []
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector  
     * @returns {number} Similarity score between 0 and 1
     */
    _calculateCosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0

        let dotProduct = 0
        let normA = 0
        let normB = 0

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i]
            normA += vecA[i] * vecA[i]
            normB += vecB[i] * vecB[i]
        }

        if (normA === 0 || normB === 0) return 0

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
    }

    /**
     * Adjust embedding vector length to match target length
     * @param {Array<number>} embedding - Source embedding vector
     * @param {number} targetLength - Target length to match
     * @returns {Array<number>} Adjusted embedding vector
     */
    _adjustEmbeddingLength(embedding, targetLength) {
        if (embedding.length === targetLength) {
            return embedding;
        }
        
        if (embedding.length > targetLength) {
            // Truncate if too long
            return embedding.slice(0, targetLength);
        } else {
            // Pad with zeros if too short
            const padded = [...embedding];
            while (padded.length < targetLength) {
                padded.push(0);
            }
            return padded;
        }
    }

    // Simple resilience mechanism with timeout and retries
    async executeWithResilience(operation, operationType = 'operation') {
        const { maxRetries, retryDelayMs } = this.resilience
        let lastError = null

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error
                logger.warn(`SPARQL ${operationType} attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`)
                
                if (attempt < maxRetries - 1) {
                    const delay = retryDelayMs * Math.pow(2, attempt) // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }

        // If all retries failed, try fallback if enabled
        if (this.resilience.enableFallbacks && operationType === 'query') {
            logger.warn(`SPARQL query failed after ${maxRetries} attempts, using fallback`)
            return this.getFallbackQueryResult()
        }

        throw new Error(`SPARQL ${operationType} failed after ${maxRetries} attempts: ${lastError?.message}`)
    }

    // Simple timeout wrapper
    async withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SPARQL operation timed out')), timeoutMs)
            )
        ])
    }

    // Simple fallback for failed queries
    getFallbackQueryResult() {
        return {
            results: {
                bindings: []
            }
        }
    }

    // Health check for SPARQL endpoint
    async healthCheck() {
        try {
            const testQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                SELECT (COUNT(*) as ?count) WHERE { 
                    GRAPH <${this.graphName}> { 
                        ?s a ragno:Entity 
                    } 
                } LIMIT 1`
            
            await this.withTimeout(
                this._executeSparqlQuery(testQuery, this.endpoint.query),
                5000 // 5 second timeout for health check
            )
            
            return { healthy: true, endpoint: this.endpoint.query }
        } catch (error) {
            return { 
                healthy: false, 
                endpoint: this.endpoint.query, 
                error: error.message 
            }
        }
    }

    // Public interface for executing SPARQL UPDATE queries
    async executeUpdate(updateQuery) {
        return await this._executeSparqlUpdate(updateQuery, this.endpoint.update);
    }

    // Public interface for executing SPARQL SELECT queries
    async executeSelect(selectQuery) {
        return await this._executeSparqlQuery(selectQuery, this.endpoint.query);
    }

    /**
     * Store content lazily without processing (no embeddings or concept extraction)
     * Uses ragno vocabulary to store raw content for later processing
     * @param {Object} data - Content data with id, content, type, metadata
     * @returns {Promise<void>}
     */
    async storeLazyContent(data) {
        if (!data || !data.id) {
            throw new Error('Data must have an id field')
        }
        
        const elementUri = `<${data.id}>`
        const timestamp = new Date().toISOString()
        
        // Use graph from metadata if provided, otherwise use default
        const targetGraph = (data.metadata && data.metadata.graph) ? data.metadata.graph : this.graphName;
        
        // Determine ragno class based on content type
        let ragnoClass;
        switch (data.type) {
            case 'document':
                ragnoClass = 'ragno:TextElement';
                break;
            case 'concept':
                ragnoClass = 'ragno:Entity';
                break;
            case 'interaction':
            default:
                ragnoClass = 'ragno:Element';
                break;
        }
        
        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${targetGraph}> {
                    ${elementUri} a ${ragnoClass} ;
                        ragno:content "${this._escapeSparqlString(data.content || '')}" ;
                        ragno:subType semem:${data.type || 'element'} ;
                        dcterms:created "${timestamp}"^^xsd:dateTime ;
                        semem:processingStatus "lazy" ;
                        ragno:isEntryPoint false ;
                        rdfs:label "${this._escapeSparqlString(data.prompt || data.title || 'Lazy Content')}" .
                    
                    ${data.metadata && Object.keys(data.metadata).length > 0 ? 
                        Object.entries(data.metadata)
                            .map(([key, value]) => `${elementUri} semem:${this._escapeProperty(key)} "${this._escapeSparqlString(String(value))}" .`)
                            .join('\n                    ') 
                        : ''
                    }
                }
            }
        `
        
        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)
        
        return {
            id: data.id,
            uri: data.id,
            stored: true,
            lazy: true,
            timestamp,
            ragnoClass: ragnoClass.split(':')[1]
        }
    }

    /**
     * Find lazy content that needs processing
     * @param {number} limit - Maximum number of items to return
     * @returns {Promise<Array>} Array of lazy content items
     */
    async findLazyContent(limit = 10) {
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?element ?content ?label ?type ?created WHERE {
                GRAPH <${this.graphName}> {
                    ?element semem:processingStatus "lazy" ;
                             ragno:content ?content ;
                             rdfs:label ?label ;
                             dcterms:created ?created .
                    OPTIONAL { ?element ragno:subType ?type }
                }
            }
            ORDER BY DESC(?created)
            LIMIT ${limit}
        `
        
        const result = await this._executeSparqlQuery(query, this.endpoint.query)
        
        return result.results.bindings.map(binding => ({
            id: binding.element.value,
            content: binding.content.value,
            label: binding.label.value,
            type: binding.type?.value || 'element',
            created: binding.created.value
        }))
    }

    /**
     * Update lazy content to processed status
     * @param {string} elementId - Element ID to update
     * @param {Array} embedding - Generated embedding
     * @param {Array} concepts - Extracted concepts
     * @returns {Promise<void>}
     */
    async updateLazyToProcessed(elementId, embedding = [], concepts = []) {
        const elementUri = `<${elementId}>`
        const embeddingStr = JSON.stringify(embedding)
        const conceptsStr = concepts.map(c => `"${this._escapeSparqlString(c)}"`).join(', ')
        
        const updateQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            DELETE {
                GRAPH <${this.graphName}> {
                    ${elementUri} semem:processingStatus "lazy" ;
                                  ragno:isEntryPoint false .
                }
            }
            INSERT {
                GRAPH <${this.graphName}> {
                    ${elementUri} semem:processingStatus "processed" ;
                                  ragno:isEntryPoint true ;
                                  ragno:embedding "${this._escapeSparqlString(embeddingStr)}" .
                    ${concepts.length > 0 ? 
                        concepts.map(concept => 
                            `${elementUri} skos:related "${this._escapeSparqlString(concept)}" .`
                        ).join('\n                    ')
                        : ''
                    }
                }
            }
            WHERE {
                GRAPH <${this.graphName}> {
                    ${elementUri} semem:processingStatus "lazy" .
                }
            }
        `
        
        await this._executeSparqlUpdate(updateQuery, this.endpoint.update)
    }

    /**
     * Store large document directly without memory processing
     * Used when content is too large for embedding generation
     * @param {Object} documentData - Document data to store
     * @returns {Promise<void>}
     */
    async storeDocument(documentData) {
        logger.info('Storing large document directly to SPARQL without embeddings', {
            id: documentData.id,
            promptLength: documentData.prompt?.length || 0,
            responseLength: documentData.response?.length || 0
        });

        try {
            await this.beginTransaction();
            
            const documentUri = `${this.baseUri}document/${documentData.id}`;
            const insertQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                PREFIX semem: <http://purl.org/stuff/semem/>

                INSERT DATA {
                    GRAPH <${this.graphName}> {
                        <${documentUri}> a ragno:TextElement ;
                            rdfs:label "${this._escapeSparqlString(documentData.prompt?.substring(0, 100) || 'Large Document')}" ;
                            ragno:content "${this._escapeSparqlString(documentData.prompt + ' ' + documentData.response)}" ;
                            semem:prompt "${this._escapeSparqlString(documentData.prompt || '')}" ;
                            semem:output "${this._escapeSparqlString(documentData.response || '')}" ;
                            semem:timestamp "${documentData.timestamp}"^^xsd:long ;
                            ragno:processed "false"^^xsd:boolean ;
                            ragno:processingSkipped "${documentData.metadata?.processingSkipped || 'unknown'}" ;
                            ragno:contentLength "${(documentData.prompt + documentData.response).length}"^^xsd:integer .
                    }
                }
            `;

            await this._executeSparqlUpdate(insertQuery, this.endpoint.update);
            await this.commitTransaction();

            logger.info('Large document stored successfully', {
                uri: documentUri,
                contentLength: (documentData.prompt + documentData.response).length
            });

        } catch (error) {
            await this.rollbackTransaction();
            logger.error('Error storing large document to SPARQL:', error);
            throw error;
        }
    }

    /**
     * Helper method to escape property names for SPARQL
     * @param {string} property - Property name to escape
     * @returns {string} Escaped property name
     */
    _escapeProperty(property) {
        return property.replace(/[^a-zA-Z0-9_]/g, '_')
    }

    // ============================================================================
    // IN-MEMORY CAPABILITIES - Enhanced methods from MemoryStore
    // ============================================================================

    /**
     * Initialize FAISS index for fast similarity search
     * Loads existing index from SPARQL store if available
     */
    initializeIndex() {
        try {
            this.index = new faiss.IndexFlatL2(this.dimension)
            if (!this.index || !this.index.getDimension) {
                throw new Error('Failed to initialize FAISS index')
            }
            logger.info(`Initialized FAISS index with dimension ${this.dimension}`)

            // Schedule index loading from SPARQL store
            this._loadIndexFromStore().catch(error => {
                logger.warn('Failed to load existing FAISS index from SPARQL store:', error)
            })
        } catch (error) {
            logger.error('FAISS index initialization failed:', error)
            throw new Error('Failed to initialize FAISS index: ' + error.message)
        }
    }

    /**
     * Load FAISS index from SPARQL store if it exists
     */
    async _loadIndexFromStore() {
        // CRITICAL FIX: Always rebuild FAISS index from shortTermMemory to ensure consistent mapping
        // Persisted FAISS indices cause position mismatches with shortTermMemory array
        logger.info('Skipping persisted FAISS index - will rebuild from shortTermMemory for consistent mapping');
        this.index = new faiss.IndexFlatL2(this.dimension)
        return false

        // Previous implementation below - disabled to fix mapping issues
        const indexQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT ?indexData ?indexSize WHERE {
                GRAPH <${this.graphName}> {
                    ?indexUri a semem:FAISSIndex ;
                              semem:dimension "${this.dimension}"^^xsd:integer ;
                              semem:indexData ?indexData ;
                              semem:indexSize ?indexSize ;
                              semem:current "true"^^xsd:boolean .
                }
            }
            LIMIT 1
        `

        try {
            const result = await this._executeSparqlQuery(indexQuery, this.endpoint.query)
            if (result.results.bindings.length > 0) {
                const binding = result.results.bindings[0]
                const indexData = binding.indexData.value
                const indexSize = parseInt(binding.indexSize.value)

                // Deserialize FAISS index from base64 data
                if (!indexData || typeof indexData !== 'string') {
                    logger.warn('Invalid index data retrieved from SPARQL, creating new index');
                    this.index = new faiss.IndexFlatL2(this.dimension)
                    return false
                }

                try {
                    const indexBuffer = Buffer.from(indexData, 'base64')
                    this.index = faiss.IndexFlatL2.fromBuffer(indexBuffer)
                } catch (deserializeError) {
                    logger.warn('Failed to deserialize FAISS index, will create new one:', deserializeError.message);
                    this.index = new faiss.IndexFlatL2(this.dimension)
                    return false
                }

                logger.info(`Loaded FAISS index from SPARQL store: ${indexSize} vectors, dimension ${this.dimension}`)
                return true
            }
        } catch (error) {
            logger.warn('Could not load FAISS index from store, will create new index:', error.message)
            // Create new index when loading fails
            this.index = new faiss.IndexFlatL2(this.dimension)

            // Clear corrupted index data from SPARQL store to prevent future errors
            try {
                await this._clearCorruptedIndexData()
            } catch (clearError) {
                logger.warn('Failed to clear corrupted index data:', clearError.message)
            }
        }
        return false
    }

    /**
     * Clear corrupted FAISS index data from SPARQL store
     */
    async _clearCorruptedIndexData() {
        const clearQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>

            DELETE {
                GRAPH <${this.graphName}> {
                    ?indexUri ?p ?o .
                }
            }
            WHERE {
                GRAPH <${this.graphName}> {
                    ?indexUri a semem:FAISSIndex ;
                              ?p ?o .
                }
            }
        `

        await this._executeSparqlUpdate(clearQuery, this.endpoint.update)
        logger.info('Cleared corrupted FAISS index data from SPARQL store')
    }

    /**
     * Persist FAISS index to SPARQL store
     */
    async _persistIndexToStore() {
        try {
            // Serialize FAISS index to binary data
            const indexBuffer = this.index.toBuffer()
            const indexData = indexBuffer.toString('base64')
            const indexSize = this.index.ntotal()

            // Clear any existing current index
            const clearQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                DELETE {
                    GRAPH <${this.graphName}> {
                        ?indexUri semem:current "true"^^xsd:boolean .
                    }
                } WHERE {
                    GRAPH <${this.graphName}> {
                        ?indexUri a semem:FAISSIndex ;
                                  semem:current "true"^^xsd:boolean .
                    }
                }
            `
            await this._executeSparqlUpdate(clearQuery, this.endpoint.update)

            // Store new index
            const indexUri = `${this.baseUri}faiss-index/${Date.now()}`
            const insertQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
                PREFIX dcterms: <http://purl.org/dc/terms/>

                INSERT DATA {
                    GRAPH <${this.graphName}> {
                        <${indexUri}> a semem:FAISSIndex ;
                                     semem:dimension "${this.dimension}"^^xsd:integer ;
                                     semem:indexData "${indexData}" ;
                                     semem:indexSize "${indexSize}"^^xsd:integer ;
                                     semem:current "true"^^xsd:boolean ;
                                     dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                    }
                }
            `
            await this._executeSparqlUpdate(insertQuery, this.endpoint.update)

            logger.info(`Persisted FAISS index to SPARQL store: ${indexSize} vectors`)
        } catch (error) {
            logger.error('Failed to persist FAISS index to store:', error)
            throw error
        }
    }

    /**
     * Update concept graph with new relationships
     * Graph state is maintained in memory and periodically persisted
     */
    updateGraph(concepts) {
        // Add new nodes if they don't exist
        for (const concept of concepts) {
            if (!this.graph.hasNode(concept)) {
                this.graph.addNode(concept)
            }
        }

        // Add or update edges between concepts
        for (const concept1 of concepts) {
            for (const concept2 of concepts) {
                if (concept1 !== concept2) {
                    // Check for existing edges between the nodes
                    const existingEdges = this.graph.edges(concept1, concept2)

                    if (existingEdges.length > 0) {
                        // Update weight of first existing edge
                        const edgeWeight = this.graph.getEdgeAttribute(existingEdges[0], 'weight')
                        this.graph.setEdgeAttribute(existingEdges[0], 'weight', edgeWeight + 1)
                    } else {
                        // Create new edge with weight 1
                        this.graph.addEdge(concept1, concept2, { weight: 1 })
                    }
                }
            }
        }

        // Schedule graph persistence (debounced to avoid too frequent updates)
        this._scheduleGraphPersistence()
    }

    /**
     * Debounced graph persistence to SPARQL store
     */
    _scheduleGraphPersistence() {
        if (this._graphPersistenceTimer) {
            clearTimeout(this._graphPersistenceTimer)
        }

        this._graphPersistenceTimer = setTimeout(async () => {
            try {
                await this._persistGraphToStore()
            } catch (error) {
                logger.error('Failed to persist concept graph:', error)
            }
        }, 30000) // 30 second debounce
    }

    /**
     * Persist concept graph to SPARQL store
     */
    async _persistGraphToStore() {
        const graphData = {
            nodes: this.graph.nodes(),
            edges: this.graph.edges().map(edge => {
                const [source, target] = this.graph.extremities(edge)
                return {
                    source,
                    target,
                    weight: this.graph.getEdgeAttribute(edge, 'weight')
                }
            })
        }

        const graphUri = `${this.baseUri}concept-graph/${Date.now()}`
        const insertQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${this.graphName}> {
                    <${graphUri}> a semem:ConceptGraph ;
                                 semem:graphData """${JSON.stringify(graphData)}""" ;
                                 semem:nodeCount "${graphData.nodes.length}"^^xsd:integer ;
                                 semem:edgeCount "${graphData.edges.length}"^^xsd:integer ;
                                 semem:current "true"^^xsd:boolean ;
                                 dcterms:created "${new Date().toISOString()}"^^xsd:dateTime .
                }
            }
        `

        // Clear previous current graph
        const clearQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            DELETE {
                GRAPH <${this.graphName}> {
                    ?graphUri semem:current "true"^^xsd:boolean .
                }
            } WHERE {
                GRAPH <${this.graphName}> {
                    ?graphUri a semem:ConceptGraph ;
                              semem:current "true"^^xsd:boolean .
                }
            }
        `

        await this._executeSparqlUpdate(clearQuery, this.endpoint.update)
        await this._executeSparqlUpdate(insertQuery, this.endpoint.update)

        logger.info(`Persisted concept graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`)
    }

    /**
     * Load concept graph from SPARQL store
     */
    async _loadGraphFromStore() {
        const graphQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

            SELECT ?graphData WHERE {
                GRAPH <${this.graphName}> {
                    ?graphUri a semem:ConceptGraph ;
                              semem:current "true"^^xsd:boolean ;
                              semem:graphData ?graphData .
                }
            }
            LIMIT 1
        `

        try {
            const result = await this._executeSparqlQuery(graphQuery, this.endpoint.query)
            if (result.results.bindings.length > 0) {
                const binding = result.results.bindings[0]
                const graphData = JSON.parse(binding.graphData.value)

                // Rebuild graph from stored data
                this.graph.clear()
                graphData.nodes.forEach(node => this.graph.addNode(node))
                graphData.edges.forEach(edge => {
                    this.graph.addEdge(edge.source, edge.target, { weight: edge.weight })
                })

                logger.info(`Loaded concept graph: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`)
                return true
            }
        } catch (error) {
            logger.warn('Could not load concept graph from store:', error)
        }
        return false
    }

    /**
     * Ensure memory cache is loaded and current
     */
    async _ensureMemoryLoaded() {
        const now = Date.now()
        if (this._memoryCache.loaded &&
            (now - this._memoryCache.lastLoaded) < this._memoryCache.cacheTimeoutMs) {
            return // Cache is still valid
        }

        logger.info('Loading memory data from SPARQL store...')

        try {
            // Load memory interactions
            const [shortTerm, longTerm] = await this.loadHistory()
            this.shortTermMemory = shortTerm
            this.longTermMemory = longTerm

            // Rebuild in-memory structures
            this.embeddings = shortTerm.map(item => item.embedding)
            this.timestamps = shortTerm.map(item => item.timestamp)
            this.accessCounts = shortTerm.map(item => item.accessCount || 1)
            this.conceptsList = shortTerm.map(item => item.concepts || [])

            // Rebuild FAISS index with loaded embeddings
            if (this.embeddings.length > 0) {
                this.index = new faiss.IndexFlatL2(this.dimension)
                let addedCount = 0;
                let skippedCount = 0;

                for (let i = 0; i < this.embeddings.length; i++) {
                    const embedding = this.embeddings[i];
                    let processedEmbedding = null;

                    if (Array.isArray(embedding) && embedding.length === this.dimension) {
                        // Check if embedding contains valid numbers
                        const hasValidNumbers = embedding.some(val => typeof val === 'number' && !isNaN(val) && val !== 0);
                        if (hasValidNumbers) {
                            processedEmbedding = embedding;
                        } else {
                            console.log(`⚠️ [SPARQLStore] Embedding ${i} is all zeros or invalid, creating default`);
                            // Create a small random embedding to maintain position mapping
                            processedEmbedding = new Array(this.dimension).fill(0).map(() => Math.random() * 0.001 - 0.0005);
                        }
                    } else {
                        console.log(`⚠️ [SPARQLStore] Invalid embedding ${i}: ${Array.isArray(embedding) ? embedding.length : typeof embedding}D (expected ${this.dimension}D), creating default`);
                        // Create a small random embedding to maintain position mapping
                        processedEmbedding = new Array(this.dimension).fill(0).map(() => Math.random() * 0.001 - 0.0005);
                    }

                    try {
                        this.index.add(processedEmbedding);
                        addedCount++;
                    } catch (error) {
                        console.log(`❌ [SPARQLStore] Failed to add embedding ${i} to FAISS: ${error.message}`);
                        // Even if FAISS add fails, we need to maintain position, so add a zero vector
                        try {
                            this.index.add(new Array(this.dimension).fill(0.0001));
                            addedCount++;
                        } catch (fallbackError) {
                            console.log(`❌ [SPARQLStore] Fallback embedding also failed for ${i}: ${fallbackError.message}`);
                            skippedCount++;
                        }
                    }
                }
                console.log(`🔧 [SPARQLStore] Rebuilt FAISS index: ${addedCount} added, ${skippedCount} skipped, ${this.embeddings.length} total embeddings`);

                // Verify synchronization
                if (this.index.ntotal() !== this.shortTermMemory.length) {
                    console.log(`⚠️ [SPARQLStore] FAISS index size (${this.index.ntotal()}) doesn't match shortTermMemory size (${this.shortTermMemory.length})`);
                }

                // Debug: Log first few shortTermMemory items
                for (let i = 0; i < Math.min(3, this.shortTermMemory.length); i++) {
                    const item = this.shortTermMemory[i];
                    console.log(`🔍 [SPARQLStore] shortTermMemory[${i}]: "${(item.prompt || item.content || 'unknown').substring(0, 50)}..."`);
                }
            }

            // Load concept graph
            await this._loadGraphFromStore()

            // Update cache metadata
            this._memoryCache.loaded = true
            this._memoryCache.lastLoaded = now

            logger.info(`Loaded ${shortTerm.length} short-term and ${longTerm.length} long-term memories`)
        } catch (error) {
            logger.error('Failed to load memory from SPARQL store:', error)
            throw error
        }
    }

    /**
     * Enhanced store method that maintains in-memory structures
     */
    async storeWithMemory(data) {
        // Store to SPARQL (persistent)
        await this.store(data)

        // Update in-memory structures for fast access
        await this._ensureMemoryLoaded()

        // Add to in-memory cache
        const interaction = {
            id: data.id,
            prompt: data.prompt || '',
            response: data.response || data.content || '',
            embedding: data.embedding || [],
            timestamp: data.timestamp || Date.now(),
            accessCount: 1,
            concepts: data.concepts || [],
            decayFactor: 1.0
        }

        this.shortTermMemory.push(interaction)
        this.embeddings.push(interaction.embedding)
        this.timestamps.push(interaction.timestamp)
        this.accessCounts.push(1)
        this.conceptsList.push(interaction.concepts)

        // Update FAISS index
        if (Array.isArray(interaction.embedding) && interaction.embedding.length === this.dimension) {
            this.index.add(interaction.embedding)
        }

        // Update concept graph
        if (interaction.concepts.length > 0) {
            this.updateGraph(interaction.concepts)
        }

        // Schedule index persistence
        this._scheduleIndexPersistence()

        logger.info(`Stored interaction ${data.id} in both SPARQL and memory cache`)
    }

    /**
     * Debounced index persistence
     */
    _scheduleIndexPersistence() {
        if (this._indexPersistenceTimer) {
            clearTimeout(this._indexPersistenceTimer)
        }

        this._indexPersistenceTimer = setTimeout(async () => {
            try {
                await this._persistIndexToStore()
            } catch (error) {
                logger.error('Failed to persist FAISS index:', error)
            }
        }, 60000) // 1 minute debounce
    }

    /**
     * Enhanced retrieve method with in-memory performance
     */
    async retrieve(queryEmbedding, queryConcepts = [], similarityThreshold = 40, excludeLastN = 0) {
        await this._ensureMemoryLoaded()

        if (this.shortTermMemory.length === 0) {
            logger.info('No interactions available')
            return []
        }

        logger.info('Retrieving relevant interactions from memory...')
        const relevantInteractions = []
        const currentTime = Date.now()
        const decayRate = 0.0001
        const relevantIndices = new Set()

        const normalizedQuery = vectorOps.normalize(queryEmbedding.flat())
        const normalizedEmbeddings = this.embeddings.map(e => vectorOps.normalize(Array.from(e)))

        for (let idx = 0; idx < this.shortTermMemory.length - excludeLastN; idx++) {
            const similarity = vectorOps.cosineSimilarity(normalizedQuery, normalizedEmbeddings[idx]) * 100
            const timeDiff = (currentTime - this.timestamps[idx]) / 1000
            const decayFactor = this.shortTermMemory[idx].decayFactor * Math.exp(-decayRate * timeDiff)
            const reinforcementFactor = Math.log1p(this.accessCounts[idx])
            const adjustedSimilarity = similarity * decayFactor * reinforcementFactor

            if (adjustedSimilarity >= similarityThreshold) {
                relevantIndices.add(idx)
                this.accessCounts[idx]++
                this.timestamps[idx] = currentTime
                this.shortTermMemory[idx].decayFactor *= 1.1

                relevantInteractions.push({
                    similarity: adjustedSimilarity,
                    interaction: this.shortTermMemory[idx],
                    concepts: this.conceptsList[idx]
                })
            }
        }

        // Apply decay to non-relevant interactions
        this.shortTermMemory.forEach((item, idx) => {
            if (!relevantIndices.has(idx)) {
                item.decayFactor *= 0.9
            }
        })

        const activatedConcepts = await this.spreadingActivation(queryConcepts)

        // Classify memories periodically during retrieval operations
        if (Math.random() < this.classificationChance) {
            this.classifyMemory()
        }

        return this.combineResults(relevantInteractions, activatedConcepts, normalizedQuery)
    }

    /**
     * Memory classification for short-term to long-term promotion
     */
    classifyMemory() {
        const currentTime = Date.now()
        const promotionCandidates = []

        this.shortTermMemory.forEach((interaction, idx) => {
            if (this.longTermMemory.some(ltm => ltm.id === interaction.id)) {
                return // Skip if already in long-term memory
            }

            // Calculate multi-factor importance score
            const importanceScore = this.calculateMemoryImportance(interaction, idx, currentTime)

            // Promote to long-term if importance score exceeds threshold
            if (importanceScore >= this.promotionThreshold) {
                promotionCandidates.push({
                    interaction,
                    index: idx,
                    score: importanceScore
                })
            }
        })

        // Sort candidates by importance score and promote top candidates
        promotionCandidates
            .sort((a, b) => b.score - a.score)
            .forEach(candidate => {
                this.longTermMemory.push(candidate.interaction)
                logger.info(`Promoted interaction ${candidate.interaction.id} to long-term memory (score: ${candidate.score.toFixed(2)})`)
            })

        // Persist memory changes back to SPARQL store
        if (promotionCandidates.length > 0) {
            this._scheduleMemoryPersistence()
        }
    }

    /**
     * Calculate multi-factor importance score for memory classification
     */
    calculateMemoryImportance(interaction, idx, currentTime) {
        const accessCount = this.accessCounts[idx] || 1
        const lastAccess = this.timestamps[idx] || interaction.timestamp
        const decayFactor = interaction.decayFactor || 1.0
        const concepts = interaction.concepts || []
        const content = interaction.prompt + ' ' + (interaction.output || interaction.response || '')

        // Factor 1: Access Frequency (0-3 points)
        const accessScore = Math.min(3.0, Math.log1p(accessCount) * 1.3)

        // Factor 2: Recency (0-2 points)
        const timeDiff = (currentTime - lastAccess) / (1000 * 60 * 60) // hours
        const recencyScore = Math.max(0, 2.0 * Math.exp(-timeDiff / 24)) // 24-hour half-life

        // Factor 3: Reinforcement Strength (0-2 points)
        const reinforcementScore = Math.min(2.0, (decayFactor - 1.0) * 4.0)

        // Factor 4: Concept Richness (0-2 points)
        const conceptScore = Math.min(2.0, concepts.length * 0.25)

        // Factor 5: Content Complexity (0-1 points)
        const complexityScore = Math.min(1.0, content.length / 1000)

        // Factor 6: Semantic Connectivity (0-1 points)
        const connectivityScore = this.calculateSemanticConnectivity(interaction, concepts)

        return accessScore + recencyScore + reinforcementScore +
               conceptScore + complexityScore + connectivityScore
    }

    /**
     * Calculate semantic connectivity score
     */
    calculateSemanticConnectivity(interaction, concepts) {
        if (concepts.length === 0) return 0

        let totalOverlap = 0
        let comparedMemories = 0

        this.shortTermMemory.forEach(other => {
            if (other.id === interaction.id) return

            const otherConcepts = other.concepts || []
            if (otherConcepts.length === 0) return

            const intersection = concepts.filter(c => otherConcepts.includes(c)).length
            const union = new Set([...concepts, ...otherConcepts]).size
            const overlap = union > 0 ? intersection / union : 0

            totalOverlap += overlap
            comparedMemories++
        })

        return comparedMemories > 0 ? Math.min(1.0, totalOverlap / comparedMemories * 3) : 0
    }

    /**
     * Spreading activation algorithm for concept networks
     */
    async spreadingActivation(queryConcepts) {
        const activatedNodes = new Map()
        const initialActivation = 1.0
        const decayFactor = 0.5

        queryConcepts.forEach(concept => {
            activatedNodes.set(concept, initialActivation)
        })

        // Spread activation for 2 steps
        for (let step = 0; step < 2; step++) {
            const newActivations = new Map()

            for (const [node, activation] of activatedNodes) {
                if (this.graph.hasNode(node)) {
                    this.graph.forEachNeighbor(node, (neighbor, attributes) => {
                        if (!activatedNodes.has(neighbor)) {
                            const weight = attributes.weight
                            const newActivation = activation * decayFactor * weight
                            newActivations.set(neighbor,
                                (newActivations.get(neighbor) || 0) + newActivation)
                        }
                    })
                }
            }

            newActivations.forEach((value, key) => {
                activatedNodes.set(key, value)
            })
        }

        return Object.fromEntries(activatedNodes)
    }

    /**
     * K-means clustering of interactions
     */
    clusterInteractions() {
        if (this.embeddings.length < 2) return

        const embeddingsMatrix = this.embeddings.map(e => Array.from(e))
        const numClusters = Math.min(10, this.embeddings.length)

        const { clusters } = kmeans(embeddingsMatrix, numClusters)
        this.clusterLabels = clusters

        this.semanticMemory.clear()
        clusters.forEach((label, idx) => {
            if (!this.semanticMemory.has(label)) {
                this.semanticMemory.set(label, [])
            }
            this.semanticMemory.get(label).push({
                embedding: this.embeddings[idx],
                interaction: this.shortTermMemory[idx]
            })
        })

        logger.info(`Clustered ${this.embeddings.length} interactions into ${numClusters} clusters`)
    }

    /**
     * Combine similarity and activation results
     */
    combineResults(relevantInteractions, activatedConcepts, normalizedQuery) {
        const combined = relevantInteractions.map(({ similarity, interaction, concepts }) => {
            const activationScore = Array.from(concepts)
                .reduce((sum, c) => sum + (activatedConcepts[c] || 0), 0)
            return {
                ...interaction,
                similarity: similarity,
                totalScore: similarity + activationScore
            }
        })

        combined.sort((a, b) => b.totalScore - a.totalScore)

        // Add semantic memory results
        const semanticResults = this.retrieveFromSemanticMemory(normalizedQuery)
        return [...combined, ...semanticResults]
    }

    /**
     * Retrieve from clustered semantic memory
     */
    retrieveFromSemanticMemory(normalizedQuery) {
        if (this.semanticMemory.size === 0) return []

        // Find best matching cluster
        let bestCluster = -1
        let bestSimilarity = -1

        this.semanticMemory.forEach((items, label) => {
            const centroid = this.calculateCentroid(items.map(i => i.embedding))
            const similarity = vectorOps.cosineSimilarity(normalizedQuery, centroid)

            if (similarity > bestSimilarity) {
                bestSimilarity = similarity
                bestCluster = label
            }
        })

        if (bestCluster === -1) return []

        // Get top 5 interactions from best cluster
        return this.semanticMemory.get(bestCluster)
            .map(({ embedding, interaction }) => ({
                ...interaction,
                similarity: vectorOps.cosineSimilarity(normalizedQuery,
                    vectorOps.normalize(Array.from(embedding)))
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
    }

    /**
     * Calculate centroid of embedding vectors
     */
    calculateCentroid(embeddings) {
        const sum = embeddings.reduce((acc, curr) => {
            const arr = Array.from(curr)
            return acc.map((val, idx) => val + arr[idx])
        }, new Array(this.dimension).fill(0))

        return sum.map(val => val / embeddings.length)
    }

    /**
     * Schedule memory persistence to SPARQL store
     */
    _scheduleMemoryPersistence() {
        if (this._memoryPersistenceTimer) {
            clearTimeout(this._memoryPersistenceTimer)
        }

        this._memoryPersistenceTimer = setTimeout(async () => {
            try {
                // Create a mock memory store object for compatibility with existing persistence method
                const mockMemoryStore = {
                    shortTermMemory: this.shortTermMemory,
                    longTermMemory: this.longTermMemory
                }
                await this.saveMemoryToHistory(mockMemoryStore)
            } catch (error) {
                logger.error('Failed to persist memory to SPARQL store:', error)
            }
        }, 120000) // 2 minute debounce
    }

    /**
     * Cleanup method to clear timers and persist final state
     */
    async cleanup() {
        // Clear any pending timers
        if (this._graphPersistenceTimer) {
            clearTimeout(this._graphPersistenceTimer)
        }
        if (this._indexPersistenceTimer) {
            clearTimeout(this._indexPersistenceTimer)
        }
        if (this._memoryPersistenceTimer) {
            clearTimeout(this._memoryPersistenceTimer)
        }

        // Persist final state
        try {
            await this._persistGraphToStore()
            await this._persistIndexToStore()

            const mockMemoryStore = {
                shortTermMemory: this.shortTermMemory,
                longTermMemory: this.longTermMemory
            }
            await this.saveMemoryToHistory(mockMemoryStore)

            logger.info('Enhanced SPARQLStore cleanup completed successfully')
        } catch (error) {
            logger.error('Error during SPARQLStore cleanup:', error)
        }

        // Call parent cleanup
        await super.close()
    }
}