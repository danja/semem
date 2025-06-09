/**
 * Ragno: Vector Enrichment and Index Building - RDF-Ext Version
 * 
 * This module generates embeddings for retrievable RDF nodes and builds
 * an HNSW vector index for efficient similarity search. It integrates with
 * the ragno search system to enable vector-based retrieval.
 */

import rdf from 'rdf-ext'
import RDFGraphManager from './core/RDFGraphManager.js'
import NamespaceManager from './core/NamespaceManager.js'
import { VectorIndex } from './search/index.js'
import { logger } from '../Utils.js'

/**
 * Enrich graph with vector embeddings and build searchable index
 * @param {Object} graphData - Graph data with RDF dataset
 * @param {Object} embeddingHandler - Semem's EmbeddingHandler instance
 * @param {Object} [options] - Enrichment options
 * @returns {Promise<{vectorIndex: VectorIndex, embeddings: Map, similarityLinks: Array, dataset: Dataset, statistics: Object}>}
 */
export async function enrichWithEmbeddings(graphData, embeddingHandler, options = {}) {
  const startTime = Date.now()
  logger.info('Starting vector enrichment and index building...')
  
  const opts = {
    // Retrievable node types (following ragno ontology)
    retrievableTypes: options.retrievableTypes || [
      'ragno:Unit',
      'ragno:Attribute', 
      'ragno:CommunityElement',
      'ragno:TextElement'
    ],
    
    // HNSW index parameters
    indexDimensions: options.indexDimensions || 1536, // Default for text-embedding-ada-002
    maxElements: options.maxElements || 100000,
    efConstruction: options.efConstruction || 200,
    M: options.M || 16,
    
    // Similarity linking
    similarityThreshold: options.similarityThreshold || 0.7,
    maxSimilarityLinks: options.maxSimilarityLinks || 5,
    linkAcrossTypes: options.linkAcrossTypes !== false,
    
    // Processing
    batchSize: options.batchSize || 50,
    includeContentEmbeddings: options.includeContentEmbeddings !== false,
    includeSummaryEmbeddings: options.includeSummaryEmbeddings !== false,
    
    ...options
  }
  
  // Initialize RDF infrastructure
  const namespaceManager = new NamespaceManager()
  const rdfManager = new RDFGraphManager({ namespace: namespaceManager })
  const resultDataset = rdf.dataset()
  
  // Copy existing dataset
  if (graphData.dataset) {
    for (const quad of graphData.dataset) {
      resultDataset.add(quad)
    }
  }
  
  try {
    // Phase 1: Identify retrievable nodes
    const retrievableNodes = await identifyRetrievableNodes(graphData, opts.retrievableTypes)
    
    logger.info(`Found ${retrievableNodes.length} retrievable nodes for embedding`)
    
    if (retrievableNodes.length === 0) {
      logger.warn('No retrievable nodes found for embedding')
      return createEmptyResult(resultDataset, startTime)
    }
    
    // Phase 2: Generate embeddings in batches
    const embeddings = new Map()
    const embeddingStats = {
      totalGenerated: 0,
      byType: new Map(),
      averageGenerationTime: 0,
      failedEmbeddings: 0
    }
    
    logger.info('Phase 2: Generating embeddings...')
    
    for (let i = 0; i < retrievableNodes.length; i += opts.batchSize) {
      const batch = retrievableNodes.slice(i, i + opts.batchSize)
      logger.debug(`Processing batch ${Math.floor(i/opts.batchSize) + 1}/${Math.ceil(retrievableNodes.length/opts.batchSize)}`)
      
      await Promise.all(batch.map(async (node) => {
        try {
          const embeddingData = await generateNodeEmbedding(node, embeddingHandler, opts)
          
          if (embeddingData) {
            embeddings.set(node.uri, embeddingData)
            
            // Update statistics
            embeddingStats.totalGenerated++
            const typeCount = embeddingStats.byType.get(node.type) || 0
            embeddingStats.byType.set(node.type, typeCount + 1)
            
            // Store embedding in RDF
            storeEmbeddingInRDF(node.uri, embeddingData, resultDataset, rdfManager)
          }
          
        } catch (error) {
          logger.warn(`Failed to generate embedding for ${node.uri}:`, error.message)
          embeddingStats.failedEmbeddings++
        }
      }))
    }
    
    logger.info(`Generated ${embeddingStats.totalGenerated} embeddings (${embeddingStats.failedEmbeddings} failed)`)
    
    // Phase 3: Build HNSW vector index
    logger.info('Phase 3: Building HNSW vector index...')
    
    const vectorIndex = new VectorIndex({
      dimensions: opts.indexDimensions,
      maxElements: opts.maxElements,
      efConstruction: opts.efConstruction,
      M: opts.M
    })
    
    // Add embeddings to index
    let indexedCount = 0
    for (const [nodeUri, embeddingData] of embeddings) {
      try {
        await vectorIndex.addVector(nodeUri, embeddingData.vector, embeddingData.metadata)
        indexedCount++
      } catch (error) {
        logger.warn(`Failed to add vector to index for ${nodeUri}:`, error.message)
      }
    }
    
    logger.info(`Built vector index with ${indexedCount} vectors`)
    
    // Phase 4: Generate similarity links
    const similarityLinks = []
    
    if (opts.similarityThreshold > 0 && embeddings.size > 1) {
      logger.info('Phase 4: Computing similarity links...')
      
      const similarityStats = await computeSimilarityLinks(
        embeddings,
        vectorIndex,
        opts,
        resultDataset,
        rdfManager
      )
      
      similarityLinks.push(...similarityStats.links)
      logger.info(`Created ${similarityLinks.length} similarity links`)
    }
    
    // Phase 5: Optimize and save index
    await vectorIndex.optimize()
    
    const processingTime = Date.now() - startTime
    logger.info(`Vector enrichment completed in ${processingTime}ms`)
    
    return {
      vectorIndex: vectorIndex,
      embeddings: embeddings,
      similarityLinks: similarityLinks,
      dataset: resultDataset,
      statistics: {
        processingTime,
        nodesProcessed: retrievableNodes.length,
        embeddingsGenerated: embeddingStats.totalGenerated,
        embeddingStats: embeddingStats,
        vectorsIndexed: indexedCount,
        similarityLinksCreated: similarityLinks.length,
        indexStatistics: await vectorIndex.getStatistics()
      }
    }
    
  } catch (error) {
    logger.error('Vector enrichment failed:', error)
    throw error
  }
}

