/**
 * DataMigration.js - Live SPARQL-based data migration for ZPT Navigation
 * 
 * Migrates data from existing graphs to standardized ones:
 * - Documents: http://example.org/semem/documents -> http://hyperdata.it/content
 * - Navigation: http://purl.org/stuff/navigation/enhanced -> http://purl.org/stuff/navigation
 * 
 * Transforms data to use proper ragno.ttl and zpt.ttl vocabulary
 */

import logger from 'loglevel';
import { v4 as uuidv4 } from 'uuid';

export default class DataMigration {
    constructor(sparqlStore, options = {}) {
        this.sparqlStore = sparqlStore;
        this.config = {
            batchSize: options.batchSize || 100,
            enableBackup: options.enableBackup !== false,
            enableValidation: options.enableValidation !== false,
            dryRun: options.dryRun || false,
            ...options
        };

        // Source and target graphs
        this.sourceGraphs = {
            documents: 'http://example.org/semem/documents',
            navigation: 'http://purl.org/stuff/navigation/enhanced',
            memory: 'http://example.org/mcp/memory'
        };

        this.targetGraphs = {
            content: 'http://hyperdata.it/content',
            navigation: 'http://purl.org/stuff/navigation',
            session: 'http://tensegrity.it/semem'
        };

        this.migrationStats = {
            documentsProcessed: 0,
            entitiesCreated: 0,
            unitsCreated: 0,
            embeddingsCreated: 0,
            navigationViewsCreated: 0,
            errors: []
        };
    }

    /**
     * Execute complete data migration pipeline
     */
    async migrate() {
        logger.info('🚀 Starting live data migration for ZPT Navigation...');
        
        try {
            // Phase 1: Backup existing data
            if (this.config.enableBackup) {
                await this.createBackup();
            }

            // Phase 2: Migrate document data to content graph
            await this.migrateDocuments();

            // Phase 3: Create proper ragno structure with embeddings
            await this.createRagnoStructure();

            // Phase 4: Migrate navigation data
            await this.migrateNavigation();

            // Phase 5: Validate migration results
            if (this.config.enableValidation) {
                await this.validateMigration();
            }

            logger.info('✅ Data migration completed successfully!');
            logger.info('📊 Migration Statistics:', this.migrationStats);
            
            return {
                success: true,
                stats: this.migrationStats
            };

        } catch (error) {
            logger.error('❌ Migration failed:', error);
            this.migrationStats.errors.push(error.message);
            
            if (this.config.enableBackup) {
                logger.info('🔄 Attempting to restore from backup...');
                await this.restoreFromBackup();
            }
            
            throw error;
        }
    }

    /**
     * Create backup of existing data
     */
    async createBackup() {
        logger.info('💾 Creating backup of existing data...');
        
        const backupGraph = `http://backup.semem/${Date.now()}`;
        
        // Backup documents
        const backupQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            INSERT {
                GRAPH <${backupGraph}> {
                    ?s ?p ?o .
                }
            }
            WHERE {
                GRAPH <${this.sourceGraphs.documents}> {
                    ?s ?p ?o .
                }
            }
        `;

        if (!this.config.dryRun) {
            const result = await this.sparqlStore._executeSparqlUpdate(backupQuery, this.sparqlStore.endpoint.update);
            if (!result.success) {
                throw new Error(`Backup failed: ${result.error}`);
            }
        }
        
        logger.info(`📦 Backup created in graph: ${backupGraph}`);
        this.backupGraph = backupGraph;
    }

    /**
     * Migrate document data from source to target content graph
     */
    async migrateDocuments() {
        logger.info('📄 Migrating document data to content graph...');

        // First, get all documents from source graph
        const documentsQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT DISTINCT ?doc ?content ?created ?type WHERE {
                GRAPH <${this.sourceGraphs.documents}> {
                    ?doc rdf:type ?type .
                    OPTIONAL { ?doc ragno:content ?content }
                    OPTIONAL { ?doc dcterms:created ?created }
                }
            }
            LIMIT ${this.config.batchSize}
        `;

        const result = await this.sparqlStore._executeSparqlQuery(documentsQuery, this.sparqlStore.endpoint.query);
        
        if (!result.success) {
            throw new Error(`Failed to query documents: ${result.error}`);
        }

        const documents = result.data.results.bindings;
        logger.info(`📊 Found ${documents.length} documents to migrate`);

        // Process documents in batches
        for (const doc of documents) {
            await this.migrateDocument(doc);
            this.migrationStats.documentsProcessed++;
        }
    }

