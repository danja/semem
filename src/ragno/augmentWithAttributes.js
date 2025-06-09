/**
 * Ragno: Node Importance-Based Augmentation - RDF-Ext Version
 * 
 * This module selects important entities and generates comprehensive attribute
 * summaries using advanced graph algorithms and LLM analysis. It integrates
 * with the ragno search system to create rich, searchable entity profiles.
 */

import rdf from 'rdf-ext'
import Attribute from './Attribute.js'
import RDFGraphManager from './core/RDFGraphManager.js'
import NamespaceManager from './core/NamespaceManager.js'
import { GraphAnalytics } from './algorithms/index.js'
import { logger } from '../Utils.js'

/**
 * Augment entities with comprehensive attributes using graph analysis and LLM
 * @param {Object} graphData - Decomposition results with RDF dataset
 * @param {Object} llmHandler - LLM handler instance
 * @param {Object} [options] - Augmentation options
 * @returns {Promise<{attributes: Attribute[], dataset: Dataset, statistics: Object}>}
 */
export async function augmentWithAttributes(graphData, llmHandler, options = {}) {
  const startTime = Date.now()
  logger.info('Starting entity attribute augmentation...')
  
  const opts = {
    // Selection criteria
    topK: options.topK || 10,
    importanceMethod: options.importanceMethod || 'hybrid', // 'degree', 'kcore', 'centrality', 'hybrid'
    minImportanceScore: options.minImportanceScore || 0.1,
    
    // Attribute generation
    attributeTypes: options.attributeTypes || [
      'overview', 'characteristics', 'relationships', 'context', 'significance'
    ],
    maxContextLength: options.maxContextLength || 2000,
    includeEvidence: options.includeEvidence !== false,
    
    // Quality control
    minAttributeLength: options.minAttributeLength || 50,
    maxAttributeLength: options.maxAttributeLength || 500,
    confidenceThreshold: options.confidenceThreshold || 0.3,
    
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
    // Phase 1: Analyze graph structure to identify important entities
    const importantEntities = await identifyImportantEntities(
      graphData, 
      opts.importanceMethod, 
      opts.topK,
      opts.minImportanceScore
    )
    
    logger.info(`Selected ${importantEntities.length} important entities for augmentation`)
    
    // Phase 2: Generate comprehensive attributes for each important entity
    const attributes = []
    const attributeStats = {
      totalGenerated: 0,
      byType: new Map(),
      averageLength: 0,
      averageConfidence: 0
    }
    
    for (const entityData of importantEntities) {
      logger.debug(`Augmenting entity: ${entityData.entity.getPreferredLabel()}`)
      
      // Gather comprehensive context for the entity
      const entityContext = await gatherEntityContext(entityData.entity, graphData, opts)
      
      // Generate multiple types of attributes
      for (const attributeType of opts.attributeTypes) {
        try {
          const attributeData = await generateEntityAttribute(
            entityData.entity,
            entityContext,
            attributeType,
            llmHandler,
            opts
          )
          
          if (attributeData && attributeData.content.length >= opts.minAttributeLength) {
            // Create RDF-based Attribute
            const attribute = new Attribute(rdfManager, {
              id: `attr_${entityData.entity.getPreferredLabel()}_${attributeType}_${attributes.length}`,
              entity: entityData.entity.getURI(),
              category: attributeType,
              content: attributeData.content,
              confidence: attributeData.confidence,
              keywords: attributeData.keywords || [],
              evidence: attributeData.evidence || [],
              temporal: attributeData.temporal || null,
              provenance: `LLM-generated ${attributeType} attribute`
            })
            
            attributes.push(attribute)
            attribute.exportToDataset(resultDataset)
            
            // Update statistics
            attributeStats.totalGenerated++
            const typeCount = attributeStats.byType.get(attributeType) || 0
            attributeStats.byType.set(attributeType, typeCount + 1)
            attributeStats.averageLength = (attributeStats.averageLength * (attributes.length - 1) + attributeData.content.length) / attributes.length
            attributeStats.averageConfidence = (attributeStats.averageConfidence * (attributes.length - 1) + attributeData.confidence) / attributes.length
            
            logger.debug(`Generated ${attributeType} attribute: ${attributeData.content.length} chars, confidence: ${attributeData.confidence}`)
          }
          
        } catch (error) {
          logger.warn(`Failed to generate ${attributeType} attribute for ${entityData.entity.getPreferredLabel()}:`, error.message)
        }
      }
    }
    
    // Phase 3: Create cross-attribute relationships and insights
    await createAttributeRelationships(attributes, resultDataset, rdfManager)
    
    const processingTime = Date.now() - startTime
    logger.info(`Attribute augmentation completed in ${processingTime}ms: ${attributes.length} attributes generated`)
    
    return {
      attributes,
      dataset: resultDataset,
      statistics: {
        processingTime,
        entitiesProcessed: importantEntities.length,
        attributesGenerated: attributes.length,
        attributeStats,
        originalStats: graphData.statistics
      }
    }
    
  } catch (error) {
    logger.error('Attribute augmentation failed:', error)
    throw error
  }
}

