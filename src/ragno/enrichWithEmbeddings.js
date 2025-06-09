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
  const rdfManager = new RDFGraphManager()
  const resultDataset = rdf.dataset()
  
  // Copy existing dataset
  if (graphData.dataset) {
    for (const quad of graphData.dataset) {
      resultDataset.add(quad)
    }
  }
  
  // Ensure ragno namespace is registered
  if (!rdfManager.ns.ragno) {
    rdfManager.ns.ragno = rdf.namespace('http://purl.org/stuff/ragno/')
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
            
            // Store in RDF dataset
            try {
              storeEmbeddingInRDF(node.uri, embeddingData, resultDataset, rdfManager)
            } catch (error) {
              logger.warn(`Failed to store embedding for ${node.uri}:`, error.message)
              // Continue with other nodes even if one fails
            }
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
    
    // Get embedding dimensions from the embedding handler
    // For nomic-embed-text, we know it's 768 dimensions
    const embeddingDimensions = 768
    
    // Log the embedding dimensions for debugging
    logger.debug(`Initializing vector index with ${embeddingDimensions} dimensions`)
    
    const vectorIndex = new VectorIndex({
      dimension: embeddingDimensions, // Note: should be 'dimension' not 'dimensions'
      maxElements: opts.maxElements || 1000,
      efConstruction: opts.efConstruction || 200,
      M: opts.M || 16
    })
    
    // Add nodes to vector index with proper error handling
    let indexedCount = 0
    for (const [nodeUri, embeddingData] of embeddings) {
      try {
        if (!embeddingData.vector) {
          logger.warn(`Skipping node ${nodeUri}: No embedding vector found`)
          continue
        }
        
        if (embeddingData.vector.length !== embeddingDimensions) {
          logger.warn(`Skipping node ${nodeUri}: Expected ${embeddingDimensions} dimensions, got ${embeddingData.vector.length}`)
          continue
        }
        
        await vectorIndex.addNode(nodeUri, embeddingData.vector, embeddingData.metadata)
        indexedCount++
      } catch (error) {
        logger.warn(`Failed to add node to index for ${nodeUri}:`, error.message)
      }
    }
    
    logger.info(`Built vector index with ${indexedCount} vectors`)
    
    // Phase 4: Generate similarity links
    const similarityLinks = []
    
    // If no nodes were indexed, skip similarity search
    if (indexedCount === 0) {
      logger.warn('No nodes were indexed, skipping similarity search')
      return {
        vectorIndex,
        embeddings: Object.fromEntries(embeddings),
        similarityLinks: [],
        dataset: rdfManager.dataset
      }
    }
    
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
    
    // Phase 5: Save index (optimization happens automatically during insertion)
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
  
  // Debug: Log available graph data properties
  logger.debug('Graph data keys:', Object.keys(graphData))
  if (graphData.units) {
    logger.debug(`Found ${graphData.units.length} units`)
    if (graphData.units.length > 0) {
      const sampleUnit = graphData.units[0]
      logger.debug('Sample unit properties:', Object.keys(sampleUnit))
      if (typeof sampleUnit.getContent === 'function') {
        logger.debug('Sample unit content:', sampleUnit.getContent())
      }
    }
  }
  
  // Process units (ragno:Unit)
  logger.debug(`Looking for units. Type set has 'ragno:Unit': ${typeSet.has('ragno:Unit')}, graphData.units exists: ${!!graphData.units}`)
  if (typeSet.has('ragno:Unit') && graphData.units) {
    for (const unit of graphData.units) {
      try {
        // Ensure we have content to embed
        const content = unit.getContent ? unit.getContent() : '';
        const summary = unit.getSummary ? unit.getSummary() : '';
        
        // Generate a URI if not available
        let uri;
        if (unit.getURI) {
          const uriObj = unit.getURI();
          uri = typeof uriObj === 'string' ? uriObj : (uriObj?.value || null);
        }
        
        if (!uri) {
          // Generate a deterministic URI based on content hash
          const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
          uri = `unit:${contentHash}`;
        }
        
        // Only include units with sufficient content
        if ((content || summary) && uri) {
          nodes.push({
            uri: uri,
            type: 'ragno:Unit',
            content: content,
            summary: summary || (content ? content.substring(0, 200) + '...' : ''),
            object: unit
          });
        } else {
          logger.warn(`Skipping unit - missing content and summary or URI:`, { 
            hasContent: !!content, 
            hasSummary: !!summary,
            hasUri: !!uri,
            uri: uri
          });
        }
      } catch (error) {
        logger.error('Error processing unit:', error);
      }
    }
  }
  
  // Process attributes (ragno:Attribute)
  if (typeSet.has('ragno:Attribute') && graphData.attributes) {
    for (const attribute of graphData.attributes) {
      try {
        let uri;
        if (attribute.getURI) {
          const uriObj = attribute.getURI();
          uri = typeof uriObj === 'string' ? uriObj : (uriObj?.value || null);
        }
        
        if (!uri) {
          const content = attribute.getContent ? attribute.getContent() : '';
          const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
          uri = `attr:${contentHash}`;
        }
        
        const content = attribute.getContent ? attribute.getContent() : '';
        const category = attribute.getCategory ? attribute.getCategory() : 'Attribute';
        
        nodes.push({
          uri: uri,
          type: 'ragno:Attribute',
          content: content,
          summary: `${category}: ${content.substring(0, 100)}`,
          object: attribute
        });
      } catch (error) {
        logger.error('Error processing attribute:', error);
      }
    }
  }
  
  // Process communities (ragno:CommunityElement)
  if (typeSet.has('ragno:CommunityElement') && graphData.communities) {
    for (const community of graphData.communities) {
      try {
        let uri;
        if (community.getURI) {
          const uriObj = community.getURI();
          uri = typeof uriObj === 'string' ? uriObj : (uriObj?.value || null);
        }
        
        if (!uri) {
          const summary = community.getSummary ? community.getSummary() : '';
          const contentHash = require('crypto').createHash('md5').update(summary).digest('hex');
          uri = `comm:${contentHash}`;
        }
        
        const summary = community.getSummary ? community.getSummary() : 'Community';
        
        nodes.push({
          uri: uri,
          type: 'ragno:CommunityElement',
          content: summary,
          summary: summary,
          object: community
        });
      } catch (error) {
        logger.error('Error processing community:', error);
      }
    }
  }
  
  // Process text elements (ragno:TextElement) - if available
  if (typeSet.has('ragno:TextElement') && graphData.textElements) {
    for (const textElement of graphData.textElements) {
      try {
        let uri;
        if (textElement.getURI) {
          const uriObj = textElement.getURI();
          uri = typeof uriObj === 'string' ? uriObj : (uriObj?.value || null);
        }
        
        if (!uri) {
          const content = textElement.getContent ? textElement.getContent() : '';
          const contentHash = require('crypto').createHash('md5').update(content).digest('hex');
          uri = `text:${contentHash}`;
        }
        
        const content = textElement.getContent ? textElement.getContent() : '';
        const summary = textElement.getSummary ? textElement.getSummary() : (content ? content.substring(0, 200) : '');
        
        nodes.push({
          uri: uri,
          type: 'ragno:TextElement',
          content: content,
          summary: summary,
          object: textElement
        });
      } catch (error) {
        logger.error('Error processing text element:', error);
      }
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
  
  // Clean up the text
  embeddingText = embeddingText.trim()
  
  if (!embeddingText) {
    logger.debug(`Skipping embedding for ${node.uri}: no text content available`)
    return null
  }
  
  // Debug log the first few characters of the text
  logger.debug(`Generating embedding for ${node.uri} with text: ${embeddingText.substring(0, 50)}...`)
  
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
  try {
    const ns = rdfManager.ns // Get namespaces from manager
    const quad = rdf.quad // Use rdf-ext quad directly
    const node = rdf.namedNode(nodeUri)
    
    // Store embedding metadata
    dataset.add(quad(
      node,
      rdf.namedNode(ns.ragno('hasEmbedding').value),
      rdf.literal('true', rdf.namedNode(ns.xsd('boolean').value))
    ))
    
    dataset.add(quad(
      node,
      rdf.namedNode(ns.ragno('embeddingDimensions').value),
      rdf.literal(embeddingData.vector.length, rdf.namedNode(ns.xsd('integer').value))
    ))
    
    dataset.add(quad(
      node,
      rdf.namedNode(ns.ragno('embeddingTimestamp').value),
      rdf.literal(embeddingData.metadata.timestamp, rdf.namedNode(ns.xsd('dateTime').value))
    ))
    
    // Store node type for search filtering
    dataset.add(quad(
      node,
      rdf.namedNode(ns.ragno('embeddingNodeType').value),
      rdf.literal(embeddingData.metadata.nodeType)
    ))
    
    logger.debug(`Stored embedding metadata for ${nodeUri}`)
  } catch (error) {
    logger.error(`Failed to store embedding in RDF for ${nodeUri}:`, error)
    throw error
  }
}

/**
 * Compute similarity links between nodes
 * @param {Map} embeddings - Map of embeddings
 * @param {Object} vectorIndex - Vector index for similarity search
 * @param {Object} options - Similarity options
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF manager
 * @returns {Promise<Object>} Similarity statistics
 */
async function computeSimilarityLinks(embeddings, vectorIndex, options, dataset, rdfManager) {
  const processedPairs = new Set()
  const similarityLinks = []
  
  logger.info(`Computing similarities for ${embeddings.size} nodes with threshold ${options.similarityThreshold}...`)
  
  // Track all nodes to ensure we don't miss any
  const allNodeUris = Array.from(embeddings.keys())
  logger.debug(`Total nodes to process: ${allNodeUris.length}`)
  
  for (const [nodeUri, embeddingData] of embeddings) {
    try {
      // Find similar nodes using vector index
      const k = Math.min(10, embeddings.size - 1)
      const searchResults = await vectorIndex.search(
        embeddingData.vector,
        k, // k = min(10, total_nodes-1)
        { minScore: options.similarityThreshold }
      )
      
      logger.debug(`Found ${searchResults.length} similar nodes for ${nodeUri} (k=${k}, minScore=${options.similarityThreshold})`)
      
      // Process similar nodes
      for (const result of searchResults) {
        // Extract node URI and score from the result
        let similarUri, score;
        
        // Handle different possible result formats
        if (result.uri) {
          // Format: { uri: string, similarity: number, ... }
          similarUri = result.uri;
          score = result.similarity || 0;
        } else if (result.node && result.node.uri) {
          // Format: { node: { uri: string, ... }, similarity: number, ... }
          similarUri = result.node.uri;
          score = result.similarity || 0;
        } else if (result.id) {
          // Format: { id: string, similarity: number, ... }
          similarUri = result.id;
          score = result.similarity || 0;
        } else {
          logger.debug(`Skipping unrecognized result format: ${JSON.stringify(result)}`);
          continue;
        }
        
        // Skip self-similarity or invalid URIs
        if (!similarUri) {
          logger.debug(`Skipping result with missing URI: ${JSON.stringify(result)}`);
          continue;
        }
        
        if (similarUri === nodeUri) {
          logger.debug(`Skipping self-similarity for ${nodeUri}`);
          continue;
        }
        
        // Check if this pair has already been processed
        const pairKey = [nodeUri, similarUri].sort().join('|');
        if (processedPairs.has(pairKey)) {
          logger.debug(`Skipping duplicate pair: ${nodeUri} <-> ${similarUri}`);
          continue;
        }
        
        // Only add if we don't already have this link (to avoid duplicates)
        const existingLink = similarityLinks.find(link => 
          (link.source === nodeUri && link.target === similarUri) ||
          (link.source === similarUri && link.target === nodeUri)
        );
        
        if (!existingLink) {
          logger.debug(`Adding similarity link: ${nodeUri} -> ${similarUri} (score: ${score.toFixed(4)})`);
          similarityLinks.push({
            source: nodeUri,
            target: similarUri,
            score: score,
            type: 'similarity',
            bidirectional: false
          });
          processedPairs.add(pairKey);
        }
        
        // Check if cross-type linking is allowed
        const targetEmbedding = embeddings.get(similarUri)
        if (!targetEmbedding) {
          logger.debug(`No embedding found for ${similarUri}, skipping`)
          continue
        }
        
        if (!options.linkAcrossTypes && 
            embeddingData.metadata.nodeType !== targetEmbedding.metadata.nodeType) {
          logger.debug(`Skipping cross-type link between ${embeddingData.metadata.nodeType} and ${targetEmbedding.metadata.nodeType}`)
          continue
        }
        
        try {
          // Create similarity relationship in RDF
          const relationshipId = `sim_${similarityLinks.length}`
          const Relationship = (await import('./Relationship.js')).default
          
          const relationship = new Relationship(rdfManager, {
            id: relationshipId,
            sourceUri: nodeUri,
            targetUri: similarUri,
            type: 'similar_to',
            content: `Vector similarity: ${score.toFixed(4)}`,
            weight: score,
            bidirectional: true,
            provenance: 'HNSW vector similarity'
          })
          
          // Export relationship to dataset
          relationship.exportToDataset(dataset)
          
          // Add to similarity links
          similarityLinks.push({
            source: nodeUri,
            target: similarUri,
            score: score,
            sourceType: embeddingData.metadata?.nodeType || 'unknown',
            targetType: targetEmbedding.metadata?.nodeType || 'unknown',
            relationship: relationship
          })
          
          logger.debug(`Created similarity link between ${nodeUri} and ${similarUri} (score: ${score.toFixed(4)})`)
          
        } catch (error) {
          logger.warn(`Failed to create similarity relationship between ${nodeUri} and ${similarUri}:`, error.message)
          continue
        }
      }
      
    } catch (error) {
      logger.warn(`Failed to compute similarities for ${nodeUri}:`, error.message)
    }
  }
  
  // Calculate statistics
  const totalLinks = similarityLinks.length
  const averageScore = totalLinks > 0 ? 
    similarityLinks.reduce((sum, link) => sum + link.score, 0) / totalLinks : 0
  
  logger.info(`Created ${totalLinks} similarity links with average score: ${averageScore.toFixed(4)}`)
  
  return {
    links: similarityLinks,
    totalPairsProcessed: processedPairs.size,
    averageSimilarity: averageScore,
    totalLinks: totalLinks
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