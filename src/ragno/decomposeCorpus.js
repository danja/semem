/**
 * Ragno: Corpus Decomposition Logic (Step 1) - RDF-Ext Version
 * 
 * This module decomposes text chunks into RDF-based semantic units, entities, 
 * and relationships following the ragno ontology. It integrates with Semem's
 * LLMHandler and creates proper RDF resources for the knowledge graph.
 */

import rdf from 'rdf-ext'
import SemanticUnit from './SemanticUnit.js'
import Entity from './Entity.js'
import Relationship from './Relationship.js'
import RDFGraphManager from './core/RDFGraphManager.js'
import NamespaceManager from './core/NamespaceManager.js'
import SPARQLHelpers from '../services/sparql/SPARQLHelper.js'
import ParseHelper from '../utils/ParseHelper.js'
import { logger } from '../Utils.js'

/**
 * Decompose text chunks into RDF-based semantic units, entities, and relationships
 * @param {Array<{content: string, source: string}>} textChunks - Text chunks to decompose
 * @param {Object} llmHandler - Instance of Semem's LLMHandler
 * @param {Object} [options] - Decomposition options
 * @returns {Promise<{units: SemanticUnit[], entities: Entity[], relationships: Relationship[], dataset: Dataset}>}
 */
export async function decomposeCorpus(textChunks, llmHandler, options = {}) {
  const startTime = Date.now()
  logger.info(`Starting corpus decomposition: ${textChunks.length} chunks`)

  const opts = {
    extractRelationships: options.extractRelationships !== false,
    generateSummaries: options.generateSummaries !== false,
    minEntityConfidence: options.minEntityConfidence || 0.3,
    maxEntitiesPerUnit: options.maxEntitiesPerUnit || 10,
    chunkOverlap: options.chunkOverlap || 0.1,
    ...options
  }

  // Initialize RDF infrastructure
  const namespaceManager = new NamespaceManager()
  const rdfManager = new RDFGraphManager({ namespace: namespaceManager })
  const dataset = rdf.dataset()

  // Collections for results
  const units = []
  const entitiesMap = new Map() // name -> Entity
  const relationships = []
  const unitEntityConnections = [] // Track unit-entity connections

  try {
    // Phase 1: Process each chunk into semantic units
    for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
      const chunk = textChunks[chunkIndex]
      logger.debug(`Processing chunk ${chunkIndex + 1}/${textChunks.length}`)

      // Extract semantic units from chunk using LLM
      const unitTexts = await extractSemanticUnits(chunk.content, llmHandler, opts)

      // Create SemanticUnit objects
      for (let unitIndex = 0; unitIndex < unitTexts.length; unitIndex++) {
        const unitText = unitTexts[unitIndex]
        const unitId = `unit_${chunkIndex}_${unitIndex}`

        // Generate summary if requested
        let summary = ''
        if (opts.generateSummaries && unitText.length > 100) {
          summary = await generateUnitSummary(unitText, llmHandler)
        }

        // Create RDF-based SemanticUnit
        const unit = new SemanticUnit({
          dataset: rdf.dataset(),
          text: unitText,
          summary: summary,
          source: chunk.source,
          position: 0, // Start position
          length: unitText.length // Content length
        })

        units.push(unit)

        // Add to RDF dataset
        unit.exportToDataset(dataset)

        // Extract entities from this unit
        const unitEntities = await extractEntitiesFromUnit(unitText, llmHandler, opts)

        // Process entities and create connections
        for (const entityData of unitEntities) {
          let entity = entitiesMap.get(entityData.name)

          if (!entity) {
            // Create new Entity
            entity = new Entity({
              name: entityData.name,
              isEntryPoint: entityData.isEntryPoint || false,
              subType: entityData.type || 'general',
              confidence: entityData.confidence || 1.0,
              alternativeLabels: entityData.alternatives || [],
              source: chunk.source
            })

            entitiesMap.set(entityData.name, entity)
            entity.exportToDataset(dataset)
          } else {
            // Update existing entity
            entity.incrementFrequency()
            entity.addSource(chunk.source)
          }

          // Create unit-entity connection
          unit.addEntityMention(entity.getURI(), entityData.relevance || 1.0)
          unitEntityConnections.push({
            unit: unit,
            entity: entity,
            relevance: entityData.relevance || 1.0,
            context: unitText
          })
        }

        logger.debug(`Unit ${unitId}: ${unitEntities.length} entities extracted`)
      }
    }

    // Phase 2: Extract relationships between entities
    if (opts.extractRelationships && entitiesMap.size > 1) {
      logger.info('Phase 2: Extracting relationships between entities...')

      const entityList = Array.from(entitiesMap.values())
      const relationshipData = await extractRelationships(entityList, units, llmHandler, opts)

      for (const relData of relationshipData) {
        const sourceEntity = entitiesMap.get(relData.source)
        const targetEntity = entitiesMap.get(relData.target)

        if (sourceEntity && targetEntity) {
          const relationship = new Relationship({
            id: `rel_${relationships.length}`,
            sourceEntity: sourceEntity.getURI(),
            targetEntity: targetEntity.getURI(),
            relationshipType: relData.type || 'related',
            content: relData.content || '',
            weight: relData.weight || 0.5,
            evidence: relData.evidence || [],
            bidirectional: relData.bidirectional || false
          })

          relationships.push(relationship)
          relationship.exportToDataset(dataset)

          // Add relationship triples using RDF graph manager
          const relUri = relationship.getURI()
          const relNode = rdf.namedNode(relUri)
          
          // Add relationship type
          rdfManager.addTriple(relNode, rdfManager.ns.rdf.type, rdfManager.ns.ragno.Relationship)
          
          // Connect relationship to source and target entities
          rdfManager.addTriple(rdf.namedNode(sourceEntity.getURI()), rdfManager.ns.ragno.hasRelationship, relNode)
          rdfManager.addTriple(relNode, rdfManager.ns.ragno.hasSource, rdf.namedNode(sourceEntity.getURI()))
          rdfManager.addTriple(relNode, rdfManager.ns.ragno.hasTarget, rdf.namedNode(targetEntity.getURI()))
          
          // Add inverse relationship if bidirectional
          if (relData.bidirectional) {
            rdfManager.addTriple(rdf.namedNode(targetEntity.getURI()), rdfManager.ns.ragno.hasRelationship, relNode)
          }
        }
      }

      logger.info(`Created ${relationships.length} relationships`)
    }

    // Phase 3: Create inter-unit relationships for coherence
    await createInterUnitRelationships(units, dataset, rdfManager)

    const processingTime = Date.now() - startTime
    logger.info(`Corpus decomposition completed in ${processingTime}ms: ${units.length} units, ${entitiesMap.size} entities, ${relationships.length} relationships`)

    return {
      units,
      entities: Array.from(entitiesMap.values()),
      relationships,
      dataset,
      connections: unitEntityConnections,
      statistics: {
        processingTime,
        totalChunks: textChunks.length,
        totalUnits: units.length,
        totalEntities: entitiesMap.size,
        totalRelationships: relationships.length,
        averageEntitiesPerUnit: entitiesMap.size / units.length
      }
    }

  } catch (error) {
    logger.error('Corpus decomposition failed:', error)
    throw error
  }
}

