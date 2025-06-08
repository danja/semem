import MemoryStore from './MemoryStore.js';
import { logger } from '../Utils.js';

/**
 * Extended MemoryStore with Ragno ontology integration
 * Provides bidirectional sync between in-memory Graphology graph and SPARQL
 */
export default class RagnoMemoryStore extends MemoryStore {
    constructor(dimension = 1536, ragnoStore = null) {
        super(dimension);
        this.ragnoStore = ragnoStore;
        this.syncQueue = [];
        this.syncBatchSize = 50;
        this.syncInterval = null;

        if (this.ragnoStore) {
            // Start periodic sync
            this.syncInterval = setInterval(() => this.flushSyncQueue(), 5000);
        }
    }

    /**
     * Override updateGraph to queue Ragno sync operations
     */
    updateGraph(concepts) {
        // Call parent implementation for in-memory updates
        super.updateGraph(concepts);

        if (!this.ragnoStore) return;

        // Queue concept creation/update
        for (const concept of concepts) {
            this.queueSync({
                type: 'concept',
                operation: 'upsert',
                data: { label: concept }
            });
        }

        // Queue relationship updates
        for (let i = 0; i < concepts.length; i++) {
            for (let j = i + 1; j < concepts.length; j++) {
                this.queueSync({
                    type: 'relationship',
                    operation: 'increment',
                    data: {
                        source: concepts[i],
                        target: concepts[j]
                    }
                });
            }
        }
    }

    /**
     * Queue a sync operation for batch processing
     */
    queueSync(operation) {
        this.syncQueue.push({
            ...operation,
            timestamp: Date.now()
        });

        // Auto-flush if queue is full
        if (this.syncQueue.length >= this.syncBatchSize) {
            this.flushSyncQueue();
        }
    }

    /**
     * Process queued sync operations in batch
     */
    async flushSyncQueue() {
        if (this.syncQueue.length === 0) return;

        const batch = this.syncQueue.splice(0, this.syncBatchSize);

        try {
            await this.ragnoStore.beginTransaction();

            // Group operations by type for efficiency
            const conceptOps = batch.filter(op => op.type === 'concept');
            const relationOps = batch.filter(op => op.type === 'relationship');

            // Process concepts first
            if (conceptOps.length > 0) {
                await this.processConcepts(conceptOps);
            }

            // Then process relationships
            if (relationOps.length > 0) {
                await this.processRelationships(relationOps);
            }

            await this.ragnoStore.commitTransaction();
            logger.info(`Synced ${batch.length} operations to Ragno store`);

        } catch (error) {
            await this.ragnoStore.rollbackTransaction();
            logger.error('Ragno sync failed:', error);
            // Re-queue failed operations
            this.syncQueue.unshift(...batch);
        }
    }

    /**
     * Process concept operations in batch
     */
    async processConcepts(operations) {
        const conceptsToCreate = new Set();
        const conceptsToUpdate = new Map();

        for (const op of operations) {
            const label = op.data.label;

            if (op.operation === 'upsert') {
                const exists = await this.ragnoStore.conceptExists(label);
                if (!exists) {
                    conceptsToCreate.add(label);
                } else {
                    conceptsToUpdate.set(label,
                        (conceptsToUpdate.get(label) || 0) + 1
                    );
                }
            }
        }

        // Batch create new concepts
        if (conceptsToCreate.size > 0) {
            const query = this.buildBatchConceptInsert(conceptsToCreate);
            await this.ragnoStore._executeSparqlUpdate(query);
        }

        // Batch update frequencies
        if (conceptsToUpdate.size > 0) {
            const query = this.buildBatchFrequencyUpdate(conceptsToUpdate);
            await this.ragnoStore._executeSparqlUpdate(query);
        }
    }

    /**
     * Process relationship operations in batch
     */
    async processRelationships(operations) {
        const relMap = new Map();

        // Aggregate relationship updates
        for (const op of operations) {
            const { source, target } = op.data;
            const key = `${source}:::${target}`;

            if (!relMap.has(key)) {
                relMap.set(key, {
                    source,
                    target,
                    increment: 0
                });
            }

            if (op.operation === 'increment') {
                relMap.get(key).increment += 1;
            }
        }

        // Build batch update query
        const query = this.buildBatchRelationshipUpdate(relMap);
        await this.ragnoStore._executeSparqlUpdate(query);
    }