    /**
     * Migrate individual document with proper ragno structure
     */
    async migrateDocument(docData) {
        const docURI = docData.doc.value;
        const content = docData.content?.value || '';
        const created = docData.created?.value || new Date().toISOString();
        
        // Create ragno:Unit for the document
        const unitURI = `http://purl.org/stuff/instance/unit-${uuidv4().substring(0, 8)}`;
        const textElementURI = `http://purl.org/stuff/instance/text-${uuidv4().substring(0, 8)}`;
        const embeddingURI = `http://purl.org/stuff/instance/embedding-${uuidv4().substring(0, 8)}`;

        const migrationQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX dcterms: <http://purl.org/dc/terms/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            
            INSERT DATA {
                GRAPH <${this.targetGraphs.content}> {
                    # ragno:Unit with content
                    <${unitURI}> a ragno:Unit ;
                        ragno:content "${this.escapeString(content)}" ;
                        ragno:hasTextElement <${textElementURI}> ;
                        ragno:hasEmbedding <${embeddingURI}> ;
                        dcterms:created "${created}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
                        ragno:isEntryPoint true .
                    
                    # ragno:TextElement for original text
                    <${textElementURI}> a ragno:TextElement ;
                        ragno:content "${this.escapeString(content)}" ;
                        dcterms:created "${created}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                    
                    # ragno:IndexElement for embedding (placeholder)
                    <${embeddingURI}> a ragno:IndexElement ;
                        ragno:subType ragno:TextEmbedding ;
                        ragno:embeddingModel "nomic-embed-text" ;
                        ragno:embeddingDimension 1536 ;
                        ragno:vectorContent "[]" .
                }
            }
        `;

        if (!this.config.dryRun) {
            const result = await this.sparqlStore._executeSparqlUpdate(migrationQuery, this.sparqlStore.endpoint.update);
            if (!result.success) {
                throw new Error(`Failed to migrate document ${docURI}: ${result.error}`);
            }
        }

        this.migrationStats.unitsCreated++;
        this.migrationStats.embeddingsCreated++;
        
        logger.debug(`✅ Migrated document: ${docURI} -> ${unitURI}`);
    }

    /**
     * Create proper ragno structure with entities and relationships
     */
    async createRagnoStructure() {
        logger.info('🏗️  Creating proper ragno structure...');

        // Extract entities from migrated content
        const entityQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            
            SELECT DISTINCT ?unit ?content WHERE {
                GRAPH <${this.targetGraphs.content}> {
                    ?unit a ragno:Unit ;
                          ragno:content ?content .
                }
            }
        `;

        const result = await this.sparqlStore._executeSparqlQuery(entityQuery, this.sparqlStore.endpoint.query);
        
        if (result.success) {
            const units = result.data.results.bindings;
            
            for (const unit of units) {
                await this.extractEntitiesFromUnit(unit);
            }
        }
    }