/**
 * Identify important entities using graph analysis algorithms
 * @param {Object} graphData - Graph data with entities and relationships
 * @param {string} method - Importance calculation method
 * @param {number} topK - Number of top entities to select
 * @param {number} minScore - Minimum importance score threshold
 * @returns {Promise<Array>} Array of important entity data objects
 */
async function identifyImportantEntities(graphData, method, topK, minScore) {
  logger.debug(`Analyzing entity importance using method: ${method}`)
  
  const { entities, dataset } = graphData
  const entityScores = new Map()
  
  // Initialize scores
  for (const entity of entities) {
    entityScores.set(entity.getURI(), {
      entity: entity,
      degreeScore: 0,
      kcoreScore: 0,
      centralityScore: 0,
      compositeScore: 0
    })
  }
  
  try {
    // Run graph algorithms for importance calculation
    const graphAnalytics = new GraphAnalytics()
    const graph = graphAnalytics.buildGraphFromRDF(dataset)
    
    if (graph.nodes.size === 0) {
      logger.warn('Empty graph for importance analysis')
      return entities.slice(0, topK).map(entity => ({ entity, importance: 0.5 }))
    }
    
    // Calculate degree-based importance
    const degreeStats = graphAnalytics.computeGraphStatistics(graph)
    const maxDegree = Math.max(...Array.from(degreeStats.degreeDistribution.values()))
    
    for (const [nodeUri, degree] of degreeStats.degreeDistribution) {
      if (entityScores.has(nodeUri)) {
        entityScores.get(nodeUri).degreeScore = degree / maxDegree
      }
    }
    
    // Calculate k-core based importance if graph is large enough
    if (graph.nodes.size > 2) {
      const kcoreResults = graphAnalytics.computeKCore(graph)
      const maxCore = Math.max(...Array.from(kcoreResults.coreNumbers.values()))
      
      if (maxCore > 0) {
        for (const [nodeUri, coreNumber] of kcoreResults.coreNumbers) {
          if (entityScores.has(nodeUri)) {
            entityScores.get(nodeUri).kcoreScore = coreNumber / maxCore
          }
        }
      }
    }
    
    // Calculate centrality for smaller graphs
    if (graph.nodes.size <= 500) {
      const centralityResults = graphAnalytics.computeBetweennessCentrality(graph)
      const maxCentrality = Math.max(...Array.from(centralityResults.centrality.values()))
      
      if (maxCentrality > 0) {
        for (const [nodeUri, centrality] of centralityResults.centrality) {
          if (entityScores.has(nodeUri)) {
            entityScores.get(nodeUri).centralityScore = centrality / maxCentrality
          }
        }
      }
    }
    
    // Calculate composite scores based on method
    for (const [uri, scores] of entityScores) {
      switch (method) {
        case 'degree':
          scores.compositeScore = scores.degreeScore
          break
        case 'kcore':
          scores.compositeScore = scores.kcoreScore
          break
        case 'centrality':
          scores.compositeScore = scores.centralityScore
          break
        case 'hybrid':
        default:
          scores.compositeScore = (
            scores.degreeScore * 0.4 +
            scores.kcoreScore * 0.4 +
            scores.centralityScore * 0.2
          )
          break
      }
    }
    
    // Sort by composite score and filter by minimum threshold
    const importantEntities = Array.from(entityScores.values())
      .filter(data => data.compositeScore >= minScore)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, topK)
      .map(data => ({
        entity: data.entity,
        importance: data.compositeScore,
        degreeScore: data.degreeScore,
        kcoreScore: data.kcoreScore,
        centralityScore: data.centralityScore
      }))
    
    logger.debug(`Selected ${importantEntities.length} entities with scores >= ${minScore}`)
    return importantEntities
    
  } catch (error) {
    logger.warn('Graph analysis failed, using fallback degree calculation:', error.message)
    
    // Fallback: simple degree calculation
    const connections = new Map()
    
    for (const entity of entities) {
      connections.set(entity.getURI(), 0)
    }
    
    // Count connections from relationships
    if (graphData.relationships) {
      for (const relationship of graphData.relationships) {
        const sourceUri = relationship.getSourceEntity()
        const targetUri = relationship.getTargetEntity()
        
        if (connections.has(sourceUri)) {
          connections.set(sourceUri, connections.get(sourceUri) + 1)
        }
        if (connections.has(targetUri)) {
          connections.set(targetUri, connections.get(targetUri) + 1)
        }
      }
    }
    
    const maxConnections = Math.max(...Array.from(connections.values()), 1)
    
    return entities
      .map(entity => ({
        entity: entity,
        importance: connections.get(entity.getURI()) / maxConnections
      }))
      .filter(data => data.importance >= minScore)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topK)
  }
}