    /**
     * Build SPARQL INSERT for batch concept creation
     */
    buildBatchConceptInsert(concepts) {
        const now = new Date().toISOString();
        const triples = Array.from(concepts).map(label => {
            const uri = this.ragnoStore.generateConceptUri(label);
            return `
                <${uri}> a ragno:Entity ;
                    skos:prefLabel "${this.escapeString(label)}"@en ;
                    ragno:subType <http://example.org/semem/ExtractedConcept> ;
                    ragno:isEntryPoint true ;
                    ragno:inCorpus <${this.ragnoStore.corpusUri}> ;
                    semem:frequency 1 ;
                    semem:firstSeen "${now}"^^xsd:dateTime ;
                    semem:lastAccessed "${now}"^^xsd:dateTime .
            `;
        }).join('\n');

        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            INSERT DATA {
                GRAPH <${this.ragnoStore.ragnoGraph}> {
                    ${triples}
                }
            }
        `;
    }

    /**
     * Build SPARQL UPDATE for batch frequency updates
     */
    buildBatchFrequencyUpdate(conceptMap) {
        const updates = Array.from(conceptMap.entries()).map(([label, increment]) => {
            const uri = this.ragnoStore.generateConceptUri(label);
            return `
                DELETE {
                    <${uri}> semem:frequency ?oldFreq ;
                             semem:lastAccessed ?oldAccess .
                }
                INSERT {
                    <${uri}> semem:frequency ?newFreq ;
                             semem:lastAccessed "${new Date().toISOString()}"^^xsd:dateTime .
                }
                WHERE {
                    <${uri}> semem:frequency ?oldFreq .
                    OPTIONAL { <${uri}> semem:lastAccessed ?oldAccess }
                    BIND((?oldFreq + ${increment}) AS ?newFreq)
                }
            `;
        }).join(' ;\n');

        return `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            ${updates}
        `;
    }

    /**
     * Build SPARQL UPDATE for batch relationship updates
     */
    buildBatchRelationshipUpdate(relMap) {
        const now = new Date().toISOString();
        const updates = [];

        for (const [key, rel] of relMap) {
            const sourceUri = this.ragnoStore.generateConceptUri(rel.source);
            const targetUri = this.ragnoStore.generateConceptUri(rel.target);
            const relUri = this.ragnoStore.generateRelationshipUri(rel.source, rel.target);

            updates.push(`
                # Upsert relationship ${rel.source} -> ${rel.target}
                INSERT {
                    <${relUri}> a ragno:Relationship ;
                        ragno:hasSourceEntity <${sourceUri}> ;
                        ragno:hasTargetEntity <${targetUri}> ;
                        ragno:hasWeight ?newWeight ;
                        semem:cooccurrenceCount ?newCount ;
                        semem:lastUpdated "${now}"^^xsd:dateTime ;
                        dcterms:created "${now}"^^xsd:dateTime .
                }
                WHERE {
                    OPTIONAL {
                        <${relUri}> ragno:hasWeight ?oldWeight ;
                                   semem:cooccurrenceCount ?oldCount .
                    }
                    BIND(COALESCE(?oldWeight, 0.0) + ${0.5 * rel.increment} AS ?newWeight)
                    BIND(COALESCE(?oldCount, 0) + ${rel.increment} AS ?newCount)
                    FILTER NOT EXISTS { <${relUri}> a ragno:Relationship }
                }
                
                # Update if exists
                DELETE {
                    <${relUri}> ragno:hasWeight ?oldWeight ;
                               semem:cooccurrenceCount ?oldCount ;
                               semem:lastUpdated ?oldUpdate .
                }
                INSERT {
                    <${relUri}> ragno:hasWeight ?newWeight2 ;
                               semem:cooccurrenceCount ?newCount2 ;
                               semem:lastUpdated "${now}"^^xsd:dateTime .
                }
                WHERE {
                    <${relUri}> ragno:hasWeight ?oldWeight ;
                               semem:cooccurrenceCount ?oldCount .
                    OPTIONAL { <${relUri}> semem:lastUpdated ?oldUpdate }
                    BIND(?oldWeight + ${0.5 * rel.increment} AS ?newWeight2)
                    BIND(?oldCount + ${rel.increment} AS ?newCount2)
                }
            `);
        }

        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            
            ${updates.join(' ;\n')}
        `;
    }

    /**
     * Load concept graph from SPARQL on initialization
     */
    async loadFromRagno() {
        if (!this.ragnoStore) return;

        logger.info('Loading concept graph from Ragno store...');

        // Load concepts
        const concepts = await this.ragnoStore.getAllConcepts();
        for (const concept of concepts) {
            if (!this.graph.hasNode(concept.label)) {
                this.graph.addNode(concept.label, {
                    frequency: concept.frequency,
                    uri: concept.uri
                });
            }
        }

        // Load relationships
        const relationships = await this.ragnoStore.getAllRelationships();
        for (const rel of relationships) {
            if (!this.graph.hasEdge(rel.source, rel.target)) {
                this.graph.addEdge(rel.source, rel.target, {
                    weight: rel.weight,
                    cooccurrenceCount: rel.count,
                    uri: rel.uri
                });
            }
        }

        logger.info(`Loaded ${concepts.length} concepts and ${relationships.length} relationships`);
    }

    /**
     * Escape string for SPARQL
     */
    escapeString(str) {
        return str.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n');
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Flush any remaining operations
        this.flushSyncQueue().catch(error => {
            logger.error('Error during final sync:', error);
        });
    }
}