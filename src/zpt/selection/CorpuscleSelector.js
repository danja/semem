/**
 * Main orchestrator for parameter-based corpuscle selection from Ragno corpus
 * Now includes ZPT ontology integration for RDF navigation storage
 */
import ParameterValidator from '../parameters/ParameterValidator.js';
import ParameterNormalizer from '../parameters/ParameterNormalizer.js';
import FilterBuilder from '../parameters/FilterBuilder.js';
import SelectionCriteria from '../parameters/SelectionCriteria.js';
import { logger } from '../../Utils.js';

// Import ZPT ontology integration
import { NamespaceUtils, getSPARQLPrefixes } from '../ontology/ZPTNamespaces.js';
import { ZPTDataFactory } from '../ontology/ZPTDataFactory.js';

export default class CorpuscleSelector {
    constructor(ragnoCorpus, options = {}) {
        this.corpus = ragnoCorpus;
        this.sparqlStore = options.sparqlStore;
        this.embeddingHandler = options.embeddingHandler;
        
        // Initialize parameter processing components
        this.validator = new ParameterValidator();
        this.normalizer = new ParameterNormalizer();
        this.filterBuilder = new FilterBuilder(options);
        this.criteriaBuilder = new SelectionCriteria(options);
        
        // Selection configuration
        this.config = {
            maxResults: options.maxResults || 1000,
            timeoutMs: options.timeoutMs || 30000,
            enableCaching: options.enableCaching !== false,
            debugMode: options.debugMode || false,
            enableZPTStorage: options.enableZPTStorage !== false, // Enable ZPT RDF storage by default
            navigationGraph: options.navigationGraph || 'http://purl.org/stuff/navigation',
            ...options
        };

        // Initialize ZPT ontology integration
        if (this.config.enableZPTStorage) {
            this.zptDataFactory = new ZPTDataFactory({
                navigationGraph: this.config.navigationGraph
            });
        }

        // Performance tracking
        this.metrics = {
            totalSelections: 0,
            avgSelectionTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        // Result cache
        this.cache = new Map();
        this.cacheExpiry = options.cacheExpiry || 3600000; // 1 hour
    }

    /**
     * Main selection method - selects corpuscles based on ZPT parameters
     * @param {Object} params - Raw ZPT navigation parameters
     * @returns {Promise<Object>} Selection results with corpuscles and metadata
     */
    async select(params) {
        const startTime = Date.now();
        this.metrics.totalSelections++;

        try {
            logger.info('Starting corpuscle selection', { params });

            // Phase 1: Validate parameters
            const validationResult = this.validator.validate(params);
            if (!validationResult.valid) {
                throw new Error(`Parameter validation failed: ${validationResult.message}`);
            }

            // Phase 2: Normalize parameters
            const normalizedParams = this.normalizer.normalize(params);
            logger.debug('Parameters normalized', { normalizedParams });

            // Phase 3: Check cache
            const cacheKey = this.normalizer.createParameterHash(normalizedParams);
            if (this.config.enableCaching) {
                const cachedResult = this.getCachedResult(cacheKey);
                if (cachedResult) {
                    this.metrics.cacheHits++;
                    logger.debug('Cache hit', { cacheKey });
                    return this.enrichCachedResult(cachedResult, normalizedParams);
                }
                this.metrics.cacheMisses++;
            }

            // Phase 4: Build selection criteria
            const selectionCriteria = this.criteriaBuilder.buildCriteria(normalizedParams);
            logger.debug('Selection criteria built', { 
                criteria: this.criteriaBuilder.getSummary(selectionCriteria) 
            });

            // Phase 5: Execute selection based on tilt type
            let corpuscles;
            switch (normalizedParams.tilt.representation) {
                case 'embedding':
                    corpuscles = await this.selectByEmbedding(normalizedParams, selectionCriteria);
                    break;
                case 'keywords':
                    corpuscles = await this.selectByKeywords(normalizedParams, selectionCriteria);
                    break;
                case 'graph':
                    corpuscles = await this.selectByGraph(normalizedParams, selectionCriteria);
                    break;
                case 'temporal':
                    corpuscles = await this.selectByTemporal(normalizedParams, selectionCriteria);
                    break;
                default:
                    throw new Error(`Unsupported tilt representation: ${normalizedParams.tilt.representation}`);
            }

            // Phase 6: Apply post-processing
            const processedCorpuscles = await this.postProcessCorpuscles(
                corpuscles, 
                normalizedParams, 
                selectionCriteria
            );

            // Phase 7: Build result object
            const result = this.buildSelectionResult(
                processedCorpuscles, 
                normalizedParams, 
                selectionCriteria,
                Date.now() - startTime
            );

            // Phase 8: Cache result
            if (this.config.enableCaching) {
                this.cacheResult(cacheKey, result);
            }

            // Update metrics
            this.updateMetrics(Date.now() - startTime);

            // Store navigation metadata in ZPT RDF if enabled
            if (this.config.enableZPTStorage) {
                await this.storeNavigationData(normalizedParams, result);
            }

            logger.info('Corpuscle selection completed', {
                resultCount: result.corpuscles.length,
                selectionTime: result.metadata.selectionTime,
                cacheKey
            });

            return result;

        } catch (error) {
            logger.error('Corpuscle selection failed', { error, params });
            throw new Error(`Selection failed: ${error.message}`);
        }
    }

    /**
     * Select corpuscles using embedding similarity
     */
    async selectByEmbedding(normalizedParams, selectionCriteria) {
        if (!this.embeddingHandler) {
            throw new Error('EmbeddingHandler required for embedding-based selection');
        }

        // Build SPARQL query for embedding search
        const queryConfig = this.filterBuilder.buildQuery(normalizedParams);
        
        // Execute base query to get candidates
        const candidates = await this.executeQuery(queryConfig);
        
        // If we have a topic, generate query embedding for similarity
        if (normalizedParams.pan.topic) {
            const queryEmbedding = await this.embeddingHandler.generateEmbedding(
                normalizedParams.pan.topic.value
            );
            
            // Calculate similarities and rank
            return this.rankBySimilarity(candidates, queryEmbedding, selectionCriteria);
        }

        // Otherwise, return candidates filtered by selection criteria
        return this.filterCorpuscles(candidates, selectionCriteria);
    }

    /**
     * Select corpuscles using keyword matching
     */
    async selectByKeywords(normalizedParams, selectionCriteria) {
        const queryConfig = this.filterBuilder.buildQuery(normalizedParams);
        const candidates = await this.executeQuery(queryConfig);
        
        // Apply keyword-based scoring
        return this.scoreByKeywords(candidates, normalizedParams, selectionCriteria);
    }

    /**
     * Select corpuscles using graph structure
     */
    async selectByGraph(normalizedParams, selectionCriteria) {
        const queryConfig = this.filterBuilder.buildQuery(normalizedParams);
        const candidates = await this.executeQuery(queryConfig);
        
        // Apply graph-based scoring (connectivity, centrality)
        return this.scoreByGraph(candidates, normalizedParams, selectionCriteria);
    }

    /**
     * Select corpuscles using temporal ordering
     */
    async selectByTemporal(normalizedParams, selectionCriteria) {
        const queryConfig = this.filterBuilder.buildQuery(normalizedParams);
        queryConfig.query = queryConfig.query.replace(
            'ORDER BY ?uri',
            'ORDER BY DESC(?created) DESC(?modified)'
        );
        
        const candidates = await this.executeQuery(queryConfig);
        return this.filterCorpuscles(candidates, selectionCriteria);
    }

    /**
     * Execute SPARQL query against the corpus
     */
    async executeQuery(queryConfig) {
        if (!this.sparqlStore) {
            throw new Error('SPARQLStore required for corpus queries');
        }

        try {
            logger.debug('Executing SPARQL query', { 
                query: queryConfig.query.substring(0, 200) + '...' 
            });

            const result = await this.sparqlStore._executeSparqlQuery(
                queryConfig.query,
                this.sparqlStore.endpoint.query
            );

            return this.parseQueryResults(result, queryConfig);
        } catch (error) {
            logger.error('SPARQL query execution failed', { error, queryConfig });
            throw new Error(`Query execution failed: ${error.message}`);
        }
    }

    /**
     * Parse SPARQL query results into corpuscle objects
     */
    parseQueryResults(sparqlResult, queryConfig) {
        if (!sparqlResult.results || !sparqlResult.results.bindings) {
            return [];
        }

        return sparqlResult.results.bindings.map(binding => {
            const corpuscle = {
                uri: binding.uri?.value,
                type: this.determineCorpuscleType(binding, queryConfig.zoomLevel),
                content: this.extractContent(binding),
                metadata: this.extractMetadata(binding),
                score: 0, // Will be calculated later
                binding // Keep original binding for debugging
            };

            return corpuscle;
        });
    }

    /**
     * Determine corpuscle type from SPARQL binding
     */
    determineCorpuscleType(binding, zoomLevel) {
        if (binding.type?.value) {
            const rdfType = binding.type.value;
            if (rdfType.includes('Entity')) return 'entity';
            if (rdfType.includes('SemanticUnit') || rdfType.includes('Unit')) return 'unit';
            if (rdfType.includes('TextElement') || rdfType.includes('Text')) return 'text';
            if (rdfType.includes('Community')) return 'community';
            if (rdfType.includes('Corpus')) return 'corpus';
        }
        
        return zoomLevel; // Fallback to zoom level
    }

    /**
     * Extract content from SPARQL binding
     */
    extractContent(binding) {
        const content = {};
        
        if (binding.label?.value) content.label = binding.label.value;
        if (binding.prefLabel?.value) content.prefLabel = binding.prefLabel.value;
        if (binding.text?.value) content.text = binding.text.value;
        if (binding.content?.value) content.content = binding.content.value;
        if (binding.description?.value) content.description = binding.description.value;
        
        return content;
    }

    /**
     * Extract metadata from SPARQL binding
     */
    extractMetadata(binding) {
        const metadata = {};
        
        if (binding.created?.value) metadata.created = binding.created.value;
        if (binding.modified?.value) metadata.modified = binding.modified.value;
        if (binding.source?.value) metadata.source = binding.source.value;
        if (binding.position?.value) metadata.position = binding.position.value;
        if (binding.embedding?.value) {
            try {
                metadata.embedding = JSON.parse(binding.embedding.value);
            } catch (e) {
                logger.warn('Failed to parse embedding', { embedding: binding.embedding.value });
            }
        }
        
        return metadata;
    }

    /**
     * Rank corpuscles by embedding similarity
     */
    async rankBySimilarity(corpuscles, queryEmbedding, selectionCriteria) {
        const scoredCorpuscles = corpuscles.map(corpuscle => {
            let similarity = 0;
            
            if (corpuscle.metadata.embedding) {
                similarity = this.calculateCosineSimilarity(
                    queryEmbedding, 
                    corpuscle.metadata.embedding
                );
            }
            
            return {
                ...corpuscle,
                score: similarity,
                similarity
            };
        });

        // Sort by similarity and apply selection criteria
        scoredCorpuscles.sort((a, b) => b.similarity - a.similarity);
        return this.filterCorpuscles(scoredCorpuscles, selectionCriteria);
    }

    /**
     * Score corpuscles by keyword relevance
     */
    scoreByKeywords(corpuscles, normalizedParams, selectionCriteria) {
        const topicValue = normalizedParams.pan.topic?.value;
        if (!topicValue) {
            return this.filterCorpuscles(corpuscles, selectionCriteria);
        }

        const keywords = topicValue.toLowerCase().split(/\s+/);
        
        const scoredCorpuscles = corpuscles.map(corpuscle => {
            const text = [
                corpuscle.content.label,
                corpuscle.content.prefLabel,
                corpuscle.content.text,
                corpuscle.content.content,
                corpuscle.content.description
            ].filter(Boolean).join(' ').toLowerCase();

            let score = 0;
            keywords.forEach(keyword => {
                const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
                score += matches;
            });

            return {
                ...corpuscle,
                score: score / keywords.length,
                keywordScore: score
            };
        });

        scoredCorpuscles.sort((a, b) => b.score - a.score);
        return this.filterCorpuscles(scoredCorpuscles, selectionCriteria);
    }

    /**
     * Score corpuscles by graph connectivity
     */
    scoreByGraph(corpuscles, normalizedParams, selectionCriteria) {
        // For now, use a simple connectivity heuristic
        // In a full implementation, this would use graph metrics
        const scoredCorpuscles = corpuscles.map(corpuscle => {
            let connectivityScore = 0;
            
            // Count relationships/connections (simplified)
            if (corpuscle.binding.entity) connectivityScore += 1;
            if (corpuscle.binding.unit) connectivityScore += 1;
            if (corpuscle.binding.members) connectivityScore += 2;
            
            return {
                ...corpuscle,
                score: connectivityScore,
                connectivityScore
            };
        });

        scoredCorpuscles.sort((a, b) => b.score - a.score);
        return this.filterCorpuscles(scoredCorpuscles, selectionCriteria);
    }

    /**
     * Apply selection criteria to filter corpuscles
     */
    filterCorpuscles(corpuscles, selectionCriteria) {
        let filtered = [...corpuscles];

        // Apply constraints
        if (selectionCriteria.constraints) {
            const resultLimit = selectionCriteria.constraints.find(c => c.type === 'result_count')?.limit;
            if (resultLimit) {
                filtered = filtered.slice(0, resultLimit);
            }
        }

        return filtered;
    }

    /**
     * Store navigation data as ZPT RDF metadata
     */
    async storeNavigationData(normalizedParams, selectionResult) {
        if (!this.config.enableZPTStorage || !this.zptDataFactory) {
            return;
        }

        try {
            // Convert parameters to ZPT URIs
            const zptParams = this.convertParametersToZPTURIs(normalizedParams);

            // Create navigation session
            const sessionConfig = {
                agentURI: 'http://example.org/agents/corpuscle_selector',
                startTime: new Date(),
                purpose: `Corpuscle selection using ${zptParams.tiltURI || normalizedParams.tilt.representation} analysis`
            };

            const session = this.zptDataFactory.createNavigationSession(sessionConfig);

            // Create navigation view with selected corpuscles
            const viewConfig = {
                query: normalizedParams.pan?.topic?.value || 'corpus selection',
                zoom: zptParams.zoomURI || this.getDefaultZoomURI(normalizedParams.zoom.level),
                tilt: zptParams.tiltURI || this.getDefaultTiltURI(normalizedParams.tilt.representation),
                pan: { domains: zptParams.panURIs || [] },
                sessionURI: session.uri.value,
                selectedCorpuscles: selectionResult.corpuscles.map(c => c.uri).filter(Boolean)
            };

            const view = this.zptDataFactory.createNavigationView(viewConfig);

            // Store in SPARQL if available
            if (this.sparqlStore) {
                await this.storeZPTDataInSPARQL(session, view);
            }

            // Add ZPT metadata to selection result
            selectionResult.zptMetadata = {
                sessionURI: session.uri.value,
                viewURI: view.uri.value,
                zptParameters: zptParams,
                stored: !!this.sparqlStore
            };

            logger.info('ZPT navigation data stored', {
                sessionURI: session.uri.value,
                viewURI: view.uri.value,
                selectedCorpuscles: viewConfig.selectedCorpuscles.length
            });

        } catch (error) {
            logger.warn('Failed to store ZPT navigation data', { error });
            // Don't throw - selection should succeed even if ZPT storage fails
        }
    }

    /**
     * Convert normalized parameters to ZPT URIs
     */
    convertParametersToZPTURIs(normalizedParams) {
        const zptParams = {};

        // Convert zoom level
        if (normalizedParams.zoom?.level) {
            const zoomURI = NamespaceUtils.resolveStringToURI('zoom', normalizedParams.zoom.level);
            if (zoomURI) {
                zptParams.zoomURI = zoomURI.value;
            }
        }

        // Convert tilt representation
        if (normalizedParams.tilt?.representation) {
            const tiltURI = NamespaceUtils.resolveStringToURI('tilt', normalizedParams.tilt.representation);
            if (tiltURI) {
                zptParams.tiltURI = tiltURI.value;
            }
        }

        // Convert pan domains (if available)
        if (normalizedParams.pan?.domains) {
            zptParams.panURIs = normalizedParams.pan.domains
                .map(domain => NamespaceUtils.resolveStringToURI('pan', domain))
                .filter(uri => uri !== null)
                .map(uri => uri.value);
        }

        return zptParams;
    }

    /**
     * Get default zoom URI for fallback cases
     */
    getDefaultZoomURI(zoomLevel) {
        const zoomURI = NamespaceUtils.resolveStringToURI('zoom', zoomLevel);
        return zoomURI ? zoomURI.value : 'http://purl.org/stuff/zpt/EntityLevel';
    }

    /**
     * Get default tilt URI for fallback cases
     */
    getDefaultTiltURI(tiltRepresentation) {
        const tiltURI = NamespaceUtils.resolveStringToURI('tilt', tiltRepresentation);
        return tiltURI ? tiltURI.value : 'http://purl.org/stuff/zpt/KeywordProjection';
    }

    /**
     * Store ZPT session and view data in SPARQL
     */
    async storeZPTDataInSPARQL(session, view) {
        if (!this.sparqlStore) {
            return;
        }

        try {
            // Generate SPARQL INSERT for session
            const sessionTriples = this.generateTriplesFromQuads(session.quads);
            const sessionInsert = getSPARQLPrefixes(['zpt', 'prov']) + `
INSERT DATA {
    GRAPH <${this.config.navigationGraph}> {
${sessionTriples}
    }
}`;

            // Generate SPARQL INSERT for view
            const viewTriples = this.generateTriplesFromQuads(view.quads);
            const viewInsert = getSPARQLPrefixes(['zpt']) + `
INSERT DATA {
    GRAPH <${this.config.navigationGraph}> {
${viewTriples}
    }
}`;

            // Execute SPARQL updates
            await this.executeSPARQLUpdate(sessionInsert, 'Store ZPT navigation session');
            await this.executeSPARQLUpdate(viewInsert, 'Store ZPT navigation view');

        } catch (error) {
            logger.error('Failed to store ZPT data in SPARQL', { error });
            throw error;
        }
    }

    /**
     * Execute SPARQL UPDATE operation
     */
    async executeSPARQLUpdate(sparql, description) {
        if (!this.sparqlStore) {
            throw new Error('SPARQL store not available');
        }

        try {
            logger.debug(`Executing SPARQL update: ${description}`);
            
            // Use the SPARQL store's update method
            if (typeof this.sparqlStore.update === 'function') {
                await this.sparqlStore.update(sparql);
            } else {
                // Fallback to direct endpoint call
                const response = await fetch(this.sparqlStore.endpoint.update, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/sparql-update',
                        'Authorization': this.sparqlStore.auth
                    },
                    body: sparql
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            }

            logger.debug(`SPARQL update successful: ${description}`);

        } catch (error) {
            logger.error(`SPARQL update failed: ${description}`, { error });
            throw error;
        }
    }

    /**
     * Generate SPARQL triples from RDF quads
     */
    generateTriplesFromQuads(quads) {
        return quads.map(quad => {
            const obj = this.formatRDFObject(quad.object);
            return `        <${quad.subject.value}> <${quad.predicate.value}> ${obj} .`;
        }).join('\n');
    }

    /**
     * Format RDF object for SPARQL
     */
    formatRDFObject(object) {
        if (object.termType === 'Literal') {
            let formatted = `"${object.value.replace(/"/g, '\\"')}"`;
            if (object.datatype) {
                formatted += `^^<${object.datatype.value}>`;
            } else if (object.language) {
                formatted += `@${object.language}`;
            }
            return formatted;
        } else {
            return `<${object.value}>`;
        }
    }

    /**
     * Post-process selected corpuscles
     */
    async postProcessCorpuscles(corpuscles, normalizedParams, selectionCriteria) {
        // Apply diversity filtering if needed
        if (selectionCriteria.scoring.components.some(c => c.name === 'diversity')) {
            corpuscles = this.applyDiversityFilter(corpuscles, normalizedParams);
        }

        // Sort by final score
        corpuscles.sort((a, b) => b.score - a.score);

        return corpuscles;
    }

    /**
     * Apply diversity filtering to reduce redundancy
     */
    applyDiversityFilter(corpuscles, normalizedParams) {
        const diversityThreshold = 0.8;
        const filtered = [];
        
        for (const corpuscle of corpuscles) {
            let isDiverse = true;
            
            for (const existing of filtered) {
                if (this.calculateContentSimilarity(corpuscle, existing) > diversityThreshold) {
                    isDiverse = false;
                    break;
                }
            }
            
            if (isDiverse) {
                filtered.push(corpuscle);
            }
        }
        
        return filtered;
    }

    /**
     * Calculate cosine similarity between embeddings
     */
    calculateCosineSimilarity(embedding1, embedding2) {
        if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
            return 0;
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Calculate content similarity between corpuscles
     */
    calculateContentSimilarity(corpuscle1, corpuscle2) {
        const text1 = Object.values(corpuscle1.content).join(' ').toLowerCase();
        const text2 = Object.values(corpuscle2.content).join(' ').toLowerCase();
        
        // Simple Jaccard similarity
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Build final selection result object
     */
    buildSelectionResult(corpuscles, normalizedParams, selectionCriteria, selectionTime) {
        return {
            corpuscles,
            metadata: {
                selectionTime,
                parameters: normalizedParams,
                criteria: this.criteriaBuilder.getSummary(selectionCriteria),
                resultCount: corpuscles.length,
                zoomLevel: normalizedParams.zoom.level,
                tiltRepresentation: normalizedParams.tilt.representation,
                hasFilters: normalizedParams._metadata.hasFilters,
                complexity: normalizedParams._metadata.complexity,
                timestamp: new Date().toISOString()
            },
            navigation: {
                zoom: normalizedParams.zoom.level,
                pan: normalizedParams.pan,
                tilt: normalizedParams.tilt.representation
            }
        };
    }

    /**
     * Cache management methods
     */
    getCachedResult(cacheKey) {
        if (!this.cache.has(cacheKey)) return null;
        
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(cacheKey);
            return null;
        }
        
        return cached.result;
    }

    cacheResult(cacheKey, result) {
        this.cache.set(cacheKey, {
            result: JSON.parse(JSON.stringify(result)), // Deep copy
            timestamp: Date.now()
        });
        
        // Cleanup old cache entries
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    enrichCachedResult(cachedResult, normalizedParams) {
        return {
            ...cachedResult,
            metadata: {
                ...cachedResult.metadata,
                fromCache: true,
                parameters: normalizedParams,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Update performance metrics
     */
    updateMetrics(selectionTime) {
        this.metrics.avgSelectionTime = 
            (this.metrics.avgSelectionTime * (this.metrics.totalSelections - 1) + selectionTime) / 
            this.metrics.totalSelections;
    }

    /**
     * Get selector statistics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
        };
    }

    /**
     * Clear cache and reset metrics
     */
    reset() {
        this.cache.clear();
        this.metrics = {
            totalSelections: 0,
            avgSelectionTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.cache.clear();
        logger.info('CorpuscleSelector disposed');
    }
}