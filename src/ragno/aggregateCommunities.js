/**
 * Ragno: Community Detection and Aggregation - RDF-Ext Version
 * 
 * This module uses advanced Leiden clustering to detect communities in the knowledge
 * graph and generates comprehensive community summaries as CommunityElement RDF resources.
 * It integrates with the ragno search system for community-based retrieval.
 */

import rdf from 'rdf-ext'
import Attribute from './Attribute.js'
import RDFGraphManager from './core/RDFGraphManager.js'
import NamespaceManager from './core/NamespaceManager.js'
import { CommunityDetection } from './algorithms/index.js'
import { logger } from '../Utils.js'

/**
 * Community Element class representing ragno:CommunityElement
 */
class CommunityElement {
  constructor(rdfManager, options = {}) {
    this.rdfManager = rdfManager
    this.ns = rdfManager.getNamespaceManager()
    this.id = options.id || `community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.uri = this.ns.createURI('ragno', this.id)

    // Core properties
    this.members = options.members || []
    this.summary = options.summary || ''
    this.confidence = options.confidence || 0.5
    this.modularityScore = options.modularityScore || 0.0
    this.cohesionScore = options.cohesionScore || 0.0
    this.keywords = options.keywords || []
    this.provenance = options.provenance || 'Leiden community detection'

    // Initialize as RDF resource
    this._initializeRDF()
  }

  _initializeRDF() {
    const quad = this.rdfManager.createQuad
    this.dataset = rdf.dataset()

    // Type declaration
    this.dataset.add(quad(
      this.uri,
      this.ns.rdf.type,
      this.ns.ragno('CommunityElement')
    ))

    // Add as SKOS Concept
    this.dataset.add(quad(
      this.uri,
      this.ns.rdf.type,
      this.ns.skos.Concept
    ))

    // Core properties
    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('content'),
      this.rdfManager.createLiteral(this.summary)
    ))

    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('hasConfidence'),
      this.rdfManager.createLiteral(this.confidence, this.ns.xsd.float)
    ))

    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('modularityScore'),
      this.rdfManager.createLiteral(this.modularityScore, this.ns.xsd.float)
    ))

    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('cohesionScore'),
      this.rdfManager.createLiteral(this.cohesionScore, this.ns.xsd.float)
    ))

    // Add member entities
    for (const memberUri of this.members) {
      this.dataset.add(quad(
        this.uri,
        this.ns.ragno('hasCommunityMember'),
        memberUri
      ))
    }

    // Add keywords
    for (const keyword of this.keywords) {
      this.dataset.add(quad(
        this.uri,
        this.ns.ragno('hasKeyword'),
        this.rdfManager.createLiteral(keyword)
      ))
    }

    // Provenance
    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('provenance'),
      this.rdfManager.createLiteral(this.provenance)
    ))

    // Timestamp
    this.dataset.add(quad(
      this.uri,
      this.ns.ragno('timestamp'),
      this.rdfManager.createLiteral(new Date().toISOString(), this.ns.xsd.dateTime)
    ))
  }

  // Accessor methods
  getURI() { return this.uri }
  getMembers() { return this.members }
  getSummary() { return this.summary }
  getConfidence() { return this.confidence }
  getModularityScore() { return this.modularityScore }
  getCohesionScore() { return this.cohesionScore }
  getKeywords() { return this.keywords }

  // Export to external dataset
  exportToDataset(targetDataset) {
    for (const quad of this.dataset) {
      targetDataset.add(quad)
    }
  }

  // Create overview attribute for this community
  createOverviewAttribute(rdfManager) {
    return Attribute.createOverviewAttribute(rdfManager, {
      entityURI: this.uri,
      summary: this.summary,
      confidence: this.confidence,
      keywords: this.keywords,
      provenance: `Community overview: ${this.provenance}`
    })
  }
}

/**
 * Detect communities and generate comprehensive summaries using Leiden clustering
 * @param {Object} graphData - Graph data with RDF dataset
 * @param {Object} llmHandler - LLM handler instance
 * @param {Object} [options] - Community detection options
 * @returns {Promise<{communities: CommunityElement[], attributes: Attribute[], dataset: Dataset, statistics: Object}>}
 */
export async function aggregateCommunities(graphData, llmHandler, options = {}) {
  const startTime = Date.now()
  logger.info('Starting community detection and aggregation...')

  const opts = {
    // Leiden algorithm parameters
    resolution: options.resolution || 1.0,
    minCommunitySize: options.minCommunitySize || 3,
    maxIterations: options.maxIterations || 100,
    randomSeed: options.randomSeed || 42,

    // Summary generation
    generateSummaries: options.generateSummaries !== false,
    maxSummaryLength: options.maxSummaryLength || 300,
    includeKeywords: options.includeKeywords !== false,

    // Quality control
    minModularityScore: options.minModularityScore || 0.1,
    minCohesionScore: options.minCohesionScore || 0.3,

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
    // Phase 1: Run Leiden community detection
    const communityDetection = new CommunityDetection()
    const graph = await communityDetection.buildGraphFromRDF(graphData.dataset)

    if (graph.nodes.size < opts.minCommunitySize) {
      logger.warn('Graph too small for meaningful community detection')
      return {
        communities: [],
        attributes: [],
        dataset: resultDataset,
        statistics: {
          processingTime: Date.now() - startTime,
          communitiesDetected: 0,
          nodesProcessed: graph.nodes.size
        }
      }
    }

    logger.info(`Running Leiden clustering on graph with ${graph.nodes.size} nodes and ${graph.edges.size} edges`)

    const clusteringResults = communityDetection.computeLeidenClustering(graph, {
      resolution: opts.resolution,
      maxIterations: opts.maxIterations,
      randomSeed: opts.randomSeed
    })

    logger.info(`Detected ${clusteringResults.communities.length} communities with modularity: ${clusteringResults.modularity.toFixed(3)}`)

    // Phase 2: Filter and process communities
    const validCommunities = clusteringResults.communities.filter(community =>
      community.members.length >= opts.minCommunitySize &&
      (clusteringResults.modularityScores?.get(community.id) || 0) >= opts.minModularityScore
    )

    logger.info(`${validCommunities.length} communities meet quality thresholds`)

    // Phase 3: Generate comprehensive summaries for each community
    const communityElements = []
    const attributes = []

    for (const community of validCommunities) {
      logger.debug(`Processing community ${community.id} with ${community.members.length} members`)

      // Gather community context
      const communityContext = await gatherCommunityContext(
        community,
        graphData,
        opts
      )

      // Generate LLM summary
      let summary = ''
      let keywords = []
      let confidence = 0.5

      if (opts.generateSummaries && communityContext.contextText) {
        const summaryData = await generateCommunitySummary(
          community,
          communityContext,
          llmHandler,
          opts
        )

        if (summaryData) {
          summary = summaryData.summary
          keywords = summaryData.keywords
          confidence = summaryData.confidence
        }
      }

      // Calculate community cohesion score
      const cohesionScore = calculateCommunityCohesion(community, graph)

      // Create CommunityElement
      const communityElement = new CommunityElement(rdfManager, {
        id: `community_${community.id}`,
        members: community.members,
        summary: summary,
        confidence: confidence,
        modularityScore: clusteringResults.modularityScores?.get(community.id) || 0,
        cohesionScore: cohesionScore,
        keywords: keywords,
        provenance: `Leiden clustering (resolution=${opts.resolution})`
      })

      communityElements.push(communityElement)
      communityElement.exportToDataset(resultDataset)

      // Create overview attribute for searchability
      if (summary) {
        const overviewAttribute = communityElement.createOverviewAttribute(rdfManager)
        attributes.push(overviewAttribute)
        overviewAttribute.exportToDataset(resultDataset)
      }

      logger.debug(`Community ${community.id}: ${summary.length} char summary, ${keywords.length} keywords, cohesion: ${cohesionScore.toFixed(3)}`)
    }

    // Phase 4: Create inter-community relationships
    await createInterCommunityRelationships(communityElements, resultDataset, rdfManager, graph)

    const processingTime = Date.now() - startTime
    logger.info(`Community aggregation completed in ${processingTime}ms: ${communityElements.length} communities, ${attributes.length} attributes`)

    return {
      communities: communityElements,
      attributes: attributes,
      dataset: resultDataset,
      statistics: {
        processingTime,
        communitiesDetected: validCommunities.length,
        totalCommunities: clusteringResults.communities.length,
        overallModularity: clusteringResults.modularity,
        averageCommunitySize: validCommunities.reduce((sum, c) => sum + c.members.length, 0) / validCommunities.length,
        nodesProcessed: graph.nodes.size,
        edgesProcessed: graph.edges.size,
        attributesGenerated: attributes.length
      }
    }

  } catch (error) {
    logger.error('Community aggregation failed:', error)
    throw error
  }
}

/**
 * Gather comprehensive context for a community
 * @param {Object} community - Community object with members
 * @param {Object} graphData - Graph data
 * @param {Object} options - Context gathering options
 * @returns {Promise<Object>} Community context object
 */
async function gatherCommunityContext(community, graphData, options) {
  const context = {
    community: community,
    memberEntities: [],
    units: [],
    relationships: [],
    contextText: '',
    evidence: []
  }

  // Get member entity objects
  if (graphData.entities) {
    for (const entity of graphData.entities) {
      if (community.members.includes(entity.getURI().value)) {
        context.memberEntities.push(entity)
      }
    }
  }

  // Gather units that mention community entities
  if (graphData.units) {
    const memberLabels = context.memberEntities.map(e => e.getPreferredLabel().toLowerCase())

    for (const unit of graphData.units) {
      const unitContent = unit.getContent().toLowerCase()
      const mentionsMembers = memberLabels.some(label => unitContent.includes(label))

      if (mentionsMembers) {
        context.units.push(unit)
        context.evidence.push(unit.getURI())

        if (context.contextText.length < options.maxSummaryLength * 3) {
          context.contextText += unit.getContent() + '\n\n'
        }
      }
    }
  }

  // Gather relationships within the community
  if (graphData.relationships) {
    for (const relationship of graphData.relationships) {
      const sourceInCommunity = community.members.includes(relationship.getSourceEntity().value)
      const targetInCommunity = community.members.includes(relationship.getTargetEntity().value)

      if (sourceInCommunity && targetInCommunity) {
        context.relationships.push(relationship)
        context.evidence.push(relationship.getURI())
      }
    }
  }

  // Trim context if too long
  if (context.contextText.length > options.maxSummaryLength * 3) {
    context.contextText = context.contextText.substring(0, options.maxSummaryLength * 3) + '...'
  }

  logger.debug(`Community ${community.id} context: ${context.memberEntities.length} entities, ${context.units.length} units, ${context.relationships.length} relationships`)

  return context
}

/**
 * Generate LLM summary for a community
 * @param {Object} community - Community object
 * @param {Object} context - Community context
 * @param {Object} llmHandler - LLM handler
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Summary data with keywords and confidence
 */
async function generateCommunitySummary(community, context, llmHandler, options) {
  const memberNames = context.memberEntities.map(e => e.getPreferredLabel()).join(', ')

  const prompt = `Analyze this community of related entities and provide a comprehensive summary of their shared theme, domain, or context.

Community Members: ${memberNames}

Context Information:
${context.contextText}

Based on the relationships and context, write a 2-3 sentence summary that captures:
1. The main theme or domain that unites these entities
2. The key relationships or patterns within the community
3. The significance or importance of this grouping

Summary:`

  try {
    const response = await llmHandler.generateResponse(prompt, '', {
      maxTokens: 150,
      temperature: 0.1
    })

    const summary = response.trim()

    if (summary.length < 20) {
      logger.debug(`Generated community summary too short: ${summary.length} chars`)
      return null
    }

    // Extract keywords from summary and member names
    const keywords = extractCommunityKeywords(summary, context.memberEntities)

    // Calculate confidence based on context quality
    const confidence = calculateSummaryConfidence(context, summary)

    return {
      summary: summary,
      keywords: keywords,
      confidence: confidence
    }

  } catch (error) {
    logger.warn(`Failed to generate community summary:`, error.message)

    // Fallback: create simple summary from member names
    const fallbackSummary = `Community of related entities including ${memberNames.slice(0, 3).join(', ')}${memberNames.length > 3 ? ' and others' : ''}.`

    return {
      summary: fallbackSummary,
      keywords: context.memberEntities.slice(0, 3).map(e => e.getPreferredLabel()),
      confidence: 0.3
    }
  }
}

/**
 * Extract keywords from community summary and members
 * @param {string} summary - Generated summary
 * @param {Array} memberEntities - Community member entities
 * @returns {Array<string>} Extracted keywords
 */
function extractCommunityKeywords(summary, memberEntities) {
  const keywords = new Set()

  // Add member entity names as keywords
  for (const entity of memberEntities.slice(0, 5)) {
    keywords.add(entity.getPreferredLabel())
  }

  // Extract significant words from summary
  const summaryWords = summary.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !isStopWord(word))

  for (const word of summaryWords.slice(0, 3)) {
    keywords.add(word)
  }

  return Array.from(keywords).slice(0, 8)
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
    'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might',
    'community', 'entities', 'related', 'group', 'members'
  ])
  return stopWords.has(word)
}

/**
 * Calculate confidence for generated summary
 * @param {Object} context - Community context
 * @param {string} summary - Generated summary
 * @returns {number} Confidence score 0-1
 */
function calculateSummaryConfidence(context, summary) {
  let confidence = 0.3 // Base confidence

  // Factor in community size
  if (context.memberEntities.length > 2) {
    confidence += Math.min(context.memberEntities.length * 0.1, 0.3)
  }

  // Factor in context richness
  if (context.units.length > 0) {
    confidence += Math.min(context.units.length * 0.05, 0.2)
  }

  if (context.relationships.length > 0) {
    confidence += Math.min(context.relationships.length * 0.05, 0.15)
  }

  // Factor in summary quality
  if (summary.length > 100) {
    confidence += 0.1
  }

  return Math.min(confidence, 1.0)
}

/**
 * Calculate cohesion score for a community
 * @param {Object} community - Community object
 * @param {Object} graph - Graph object
 * @returns {number} Cohesion score 0-1
 */
function calculateCommunityCohesion(community, graph) {
  const members = new Set(community.members)
  let internalEdges = 0
  let totalPossibleEdges = 0

  // Count internal edges vs total possible
  for (const member of members) {
    const memberEdges = graph.adjacencyList.get(member) || new Set()

    for (const neighbor of memberEdges) {
      if (members.has(neighbor) && member < neighbor) { // Avoid double counting
        internalEdges++
      }
    }
  }

  totalPossibleEdges = (members.size * (members.size - 1)) / 2

  return totalPossibleEdges > 0 ? internalEdges / totalPossibleEdges : 0
}

/**
 * Create relationships between overlapping communities
 * @param {Array<CommunityElement>} communities - Community elements
 * @param {Dataset} dataset - RDF dataset
 * @param {RDFGraphManager} rdfManager - RDF manager
 * @param {Object} graph - Graph object
 */
async function createInterCommunityRelationships(communities, dataset, rdfManager, graph) {
  logger.debug('Creating inter-community relationships...')

  const Relationship = (await import('./Relationship.js')).default
  let relationshipCount = 0

  // Find overlapping or connected communities
  for (let i = 0; i < communities.length; i++) {
    for (let j = i + 1; j < communities.length; j++) {
      const comm1 = communities[i]
      const comm2 = communities[j]

      // Check for shared members (overlap)
      const sharedMembers = comm1.getMembers().filter(member =>
        comm2.getMembers().includes(member)
      )

      if (sharedMembers.length > 0) {
        // Create overlap relationship
        const relationship = new Relationship(rdfManager, {
          id: `comm_overlap_${i}_${j}`,
          sourceEntity: comm1.getURI(),
          targetEntity: comm2.getURI(),
          relationshipType: 'overlaps',
          content: `Communities share ${sharedMembers.length} member(s)`,
          weight: sharedMembers.length / Math.min(comm1.getMembers().length, comm2.getMembers().length),
          bidirectional: true
        })

        relationship.exportToDataset(dataset)
        relationshipCount++
        continue
      }

      // Check for inter-community connections
      let connectionCount = 0
      for (const member1 of comm1.getMembers()) {
        const memberEdges = graph.adjacencyList.get(member1) || new Set()
        for (const member2 of comm2.getMembers()) {
          if (memberEdges.has(member2)) {
            connectionCount++
          }
        }
      }

      if (connectionCount > 0) {
        // Create connection relationship
        const connectionStrength = connectionCount / (comm1.getMembers().length + comm2.getMembers().length)

        if (connectionStrength > 0.1) { // Only create if significant connection
          const relationship = new Relationship(rdfManager, {
            id: `comm_connected_${i}_${j}`,
            sourceEntity: comm1.getURI(),
            targetEntity: comm2.getURI(),
            relationshipType: 'connected_to',
            content: `Communities connected by ${connectionCount} inter-community edge(s)`,
            weight: connectionStrength,
            bidirectional: true
          })

          relationship.exportToDataset(dataset)
          relationshipCount++
        }
      }
    }
  }

  logger.debug(`Created ${relationshipCount} inter-community relationships`)
}