    /**
     * Extract entities from unit content using simple keyword extraction
     */
    async extractEntitiesFromUnit(unitData) {
        const unitURI = unitData.unit.value;
        const content = unitData.content?.value || '';
        
        // Simple entity extraction (in practice, this would use LLM)
        const keywords = ['machine learning', 'artificial intelligence', 'sparql', 'rdf', 'navigation', 'semantic web'];
        const foundEntities = keywords.filter(keyword => 
            content.toLowerCase().includes(keyword.toLowerCase())
        );

        for (const entityName of foundEntities) {
            const entityURI = `http://purl.org/stuff/instance/entity-${this.generateEntityId(entityName)}`;
            
            const entityInsert = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
                
                INSERT DATA {
                    GRAPH <${this.targetGraphs.content}> {
                        <${entityURI}> a ragno:Entity ;
                            rdfs:label "${entityName}" ;
                            skos:prefLabel "${entityName}" ;
                            ragno:isEntryPoint true ;
                            ragno:subType ragno:ExtractedConcept ;
                            ragno:hasUnit <${unitURI}> .
                    }
                }
            `;

            if (!this.config.dryRun) {
                await this.sparqlStore._executeSparqlUpdate(entityInsert, this.sparqlStore.endpoint.update);
            }
            
            this.migrationStats.entitiesCreated++;
        }
    }

    /**
     * Migrate navigation data to proper ZPT structure
     */
    async migrateNavigation() {
        logger.info('🧭 Migrating navigation data...');

        // Get existing navigation data
        const navQuery = `
            PREFIX zpt: <http://purl.org/stuff/zpt/>
            PREFIX prov: <http://www.w3.org/ns/prov#>
            
            SELECT DISTINCT ?s ?p ?o WHERE {
                GRAPH <${this.sourceGraphs.navigation}> {
                    ?s ?p ?o .
                }
            }
            LIMIT 1000
        `;

        const result = await this.sparqlStore._executeSparqlQuery(navQuery, this.sparqlStore.endpoint.query);
        
        if (result.success && result.data.results.bindings.length > 0) {
            // Create proper navigation session
            const sessionURI = `http://purl.org/stuff/instance/session-${uuidv4()}`;
            const viewURI = `http://purl.org/stuff/instance/view-${uuidv4()}`;
            
            const navInsert = `
                PREFIX zpt: <http://purl.org/stuff/zpt/>
                PREFIX prov: <http://www.w3.org/ns/prov#>
                PREFIX dcterms: <http://purl.org/dc/terms/>
                
                INSERT DATA {
                    GRAPH <${this.targetGraphs.navigation}> {
                        <${sessionURI}> a zpt:NavigationSession ;
                            dcterms:created "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
                            prov:wasAssociatedWith <http://example.org/agent/migration> .
                        
                        <${viewURI}> a zpt:NavigationView ;
                            zpt:partOfSession <${sessionURI}> ;
                            zpt:hasQuery "Migrated navigation data" ;
                            dcterms:created "${new Date().toISOString()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
                    }
                }
            `;

            if (!this.config.dryRun) {
                await this.sparqlStore._executeSparqlUpdate(navInsert, this.sparqlStore.endpoint.update);
            }
            
            this.migrationStats.navigationViewsCreated++;
        }
    }

    /**
     * Validate migration results
     */
    async validateMigration() {
        logger.info('🔍 Validating migration results...');

        const validationQueries = {
            units: `SELECT (COUNT(*) as ?count) WHERE { GRAPH <${this.targetGraphs.content}> { ?s a ragno:Unit } }`,
            entities: `SELECT (COUNT(*) as ?count) WHERE { GRAPH <${this.targetGraphs.content}> { ?s a ragno:Entity } }`,
            embeddings: `SELECT (COUNT(*) as ?count) WHERE { GRAPH <${this.targetGraphs.content}> { ?s ragno:hasEmbedding ?e } }`,
            navigation: `SELECT (COUNT(*) as ?count) WHERE { GRAPH <${this.targetGraphs.navigation}> { ?s a zpt:NavigationSession } }`
        };

        const validation = {};
        
        for (const [type, query] of Object.entries(validationQueries)) {
            const prefixedQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX zpt: <http://purl.org/stuff/zpt/>
                ${query}
            `;
            
            const result = await this.sparqlStore._executeSparqlQuery(prefixedQuery, this.sparqlStore.endpoint.query);
            
            if (result.success) {
                validation[type] = parseInt(result.data.results.bindings[0].count.value);
            } else {
                validation[type] = 0;
            }
        }

        logger.info('📊 Migration Validation Results:', validation);
        
        // Check if migration was successful
        if (validation.units === 0 && this.migrationStats.documentsProcessed > 0) {
            throw new Error('Migration validation failed: No units were created');
        }

        return validation;
    }

    /**
     * Helper methods
     */
    escapeString(str) {
        if (!str) return '';
        return str.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    generateEntityId(entityName) {
        return entityName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 16);
    }

    /**
     * Restore from backup in case of failure
     */
    async restoreFromBackup() {
        if (!this.backupGraph) {
            logger.warn('⚠️  No backup graph available for restoration');
            return;
        }

        logger.info('🔄 Restoring data from backup...');
        
        // Clear target graphs
        await this.sparqlStore._executeSparqlUpdate(`CLEAR GRAPH <${this.targetGraphs.content}>`, this.sparqlStore.endpoint.update);
        await this.sparqlStore._executeSparqlUpdate(`CLEAR GRAPH <${this.targetGraphs.navigation}>`, this.sparqlStore.endpoint.update);
        
        // Restore from backup
        const restoreQuery = `
            INSERT {
                GRAPH <${this.sourceGraphs.documents}> {
                    ?s ?p ?o .
                }
            }
            WHERE {
                GRAPH <${this.backupGraph}> {
                    ?s ?p ?o .
                }
            }
        `;
        
        await this.sparqlStore._executeSparqlUpdate(restoreQuery, this.sparqlStore.endpoint.update);
        logger.info('✅ Data restored from backup');
    }
}