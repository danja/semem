import dotenv from 'dotenv';
import Config from '../../Config.js';
import logger from 'loglevel';
import SPARQLTemplateLoader from '../SPARQLTemplateLoader.js';
// import { WorkflowLogger } from '../../utils/WorkflowLogger.js';

dotenv.config();

/**
 * Store module handles data persistence operations to SPARQL
 * This module manages storing and loading various data types including memories,
 * entities, semantic units, relationships, and communities
 */
export class Store {
    constructor(sparqlExecute, graphName, dimension) {
        this.config = new Config();
        this.sparqlExecute = sparqlExecute;
        this.graphName = graphName;
        this.dimension = dimension;

        // Initialize template loader for query templates
        this.templateLoader = new SPARQLTemplateLoader();

        // Initialize workflow logger for operation tracking (temporarily disabled)
        // this.workflowLogger = new WorkflowLogger();

        logger.info('Store module initialized');
    }

    /**
     * Load memory history from SPARQL store
     * @returns {Promise<Array>} Array containing [shortTermMemory, longTermMemory]
     */
    async loadHistory() {
        await this.sparqlExecute.verify();

        const query = await this.templateLoader.loadAndInterpolate('store', 'load-memory', {
            graphName: this.graphName
        });

        try {
            const result = await this.sparqlExecute.executeSparqlQuery(query);
            const shortTermMemory = [];
            const longTermMemory = [];

            for (const binding of result.results.bindings) {
                try {
                    let embedding = new Array(this.dimension).fill(0);
                    if (binding.embedding?.value && binding.embedding.value !== 'undefined') {
                        try {
                            let parsedEmbedding = JSON.parse(binding.embedding.value.trim());

                            // Handle nested array formats that might come from SPARQL
                            if (Array.isArray(parsedEmbedding) && parsedEmbedding.length === 1 && Array.isArray(parsedEmbedding[0])) {
                                parsedEmbedding = parsedEmbedding[0];
                            }

                            // Flatten any nested structures and ensure numeric values
                            if (Array.isArray(parsedEmbedding)) {
                                const flatEmbedding = parsedEmbedding.flat().map(val => {
                                    const num = parseFloat(val);
                                    return isNaN(num) ? 0 : num;
                                });

                                // Only use if dimensions match
                                if (flatEmbedding.length === this.dimension) {
                                    embedding = flatEmbedding;
                                    this.validateEmbedding(embedding);
                                    logger.debug(`✅ Successfully parsed embedding: ${flatEmbedding.length}D`);
                                } else {
                                    logger.debug(`❌ Embedding dimension mismatch: expected ${this.dimension}, got ${flatEmbedding.length}`);
                                }
                            } else {
                                logger.debug(`❌ Parsed embedding is not an array: ${typeof parsedEmbedding}`);
                            }
                        } catch (embeddingError) {
                            // Use debug level for common embedding format issues to reduce noise
                            logger.debug('❌ Invalid embedding format (using default):', embeddingError.message);
                        }
                    }

                    let concepts = [];
                    if (binding.concepts?.value && binding.concepts.value !== 'undefined') {
                        try {
                            concepts = JSON.parse(binding.concepts.value.trim());
                            if (!Array.isArray(concepts)) {
                                throw new Error('Concepts must be an array');
                            }
                        } catch (conceptsError) {
                            logger.error('Invalid concepts format:', conceptsError);
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
                    };

                    if (binding.memoryType.value === 'short-term') {
                        shortTermMemory.push(interaction);
                    } else {
                        longTermMemory.push(interaction);
                    }
                } catch (parseError) {
                    logger.error('Failed to parse interaction:', parseError, binding);
                }
            }

            logger.info(`Loaded ${shortTermMemory.length} short-term and ${longTermMemory.length} long-term memories from store`);
            return [shortTermMemory, longTermMemory];
        } catch (error) {
            logger.error('Error loading history:', error);
            return [[], []];
        }
    }

    /**
     * Save memory store to SPARQL with transaction support
     * @param {Object} memoryStore - Memory store containing short-term and long-term memories
     */
    async saveMemoryToHistory(memoryStore) {
        // Start workflow tracking for SPARQL persistence
        const operationId = this.workflowLogger.startOperation(
            null,
            'storage',
            'Persisting memories to SPARQL knowledge graph',
            {
                shortTermMemories: memoryStore.shortTermMemory.length,
                longTermMemories: memoryStore.longTermMemory.length,
                totalMemories: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length,
                graphName: this.graphName
            }
        );

        const opLogger = this.workflowLogger.createOperationLogger(operationId);

        try {
            // Step 1: Verify connection
            opLogger.step(
                'verify_connection',
                '🔌 Verifying SPARQL endpoint connection',
                `[Store] verify() - checking connectivity`,
                {}
            );
            await this.sparqlExecute.verify();

            // Step 2: Begin transaction
            opLogger.step(
                'begin_transaction',
                '🚀 Starting database transaction',
                '[Store] beginTransaction() - ensuring atomic operation',
                {}
            );
            await this.sparqlExecute.beginTransaction();

            // Step 3: Clear existing interactions
            opLogger.step(
                'clear_existing',
                '🧹 Clearing existing interactions from graph',
                `[Store] DELETE operation on graph <${this.graphName}>`,
                { graphName: this.graphName }
            );

            const clearQuery = await this.templateLoader.loadAndInterpolate('store', 'clear-existing', {
                graphName: this.graphName
            });
            await this.sparqlExecute.executeSparqlUpdate(clearQuery);

            // Step 4: Generate RDF triples
            opLogger.step(
                'generate_rdf',
                '🏗️ Generating RDF triples for memories',
                `[Store] _generateInsertStatements() - creating triples for ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} interactions`,
                {
                    shortTermTriples: memoryStore.shortTermMemory.length,
                    longTermTriples: memoryStore.longTermMemory.length
                }
            );

            const insertStatements = [
                this._generateInsertStatements(memoryStore.shortTermMemory, 'short-term'),
                this._generateInsertStatements(memoryStore.longTermMemory, 'long-term'),
                this._generateConceptStatements(memoryStore.shortTermMemory),
                this._generateConceptStatements(memoryStore.longTermMemory)
            ].join('\n        ');

            const insertQuery = await this.templateLoader.loadAndInterpolate('store', 'insert-memory', {
                graphName: this.graphName,
                insertStatements: insertStatements
            });

            // Step 5: Execute INSERT operation
            opLogger.step(
                'execute_insert',
                '📤 Executing SPARQL INSERT operation',
                `[Store] executeSparqlUpdate() - inserting ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} interactions with embeddings`,
                {
                    queryLength: insertQuery.length,
                    totalInteractions: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length
                }
            );

            logger.debug(`Store saveMemoryToHistory query = \n${insertQuery}`);
            await this.sparqlExecute.executeSparqlUpdate(insertQuery);

            // Step 6: Commit transaction
            opLogger.step(
                'commit_transaction',
                '✅ Committing transaction to knowledge graph',
                '[Store] commitTransaction() - finalizing atomic operation',
                { graphName: this.graphName }
            );
            await this.sparqlExecute.commitTransaction();

            // Complete operation successfully
            opLogger.complete(
                `Successfully persisted ${memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length} memories to SPARQL store`,
                {
                    shortTermMemories: memoryStore.shortTermMemory.length,
                    longTermMemories: memoryStore.longTermMemory.length,
                    totalMemories: memoryStore.shortTermMemory.length + memoryStore.longTermMemory.length,
                    graphName: this.graphName
                }
            );

            logger.info(`Saved memory to SPARQL store. Stats: ${memoryStore.shortTermMemory.length} short-term, ${memoryStore.longTermMemory.length} long-term memories`);
        } catch (error) {
            // Step 7: Handle errors and rollback
            opLogger.step(
                'rollback_transaction',
                '🔄 Rolling back transaction due to error',
                `[Store] rollbackTransaction() - error: ${error.message}`,
                { error: error.message }
            );
            await this.sparqlExecute.rollbackTransaction();

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
                graphName: this.graphName
            });

            logger.error('Error saving to SPARQL store:', error);
            throw error;
        }
    }

    /**
     * Store a single interaction/memory item
     * @param {Object} data - Data to store (must have id, embedding, etc.)
     */
    async store(data) {
        if (!data || !data.id) {
            throw new Error('Data must have an id field');
        }

        const entityUri = `<${data.id}>`;

        // Use graph from metadata if provided, otherwise use default
        const targetGraph = (data.metadata && data.metadata.graph) ? data.metadata.graph : this.graphName;

        const insertQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${targetGraph}> {
                    ${entityUri} a semem:Interaction ;
                        semem:id "${this._escapeSparqlString(data.id)}" ;
                        semem:prompt "${this._escapeSparqlString(data.prompt || '')}" ;
                        semem:output "${this._escapeSparqlString(data.response || data.content || '')}" ;
                        semem:embedding """${JSON.stringify(data.embedding || [])}""" ;
                        semem:timestamp "${Date.now()}"^^xsd:integer ;
                        semem:accessCount "0"^^xsd:integer ;
                        semem:concepts """${JSON.stringify(data.concepts || [])}""" ;
                        semem:decayFactor "1.0"^^xsd:decimal ;
                        semem:memoryType "${data.metadata?.memoryType || 'short-term'}" .
                    ${data.metadata ? Object.entries(data.metadata).filter(([key]) => key !== 'memoryType').map(([key, value]) =>
            `${entityUri} semem:${key} "${this._escapeSparqlString(String(value))}" .`
        ).join('\n') : ''}
                }
            }
        `;

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored entity ${data.id} in SPARQL store`);
    }

    /**
     * Store a ragno:Entity with metadata and relationships
     * @param {Object} entity - Entity data with id, label, metadata
     */
    async storeEntity(entity) {
        if (!entity || !entity.id) {
            throw new Error('Entity must have an id field');
        }

        const entityUri = `<${entity.id}>`;
        const embeddingStr = Array.isArray(entity.embedding) ? JSON.stringify(entity.embedding) : '[]';

        const optionalStatements = [
            entity.description ? `${entityUri} rdfs:comment "${this._escapeSparqlString(entity.description)}" .` : '',
            entity.metadata ? Object.entries(entity.metadata).map(([key, value]) =>
                `${entityUri} ragno:${key} "${this._escapeSparqlString(String(value))}" .`
            ).join('\n        ') : ''
        ].filter(s => s).join('\n        ');

        const insertQuery = await this.templateLoader.loadAndInterpolate('store', 'insert-entity', {
            graphName: this.graphName,
            entityUri: entityUri,
            label: this._escapeSparqlString(entity.label || entity.name || ''),
            subType: entity.subType || 'Entity',
            prefLabel: this._escapeSparqlString(entity.prefLabel || entity.label || ''),
            embeddingStr: embeddingStr,
            timestamp: new Date().toISOString(),
            frequency: entity.frequency || 1,
            centrality: entity.centrality || 0.0,
            isEntryPoint: entity.isEntryPoint || false,
            optionalStatements: optionalStatements
        });

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored ragno:Entity ${entity.id}`);
    }

    /**
     * Store a ragno:SemanticUnit with content and relationships
     * @param {Object} unit - Semantic unit data with content, entities, embedding
     */
    async storeSemanticUnit(unit) {
        if (!unit || !unit.id) {
            throw new Error('SemanticUnit must have an id field');
        }

        const unitUri = `<${unit.id}>`;
        const embeddingStr = Array.isArray(unit.embedding) ? JSON.stringify(unit.embedding) : '[]';

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
        `;

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored ragno:SemanticUnit ${unit.id}`);
    }

    /**
     * Store a ragno:Relationship with source, target and properties
     * @param {Object} relationship - Relationship data with source, target, type
     */
    async storeRelationship(relationship) {
        if (!relationship || !relationship.id || !relationship.source || !relationship.target) {
            throw new Error('Relationship must have id, source, and target fields');
        }

        const relUri = `<${relationship.id}>`;

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

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
        `;

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored ragno:Relationship ${relationship.id}`);
    }

    /**
     * Store a ragno:Community with members and aggregation data
     * @param {Object} community - Community data with members and statistics
     */
    async storeCommunity(community) {
        if (!community || !community.id) {
            throw new Error('Community must have an id field');
        }

        const communityUri = `<${community.id}>`;

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
        `;

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored ragno:Community ${community.id}`);
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

        await this.sparqlExecute.executeSparqlUpdate(insertQuery);
        logger.info(`Stored ${concepts.length} concepts for entity ${sourceEntityUri}`);
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
     * Validate embedding dimensions and format
     * @param {Array} embedding - Embedding vector to validate
     */
    validateEmbedding(embedding) {
        if (!Array.isArray(embedding)) {
            throw new Error('Embedding must be an array');
        }
        if (embedding.length !== this.dimension) {
            throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`);
        }
        if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
            throw new Error('Embedding must contain only valid numbers');
        }
    }

    /**
     * Generate insert statements for memory interactions
     * @param {Array} memories - Array of memory interactions
     * @param {string} type - Memory type ('short-term' or 'long-term')
     * @returns {string} Generated SPARQL insert statements
     */
    _generateInsertStatements(memories, type) {
        return memories.map((interaction, index) => {
            let embeddingStr = '[]';
            if (Array.isArray(interaction.embedding)) {
                try {
                    this.validateEmbedding(interaction.embedding);
                    embeddingStr = JSON.stringify(interaction.embedding);
                } catch (error) {
                    logger.debug('Invalid embedding in memory (using default):', error.message);
                }
            }

            let conceptsStr = '[]';
            if (Array.isArray(interaction.concepts)) {
                conceptsStr = JSON.stringify(interaction.concepts);
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
                    semem:memoryType "${type}" .
            `;
        }).join('\n');
    }

    /**
     * Generate concept statements from memory interactions
     * @param {Array} memories - Array of memory interactions
     * @returns {string} Generated SPARQL concept statements
     */
    _generateConceptStatements(memories) {
        const conceptStatements = [];

        for (const interaction of memories) {
            if (interaction.concepts && Array.isArray(interaction.concepts)) {
                for (const concept of interaction.concepts) {
                    if (typeof concept === 'string' && concept.trim()) {
                        const conceptUri = this.generateConceptURI(concept);
                        conceptStatements.push(`
                            <${conceptUri}> a ragno:Concept ;
                                rdfs:label "${this._escapeSparqlString(concept)}" ;
                                ragno:extractedFrom <${interaction.id}> .
                        `);
                    }
                }
            }
        }

        return conceptStatements.join('\n');
    }

    /**
     * Escape special characters in SPARQL strings
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    _escapeSparqlString(str) {
        if (typeof str !== 'string') {
            return String(str);
        }
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Dispose of store resources
     */
    dispose() {
        logger.info('Store module disposed');
    }
}