/**
 * Gather comprehensive context for an entity
 * @param {Entity} entity - Entity to gather context for
 * @param {Object} graphData - Graph data
 * @param {Object} options - Context gathering options
 * @returns {Promise<Object>} Entity context object
 */
async function gatherEntityContext(entity, graphData, options) {
  const context = {
    entity: entity,
    units: [],
    relationships: [],
    relatedEntities: new Set(),
    contextText: '',
    evidence: []
  }
  
  const entityUri = entity.getURI()
  const entityLabel = entity.getPreferredLabel().toLowerCase()
  
  // Gather connected semantic units
  if (graphData.units) {
    for (const unit of graphData.units) {
      // Check if unit mentions this entity
      const unitContent = unit.getContent().toLowerCase()
      if (unitContent.includes(entityLabel) || unit.hasEntityMention(entityUri)) {
        context.units.push(unit)
        context.evidence.push(unit.getURI())
        
        if (context.contextText.length < options.maxContextLength) {
          context.contextText += unit.getContent() + '\n\n'
        }
      }
    }
  }
  
  // Gather relationships
  if (graphData.relationships) {
    for (const relationship of graphData.relationships) {
      if (relationship.getSourceEntity() === entityUri || relationship.getTargetEntity() === entityUri) {
        context.relationships.push(relationship)
        
        // Add related entities
        const otherEntityUri = relationship.getSourceEntity() === entityUri 
          ? relationship.getTargetEntity() 
          : relationship.getSourceEntity()
        context.relatedEntities.add(otherEntityUri)
        
        context.evidence.push(relationship.getURI())
      }
    }
  }
  
  // Trim context text if too long
  if (context.contextText.length > options.maxContextLength) {
    context.contextText = context.contextText.substring(0, options.maxContextLength) + '...'
  }
  
  logger.debug(`Gathered context for ${entity.getPreferredLabel()}: ${context.units.length} units, ${context.relationships.length} relationships`)
  
  return context
}

/**
 * Generate a specific type of attribute for an entity
 * @param {Entity} entity - Entity to generate attribute for
 * @param {Object} context - Entity context
 * @param {string} attributeType - Type of attribute to generate
 * @param {Object} llmHandler - LLM handler
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated attribute data
 */
