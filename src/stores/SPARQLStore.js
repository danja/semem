import BaseStore from './BaseStore.js'
import { SPARQLQueryService } from '../services/sparql/SPARQLQueryService.js'
import { createUnifiedLogger } from '../utils/LoggingConfig.js'

// Use unified STDIO-aware logger
const logger = createUnifiedLogger('sparql-store');
import { v4 as uuidv4 } from 'uuid'
import { SPARQL_CONFIG } from '../../config/preferences.js'
import { WorkflowLogger, workflowLoggerRegistry } from '../utils/WorkflowLogger.js'
import SPARQLTemplateLoader from './SPARQLTemplateLoader.js'

// Import the new modular components
import { SPARQLExecute } from './modules/SPARQLExecute.js'
import { Vectors } from './modules/Vectors.js'
import { Search } from './modules/Search.js'
import { SPARQLCache } from './modules/SPARQLCache.js'
import { Store } from './modules/Store.js'
import { ZPT } from './modules/ZPT.js'
import { GraphModule } from './modules/Graph.js'

/**
 * SPARQLStore - Refactored facade class that composes modular components
 * Maintains API compatibility while internally using specialized modules
 */
export default class SPARQLStore extends BaseStore {
    constructor(endpoint, options = {}, config = null) {
        super()

        // Store configuration
        this.config = config
        this.options = options

        // Initialize core modules
        this._initializeModules(endpoint, options)

        // Legacy compatibility properties
        this._initializeLegacyProperties()

        logger.info('SPARQLStore initialized')
    }

    /**
     * Initialize all the modular components
     */
    _initializeModules(endpoint, options) {
        // Extract common configuration
        const credentials = {
            user: options.user || 'admin',
            password: options.password || 'admin'
        }
        const graphName = options.graphName
        if (!graphName) {
            throw new Error('graphName must be provided in options.graphName - check config.json graphName setting')
        }
        const dimension = options.dimension
        if (!dimension) {
            throw new Error('Embedding dimension must be provided in options.dimension - check config.json embeddingDimension setting')
        }

        // Initialize SPARQL execution module
        this.sparqlExecute = new SPARQLExecute(endpoint, credentials, graphName)

        // Initialize vectors module
        this.vectors = new Vectors(dimension)

        // Initialize search module
        this.searchModule = new Search(this.sparqlExecute, this.vectors, graphName)

        // Initialize cache module
        this.cache = new SPARQLCache({
            cacheTimeoutMs: options.cacheTimeoutMs,
            maxCacheSize: options.maxCacheSize
        })

        // Initialize store module
        this.storeModule = new Store(this.sparqlExecute, graphName, dimension)

        // Initialize ZPT module
        this.zpt = new ZPT(this.sparqlExecute, graphName)

        // Initialize graph module
        this.graph = new GraphModule(this.sparqlExecute, graphName, options.baseUri)

        // Initialize services that modules may need
        this.queryService = new SPARQLQueryService()
        this.templateLoader = new SPARQLTemplateLoader()

        // Store references for easy access
        this.endpoint = this.sparqlExecute.getEndpoint()
        this.graphName = graphName
        this.dimension = dimension
        this.credentials = credentials
    }

    /**
     * Initialize legacy properties for backward compatibility
     */
    _initializeLegacyProperties() {
        // Memory cache properties (delegated to cache module)
        Object.defineProperty(this, 'shortTermMemory', {
            get: () => this.cache.getMemoryData().shortTermMemory,
            set: (value) => this.cache.setShortTermMemory(value)
        })

        Object.defineProperty(this, 'longTermMemory', {
            get: () => this.cache.getMemoryData().longTermMemory,
            set: (value) => this.cache.setLongTermMemory(value)
        })

        Object.defineProperty(this, 'embeddings', {
            get: () => this.cache.getMemoryData().embeddings,
            set: (value) => this.cache.setEmbeddings(value)
        })

        // FAISS properties (delegated to vectors module)
        Object.defineProperty(this, 'index', {
            get: () => this.vectors.index
        })

        Object.defineProperty(this, 'faissToMemoryMap', {
            get: () => this.vectors.faissToMemoryMap
        })

        Object.defineProperty(this, 'memoryToFaissMap', {
            get: () => this.vectors.memoryToFaissMap
        })

        // Transaction properties (delegated to sparqlExecute module)
        Object.defineProperty(this, 'inTransaction', {
            get: () => this.sparqlExecute.inTransaction
        })

        Object.defineProperty(this, 'transactionId', {
            get: () => this.sparqlExecute.transactionId
        })

        // Graph properties (delegated to graph module)
        // Add nodes method as a property that returns a function
        this.graph.nodes = () => this.graph.graph.nodes()
    }