/**
 * Identify retrievable nodes from graph data
 * @param {Object} graphData - Graph data
 * @param {Array<string>} retrievableTypes - Types to include
 * @returns {Promise<Array>} Array of retrievable node objects
 */
async function identifyRetrievableNodes(graphData, retrievableTypes) {
  const nodes = []
  const typeSet = new Set(retrievableTypes)
  
  // Process units (ragno:Unit)
  if (typeSet.has('ragno:Unit') && graphData.units) {
    for (const unit of graphData.units) {
      nodes.push({
        uri: unit.getURI().value,
        type: 'ragno:Unit',
        content: unit.getContent(),
        summary: unit.getSummary(),
        object: unit
      })
    }
  }
  
  // Process attributes (ragno:Attribute)
  if (typeSet.has('ragno:Attribute') && graphData.attributes) {
    for (const attribute of graphData.attributes) {
      nodes.push({
        uri: attribute.getURI().value,
        type: 'ragno:Attribute',
        content: attribute.getContent(),
        summary: `${attribute.getCategory()}: ${attribute.getContent()}`,
        object: attribute
      })
    }
  }
  
  // Process communities (ragno:CommunityElement)
  if (typeSet.has('ragno:CommunityElement') && graphData.communities) {
    for (const community of graphData.communities) {
      nodes.push({
        uri: community.getURI().value,
        type: 'ragno:CommunityElement',
        content: community.getSummary(),
        summary: community.getSummary(),
        object: community
      })
    }
  }
  
  // Process text elements (ragno:TextElement) - if available
  if (typeSet.has('ragno:TextElement') && graphData.textElements) {
    for (const textElement of graphData.textElements) {
      nodes.push({
        uri: textElement.getURI().value,
        type: 'ragno:TextElement',
        content: textElement.getContent(),
        summary: textElement.getSummary() || textElement.getContent().substring(0, 200),
        object: textElement
      })
    }
  }
  
  return nodes
}

