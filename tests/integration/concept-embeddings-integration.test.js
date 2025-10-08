import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import path from 'path'
import Config from '../../src/Config.js'
import { SimpleVerbsService } from '../../src/mcp/tools/simple-verbs.js'

// Helper function to check if services are available
async function checkServicesAvailable(config) {
  try {
    // Check SPARQL endpoint
    const storageConfig = config.get('storage')
    // Test SPARQL endpoint with actual query
    const sparqlResponse = await fetch(storageConfig.options.query, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json'
      },
      body: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
      signal: AbortSignal.timeout(5000)
    })
    
    if (!sparqlResponse.ok) {
      return { sparql: false, reason: `SPARQL endpoint returned ${sparqlResponse.status}` }
    }

    // Check configured LLM providers
    const llmProviders = config.get('llmProviders') || []
    const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'))
    const embeddingProviders = llmProviders.filter(p => p.capabilities?.includes('embedding'))
    
    if (chatProviders.length === 0) {
      return { llm: false, reason: 'No chat providers configured' }
    }
    
    if (embeddingProviders.length === 0) {
      return { embedding: false, reason: 'No embedding providers configured' }
    }

    return { sparql: true, llm: true, embedding: true }
  } catch (error) {
    console.warn('❌ Service check error:', error.message)
    return { error: error.message }
  }
}

// Helper function to clear test data
async function clearTestGraph(config, testGraphName) {
  try {
    const storageConfig = config.get('storage')
    const clearQuery = `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      DELETE WHERE {
        GRAPH <${testGraphName}> {
          ?s ?p ?o .
        }
      }
    `
    
    await fetch(storageConfig.options.update, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        'Authorization': `Basic ${Buffer.from(`${storageConfig.options.user}:${storageConfig.options.password}`).toString('base64')}`
      },
      body: clearQuery
    })
  } catch (error) {
    console.warn('Failed to clear test graph:', error.message)
  }
}

// Helper function to count concepts in graph
async function countConceptsInGraph(config, testGraphName) {
  try {
    const storageConfig = config.get('storage')
    const countQuery = `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      SELECT (COUNT(*) as ?count) WHERE {
        GRAPH <${testGraphName}> {
          ?concept a ragno:Concept .
        }
      }
    `
    
    const response = await fetch(storageConfig.options.query, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        'Accept': 'application/sparql-results+json',
        'Authorization': `Basic ${Buffer.from(`${storageConfig.options.user}:${storageConfig.options.password}`).toString('base64')}`
      },
      body: countQuery
    })
    
    if (response.ok) {
      const result = await response.json()
      return parseInt(result.results.bindings[0]?.count?.value || '0')
    }
    return 0
  } catch (error) {
    console.warn('Failed to count concepts:', error.message)
    return 0
  }
}