/**
 * Extract semantic units from text using LLM
 * @param {string} text - Input text
 * @param {Object} llmHandler - LLM handler
 * @param {Object} options - Extraction options
 * @returns {Promise<Array<string>>} Array of semantic unit texts
 */
async function extractSemanticUnits(text, llmHandler, options = {}) {
  const prompt = `Break down the following text into independent semantic units. Each unit should represent a complete thought, event, or concept that can stand alone. Return as a JSON array of strings.

Text: "${text}"

Return format: ["unit1", "unit2", "unit3"]

Semantic units:`

  try {
    const response = await llmHandler.generateResponse(prompt, '', {
      max_tokens: 1000,
      temperature: 0.1
    })

    // Parse LLM response using ParseHelper
    const cleanedResponse = ParseHelper.resolveSyntax(response)
    if (cleanedResponse === false) {
      logger.warn('ParseHelper could not resolve syntax, using original response')
      const units = JSON.parse(response.trim())
      return Array.isArray(units) ? units : [text]
    }
    
    const units = JSON.parse(cleanedResponse)
    return Array.isArray(units) ? units : [text] // Fallback to original text

  } catch (error) {
    logger.warn('LLM unit extraction failed, using sentence splitting fallback:', error.message)

    // Fallback: simple sentence splitting
    return text.split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 10) // Filter out very short sentences
  }
}

