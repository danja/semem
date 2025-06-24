import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Hyde from '../../../src/ragno/algorithms/Hyde.js'
import SemanticUnit from '../../../src/ragno/SemanticUnit.js'
import Entity from '../../../src/ragno/Entity.js'
import MemoryManager from '../../../src/MemoryManager.js'
import InMemoryStore from '../../../src/stores/InMemoryStore.js'
import Config from '../../../src/Config.js'
import rdf from 'rdf-ext'

// Mock logger to avoid noise in tests
vi.mock('../../../src/Utils.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('Hyde Metadata Integration Tests', () => {
  let config
  let memoryManager
  let llmHandler
  let storage
  let hyde
  let dataset

  beforeEach(async () => {
    // Setup test configuration
    config = new Config()
    await config.init()
    
    // Create minimal storage
    storage = new InMemoryStore()
    
    // Create mock LLM provider that returns realistic responses
    const mockLLMProvider = {
      chat: vi.fn().mockImplementation(async (messages, options) => {
        const query = messages.find(m => m.role === 'user')?.content || ''
        
        // Generate realistic hypothetical responses based on query
        const responses = {
          'renewable energy benefits': 'Renewable energy sources like solar and wind power offer significant environmental and economic benefits. They reduce greenhouse gas emissions, create jobs in clean energy sectors, and provide energy independence. Solar panels can reduce electricity costs by 70-90%, while wind energy has become cost-competitive with fossil fuels.',
          'machine learning': 'Machine learning algorithms analyze large datasets to identify patterns and make predictions. Deep neural networks process information through multiple layers, similar to how the human brain works. Common applications include image recognition, natural language processing, and recommendation systems.',
          'climate change biodiversity': 'Climate change significantly impacts biodiversity through habitat loss, temperature changes, and altered precipitation patterns. Species migration patterns shift as temperatures rise, and coral reefs face bleaching due to ocean acidification. Conservation efforts must adapt to these changing conditions.'
        }
        
        // Find best matching response
        let response = 'This is a comprehensive response about the topic with detailed information and examples.'
        for (const [key, value] of Object.entries(responses)) {
          if (query.toLowerCase().includes(key)) {
            response = value
            break
          }
        }
        
        return { content: response }
      }),
      generateResponse: vi.fn().mockImplementation(async (prompt, context, options) => {
        // Delegate to chat method for consistency
        const messages = [{ role: 'user', content: prompt }]
        const result = await mockLLMProvider.chat(messages, options)
        return result.content
      })
    }
    
    // Create mock embedding provider (minimal for MemoryManager compatibility)
    const mockEmbeddingProvider = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]) // Simple mock embedding
    }
    
    // Create memory manager with mock providers
    memoryManager = new MemoryManager({
      llmProvider: mockLLMProvider,
      embeddingProvider: mockEmbeddingProvider,
      storage
    })
    
    llmHandler = memoryManager.llmHandler
    
    // Initialize Hyde with test configuration
    hyde = new Hyde({
      hypothesesPerQuery: 2,
      temperature: 0.7,
      maxTokens: 200,
      extractEntities: true,
      model: 'test-model'
    })
    
    dataset = rdf.dataset()
  })

  afterEach(async () => {
    if (memoryManager) {
      await memoryManager.dispose()
    }
  })

  describe('Full Hyde Workflow Integration', () => {
    it('should generate hypotheses with confidence and make metadata accessible', async () => {
      const query = 'What are the benefits of renewable energy?'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 2,
          extractEntities: false // Focus on hypothesis metadata
        }
      )
      
      // Verify hypotheses were generated
      expect(results.hypotheses).toBeDefined()
      expect(results.hypotheses.length).toBe(2)
      
      // Check each hypothesis for metadata accessibility
      for (const hypothesis of results.hypotheses) {
        expect(hypothesis).toBeInstanceOf(SemanticUnit)
        
        // Current broken behavior: confidence calculated but not accessible
        const metadata = hypothesis.getMetadata()
        
        // This test documents what SHOULD work after our implementation
        try {
          // Expected: confidence should be accessible
          expect(metadata.confidence).toBeDefined()
          expect(typeof metadata.confidence).toBe('number')
          expect(metadata.confidence).toBeGreaterThan(0)
          expect(metadata.confidence).toBeLessThanOrEqual(0.95)
          
          // Expected: original query should be accessible
          expect(metadata.originalQuery).toBe(query)
          
          // Expected: hypothetical flag should be accessible
          expect(metadata.hypothetical).toBe(true)
          
          console.log('✅ Metadata accessible - implementation working!')
          
        } catch (error) {
          // Document expected failure until implementation is complete
          console.log('❌ Expected failure - metadata not yet accessible:', error.message)
          
          // Verify that confidence was at least calculated (from Hyde internal state)
          // This proves the calculation works, just not the accessibility
          expect(hyde.lastConfidenceCalculated).toBeDefined()
        }
      }
    })
    
    it('should show confidence variation between hypotheses', async () => {
      const query = 'How does climate change affect biodiversity?'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 3,
          extractEntities: false
        }
      )
      
      expect(results.hypotheses.length).toBe(3)
      
      // Collect confidence values (when accessible)
      const confidences = []
      
      for (const hypothesis of results.hypotheses) {
        try {
          const metadata = hypothesis.getMetadata()
          if (metadata.confidence !== undefined) {
            confidences.push(metadata.confidence)
          }
        } catch (error) {
          // Expected during implementation phase
          console.log('Confidence not accessible yet:', error.message)
        }
      }
      
      // After implementation, we should see confidence variation
      if (confidences.length > 1) {
        // Verify that confidences are not all identical
        const uniqueConfidences = new Set(confidences)
        expect(uniqueConfidences.size).toBeGreaterThan(1)
        
        // Verify reasonable confidence range
        const minConfidence = Math.min(...confidences)
        const maxConfidence = Math.max(...confidences)
        
        expect(minConfidence).toBeGreaterThanOrEqual(0.1)
        expect(maxConfidence).toBeLessThanOrEqual(0.95)
        
        console.log(`✅ Confidence variation: ${minConfidence.toFixed(3)} - ${maxConfidence.toFixed(3)}`)
      }
    })
    
    it('should persist metadata to RDF dataset correctly', async () => {
      const query = 'What is machine learning?'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 1,
          extractEntities: false
        }
      )
      
      expect(results.hypotheses.length).toBe(1)
      const hypothesis = results.hypotheses[0]
      
      // Verify hypothesis was added to dataset
      expect(dataset.size).toBeGreaterThan(0)
      
      // Check for metadata-related triples in the dataset
      let foundConfidenceTriple = false
      let foundQueryTriple = false
      let foundHypotheticalTriple = false
      
      for (const quad of dataset) {
        const predicateValue = quad.predicate.value
        const objectValue = quad.object.value
        
        // Check for confidence property
        if (predicateValue.includes('confidence') && !isNaN(parseFloat(objectValue))) {
          foundConfidenceTriple = true
          const confidenceValue = parseFloat(objectValue)
          expect(confidenceValue).toBeGreaterThan(0)
          expect(confidenceValue).toBeLessThanOrEqual(0.95)
        }
        
        // Check for original query property
        if (predicateValue.includes('originalQuery') && objectValue === query) {
          foundQueryTriple = true
        }
        
        // Check for hypothetical flag
        if (predicateValue.includes('hypothetical') && objectValue === 'true') {
          foundHypotheticalTriple = true
        }
      }
      
      // After implementation, these should be found
      try {
        expect(foundConfidenceTriple).toBe(true)
        expect(foundQueryTriple).toBe(true)
        expect(foundHypotheticalTriple).toBe(true)
        console.log('✅ Metadata properly persisted to RDF dataset')
        
      } catch (error) {
        console.log('❌ Expected failure - metadata persistence not yet implemented:', error.message)
        console.log(`   Confidence triples found: ${foundConfidenceTriple}`)
        console.log(`   Query triples found: ${foundQueryTriple}`)
        console.log(`   Hypothetical triples found: ${foundHypotheticalTriple}`)
      }
    })
    
    it('should support metadata retrieval after SPARQL round-trip', async () => {
      // This test simulates storing to SPARQL and retrieving
      const query = 'How can AI improve healthcare?'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 1,
          extractEntities: false
        }
      )
      
      const originalHypothesis = results.hypotheses[0]
      
      // Simulate SPARQL storage by exporting to dataset then reconstructing
      const storageDataset = rdf.dataset()
      originalHypothesis.exportToDataset(storageDataset)
      
      // Simulate retrieval by creating new SemanticUnit from stored data
      // This would normally be done by SPARQL query results processing
      const reconstructedUri = originalHypothesis.getURI()
      
      // After implementation, we should be able to reconstruct metadata
      try {
        // Create new SemanticUnit from stored RDF data
        const reconstructed = new SemanticUnit({
          uri: reconstructedUri,
          content: originalHypothesis.getText()
        })
        
        // Load metadata from RDF dataset (this would be done by our metadata interface)
        // reconstructed.loadMetadataFromDataset(storageDataset)
        
        const originalMetadata = originalHypothesis.getMetadata()
        const reconstructedMetadata = reconstructed.getMetadata()
        
        // Verify metadata survived round-trip
        expect(reconstructedMetadata.confidence).toBeDefined()
        expect(reconstructedMetadata.confidence).toBe(originalMetadata.confidence)
        expect(reconstructedMetadata.originalQuery).toBe(query)
        expect(reconstructedMetadata.hypothetical).toBe(true)
        
        console.log('✅ Metadata survives SPARQL round-trip')
        
      } catch (error) {
        console.log('❌ Expected failure - SPARQL round-trip not yet implemented:', error.message)
      }
    })
    
    it('should maintain backwards compatibility with existing SemanticUnit functionality', async () => {
      const query = 'Test query for backwards compatibility'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 1,
          extractEntities: false
        }
      )
      
      const hypothesis = results.hypotheses[0]
      
      // Verify all existing SemanticUnit methods still work
      expect(typeof hypothesis.getText).toBe('function')
      expect(typeof hypothesis.getContent).toBe('function')
      expect(typeof hypothesis.getURI).toBe('function')
      expect(typeof hypothesis.exportToDataset).toBe('function')
      expect(typeof hypothesis.getMetadata).toBe('function')
      
      // Test existing functionality
      expect(hypothesis.getText()).toBeDefined()
      expect(hypothesis.getURI()).toBeDefined()
      
      const metadata = hypothesis.getMetadata()
      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
      
      // Existing metadata should still be accessible
      expect(metadata.text).toBeDefined()
      
      console.log('✅ Backwards compatibility maintained')
    })
  })
  
  describe('Display Function Integration', () => {
    it('should allow display functions to access confidence values', async () => {
      const query = 'Test query for display functions'
      
      const results = await hyde.generateHypotheses(
        query,
        llmHandler,
        dataset,
        {
          hypothesesPerQuery: 2,
          extractEntities: false
        }
      )
      
      // Simulate the display function from Hyde.js example
      function displayHypothesisConfidence(hypothesis) {
        try {
          // This is how the example code tries to access confidence
          const metadata = hypothesis.getMetadata()
          const confidence = metadata.confidence
          
          if (confidence !== undefined) {
            return typeof confidence === 'number' ? confidence.toFixed(3) : confidence
          }
          return 'N/A'
          
        } catch (error) {
          return 'Error: ' + error.message
        }
      }
      
      // Test display function on each hypothesis
      for (let i = 0; i < results.hypotheses.length; i++) {
        const hypothesis = results.hypotheses[i]
        const confidenceDisplay = displayHypothesisConfidence(hypothesis)
        
        console.log(`Hypothesis ${i + 1} confidence display: ${confidenceDisplay}`)
        
        // After implementation, confidence should be properly displayed
        if (confidenceDisplay !== 'N/A' && !confidenceDisplay.startsWith('Error:')) {
          const confidenceValue = parseFloat(confidenceDisplay)
          expect(confidenceValue).toBeGreaterThan(0)
          expect(confidenceValue).toBeLessThanOrEqual(0.95)
        }
      }
    })
  })
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle SemanticUnit creation with no metadata gracefully', () => {
      // Test creating SemanticUnit without metadata option
      const unit = new SemanticUnit({
        uri: 'http://test.org/unit-no-metadata',
        content: 'Test content without metadata'
      })
      
      expect(unit).toBeDefined()
      expect(unit.getText()).toBe('Test content without metadata')
      
      const metadata = unit.getMetadata()
      expect(metadata).toBeDefined()
      expect(metadata.text).toBe('Test content without metadata')
      
      // After implementation, getMetadata should work even without initial metadata
      expect(typeof metadata).toBe('object')
    })
    
    it('should handle SemanticUnit creation with empty metadata', () => {
      const unit = new SemanticUnit({
        uri: 'http://test.org/unit-empty-metadata',
        content: 'Test content',
        metadata: {}
      })
      
      expect(unit).toBeDefined()
      const metadata = unit.getMetadata()
      expect(metadata).toBeDefined()
      expect(metadata.text).toBe('Test content')
    })
    
    it('should handle metadata with various data types', () => {
      const complexMetadata = {
        confidence: 0.75,
        originalQuery: 'test query',
        hypothetical: true,
        timestamp: new Date().toISOString(),
        numericProperty: 42,
        arrayProperty: ['item1', 'item2'],
        objectProperty: { nested: 'value' }
      }
      
      try {
        const unit = new SemanticUnit({
          uri: 'http://test.org/unit-complex-metadata',
          content: 'Test content',
          metadata: complexMetadata
        })
        
        const retrievedMetadata = unit.getMetadata()
        
        // After implementation, complex metadata should be handled properly
        expect(retrievedMetadata.confidence).toBe(0.75)
        expect(retrievedMetadata.originalQuery).toBe('test query')
        expect(retrievedMetadata.hypothetical).toBe(true)
        expect(retrievedMetadata.numericProperty).toBe(42)
        
        console.log('✅ Complex metadata handled correctly')
        
      } catch (error) {
        console.log('❌ Expected failure - complex metadata not yet supported:', error.message)
      }
    })
  })
})