async function generateEntityAttribute(entity, context, attributeType, llmHandler, options) {
  const entityName = entity.getPreferredLabel()
  const relatedEntities = Array.from(context.relatedEntities).slice(0, 5) // Limit for context
  
  // Build type-specific prompts
  const prompts = {
    overview: `Provide a comprehensive overview of ${entityName} based on the following information. Focus on who/what they are, their primary role or significance, and key characteristics.

Context: ${context.contextText}

Related entities: ${relatedEntities.join(', ')}

Write a 2-3 sentence overview:`,

    characteristics: `Describe the key characteristics, traits, and distinctive features of ${entityName} based on the provided context.

Context: ${context.contextText}

List the main characteristics in 2-3 sentences:`,

    relationships: `Summarize the key relationships and connections of ${entityName} with other entities, based on the provided information.

Context: ${context.contextText}
Related entities: ${relatedEntities.join(', ')}

Describe the main relationships in 2-3 sentences:`,

    context: `Explain the broader context, setting, or environment in which ${entityName} operates or exists.

Context: ${context.contextText}

Describe the context in 2-3 sentences:`,

    significance: `Analyze the importance and significance of ${entityName} within the broader narrative or domain.

Context: ${context.contextText}

Explain the significance in 2-3 sentences:`
  }
  
  const prompt = prompts[attributeType] || prompts.overview
  
  try {
    const response = await llmHandler.generateCompletion(prompt, {
      max_tokens: 200,
      temperature: 0.1
    })
    
    const content = response.trim()
    
    if (content.length < options.minAttributeLength) {
      logger.debug(`Generated ${attributeType} attribute too short: ${content.length} chars`)
      return null
    }
    
    // Extract keywords from the generated content
    const keywords = extractKeywords(content)
    
    // Calculate confidence based on context quality
    const confidence = calculateAttributeConfidence(context, content, options)
    
    return {
      content: content,
      confidence: confidence,
      keywords: keywords,
      evidence: context.evidence,
      temporal: null // Could be enhanced with temporal extraction
    }
    
  } catch (error) {
    logger.warn(`Failed to generate ${attributeType} attribute for ${entityName}:`, error.message)
    return null
  }
}

/**
 * Extract keywords from attribute content
 * @param {string} content - Attribute content
 * @returns {Array<string>} Extracted keywords
 */
function extractKeywords(content) {
  // Simple keyword extraction - could be enhanced with NLP
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !isStopWord(word))
  
  // Get unique words and sort by frequency
  const wordCounts = new Map()
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
  }
  
  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

/**
 * Check if word is a stop word
 * @param {string} word - Word to check
 * @returns {boolean} True if stop word
 */
function isStopWord(word) {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might'
  ])
  return stopWords.has(word)
}

/**
 * Calculate confidence score for generated attribute
 * @param {Object} context - Entity context
 * @param {string} content - Generated content
 * @param {Object} options - Calculation options
 * @returns {number} Confidence score 0-1
 */
function calculateAttributeConfidence(context, content, options) {
  let confidence = 0.5 // Base confidence
  
  // Factor in context quality
  if (context.units.length > 0) {
    confidence += Math.min(context.units.length * 0.1, 0.3)
  }
  
  if (context.relationships.length > 0) {
    confidence += Math.min(context.relationships.length * 0.05, 0.2)
  }
  
  // Factor in content quality
  if (content.length > options.minAttributeLength * 2) {
    confidence += 0.1
  }
  
  // Factor in evidence
  if (context.evidence.length > 2) {
    confidence += 0.1
  }
  
  return Math.min(confidence, 1.0)
}

/**
 * Create relationships between attributes for cross-referencing
 * @param {Array<Attribute>} attributes - Generated attributes
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF manager
 */
async function createAttributeRelationships(attributes, dataset, rdfManager) {
  logger.debug('Creating cross-attribute relationships...')
  
  // Group attributes by entity
  const entityAttributes = new Map()
  for (const attribute of attributes) {
    const entityUri = attribute.getEntity()
    if (!entityAttributes.has(entityUri)) {
      entityAttributes.set(entityUri, [])
    }
    entityAttributes.get(entityUri).push(attribute)
  }
  
  // Create relationships within entity attribute groups
  for (const [entityUri, entityAttrs] of entityAttributes) {
    if (entityAttrs.length < 2) continue
    
    for (let i = 0; i < entityAttrs.length; i++) {
      for (let j = i + 1; j < entityAttrs.length; j++) {
        const attr1 = entityAttrs[i]
        const attr2 = entityAttrs[j]
        
        // Create complementary relationship
        const relationship = new (await import('./Relationship.js')).default(rdfManager, {
          id: `attr_rel_${i}_${j}`,
          sourceEntity: attr1.getURI(),
          targetEntity: attr2.getURI(),
          relationshipType: 'complements',
          content: `${attr1.getCategory()} complements ${attr2.getCategory()}`,
          weight: 0.5,
          bidirectional: true
        })
        
        relationship.exportToDataset(dataset)
      }
    }
  }
  
  logger.debug(`Created cross-attribute relationships for ${entityAttributes.size} entities`)
}