/**
 * Generate summary for a semantic unit
 * @param {string} unitText - Unit text content
 * @param {Object} llmHandler - LLM handler
 * @returns {Promise<string>} Generated summary
 */
async function generateUnitSummary(unitText, llmHandler) {
  const prompt = `Provide a concise 1-2 sentence summary of the key concept or event in this text:

"${unitText}"

Summary:`

  try {
    const summary = await llmHandler.generateResponse(prompt, '', {
      max_tokens: 100,
      temperature: 0.1
    })

    return summary.trim()

  } catch (error) {
    logger.warn('Summary generation failed:', error.message)
    return unitText.length > 100 ? unitText.substring(0, 100) + '...' : unitText
  }
}

/**
 * Extract entities from a semantic unit
 * @param {string} unitText - Unit text content
 * @param {Object} llmHandler - LLM handler
 * @param {Object} options - Extraction options
 * @returns {Promise<Array<Object>>} Array of entity data objects
 */
async function extractEntitiesFromUnit(unitText, llmHandler, options = {}) {
  const prompt = `Extract the key entities (people, places, organizations, concepts) from this text. For each entity, provide name, type, relevance score (0-1), and whether it's an entry point (important/central entity).

Text: "${unitText}"

Return as JSON array:
[{"name": "entity1", "type": "person", "relevance": 0.9, "isEntryPoint": true, "confidence": 0.8}]

Entities:`

  try {
    const systemPrompt = "You are a helpful assistant that extracts entities from text. Return entities as a JSON array with name, type, relevance, isEntryPoint, and confidence.";
    const response = await llmHandler.generateResponse(prompt, '', {
      systemPrompt,
      max_tokens: 500,
      temperature: 0.1
    });

    // Use ParseHelper to clean the response
    const cleanedResponse = ParseHelper.resolveSyntax(response)
    if (cleanedResponse === false) {
      logger.warn('ParseHelper could not resolve syntax for entity extraction')
      throw new Error('Failed to parse entity extraction response')
    }

    const entities = JSON.parse(cleanedResponse)

    // Filter and validate entities
    return Array.isArray(entities) ? entities.filter(entity =>
      entity.name &&
      entity.name.length > 1 &&
      (entity.confidence || 1.0) >= options.minEntityConfidence
    ).slice(0, options.maxEntitiesPerUnit) : []

  } catch (error) {
    logger.warn('Entity extraction failed, using fallback:', error.message)

    // Fallback: extract capitalized words as potential entities
    const words = unitText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    return words.slice(0, options.maxEntitiesPerUnit).map(name => ({
      name: name,
      type: 'general',
      relevance: 0.5,
      isEntryPoint: false,
      confidence: 0.5
    }))
  }
}

/**
 * Extract relationships between entities
 * @param {Array<Entity>} entities - List of entities
 * @param {Array<SemanticUnit>} units - List of semantic units
 * @param {Object} llmHandler - LLM handler
 * @param {Object} options - Extraction options
 * @returns {Promise<Array<Object>>} Array of relationship data objects
 */