/**
 * Generate embedding for a node
 * @param {Object} node - Node object
 * @param {Object} embeddingHandler - Embedding handler
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Embedding data object
 */
async function generateNodeEmbedding(node, embeddingHandler, options) {
  // Determine what text to embed
  let embeddingText = ''
  
  if (options.includeSummaryEmbeddings && node.summary) {
    embeddingText = node.summary
  } else if (options.includeContentEmbeddings && node.content) {
    embeddingText = node.content
  } else {
    embeddingText = node.content || node.summary || ''
  }
  
  if (!embeddingText || embeddingText.trim().length < 10) {
    logger.debug(`Skipping embedding for ${node.uri}: insufficient text content`)
    return null
  }
  
  // Truncate if too long (most embedding models have token limits)
  if (embeddingText.length > 8000) {
    embeddingText = embeddingText.substring(0, 8000) + '...'
  }
  
  try {
    // Generate embedding using Semem's EmbeddingHandler
    const vector = await embeddingHandler.generateEmbedding(embeddingText)
    
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      logger.warn(`Invalid embedding generated for ${node.uri}`)
      return null
    }
    
    // Create metadata for the embedding
    const metadata = {
      nodeType: node.type,
      textLength: embeddingText.length,
      hasContent: !!node.content,
      hasSummary: !!node.summary,
      timestamp: new Date().toISOString()
    }
    
    return {
      vector: vector,
      metadata: metadata,
      textEmbedded: embeddingText.substring(0, 200) // Store sample for debugging
    }
    
  } catch (error) {
    logger.warn(`Embedding generation failed for ${node.uri}:`, error.message)
    return null
  }
}

/**
 * Store embedding information in RDF dataset
 * @param {string} nodeUri - Node URI
 * @param {Object} embeddingData - Embedding data
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF manager
 */
function storeEmbeddingInRDF(nodeUri, embeddingData, dataset, rdfManager) {
  const quad = rdfManager.createQuad
  const ns = rdfManager.getNamespaceManager()
  const uri = rdfManager.createURI(nodeUri)
  
  // Store embedding metadata
  dataset.add(quad(
    uri,
    ns.ragno('hasEmbedding'),
    rdfManager.createLiteral('true', ns.xsd.boolean)
  ))
  
  dataset.add(quad(
    uri,
    ns.ragno('embeddingDimensions'),
    rdfManager.createLiteral(embeddingData.vector.length, ns.xsd.integer)
  ))
  
  dataset.add(quad(
    uri,
    ns.ragno('embeddingTimestamp'),
    rdfManager.createLiteral(embeddingData.metadata.timestamp, ns.xsd.dateTime)
  ))
  
  // Store node type for search filtering
  dataset.add(quad(
    uri,
    ns.ragno('embeddingNodeType'),
    rdfManager.createLiteral(embeddingData.metadata.nodeType)
  ))
  
  // Note: We don't store the actual vector in RDF due to size - it's in the vector index
}

/**
 * Compute similarity links between nodes
 * @param {Map} embeddings - Map of embeddings
 * @param {VectorIndex} vectorIndex - Vector index for similarity search
 * @param {Object} options - Similarity options
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF manager
 * @returns {Promise<Object>} Similarity statistics
 */