    // ========== SPARQL Execution Methods (delegate to SPARQLExecute) ==========

    async executeSparqlQuery(query, endpoint = null) {
        return this.sparqlExecute.executeSparqlQuery(query, endpoint)
    }

    async executeSparqlUpdate(update, endpoint = null) {
        return this.sparqlExecute.executeSparqlUpdate(update, endpoint)
    }

    async beginTransaction() {
        return this.sparqlExecute.beginTransaction()
    }

    async commitTransaction() {
        return this.sparqlExecute.commitTransaction()
    }

    async rollbackTransaction() {
        return this.sparqlExecute.rollbackTransaction()
    }

    isInTransaction() {
        return this.sparqlExecute.isInTransaction()
    }

    async verify() {
        return this.sparqlExecute.verify()
    }

    // ========== Vector Operations (delegate to Vectors) ==========

    calculateCosineSimilarity(vecA, vecB) {
        return this.vectors.calculateCosineSimilarity(vecA, vecB)
    }

    addEmbedding(embedding, memoryIndex) {
        return this.vectors.addEmbedding(embedding, memoryIndex)
    }

    rebuildIndex(embeddings) {
        return this.vectors.rebuildIndex(embeddings)
    }

    searchIndex(queryEmbedding, k = 10) {
        return this.vectors.searchIndex(queryEmbedding, k)
    }

    isValidEmbedding(embedding) {
        return this.vectors.isValidEmbedding(embedding)
    }

    adjustEmbeddingLength(embedding, targetLength) {
        return this.vectors.adjustEmbeddingLength(embedding, targetLength)
    }

    // ========== Search Methods (delegate to Search) ==========

    async findSimilarElements(queryEmbedding, limit, threshold, filters) {
        return this.searchModule.findSimilarElements(queryEmbedding, limit, threshold, filters)
    }

    async search(queryEmbedding, limit, threshold) {
        return this.searchModule.search(queryEmbedding, limit, threshold)
    }

    // ========== Cache Management (delegate to SPARQLCache) ==========

    async loadHistory() {
        return this.storeModule.loadHistory()
    }

    async saveMemoryToHistory() {
        return this.storeModule.saveMemoryToHistory()
    }

    clearMemoryCache() {
        return this.cache.clearMemoryCache()
    }

    getMemoryCacheStats() {
        return this.cache.getMemoryCacheStats()
    }

    // ========== Store Operations (delegate to Store) ==========

    async store(data) {
        return this.storeModule.store(data)
    }

    async storeEntity(entity) {
        return this.storeModule.storeEntity(entity)
    }

    async storeSemanticUnit(unit) {
        return this.storeModule.storeSemanticUnit(unit)
    }

    async storeRelationship(relationship) {
        return this.storeModule.storeRelationship(relationship)
    }

    async storeCommunity(community) {
        return this.storeModule.storeCommunity(community)
    }

    async storeConcepts(concepts) {
        return this.storeModule.storeConcepts(concepts)
    }

    // ========== ZPT Operations (delegate to ZPT) ==========

    async queryByZoomLevel(queryConfig) {
        return this.zpt.queryByZoomLevel(queryConfig)
    }

    getAvailableZoomLevels() {
        return this.zpt.getAvailableZoomLevels()
    }

    isValidZoomLevel(level) {
        return this.zpt.isValidZoomLevel(level)
    }

    createDrillDownQuery(fromLevel, entityId) {
        return this.zpt.createDrillDownQuery(fromLevel, entityId)
    }

    createZoomOutQuery(fromLevel, entityIds) {
        return this.zpt.createZoomOutQuery(fromLevel, entityIds)
    }