async function extractRelationships(entities, units, llmHandler, options = {}) {
  const relationships = []
  const entityNames = entities.map(e => {
    const label = e.getPreferredLabel ? e.getPreferredLabel() : '';
    return label || '';
  });

  // Process units that contain multiple entities
  for (const unit of units) {
    const unitEntityNames = entityNames.filter(name =>
      unit.getContent().toLowerCase().includes(name.toLowerCase())
    )

    if (unitEntityNames.length < 2) continue

    const prompt = `Identify relationships between these entities in the given text. Return relationships as JSON array with source, target, type, content, and weight (0-1).

Entities: [${unitEntityNames.map(name => `"${name}"`).join(', ')}]
Text: "${unit.getContent()}"

Return format:
[{"source": "Entity1", "target": "Entity2", "type": "collaborates_with", "content": "relationship description", "weight": 0.8}]

Relationships:`

    try {
      const systemPrompt = "You are a helpful assistant that identifies relationships between entities in text. Return relationships as a JSON array with source, target, type, content, and weight (0-1).";
      const response = await llmHandler.generateResponse(prompt, '', {
        systemPrompt,
        max_tokens: 300,
        temperature: 0.1
      });

      // Use ParseHelper to clean the response
      const cleanedResponse = ParseHelper.resolveSyntax(response)
      if (cleanedResponse === false) {
        logger.warn('ParseHelper could not resolve syntax for relationship extraction')
        continue // Skip this unit and continue with the next one
      }

      const unitRelationships = JSON.parse(cleanedResponse)

      if (Array.isArray(unitRelationships)) {
        for (const rel of unitRelationships) {
          if (rel.source && rel.target && rel.source !== rel.target) {
            relationships.push({
              ...rel,
              evidence: [unit.getURI()],
              bidirectional: rel.bidirectional || false
            })
          }
        }
      }

    } catch (error) {
      logger.warn(`Relationship extraction failed for unit: ${error.message}`)
    }
  }

  return relationships
}

/**
 * Create inter-unit relationships for coherence
 * @param {Array<SemanticUnit>} units - List of semantic units
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF graph manager
 */
async function createInterUnitRelationships(units, dataset, rdfManager) {
  logger.debug('Creating inter-unit relationships...')

  // Create simple sequential relationships between adjacent units
  for (let i = 0; i < units.length - 1; i++) {
    const currentUnit = units[i]
    const nextUnit = units[i + 1]

    // Create a "follows" relationship
    const relationshipId = `unit_rel_${i}`
    const relationship = new Relationship({
      id: relationshipId,
      sourceEntity: currentUnit.getURI(),
      targetEntity: nextUnit.getURI(),
      relationshipType: 'follows',
      content: 'Sequential narrative flow',
      weight: 0.3,
      bidirectional: false
    })

    relationship.exportToDataset(dataset)
  }

  logger.debug(`Created ${units.length - 1} inter-unit relationships`)
}

/**
 * Export decomposition results to SPARQL endpoint
 * @param {Object} decompositionResults - Results from decomposeCorpus
 * @param {string} endpoint - SPARQL endpoint URL
 * @param {Object} [auth] - Authentication credentials
 * @returns {Promise<Object>} Export statistics
 */
export async function exportToRDF(decompositionResults, endpoint, auth = null) {
  const { dataset, statistics } = decompositionResults
  const startTime = Date.now()

  logger.info(`Exporting decomposition results to SPARQL endpoint: ${endpoint}`)

  try {
    // Convert dataset to N-Triples for SPARQL insertion
    const serializer = require('@rdfjs/serializer-ntriples')
    const ntriplesStream = serializer.import(dataset.toStream())

    let ntriplesData = ''
    for await (const chunk of ntriplesStream) {
      ntriplesData += chunk
    }

    // Insert all triples at once
    const insertQuery = `INSERT DATA { ${ntriplesData} }`

    await SPARQLHelpers.executeSPARQLUpdate(endpoint, insertQuery, auth)

    const exportTime = Date.now() - startTime
    logger.info(`Export completed in ${exportTime}ms`)

    return {
      success: true,
      exportTime,
      triplesExported: dataset.size,
      originalStatistics: statistics,
      endpoint
    }

  } catch (error) {
    logger.error('RDF export failed:', error)
    throw error
  }
}