async function computeSimilarityLinks(embeddings, vectorIndex, options, dataset, rdfManager) {
  const links = []
  const processedPairs = new Set()
  
  logger.debug(`Computing similarity links with threshold ${options.similarityThreshold}`)
  
  for (const [nodeUri, embeddingData] of embeddings) {
    try {
      // Find similar nodes using vector index
      const similarNodes = await vectorIndex.search(
        embeddingData.vector,
        options.maxSimilarityLinks + 1, // +1 because it will include self
        options.similarityThreshold
      )
      
      // Process similar nodes
      for (const similar of similarNodes) {
        const similarUri = similar.id
        
        // Skip self-similarity
        if (similarUri === nodeUri) continue
        
        // Skip if we've already processed this pair
        const pairKey = [nodeUri, similarUri].sort().join('|')
        if (processedPairs.has(pairKey)) continue
        processedPairs.add(pairKey)
        
        // Check if cross-type linking is allowed
        const targetEmbedding = embeddings.get(similarUri)
        if (!targetEmbedding) continue
        
        if (!options.linkAcrossTypes && 
            embeddingData.metadata.nodeType !== targetEmbedding.metadata.nodeType) {
          continue
        }
        
        // Create similarity relationship in RDF
        const relationshipId = `sim_${links.length}`
        const relationship = new (await import('./Relationship.js')).default(rdfManager, {
          id: relationshipId,
          sourceEntity: rdfManager.createURI(nodeUri),
          targetEntity: rdfManager.createURI(similarUri),
          relationshipType: 'similar_to',
          content: `Vector similarity: ${similar.distance.toFixed(3)}`,
          weight: similar.distance,
          bidirectional: true,
          provenance: 'HNSW vector similarity'
        })
        
        relationship.exportToDataset(dataset)
        
        links.push({
          source: nodeUri,
          target: similarUri,
          similarity: similar.distance,
          sourceType: embeddingData.metadata.nodeType,
          targetType: targetEmbedding.metadata.nodeType,
          relationship: relationship
        })
      }
      
    } catch (error) {
      logger.warn(`Failed to compute similarities for ${nodeUri}:`, error.message)
    }
  }
  
  return {
    links: links,
    totalPairsProcessed: processedPairs.size,
    averageSimilarity: links.length > 0 ? 
      links.reduce((sum, link) => sum + link.similarity, 0) / links.length : 0
  }
}

/**
 * Create empty result for cases with no retrievable nodes
 * @param {Dataset} dataset - RDF dataset
 * @param {number} startTime - Start time
 * @returns {Object} Empty result object
 */
function createEmptyResult(dataset, startTime) {
  return {
    vectorIndex: null,
    embeddings: new Map(),
    similarityLinks: [],
    dataset: dataset,
    statistics: {
      processingTime: Date.now() - startTime,
      nodesProcessed: 0,
      embeddingsGenerated: 0,
      vectorsIndexed: 0,
      similarityLinksCreated: 0
    }
  }
}

/**
 * Export enrichment results for use in search systems
 * @param {Object} enrichmentResults - Results from enrichWithEmbeddings
 * @param {string} indexPath - Path to save vector index
 * @param {Object} [options] - Export options
 * @returns {Promise<Object>} Export statistics
 */
export async function exportEnrichmentResults(enrichmentResults, indexPath, options = {}) {
  const startTime = Date.now()
  logger.info(`Exporting enrichment results to ${indexPath}`)
  
  try {
    const { vectorIndex, embeddings, dataset, statistics } = enrichmentResults
    
    // Save vector index
    if (vectorIndex) {
      await vectorIndex.save(indexPath)
      logger.info(`Vector index saved to ${indexPath}`)
    }
    
    // Optionally save embeddings as JSON for backup
    if (options.saveEmbeddingsBackup) {
      const embeddingsObj = Object.fromEntries(
        Array.from(embeddings.entries()).map(([uri, data]) => [
          uri, 
          {
            metadata: data.metadata,
            textEmbedded: data.textEmbedded
            // Note: vector is stored in index, not here
          }
        ])
      )
      
      const backupPath = indexPath.replace(/\.[^.]+$/, '_embeddings.json')
      await import('fs').then(fs => 
        fs.promises.writeFile(backupPath, JSON.stringify(embeddingsObj, null, 2))
      )
      logger.info(`Embeddings metadata saved to ${backupPath}`)
    }
    
    const exportTime = Date.now() - startTime
    
    return {
      success: true,
      exportTime: exportTime,
      indexPath: indexPath,
      vectorsExported: embeddings.size,
      originalStatistics: statistics
    }
    
  } catch (error) {
    logger.error('Export failed:', error)
    throw error
  }
}