    // ========== Graph Operations (delegate to Graph) ==========

    async traverseGraph(startNode, depth, options) {
        return this.graph.traverseGraph(startNode, depth, options)
    }

    async validateCorpus() {
        return this.graph.validateCorpus()
    }

    updateGraph(concepts) {
        return this.graph.updateGraph(concepts)
    }

    getGraphStats() {
        return this.graph.getGraphStats()
    }

    isGraphConnected() {
        return this.graph.isGraphConnected()
    }

    getMostCentralNodes(count) {
        return this.graph.getMostCentralNodes(count)
    }

    findCommunities() {
        return this.graph.findCommunities()
    }

    // ========== Missing Methods Required by MemoryManager ==========

    async _ensureMemoryLoaded() {
        // Delegate to cache module to check if memory needs reloading
        const cacheStats = this.cache.getCacheStats().memoryCache
        const now = Date.now()

        if (cacheStats.loaded && (now - cacheStats.lastLoaded) < this.cache.cacheTimeoutMs) {
            return // Cache is still valid
        }

        logger.info('Loading memory data from SPARQL store...')

        try {
            // Load memory interactions using store module
            const [shortTerm, longTerm] = await this.storeModule.loadHistory()

            // Update cache with loaded data
            this.cache.setShortTermMemory(shortTerm)
            this.cache.setLongTermMemory(longTerm)

            // Rebuild in-memory structures
            const embeddings = shortTerm.map(item => item.embedding)
            const timestamps = shortTerm.map(item => item.timestamp)
            const accessCounts = shortTerm.map(item => item.accessCount || 1)
            const conceptsList = shortTerm.map(item => item.concepts || [])

            // Update cache arrays
            this.cache.setEmbeddings(embeddings)
            this.cache.setTimestamps(timestamps)
            this.cache.setAccessCounts(accessCounts)
            this.cache.setConceptsList(conceptsList)

            // Rebuild FAISS index using vectors module
            if (embeddings.length > 0) {
                const stats = this.vectors.rebuildIndex(embeddings)
                logger.info(`Rebuilt FAISS index: ${stats.addedCount} valid embeddings added, ${stats.skippedCount} invalid embeddings skipped`)
            }

            // Load concept graph using graph module
            await this.graph.loadGraphFromStore()

            // Mark cache as loaded
            this.cache.markLoaded()

            logger.info(`Loaded ${shortTerm.length} short-term and ${longTerm.length} long-term memories`)
        } catch (error) {
            logger.error('Failed to load memory data:', error)
            throw error
        }
    }

    async storeWithMemory(interaction) {
        return this.storeModule.store(interaction)
    }

    async retrieve(queryEmbedding, queryConcepts, similarityThreshold, excludeLastN) {
        // Convert threshold from 0-100 scale to 0-1 scale for search module
        const normalizedThreshold = similarityThreshold > 1 ? similarityThreshold / 100 : similarityThreshold;
        return this.searchModule.search(queryEmbedding, 50, normalizedThreshold);
    }

    async storeDocument(documentData) {
        return this.storeModule.store(documentData)
    }

    async cleanup() {
        // Cleanup all modules
        if (this.graph) this.graph.cancelScheduledPersistence()
        if (this.cache) this.cache.clearQueryCache()
        logger.info('SPARQLStore cleanup completed')
    }

    async close() {
        await this.dispose()
    }

    // ========== Legacy Methods for Compatibility ==========

    getGraphName() {
        return this.graphName
    }

    getEndpoint() {
        return this.endpoint
    }

    getDimension() {
        return this.dimension
    }

    // ========== Disposal ==========

    async dispose() {
        // Dispose all modules in reverse order of initialization
        if (this.graph) await this.graph.dispose()
        if (this.zpt) this.zpt.dispose()
        if (this.storeModule) this.storeModule.dispose()
        if (this.cache) this.cache.dispose()
        if (this.searchModule) this.searchModule.dispose()
        if (this.vectors) this.vectors.dispose()
        if (this.sparqlExecute) await this.sparqlExecute.dispose()

        logger.info('SPARQLStore disposed')
    }
}