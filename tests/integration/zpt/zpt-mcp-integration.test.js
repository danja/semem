/**
 * ZPT MCP Integration Tests
 * Tests based on exercises in docs/manual/zpt-exercises.md
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Config from '../../../src/Config.js';

const fetch = global.fetch;
if (!fetch) {
  throw new Error('Fetch unavailable in E2E tests');
}

// Test configuration
const TEST_CONFIG = {
  MCP_PORT: process.env.MCP_PORT || 4101,
  MCP_URL: process.env.MCP_URL || `http://localhost:${process.env.MCP_PORT || 4101}`,
  TIMEOUT: 120000, // 120 second timeout for integration tests (longer due to ZPT complexity and data seeding)
  SETUP_DELAY: 2000, // 2 second delay between setup operations
};

// Test data for seeding
const TEST_CONTENT = {
  micro: {
    content: "The mitochondria produces ATP through cellular respiration. DNA contains adenine, thymine, guanine, and cytosine bases.",
    type: "document",
    tags: ["biology", "micro", "cellular"]
  },
  entities: {
    content: "Albert Einstein developed the theory of relativity at Princeton University in 1915. Marie Curie won Nobel Prizes in Physics and Chemistry.",
    type: "document", 
    tags: ["physics", "history", "scientists"]
  },
  concepts: {
    content: "Democracy requires citizen participation and transparent governance. Education empowers individuals and strengthens society.",
    type: "interaction",
    tags: ["politics", "education", "society"]
  },
  science: {
    content: "NASA launched the James Webb Space Telescope to study distant galaxies. The telescope uses infrared technology to peer through cosmic dust.",
    type: "document",
    tags: ["space", "astronomy", "technology"]
  },
  history: {
    content: "The Renaissance began in Italy during the 14th century and spread across Europe by the 16th century. Artists like Leonardo da Vinci revolutionized art and science.",
    type: "document",
    tags: ["history", "art", "renaissance"]
  },
  technology: {
    content: "Artificial intelligence and machine learning are transforming industries. Neural networks can process vast amounts of data to identify patterns.",
    type: "interaction", 
    tags: ["ai", "technology", "computing"]
  }
};

class ZPTTestRunner {
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

  async seedTestData() {
    console.log('🌱 Seeding test data for ZPT exercises...');
    
    for (const [key, data] of Object.entries(TEST_CONTENT)) {
      try {
        console.log(`  📝 Storing ${key} content...`);
        const result = await this.tell(data.content, data.type, data.tags);
        expect(result.success).toBe(true);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to seed ${key}:`, error);
        throw error;
      }
    }
    
    // Wait for indexing to complete
    console.log('⏳ Waiting for content indexing...');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SETUP_DELAY));
    console.log('✅ Test data seeded successfully');
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
        console.warn(`Health check failed with status ${response.status}: ${response.statusText}`);
      } catch (error) {
        console.warn(`Health check error: ${error.message}`);
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

  validateEntityResults(results) {
    results.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('label');
      expect(item.type).toMatch(/entity|person|place|organization/);
    });
  }

  validateUnitResults(results) {
    results.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item.type).toMatch(/unit|summary|concept|idea|process/);
    });
  }

  validateMicroResults(results) {
    results.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item.type).toMatch(/micro|molecular|fact|data/);
    });
  }
}

describe('ZPT MCP Integration Tests', () => {
  let testRunner;

  beforeAll(async () => {
    console.log('🚀 Starting ZPT MCP Integration Tests');
    
    testRunner = new ZPTTestRunner();
    await testRunner.init();
    await testRunner.waitForServer();
    await testRunner.seedTestData();
  }, TEST_CONFIG.TIMEOUT);

  afterAll(async () => {
    console.log('🧹 ZPT Integration Tests completed');
  });

  describe('Exercise Set 1: Basic Zoom Navigation', () => {
    it('Exercise 1.1: Micro Level Detail', async () => {
      const response = await testRunner.zptNavigate(
        'mitochondria ATP cellular respiration',
        'micro'
      );

      testRunner.validateZPTResponse(response, 'micro', 0);

      // Check for micro-level terms
      const content = response.content.data;
      const allText = content.map(item => 
        `${item.label || ''} ${item.content || ''}`
      ).join(' ').toLowerCase();

      // Should contain specific micro-level terms
      const molecularTerms = ['atp', 'adenine', 'thymine', 'guanine', 'cytosine'];
      const foundTerms = molecularTerms.filter(term => allText.includes(term));
      expect(foundTerms.length).toBeGreaterThanOrEqual(3);

      testRunner.validateMicroResults(content);
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 1.2: Entity Level Navigation', async () => {
      const response = await testRunner.zptNavigate(
        'Albert Einstein Princeton University',
        'entity'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Check for entity-level results
      const content = response.content.data;
      const allText = content.map(item => 
        `${item.label || ''} ${item.content || ''}`
      ).join(' ').toLowerCase();

      // Should contain named entities
      const entities = ['einstein', 'princeton', 'curie', 'nobel'];
      const foundEntities = entities.filter(entity => allText.includes(entity));
      expect(foundEntities.length).toBeGreaterThanOrEqual(1);

      testRunner.validateEntityResults(content);
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 1.3: Unit Level Abstraction', async () => {
      const response = await testRunner.zptNavigate(
        'democracy governance education empowerment',
        'unit'
      );

      testRunner.validateZPTResponse(response, 'unit', 0);

      // Check for unit-level results
      const content = response.content.data;
      const allText = content.map(item => 
        `${item.label || ''} ${item.content || ''}`
      ).join(' ').toLowerCase();

      // Should contain abstract unit terms
      const unitTerms = ['democracy', 'governance', 'education', 'empowerment'];
      const foundUnitTerms = unitTerms.filter(term => allText.includes(term));
      expect(foundUnitTerms.length).toBeGreaterThanOrEqual(1);

      testRunner.validateUnitResults(content);
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 1.4: Community Level Overview', async () => {
      const response = await testRunner.zptNavigate(
        'science technology politics education',
        'community'
      );

      testRunner.validateZPTResponse(response, 'community', 0);

      // Communities should provide high-level groupings
      const content = response.content.data;
      content.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item.type).toMatch(/community|theme|domain|category/);
      });
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Exercise Set 2: Pan Filtering', () => {
    it('Exercise 2.1: Domain-Based Filtering', async () => {
      const response = await testRunner.zptNavigate(
        'research development',
        'entity',
        { domains: ['science', 'technology'] }
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Results should be filtered to science/technology domains
      const content = response.content.data;
      expect(response.content.filters.domains).toEqual(['science', 'technology']);
      
      // Verify domain filtering was applied
      if (content.length > 0) {
        const allText = content.map(item => 
          `${item.label || ''} ${item.content || ''} ${item.domain || ''}`
        ).join(' ').toLowerCase();

        const scienceTech = ['science', 'technology', 'research', 'nasa', 'telescope', 'ai', 'neural'];
        const foundTerms = scienceTech.filter(term => allText.includes(term));
        expect(foundTerms.length).toBeGreaterThanOrEqual(1);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 2.2: Keyword-Based Filtering', async () => {
      const response = await testRunner.zptNavigate(
        'artificial intelligence machine learning',
        'entity',
        { keywords: ['ai', 'machine learning', 'neural'] }
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Results should be filtered by keywords
      expect(response.content.filters.keywords).toEqual(['ai', 'machine learning', 'neural']);
      
      if (response.content.data.length > 0) {
        const allText = response.content.data.map(item => 
          `${item.label || ''} ${item.content || ''}`
        ).join(' ').toLowerCase();

        const keywords = ['ai', 'artificial', 'intelligence', 'machine', 'learning', 'neural'];
        const foundKeywords = keywords.filter(keyword => allText.includes(keyword));
        expect(foundKeywords.length).toBeGreaterThanOrEqual(1);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 2.3: Combined Domain and Keyword Filtering', async () => {
      const response = await testRunner.zptNavigate(
        'space exploration technology',
        'entity',
        { 
          domains: ['science', 'technology'],
          keywords: ['space', 'telescope', 'nasa']
        }
      );

      testRunner.validateZPTResponse(response, 'entity', 0);

      // Should apply both domain AND keyword filters
      expect(response.content.filters.domains).toEqual(['science', 'technology']);
      expect(response.content.filters.keywords).toEqual(['space', 'telescope', 'nasa']);
      
      if (response.content.data.length > 0) {
        const allText = response.content.data.map(item => 
          `${item.label || ''} ${item.content || ''}`
        ).join(' ').toLowerCase();

        // Should match both domain and keyword criteria
        const spaceTerms = ['space', 'telescope', 'nasa', 'galaxy'];
        const foundTerms = spaceTerms.filter(term => allText.includes(term));
        expect(foundTerms.length).toBeGreaterThanOrEqual(1);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Exercise Set 3: Tilt Perspective Changes', () => {
    it('Exercise 3.1: Keywords Perspective', async () => {
      const response = await testRunner.zptNavigate(
        'climate change weather patterns ecosystem',
        'entity',
        {},
        'keywords'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.metadata.navigation.tilt).toBe('keywords');

      // Keywords perspective should emphasize important terms
      if (response.content.data.length > 0) {
        response.content.data.forEach(item => {
          expect(item).toHaveProperty('keywords');
        });
      }
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 3.2: Embedding Perspective', async () => {
      const response = await testRunner.zptNavigate(
        'NASA James Webb Space Telescope galaxies',
        'entity',
        {},
        'embedding'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.metadata.navigation.tilt).toBe('embedding');

      // Embedding perspective should emphasize named entities
      if (response.content.data.length > 0) {
        const allText = response.content.data.map(item => 
          `${item.label || ''} ${item.content || ''}`
        ).join(' ').toLowerCase();

        const entities = ['nasa', 'webb', 'telescope'];
        const foundEntities = entities.filter(entity => allText.includes(entity));
        expect(foundEntities.length).toBeGreaterThanOrEqual(1);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 3.3: Graph Perspective', async () => {
      const response = await testRunner.zptNavigate(
        'photosynthesis converts sunlight chemical energy',
        'entity',
        {},
        'graph'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.metadata.navigation.tilt).toBe('graph');

      // Graph perspective should show connections
      if (response.content.data.length > 0) {
        response.content.data.forEach(item => {
          // Should have relationship indicators
          expect(item).toHaveProperty('relationships');
        });
      }
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 3.4: Temporal Perspective', async () => {
      const response = await testRunner.zptNavigate(
        'Renaissance Italy 14th century 16th century',
        'entity',
        {},
        'temporal'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.metadata.navigation.tilt).toBe('temporal');

      // Temporal perspective should emphasize time-based information
      if (response.content.data.length > 0) {
        const allText = response.content.data.map(item => 
          `${item.label || ''} ${item.content || ''}`
        ).join(' ').toLowerCase();

        const temporalTerms = ['renaissance', '14th', '16th', 'century'];
        const foundTerms = temporalTerms.filter(term => allText.includes(term));
        expect(foundTerms.length).toBeGreaterThanOrEqual(1);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Exercise Set 4: Combined ZPT Navigation', () => {
    it('Exercise 4.1: Science Research Navigation', async () => {
      const response = await testRunner.zptNavigate(
        'molecular biology physics chemistry',
        'text',
        { domains: ['science'] },
        'graph'
      );

      testRunner.validateZPTResponse(response, 'text', 0);
      
      // Should combine text zoom, science domain filter, and graph tilt
      expect(response.content.metadata.navigation.zoom).toBe('text');
      expect(response.content.filters.domains).toEqual(['science']);
      expect(response.content.metadata.navigation.tilt).toBe('graph');
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 4.2: Historical Entity Analysis', async () => {
      const response = await testRunner.zptNavigate(
        'historical events revolution war',
        'entity',
        { keywords: ['war', 'revolution'] },
        'temporal'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      
      // Should combine entity zoom, keyword filter, and temporal tilt
      expect(response.content.metadata.navigation.zoom).toBe('entity');
      expect(response.content.filters.keywords).toEqual(['war', 'revolution']);
      expect(response.content.metadata.navigation.tilt).toBe('temporal');
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 4.3: Technology Community Exploration', async () => {
      const response = await testRunner.zptNavigate(
        'artificial intelligence blockchain quantum computing',
        'community',
        { keywords: ['innovation', 'computing'] },
        'keywords'
      );

      testRunner.validateZPTResponse(response, 'community', 0);
      
      // Should combine community zoom, keyword filter, and keywords tilt
      expect(response.content.metadata.navigation.zoom).toBe('community');
      expect(response.content.filters.keywords).toEqual(['innovation', 'computing']);
      expect(response.content.metadata.navigation.tilt).toBe('keywords');
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Exercise Set 5: Dynamic Navigation Sequences', () => {
    it('Exercise 5.1: Zoom Progression Sequence', async () => {
      // Start with community level
      let response = await testRunner.zptNavigate('scientific research', 'community');
      testRunner.validateZPTResponse(response, 'community', 0);
      
      // Move to unit level
      response = await testRunner.zptNavigate('scientific research', 'unit');
      testRunner.validateZPTResponse(response, 'unit', 0);
      
      // Move to entity level
      response = await testRunner.zptNavigate('scientific research', 'entity');
      testRunner.validateZPTResponse(response, 'entity', 0);
      
      // Move to micro level
      response = await testRunner.zptNavigate('scientific research', 'micro');
      testRunner.validateZPTResponse(response, 'micro', 0);

      // Each level should maintain topic coherence
      expect(response.content.metadata.navigation.query).toBe('scientific research');
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 5.2: Pan Filter Refinement', async () => {
      // Start with no filters
      let response = await testRunner.zptNavigate('research technology');
      testRunner.validateZPTResponse(response, 'entity', 0);
      const initialResults = response.content.data.length;
      
      // Add domain filter
      response = await testRunner.zptNavigate(
        'research technology', 
        'entity', 
        { domains: ['science'] }
      );
      testRunner.validateZPTResponse(response, 'entity', 0);
      
      // Add keyword filter
      response = await testRunner.zptNavigate(
        'research technology', 
        'entity', 
        { 
          domains: ['science'],
          keywords: ['research'] 
        }
      );
      testRunner.validateZPTResponse(response, 'entity', 0);
      
      // Should maintain relevance throughout refinement
      expect(response.content.filters.domains).toEqual(['science']);
      expect(response.content.filters.keywords).toEqual(['research']);
    }, TEST_CONFIG.TIMEOUT);

    it('Exercise 5.3: Tilt Perspective Switching', async () => {
      const baseParams = {
        query: 'artificial intelligence',
        zoom: 'text',
        pan: { domains: ['technology'] }
      };

      // Test different tilt perspectives on same content
      const tilts = ['keywords', 'embedding', 'graph', 'temporal'];
      
      for (const tilt of tilts) {
        const response = await testRunner.zptNavigate(
          baseParams.query,
          baseParams.zoom,
          baseParams.pan,
          tilt
        );
        
        testRunner.validateZPTResponse(response, 'text', 0);
        expect(response.content.metadata.navigation.tilt).toBe(tilt);
        
        // Same base query and filters, different perspective
        expect(response.content.metadata.navigation.query).toBe(baseParams.query);
        expect(response.content.filters.domains).toEqual(['technology']);
      }
    }, TEST_CONFIG.TIMEOUT);
  });

  describe('Performance and Quality Tests', () => {
    it('should complete navigation within expected time bounds', async () => {
      const startTime = Date.now();
      
      const response = await testRunner.zptNavigate('test query', 'entity');
      
      const duration = Date.now() - startTime;
      
      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Should include timing metadata
      expect(response.content.metadata.pipeline).toBeDefined();
      expect(response.content.metadata.pipeline.totalTime).toBeGreaterThan(0);
    }, TEST_CONFIG.TIMEOUT);

    it('should handle empty results gracefully', async () => {
      const response = await testRunner.zptNavigate(
        'completely nonexistent made up query xyz123',
        'entity'
      );

      testRunner.validateZPTResponse(response, 'entity', 0);
      expect(response.content.data).toHaveLength(0);
      expect(response.content.estimatedResults).toBe(0);
      expect(response.content.suggestions).toBeDefined();
    }, TEST_CONFIG.TIMEOUT);

    it('should provide meaningful error messages for invalid parameters', async () => {
      try {
        await testRunner.zptNavigate('', 'invalid_zoom');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toMatch(/invalid|parameter|zoom/i);
      }
    }, TEST_CONFIG.TIMEOUT);

    it('should maintain consistency across repeated requests', async () => {
      const params = {
        query: 'artificial intelligence',
        zoom: 'entity',
        pan: { domains: ['technology'] },
        tilt: 'keywords'
      };

      // Make multiple identical requests
      const responses = await Promise.all([
        testRunner.zptNavigate(params.query, params.zoom, params.pan, params.tilt),
        testRunner.zptNavigate(params.query, params.zoom, params.pan, params.tilt),
        testRunner.zptNavigate(params.query, params.zoom, params.pan, params.tilt)
      ]);

      // All responses should be successful
      responses.forEach(response => {
        testRunner.validateZPTResponse(response, 'entity', 0);
      });

      // Results should be consistent (same number of items, same structure)
      const firstResponse = responses[0];
      responses.slice(1).forEach(response => {
        expect(response.content.data.length).toBe(firstResponse.content.data.length);
        expect(response.content.zoom).toBe(firstResponse.content.zoom);
        expect(response.content.estimatedResults).toBe(firstResponse.content.estimatedResults);
      });
    }, TEST_CONFIG.TIMEOUT);
  });
});
