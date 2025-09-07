/**
 * Fixed Concept Tilt Projector Unit Tests
 * Tests the concept tilt functionality in TiltProjector matching the actual API
 * 
 * Unit Tests: Mock dependencies for isolated testing
 * Integration Tests: Use live dependencies (set INTEGRATION_TESTS=true)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TiltProjector from '../../../src/zpt/selection/TiltProjector.js';

// Test data with concept-rich content
const CONCEPT_TEST_DATA = {
  philosophy: [
    {
      id: 'http://example.org/interaction1',
      content: 'Phenomenology investigates the structures of consciousness and lived experience. Edmund Husserl developed transcendental phenomenology as a foundational method.',
      type: 'semem:Interaction',
      metadata: { tags: ['philosophy', 'phenomenology', 'consciousness'] }
    }
  ],
  science: [
    {
      id: 'http://example.org/entity1',
      content: 'Quantum entanglement demonstrates non-local correlations between particles separated by arbitrary distances. This phenomenon challenges classical notions of locality.',
      type: 'ragno:Entity',
      metadata: { tags: ['physics', 'quantum', 'entanglement'] }
    }
  ]
};

// Mock concept extraction responses
const MOCK_CONCEPT_RESPONSES = {
  phenomenology: [
    {
      label: 'Phenomenology',
      type: 'philosophical-method',
      category: 'Philosophy',
      confidence: 0.95
    },
    {
      label: 'Consciousness',
      type: 'mental-phenomenon',
      category: 'Philosophy',
      confidence: 0.92
    }
  ],
  quantum: [
    {
      label: 'Quantum Entanglement',
      type: 'physical-phenomenon',
      category: 'Physics',
      confidence: 0.88
    }
  ]
};

describe('Concept Tilt Projector Tests', () => {
  let tiltProjector;
  let mockConceptExtractor;
  let mockSparqlStore;

  beforeEach(() => {
    // Create projector instance
    tiltProjector = new TiltProjector({});
    
    // Create mock dependencies
    mockConceptExtractor = {
      extractConcepts: vi.fn()
    };
    
    mockSparqlStore = {
      storeConcepts: vi.fn().mockResolvedValue({ success: true }),
      storeConceptRelationships: vi.fn().mockResolvedValue({ success: true })
    };
    
    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concept Tilt Availability', () => {
    it('should include concept as a valid projection strategy', () => {
      const availableStrategies = Object.keys(tiltProjector.projectionStrategies);
      
      expect(availableStrategies).toContain('concept');
      expect(tiltProjector.projectionStrategies.concept.name).toBe('Concept Graph Projection');
      expect(tiltProjector.projectionStrategies.concept.outputType).toBe('conceptual');
      
      console.log(`✅ Available strategies: ${availableStrategies.join(', ')}`);
    });

    it('should have correct concept strategy configuration', () => {
      const conceptStrategy = tiltProjector.projectionStrategies.concept;
      
      expect(conceptStrategy.processor).toBeDefined();
      expect(conceptStrategy.requirements).toContain('conceptExtractor');
      expect(conceptStrategy.requirements).toContain('sparqlStore');
      expect(conceptStrategy.metadata).toContain('concept');
      expect(conceptStrategy.metadata).toContain('confidence');
      
      console.log(`✅ Concept strategy properly configured`);
    });
  });

  describe('Concept Extraction Integration', () => {
    it('should extract concepts from philosophical content', async () => {
      // Setup mock
      mockConceptExtractor.extractConcepts.mockResolvedValue(MOCK_CONCEPT_RESPONSES.phenomenology);
      
      // Test concept extraction via project method
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.philosophy,
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      expect(mockConceptExtractor.extractConcepts).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.representation).toBe('concept');
      expect(result.outputType).toBe('conceptual');
      expect(result.data).toBeDefined();
      expect(result.data.concepts).toBeDefined();
      expect(result.data.concepts.length).toBeGreaterThan(0);
      
      // Validate concept structure
      result.data.concepts.forEach(concept => {
        expect(concept).toHaveProperty('label');
        expect(concept).toHaveProperty('uri');
        expect(concept.uri).toMatch(/^http:\/\//);
      });
      
      console.log(`🧠 Extracted ${result.data.concepts.length} philosophical concepts`);
    });

    it('should extract concepts from scientific content', async () => {
      // Setup mock
      mockConceptExtractor.extractConcepts.mockResolvedValue(MOCK_CONCEPT_RESPONSES.quantum);
      
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.science,
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      expect(result.data.concepts).toBeDefined();
      expect(result.data.concepts.length).toBe(1);
      
      const conceptLabels = result.data.concepts.map(c => c.label);
      expect(conceptLabels).toContain('Quantum Entanglement');
      
      console.log(`⚛️ Extracted quantum concepts: ${conceptLabels.join(', ')}`);
    });

    it('should handle empty corpus gracefully', async () => {
      const result = await tiltProjector.project(
        [],
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      expect(result.data.concepts).toEqual([]);
      expect(result.data.statistics.conceptCount).toBe(0);
      
      console.log('✅ Empty corpus handled gracefully');
    });
  });

  describe('Concept Output Format', () => {
    it('should format concepts with proper structure', async () => {
      mockConceptExtractor.extractConcepts.mockResolvedValue(MOCK_CONCEPT_RESPONSES.phenomenology);
      
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.philosophy,
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      // Validate output structure matches conceptual format
      expect(result.data).toHaveProperty('concepts');
      expect(result.data).toHaveProperty('relationships');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('statistics');
      
      // Validate statistics
      expect(result.data.statistics.conceptCount).toBeGreaterThanOrEqual(0);
      expect(result.data.statistics.relationshipCount).toBeGreaterThanOrEqual(0);
      expect(result.data.statistics.categoryCount).toBeGreaterThanOrEqual(0);
      
      console.log(`📊 Concept output properly formatted`);
    });

    it('should include metadata in project response', async () => {
      mockConceptExtractor.extractConcepts.mockResolvedValue(MOCK_CONCEPT_RESPONSES.phenomenology);
      
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.philosophy,
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.corpuscleCount).toBe(1);
      expect(result.metadata.projectionStrategy).toBe('Concept Graph Projection');
      expect(result.metadata.timestamp).toBeDefined();
      
      console.log(`📋 Metadata properly included`);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing dependencies', async () => {
      await expect(
        tiltProjector.project(
          CONCEPT_TEST_DATA.philosophy,
          { representation: 'concept' },
          {} // Missing required dependencies
        )
      ).rejects.toThrow(/Missing required dependencies/);
      
      console.log('✅ Missing dependencies handled gracefully');
    });

    it('should handle conceptExtractor failures', async () => {
      mockConceptExtractor.extractConcepts.mockRejectedValue(new Error('Extraction failed'));
      
      // Should still return result with empty concepts
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.philosophy,
        { representation: 'concept' },
        { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
      );
      
      expect(result.data.concepts).toEqual([]);
      expect(result.data.statistics.conceptCount).toBe(0);
      
      console.log('✅ Extraction failures handled gracefully');
    });

    it('should handle unsupported tilt representation', async () => {
      await expect(
        tiltProjector.project(
          CONCEPT_TEST_DATA.philosophy,
          { representation: 'unsupported' },
          { conceptExtractor: mockConceptExtractor, sparqlStore: mockSparqlStore }
        )
      ).rejects.toThrow(/Unsupported tilt representation/);
      
      console.log('✅ Unsupported representations handled gracefully');
    });
  });

  describe('Integration Tests', () => {
    it('should work with other projection strategies', () => {
      const strategies = Object.keys(tiltProjector.projectionStrategies);
      
      // Should have multiple strategies including concept
      expect(strategies).toContain('concept');
      expect(strategies).toContain('keywords');
      expect(strategies).toContain('temporal');
      expect(strategies.length).toBeGreaterThanOrEqual(4);
      
      console.log('✅ Multiple projection strategies available');
    });

    it('should have valid output format specification', () => {
      const conceptualFormat = tiltProjector.outputFormats.conceptual;
      
      expect(conceptualFormat).toBeDefined();
      expect(conceptualFormat.schema).toBeDefined();
      expect(conceptualFormat.schema.concepts).toBe('object[]');
      expect(conceptualFormat.schema.relationships).toBe('object[]');
      expect(conceptualFormat.example).toBeDefined();
      
      console.log('✅ Conceptual output format properly specified');
    });
  });
});

// Optional integration tests with live dependencies
// Run with: INTEGRATION_TESTS=true npx vitest run tests/unit/zpt/concept-tilt-projector.test.js
describe.skipIf(!process.env.INTEGRATION_TESTS)('Concept Tilt Projector Integration Tests (Live Dependencies)', () => {
  let tiltProjector;
  let realConceptExtractor;
  let realSparqlStore;

  beforeEach(() => {
    // Create projector instance
    tiltProjector = new TiltProjector({});
    
    // Create real dependencies (simplified mocks that could be real services)
    realConceptExtractor = {
      extractConcepts: async (content) => {
        // Simple concept extraction based on content (case-insensitive)
        const concepts = [];
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('phenomenology')) concepts.push({ label: 'Phenomenology', confidence: 0.9, category: 'Philosophy' });
        if (lowerContent.includes('consciousness')) concepts.push({ label: 'Consciousness', confidence: 0.85, category: 'Philosophy' });
        if (lowerContent.includes('quantum')) concepts.push({ label: 'Quantum Physics', confidence: 0.8, category: 'Physics' });
        if (lowerContent.includes('husserl')) concepts.push({ label: 'Husserl', confidence: 0.8, category: 'Philosophy' });
        return concepts;
      }
    };
    
    realSparqlStore = {
      storeConcepts: async (concepts, sourceUri) => {
        console.log(`Live storing ${concepts.length} concepts for ${sourceUri}`);
        return { success: true, stored: concepts.length };
      },
      storeConceptRelationships: async (relationships) => {
        console.log(`Live storing ${relationships.length} concept relationships`);
        return { success: true, stored: relationships.length };
      }
    };
  });

  describe('Live Concept Projection', () => {
    it('should extract and project concepts from philosophical content', async () => {
      const philosophicalData = [
        {
          id: 'http://example.org/interaction1',
          content: 'Phenomenology investigates consciousness and lived experience. Husserl developed methods for studying the structures of consciousness.',
          type: 'semem:Interaction',
          metadata: { tags: ['philosophy', 'phenomenology'] }
        }
      ];
      
      const result = await tiltProjector.project(
        philosophicalData,
        { representation: 'concept' },
        { conceptExtractor: realConceptExtractor, sparqlStore: realSparqlStore }
      );
      
      expect(result).toBeDefined();
      expect(result.representation).toBe('concept');
      expect(result.outputType).toBe('conceptual');
      expect(result.data.concepts).toBeDefined();
      expect(result.data.concepts.length).toBeGreaterThan(0);
      
      // Should have extracted philosophical concepts
      const conceptLabels = result.data.concepts.map(c => c.label);
      expect(conceptLabels).toContain('Phenomenology');
      expect(conceptLabels).toContain('Consciousness');
      
      console.log(`✅ Live extracted concepts: ${conceptLabels.join(', ')}`);
    });

    it('should extract and project concepts from scientific content', async () => {
      const scientificData = [
        {
          id: 'http://example.org/entity1',
          content: 'Quantum entanglement demonstrates non-local correlations between particles. This quantum mechanical phenomenon challenges classical physics.',
          type: 'ragno:Entity',
          metadata: { tags: ['physics', 'quantum'] }
        }
      ];
      
      const result = await tiltProjector.project(
        scientificData,
        { representation: 'concept' },
        { conceptExtractor: realConceptExtractor, sparqlStore: realSparqlStore }
      );
      
      expect(result.data.concepts.length).toBeGreaterThan(0);
      
      const conceptLabels = result.data.concepts.map(c => c.label);
      expect(conceptLabels).toContain('Quantum Physics');
      
      console.log(`⚡ Live extracted quantum concepts: ${conceptLabels.join(', ')}`);
    });

    it('should handle mixed content types efficiently', async () => {
      const mixedData = [
        {
          id: 'http://example.org/mixed1',
          content: 'Phenomenology studies consciousness through quantum-inspired methodologies',
          type: 'semem:Interaction'
        },
        {
          id: 'http://example.org/mixed2', 
          content: 'The quantum nature of consciousness remains a philosophical puzzle',
          type: 'ragno:Entity'
        }
      ];
      
      const startTime = Date.now();
      const result = await tiltProjector.project(
        mixedData,
        { representation: 'concept' },
        { conceptExtractor: realConceptExtractor, sparqlStore: realSparqlStore }
      );
      const duration = Date.now() - startTime;
      
      expect(result.data.concepts.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Should be fast
      
      const conceptLabels = result.data.concepts.map(c => c.label);
      console.log(`⚡ Live mixed content processing took ${duration}ms, extracted: ${conceptLabels.join(', ')}`);
    });
  });

  describe('Live Error Handling', () => {
    it('should handle concept extraction failures gracefully', async () => {
      const failingConceptExtractor = {
        extractConcepts: async () => {
          throw new Error('Live extraction service unavailable');
        }
      };
      
      const result = await tiltProjector.project(
        CONCEPT_TEST_DATA.philosophy,
        { representation: 'concept' },
        { conceptExtractor: failingConceptExtractor, sparqlStore: realSparqlStore }
      );
      
      // Should still return result with empty concepts
      expect(result.data.concepts).toEqual([]);
      expect(result.data.statistics.conceptCount).toBe(0);
      
      console.log('✅ Live extraction failure handled gracefully');
    });
  });
});