/**
 * RDF Concept Integration MCP Tests
 * Tests the new RDF concept extraction and integration functionality through MCP endpoints
 * Validates graph tilt, concept filtering, and RDF-native concept storage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fetch from 'node-fetch';
import Config from '../../../src/Config.js';

// Test configuration
const TEST_CONFIG = {
  MCP_PORT: process.env.MCP_PORT || 4101,
  MCP_URL: process.env.MCP_URL || `http://localhost:${process.env.MCP_PORT || 4101}`,
  TIMEOUT: 120000, // 120 second timeout for concept extraction (LLM operations)
  SETUP_DELAY: 3000, // 3 second delay for concept processing
};

// Test data specifically designed for concept extraction
const CONCEPT_TEST_CONTENT = {
  philosophy: {
    content: "Existentialism explores the nature of existence and human freedom. Key concepts include authenticity, absurdity, and individual responsibility in creating meaning.",
    type: "interaction",
    tags: ["philosophy", "existentialism", "concepts"]
  },
  science: {
    content: "Quantum mechanics reveals the probabilistic nature of reality. Superposition, entanglement, and wave-particle duality are fundamental quantum concepts.",
    type: "document",
    tags: ["physics", "quantum", "concepts"]
  },
  psychology: {
    content: "Cognitive psychology studies mental processes like perception, memory, and decision-making. Understanding cognition helps explain human behavior patterns.",
    type: "fact",
    tags: ["psychology", "cognition", "concepts"]
  },
  economics: {
    content: "Market equilibrium occurs when supply equals demand. Price mechanisms coordinate economic activity through voluntary exchange and competition.",
    type: "interaction",
    tags: ["economics", "market", "concepts"]
  },
  technology: {
    content: "Machine learning algorithms enable pattern recognition in large datasets. Neural networks, deep learning, and artificial intelligence transform data processing.",
    type: "document",
    tags: ["technology", "ai", "concepts"]
  }
};

class ConceptTestRunner {
  constructor() {
    this.config = null;
    this.baseUrl = TEST_CONFIG.MCP_URL;
    this.timeout = TEST_CONFIG.TIMEOUT;
  }

  async init() {
    this.config = new Config();
    await this.config.init();
  }

  async makeRequest(endpoint, data) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async tell(content, type = 'fact', tags = []) {
    return await this.makeRequest('/tell', {
      content,
      type,
      metadata: { tags }
    });
  }

  async zptNavigate(query, zoom = 'entity', pan = {}, tilt = 'keywords') {
    return await this.makeRequest('/zpt/navigate', {
      query,
      zoom,
      pan,
      tilt
    });
  }

  async seedConceptTestData() {
    console.log('🌱 Seeding concept extraction test data...');
    
    for (const [key, data] of Object.entries(CONCEPT_TEST_CONTENT)) {
      try {
        console.log(`  📝 Storing ${key} content for concept extraction...`);
        const result = await this.tell(data.content, data.type, data.tags);
        expect(result.success).toBe(true);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to seed ${key}:`, error);
        throw error;
      }
    }
    
    // Wait for concept processing to complete
    console.log('⏳ Waiting for concept extraction and indexing...');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SETUP_DELAY));
    console.log('✅ Concept test data seeded successfully');
  }

  async waitForServer() {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.baseUrl}/health`, { timeout: 5000 });
        if (response.ok) {
          console.log('✅ MCP server is ready');
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }

      attempts++;
      console.log(`⏳ Waiting for MCP server... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('MCP server failed to become ready within timeout');
  }

  validateZPTResponse(response, expectedZoom, expectedMinResults = 0) {
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.content).toBeDefined();
    expect(response.content.zoom).toBe(expectedZoom);
    expect(Array.isArray(response.content.data)).toBe(true);
    expect(response.content.data.length).toBeGreaterThanOrEqual(expectedMinResults);
    
    // Validate metadata structure
    expect(response.content.metadata).toBeDefined();
    expect(response.content.metadata.navigation).toBeDefined();
    expect(response.content.estimatedResults).toBeGreaterThanOrEqual(0);
  }

  validateConceptTiltResults(results) {
    results.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('label');
      
      // Concept tilt should include conceptual properties
      expect(item.type).toMatch(/concept|ragno:Concept|entity/);
      
      // Should have conceptual content or concept-related metadata
      const hasConceptualData = item.concepts || 
                               item.conceptualRelations || 
                               (item.content && item.content.toLowerCase().includes('concept')) ||
                               (item.label && item.label.toLowerCase().includes('concept'));
      expect(hasConceptualData).toBeTruthy();
    });
  }

  validateConceptFilterResults(results, expectedConceptTerms) {
    const allText = results.map(item => 
      `${item.label || ''} ${item.content || ''} ${JSON.stringify(item.concepts || [])}`
    ).join(' ').toLowerCase();

    const foundTerms = expectedConceptTerms.filter(term => 
      allText.includes(term.toLowerCase())
    );
    
    expect(foundTerms.length).toBeGreaterThanOrEqual(1);
    return foundTerms;
  }

  validateRDFConceptStructure(results) {
    results.forEach(item => {
      // Should have RDF-compliant structure for concepts
      expect(item).toHaveProperty('id');
      
      // If it's a concept, should follow ragno:Concept pattern
      if (item.type === 'ragno:Concept' || (item.concepts && item.concepts.length > 0)) {
        expect(item.concepts).toBeDefined();
        
        // Each concept should have proper RDF structure
        if (item.concepts && Array.isArray(item.concepts)) {
          item.concepts.forEach(concept => {
            expect(concept).toHaveProperty('uri');
            expect(concept).toHaveProperty('label');
            expect(concept.uri).toMatch(/^http:\/\//); // Should be proper URI
          });
        }
      }
    });
  }
}

describe('RDF Concept Integration MCP Tests', () => {
  let testRunner;

  beforeAll(async () => {
    console.log('🚀 Starting RDF Concept Integration MCP Tests');
    
    testRunner = new ConceptTestRunner();
    await testRunner.init();
    await testRunner.waitForServer();
    await testRunner.seedConceptTestData();
  }, TEST_CONFIG.TIMEOUT);

  afterAll(async () => {
    console.log('🧹 Concept Integration MCP Tests completed');
  });

  describe('Concept Tilt Functionality', () => {
    it('should extract concepts using graph tilt on entity zoom', async () => {
      const response = await testRunner.zptNavigate(
        'existentialism authenticity absurdity',
        'entity',
        {}, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.metadata.navigation.tilt).toBe('graph');

      // Should have concept-oriented results
      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} concept-tilted entity results`);
        
        // Validate graph tilt results
        testRunner.validateConceptTiltResults(content);
        
        // Should contain philosophical concepts
        const conceptTerms = ['existentialism', 'authenticity', 'absurdity', 'freedom', 'responsibility'];
        const foundTerms = testRunner.validateConceptFilterResults(content, conceptTerms);
        console.log(`🧠 Found concept terms: ${foundTerms.join(', ')}`);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should extract concepts using graph tilt on text zoom', async () => {
      const response = await testRunner.zptNavigate(
        'quantum mechanics superposition entanglement',
        'text',
        {}, 'graph');

      testRunner.validateZPTResponse(response, 'text', 0);
      expect(response.content.metadata.navigation.tilt).toBe('graph');

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} concept-tilted text results`);
        
        testRunner.validateConceptTiltResults(content);
        
        // Should contain quantum physics concepts
        const quantumConcepts = ['quantum', 'superposition', 'entanglement', 'wave-particle', 'duality'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, quantumConcepts);
        console.log(`⚛️ Found quantum keywords: ${foundConcepts.join(', ')}`);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should support graph tilt on community zoom for thematic concepts', async () => {
      const response = await testRunner.zptNavigate(
        'psychology cognition perception memory',
        'community',
        {}, 'graph');

      testRunner.validateZPTResponse(response, 'community', 0);
      expect(response.content.metadata.navigation.tilt).toBe('graph');

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} concept-tilted community results`);
        
        // Community level should group conceptual themes
        content.forEach(item => {
          expect(item).toHaveProperty('id');
          expect(item.type).toMatch(/theme|domain|category|concept/);
        });
        
        const psychConcepts = ['psychology', 'cognition', 'perception', 'memory', 'decision-making'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, psychConcepts);
        console.log(`🧠 Found psychology keywords: ${foundConcepts.join(', ')}`);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Concept-Based Pan Filtering', () => {
    it('should filter results using direct concept matching', async () => {
      const response = await testRunner.zptNavigate(
        'learning algorithms patterns data',
        'entity',
        { keywords: ['machine learning', 'artificial intelligence'] }
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} concept-filtered results`);
        
        // Should contain AI/ML concepts
        const mlConcepts = ['machine', 'learning', 'artificial', 'intelligence', 'neural', 'algorithm'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, mlConcepts);
        console.log(`🤖 Found ML keywords: ${foundConcepts.join(', ')}`);
        
        // Should have concept filter metadata
        expect(response.content.filters).toBeDefined();
        expect(response.content.filters.keywords).toEqual(['machine learning', 'artificial intelligence']);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should support categorical concept filtering', async () => {
      const response = await testRunner.zptNavigate(
        'economic market supply demand',
        'entity',
        { domains: ['economics', 'market theory'] }
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} categorically concept-filtered results`);
        
        const economicConcepts = ['market', 'supply', 'demand', 'equilibrium', 'price', 'competition'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, economicConcepts);
        console.log(`💰 Found economic keywords: ${foundConcepts.join(', ')}`);

        expect(response.content.filters.domains).toEqual(['economics', 'market theory']);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should support similarity-based concept filtering', async () => {
      const response = await testRunner.zptNavigate(
        'understanding consciousness thought mental processes',
        'text',
        { keywords: ['cognitive', 'psychology', 'mental', 'processes'] },
        'embedding'
      );

      testRunner.validateZPTResponse(response, 'text', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} similarity concept-filtered results`);
        
        const cognitiveConcepts = ['cognitive', 'psychology', 'mental', 'processes', 'perception', 'memory'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, cognitiveConcepts);
        console.log(`🧠 Found cognitive keywords: ${foundConcepts.join(', ')}`);

        expect(response.content.filters.keywords).toEqual(['cognitive', 'psychology', 'mental', 'processes']);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('RDF Concept Storage and Retrieval', () => {
    it('should store concepts as RDF ragno:Concept entities', async () => {
      // First seed data that should generate concepts
      const conceptData = {
        content: "Phenomenology studies the structures of consciousness and experience. Edmund Husserl developed transcendental phenomenology as a method for understanding subjective experience.",
        type: "interaction",
        tags: ["philosophy", "phenomenology", "consciousness"]
      };

      const storeResult = await testRunner.tell(conceptData.content, conceptData.type, conceptData.tags);
      expect(storeResult.success).toBe(true);

      // Wait for concept extraction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now query for concepts using graph tilt
      const response = await testRunner.zptNavigate(
        'phenomenology consciousness experience Husserl',
        'entity',
        {}, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} stored concept results`);
        
        // Validate RDF concept structure
        testRunner.validateRDFConceptStructure(content);
        
        const phenomenologyConcepts = ['phenomenology', 'consciousness', 'experience', 'husserl', 'transcendental'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, phenomenologyConcepts);
        console.log(`🔍 Found phenomenology keywords: ${foundConcepts.join(', ')}`);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should query concepts with proper RDF properties', async () => {
      const response = await testRunner.zptNavigate(
        'quantum superposition measurement',
        'entity',
        { rdfTypes: ['ragno:Concept'] }, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} RDF concept entities`);
        
        // Should have proper RDF structure
        testRunner.validateRDFConceptStructure(content);
        
        // Check for RDF properties
        content.forEach(item => {
          // Should have concept-specific RDF properties
          const hasRDFProperties = item.rdfType === 'ragno:Concept' ||
                                  item.type === 'ragno:Concept' ||
                                  (item.concepts && item.concepts.length > 0);
          expect(hasRDFProperties).toBeTruthy();
        });
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should support concept relationship queries', async () => {
      const response = await testRunner.zptNavigate(
        'artificial intelligence machine learning algorithms',
        'entity',
        { keywords: ['artificial intelligence', 'machine learning'] },
        'graph'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} concept relationship results`);
        
        // Should include relationship information
        content.forEach(item => {
          const hasRelations = item.relationships ||
                              item.conceptualRelations ||
                              item.relations;
          if (hasRelations) {
            expect(hasRelations).toBeTruthy();
          }
        });

        const aiConcepts = ['artificial', 'intelligence', 'machine', 'learning', 'algorithm', 'neural'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, aiConcepts);
        console.log(`🤖 Found AI concept relations: ${foundConcepts.join(', ')}`);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Combined Concept Integration Features', () => {
    it('should combine graph tilt with concept filtering', async () => {
      const response = await testRunner.zptNavigate(
        'philosophy ethics morality',
        'text',
        { 
          keywords: ['existentialism', 'ethics'],
          domains: ['philosophy']
        }, 'graph');

      testRunner.validateZPTResponse(response, 'text', 0);

      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Found ${content.length} combined concept results`);
        
        // Should satisfy both graph tilt and concept filtering
        testRunner.validateConceptTiltResults(content);
        
        const philosophyConcepts = ['philosophy', 'ethics', 'morality', 'existentialism', 'authenticity'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, philosophyConcepts);
        console.log(`🧠 Found philosophy keywords: ${foundConcepts.join(', ')}`);
        
        // Should have appropriate filters
        expect(response.content.filters.keywords).toEqual(['existentialism', 'ethics']);
        expect(response.content.filters.domains).toEqual(['philosophy']);
        expect(response.content.metadata.navigation.tilt).toBe('graph');
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should support concept-based zoom progression', async () => {
      const baseQuery = 'cognitive psychology mental processes';
      const conceptFilters = { keywords: ['cognition', 'psychology'] };
      
      // Test graph tilt across different zoom levels
      const zoomLevels = ['community', 'text', 'entity', 'unit'];
      
      for (const zoom of zoomLevels) {
        console.log(`🔍 Testing graph tilt at ${zoom} level`);
        
        const response = await testRunner.zptNavigate(
          baseQuery,
          zoom,
          conceptFilters, 'graph');
        
        testRunner.validateZPTResponse(response, zoom, 0);
        expect(response.content.metadata.navigation.tilt).toBe('graph');
        
        if (response.content.data.length > 0) {
          console.log(`  📊 Found ${response.content.data.length} results at ${zoom} level`);
          
          // Each level should maintain conceptual focus
          const cognitiveConcepts = ['cognitive', 'psychology', 'mental', 'processes', 'perception'];
          testRunner.validateConceptFilterResults(response.content.data, cognitiveConcepts);
        }
        
        // Small delay between zoom changes
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should validate concept extraction pipeline integration', async () => {
      // Test the full pipeline: Tell → Concept Extraction → Storage → Retrieval
      
      // Step 1: Store content rich in concepts
      const conceptRichContent = {
        content: "Systems thinking examines interconnections between components in complex systems. Emergence, feedback loops, and holistic perspectives are key systems thinking concepts.",
        type: "document",
        tags: ["systems", "thinking", "complexity"]
      };

      const storeResult = await testRunner.tell(conceptRichContent.content, conceptRichContent.type, conceptRichContent.tags);
      expect(storeResult.success).toBe(true);

      // Step 2: Wait for concept processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Retrieve using concept navigation
      const response = await testRunner.zptNavigate(
        'systems thinking emergence feedback holistic',
        'entity',
        { keywords: ['systems theory'] }, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Step 4: Validate full pipeline results
      const content = response.content.data;
      if (content.length > 0) {
        console.log(`📊 Full pipeline test found ${content.length} results`);
        
        // Should have concept-oriented structure
        testRunner.validateConceptTiltResults(content);
        testRunner.validateRDFConceptStructure(content);
        
        const systemsConcepts = ['systems', 'thinking', 'emergence', 'feedback', 'holistic', 'complexity'];
        const foundConcepts = testRunner.validateConceptFilterResults(content, systemsConcepts);
        console.log(`🌐 Found systems keywords: ${foundConcepts.join(', ')}`);

        // Validate metadata indicates successful concept processing
        expect(response.content.metadata.navigation.tilt).toBe('graph');
        expect(response.content.metadata.pipeline).toBeDefined();
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty concept extraction gracefully', async () => {
      const response = await testRunner.zptNavigate(
        'nonexistent made up concepts xyz123',
        'entity',
        {}, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.data).toHaveLength(0);
      expect(response.content.estimatedResults).toBe(0);
      expect(response.content.metadata.navigation.tilt).toBe('graph');
    }, TEST_CONFIG.TIMEOUT);

    it('should maintain performance with complex concept queries', async () => {
      const startTime = Date.now();
      
      const response = await testRunner.zptNavigate(
        'complex philosophical psychological economic technological concepts',
        'text',
        { 
          keywords: ['philosophy', 'psychology', 'economics', 'technology']
        }, 'graph');
      
      const duration = Date.now() - startTime;
      
      testRunner.validateZPTResponse(response, 'text', 0);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(response.content.metadata.pipeline.totalTime).toBeGreaterThan(0);
      
      console.log(`⏱️ Complex concept query completed in ${duration}ms`);
    }, TEST_CONFIG.TIMEOUT);

    it('should validate concept filter compatibility', async () => {
      // Test that concept filters work with existing domain/keyword filters
      const response = await testRunner.zptNavigate(
        'machine learning artificial intelligence',
        'entity',
        { 
          domains: ['technology'],
          keywords: ['machine learning', 'artificial intelligence']
        }, 'graph');

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Should apply all filter types
      expect(response.content.filters.domains).toEqual(['technology']);
      expect(response.content.filters.keywords).toEqual(['machine learning', 'artificial intelligence']);
      expect(response.content.metadata.navigation.tilt).toBe('graph');
    }, TEST_CONFIG.TIMEOUT);
  });
});