describe('Concept Embeddings Integration Tests', () => {
  let simpleVerbsService
  let servicesAvailable = false
  let config
  let testGraphName = 'http://hyperdata.it/test/concept-embeddings'

  beforeAll(async () => {
    // Initialize configuration - following pattern from working integration test
    config = new Config('config/config.json')
    await config.init()
    
    // Check if required services are running
    const serviceCheck = await checkServicesAvailable(config)
    
    if (serviceCheck.error || !serviceCheck.sparql || !serviceCheck.llm || !serviceCheck.embedding) {
      console.warn('Skipping integration tests - services not available:', serviceCheck)
      servicesAvailable = false
      return
    }
    
    servicesAvailable = true
    console.log('✅ All required services are available for integration testing')
  })

  beforeEach(async () => {
    if (!servicesAvailable) return
    
    // Clear test data before each test
    await clearTestGraph(config, testGraphName)
    
    // Create fresh service instance
    simpleVerbsService = new SimpleVerbsService()
  })

  afterAll(async () => {
    if (!servicesAvailable) return
    
    // Clean up test data
    await clearTestGraph(config, testGraphName)
  })

  it('should perform end-to-end concept embedding workflow', async () => {
    if (!servicesAvailable) {
      console.warn('Skipping test: services not available')
      return
    }
    const target = `
      Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. 
      Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals.
      Machine learning is a subset of AI that focuses on the use of data and algorithms to imitate the way that humans learn, gradually improving its accuracy.
      Deep learning is a subset of machine learning that uses neural networks with multiple layers.
    `.trim()

    const options = {
      maxConcepts: 5,
      batchSize: 2,
      graph: testGraphName
    }

    console.log('🧪 Starting end-to-end concept embedding test...')

    // Verify graph is empty initially
    const initialCount = await countConceptsInGraph(config, testGraphName)
    expect(initialCount).toBe(0)

    // Execute concept embedding operation
    const result = await simpleVerbsService.augment({
      target,
      operation: 'concept_embeddings',
      options
    })

    console.log('📊 Concept embedding result:', {
      success: result.success,
      totalConcepts: result.result?.totalConcepts,
      totalEmbeddings: result.result?.totalEmbeddings,
      message: result.result?.message
    })

    // Verify operation success
    expect(result.success).toBe(true)
    expect(result.operation).toBe('concept_embeddings')
    expect(result.result.augmentationType).toBe('concept_embeddings')

    // Verify concepts were extracted and processed
    expect(result.result.totalConcepts).toBeGreaterThan(0)
    expect(result.result.totalEmbeddings).toBeGreaterThan(0)
    expect(result.result.conceptsEmbedded.length).toBeGreaterThan(0)

    // Verify concepts were stored in SPARQL
    const finalCount = await countConceptsInGraph(config, testGraphName)
    expect(finalCount).toBe(result.result.totalEmbeddings)
    expect(finalCount).toBeGreaterThan(0)

    console.log(`✅ Successfully stored ${finalCount} concepts with embeddings`)

    // Verify the structure of embedded concepts
    const firstConcept = result.result.conceptsEmbedded[0]
    expect(firstConcept).toHaveProperty('concept')
    expect(firstConcept).toHaveProperty('conceptUri')
    expect(firstConcept).toHaveProperty('embeddingUri') 
    expect(firstConcept).toHaveProperty('embeddingDimension')
    expect(firstConcept).toHaveProperty('embeddingModel')

    expect(firstConcept.embeddingDimension).toBe(1536) // nomic-embed-text dimension
    expect(firstConcept.conceptUri).toContain('http://purl.org/stuff/instance/')
    expect(firstConcept.embeddingUri).toContain('http://purl.org/stuff/instance/')
  }, 30000) // 30 second timeout for integration test

  it('should handle concepts operation with embeddings', async () => {
    if (!servicesAvailable) {
      console.warn('Skipping test: services not available')
      return
    }
    const target = 'Natural language processing is a subfield of linguistics, computer science, and artificial intelligence.'
    
    const options = {
      includeEmbeddings: true,
      maxConcepts: 3,
      graph: testGraphName
    }

    console.log('🧪 Testing concepts operation with embeddings...')

    const result = await simpleVerbsService.augment({
      target,
      operation: 'concepts',
      options
    })

    console.log('📊 Concepts with embeddings result:', {
      success: result.success,
      augmentationType: result.result?.augmentationType,
      conceptsLength: result.result?.concepts?.length,
      embeddedConceptsLength: result.result?.embeddedConcepts?.length
    })

    // Verify operation success
    expect(result.success).toBe(true)
    expect(result.result.augmentationType).toBe('concepts_with_embeddings')
    
    // Verify concepts were extracted
    expect(result.result.concepts).toBeDefined()
    expect(Array.isArray(result.result.concepts)).toBe(true)
    expect(result.result.concepts.length).toBeGreaterThan(0)

    // Verify embeddings were generated and stored
    expect(result.result.embeddedConcepts).toBeDefined()
    expect(Array.isArray(result.result.embeddedConcepts)).toBe(true)
    expect(result.result.embeddedConcepts.length).toBeGreaterThan(0)
    expect(result.result.totalEmbeddings).toBeGreaterThan(0)

    // Verify concepts were stored in SPARQL
    const conceptCount = await countConceptsInGraph(config, testGraphName)
    expect(conceptCount).toBe(result.result.totalEmbeddings)

    console.log(`✅ Successfully processed ${result.result.concepts.length} concepts, embedded ${result.result.totalEmbeddings}`)
  }, 20000)

  it('should respect maxConcepts limit', async () => {
    if (!servicesAvailable) {
      console.warn('Skipping test: services not available')
      return
    }
    const target = `
      Machine learning, artificial intelligence, deep learning, neural networks, 
      natural language processing, computer vision, robotics, automation, 
      data science, big data, algorithms, statistics, mathematics, programming
    `.trim()

    const options = {
      maxConcepts: 3, // Limit to only 3 concepts
      graph: testGraphName
    }

    console.log('🧪 Testing maxConcepts limit...')

    const result = await simpleVerbsService.augment({
      target,
      operation: 'concept_embeddings',
      options
    })

    console.log('📊 MaxConcepts limit result:', {
      success: result.success,
      totalConcepts: result.result?.totalConcepts,
      totalProcessed: result.result?.totalProcessed,
      totalEmbeddings: result.result?.totalEmbeddings
    })

    expect(result.success).toBe(true)
    expect(result.result.totalProcessed).toBeLessThanOrEqual(3)
    expect(result.result.totalEmbeddings).toBeLessThanOrEqual(3)

    // Verify only the limited number were stored
    const conceptCount = await countConceptsInGraph(config, testGraphName)
    expect(conceptCount).toBeLessThanOrEqual(3)

    console.log(`✅ Respected maxConcepts limit: processed ${result.result.totalProcessed} concepts`)
  }, 20000)

  it('should work with custom graph configuration', async () => {
    if (!servicesAvailable) {
      console.warn('Skipping test: services not available')
      return
    }
    const customGraph = 'http://hyperdata.it/test/custom-concept-graph'
    const target = 'Quantum computing uses quantum mechanical phenomena to perform calculations.'
    
    const options = {
      maxConcepts: 2,
      graph: customGraph
    }

    console.log('🧪 Testing custom graph configuration...')

    const result = await simpleVerbsService.augment({
      target,
      operation: 'concept_embeddings',
      options
    })

    expect(result.success).toBe(true)
    expect(result.result.targetGraph).toBe(customGraph)

    // Clean up custom graph
    const storageConfig = config.get('storage')
    await fetch(storageConfig.options.update, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-update',
        'Authorization': `Basic ${Buffer.from(`${storageConfig.options.user}:${storageConfig.options.password}`).toString('base64')}`
      },
      body: `DELETE WHERE { GRAPH <${customGraph}> { ?s ?p ?o . } }`
    })

    console.log('✅ Successfully used custom graph configuration')
  }, 15000)
})
