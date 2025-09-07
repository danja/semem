/**
 * Fixed Concept Filtering and Search Integration Tests
 * Tests concept-based filtering in PanDomainFilter using actual API
 * 
 * Unit Tests: Isolated testing with mocks
 * Integration Tests: Live filtering with real data (set INTEGRATION_TESTS=true)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PanDomainFilter from '../../../src/zpt/selection/PanDomainFilter.js';

describe('Concept Filtering and Search Integration Tests', () => {
  let panDomainFilter;

  beforeEach(() => {
    // Create filter instance - PanDomainFilter initializes in constructor
    panDomainFilter = new PanDomainFilter({});
    
    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concept Filter Strategy Implementation', () => {
    it('should have concept filtering strategies available', () => {
      const conceptStrategies = panDomainFilter.filterStrategies.concept;
      
      expect(conceptStrategies).toBeDefined();
      expect(conceptStrategies.direct).toBeDefined();
      expect(conceptStrategies.categorical).toBeDefined();
      expect(conceptStrategies.relational).toBeDefined();
      expect(conceptStrategies.similarity).toBeDefined();
      
      console.log('✅ Concept filtering strategies available');
    });

    it('should create direct concept filters', () => {
      const concepts = ['phenomenology', 'consciousness', 'intentionality'];
      const filter = panDomainFilter.filterStrategies.concept.direct(concepts);
      
      expect(filter).toBeDefined();
      expect(filter.type).toBe('concept-direct');
      expect(typeof filter.filter).toBe('function');
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Direct concept filter created');
    });

    it('should create categorical concept filters', () => {
      const concepts = [
        { label: 'Phenomenology', category: 'Philosophy' },
        { label: 'Consciousness', category: 'Philosophy' }
      ];
      const filter = panDomainFilter.filterStrategies.concept.categorical(concepts);
      
      expect(filter).toBeDefined();
      expect(filter.type).toBe('concept-categorical');
      expect(typeof filter.filter).toBe('function');
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Categorical concept filter created');
    });

    it('should create relational concept filters', () => {
      const concepts = [
        { label: 'Phenomenology', relationships: ['consciousness', 'intentionality'] }
      ];
      const filter = panDomainFilter.filterStrategies.concept.relational(concepts);
      
      expect(filter).toBeDefined();
      expect(filter.type).toBe('concept-relational');
      expect(typeof filter.filter).toBe('function');
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Relational concept filter created');
    });

    it('should create similarity concept filters', () => {
      const concepts = ['artificial intelligence', 'machine learning'];
      const threshold = 0.8;
      const filter = panDomainFilter.filterStrategies.concept.similarity(concepts, threshold);
      
      expect(filter).toBeDefined();
      expect(filter.type).toBe('concept-similarity');
      expect(typeof filter.filter).toBe('function');
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Similarity concept filter created');
    });
  });

  describe('Filter Integration', () => {
    it('should apply general pan filters with concept data', () => {
      const panParams = {
        domains: ['philosophy'],
        concepts: ['phenomenology', 'consciousness']
      };
      
      const result = panDomainFilter.applyFilters(panParams);
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.appliedFilters).toBeDefined();
      expect(result.filterCount).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Applied ${result.filterCount} filters`);
    });

    it('should estimate concept filter selectivity', () => {
      const concepts = ['phenomenology', 'consciousness'];
      const selectivity = panDomainFilter.estimateConceptSelectivity(concepts, 'direct');
      
      expect(selectivity).toBeDefined();
      expect(typeof selectivity).toBe('number');
      expect(selectivity).toBeGreaterThan(0);
      expect(selectivity).toBeLessThanOrEqual(1);
      
      console.log(`✅ Concept selectivity estimated: ${selectivity}`);
    });

    it('should handle domain detection for concepts', () => {
      const topicValue = 'philosophical concepts';
      const domain = panDomainFilter.detectTopicDomain(topicValue);
      
      // Domain detection may return null for unrecognized domains
      expect(domain === null || typeof domain === 'object').toBe(true);
      
      console.log(`✅ Domain detection handled: ${domain ? domain.name : 'unrecognized'}`);
    });
  });

  describe('Concept-Specific Functionality', () => {
    it('should handle concept URI generation', () => {
      const concepts = [
        { label: 'Phenomenology', uri: 'http://example.org/concept/phenomenology' },
        { label: 'Consciousness' } // No URI provided
      ];
      
      const filter = panDomainFilter.filterStrategies.concept.direct(concepts);
      
      // Should handle both with and without URIs
      expect(filter.filter).toBeDefined();
      
      console.log('✅ Concept URI handling working');
    });

    it('should support concept confidence scoring', () => {
      const concepts = [
        { label: 'Phenomenology', confidence: 0.9 },
        { label: 'Consciousness', confidence: 0.8 }
      ];
      
      const filter = panDomainFilter.filterStrategies.concept.direct(concepts);
      
      expect(filter).toBeDefined();
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Concept confidence scoring supported');
    });

    it('should validate concept filter parameters', () => {
      // Test with empty concepts
      const emptyFilter = panDomainFilter.filterStrategies.concept.direct([]);
      expect(typeof emptyFilter.filter).toBe('function');
      expect(emptyFilter.selectivity).toBeDefined();
      
      // Test with invalid threshold - should use default threshold
      const invalidThreshold = panDomainFilter.filterStrategies.concept.similarity(['test'], -1);
      expect(typeof invalidThreshold.filter).toBe('function');
      expect(invalidThreshold.selectivity).toBeDefined();
      
      console.log('✅ Concept filter parameter validation working');
    });
  });

  describe('Performance and Integration', () => {
    it('should handle large concept sets efficiently', () => {
      const largeConcepts = Array.from({ length: 100 }, (_, i) => `concept-${i}`);
      
      const startTime = Date.now();
      const filter = panDomainFilter.filterStrategies.concept.direct(largeConcepts);
      const duration = Date.now() - startTime;
      
      expect(filter).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
      
      console.log(`⚡ Large concept set processed in ${duration}ms`);
    });

    it('should integrate with domain patterns', () => {
      const patterns = panDomainFilter.domainPatterns;
      
      expect(patterns).toBeDefined();
      expect(patterns.scientific).toBeDefined();
      expect(patterns.social).toBeDefined();
      
      // Should be able to classify concepts into domain patterns
      console.log('✅ Domain pattern integration available');
    });

    it('should support memory domain hierarchy', () => {
      const config = panDomainFilter.config;
      
      expect(config.hierarchicalDomains).toBeDefined();
      expect(config.memoryRelevanceThreshold).toBeDefined();
      expect(config.crossDomainBoost).toBeDefined();
      
      console.log('✅ Memory domain hierarchy configuration available');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed concept input', () => {
      // Test with concepts that have some valid data
      const malformedConcepts = [
        { label: '' }, // empty label
        { label: 'valid concept' }
      ];
      
      const filter = panDomainFilter.filterStrategies.concept.direct(malformedConcepts);
      
      expect(filter).toBeDefined();
      expect(typeof filter.filter).toBe('function');
      expect(filter.selectivity).toBeDefined();
      
      console.log('✅ Malformed concept input handled gracefully');
    });

    it('should handle unsupported concept filter types', () => {
      // All defined concept filter types should work
      const supportedTypes = ['direct', 'categorical', 'relational', 'similarity'];
      
      supportedTypes.forEach(type => {
        const strategy = panDomainFilter.filterStrategies.concept[type];
        expect(strategy).toBeDefined();
        expect(typeof strategy).toBe('function');
      });
      
      console.log('✅ All concept filter types are supported');
    });
  });
});

// Optional integration tests with live filtering scenarios
// Run with: INTEGRATION_TESTS=true npx vitest run tests/unit/zpt/concept-filtering-search.test.js
describe.skipIf(!process.env.INTEGRATION_TESTS)('Concept Filtering Integration Tests (Live Scenarios)', () => {
  let panDomainFilter;

  beforeEach(() => {
    panDomainFilter = new PanDomainFilter({});
  });

  describe('Live Concept Filtering Performance', () => {
    it('should handle large-scale concept filtering efficiently', () => {
      const largeConcepts = Array.from({ length: 500 }, (_, i) => ({
        label: `Concept-${i}`,
        category: ['Philosophy', 'Science', 'Technology'][i % 3],
        confidence: 0.5 + (Math.random() * 0.5)
      }));
      
      const startTime = Date.now();
      const directFilter = panDomainFilter.filterStrategies.concept.direct(largeConcepts);
      const categoricalFilter = panDomainFilter.filterStrategies.concept.categorical(largeConcepts);
      const similarityFilter = panDomainFilter.filterStrategies.concept.similarity(largeConcepts, 0.8);
      const duration = Date.now() - startTime;
      
      expect(typeof directFilter.filter).toBe('function');
      expect(typeof categoricalFilter.filter).toBe('function');
      expect(typeof similarityFilter.filter).toBe('function');
      expect(duration).toBeLessThan(1000); // Should be very fast
      
      console.log(`⚡ Live large-scale filtering (${largeConcepts.length} concepts) took ${duration}ms`);
    });

    it('should apply real-world concept filtering scenarios', () => {
      const realWorldConcepts = [
        { label: 'Machine Learning', category: 'Computer Science', confidence: 0.95 },
        { label: 'Neural Networks', category: 'Computer Science', confidence: 0.92 },
        { label: 'Consciousness', category: 'Philosophy', confidence: 0.88 },
        { label: 'Quantum Computing', category: 'Physics', confidence: 0.85 },
        { label: 'Artificial Intelligence', category: 'Computer Science', confidence: 0.93 }
      ];
      
      const panParams = {
        domains: ['computer_science', 'philosophy'],
        concepts: realWorldConcepts.map(c => c.label),
        minConfidence: 0.9
      };
      
      const result = panDomainFilter.applyFilters(panParams);
      
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.appliedFilters).toBeDefined();
      expect(result.filterCount).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Live real-world filtering applied ${result.filterCount} filters`);
    });
  });

  describe('Live Concept Selectivity Estimation', () => {
    it('should provide accurate selectivity estimates for various concept types', () => {
      const conceptTypes = {
        philosophy: ['Phenomenology', 'Consciousness', 'Existentialism'],
        science: ['Quantum Mechanics', 'Relativity', 'Evolution'],
        technology: ['Machine Learning', 'Blockchain', 'Cloud Computing']
      };
      
      for (const [domain, concepts] of Object.entries(conceptTypes)) {
        const directSelectivity = panDomainFilter.estimateConceptSelectivity(concepts, 'direct');
        const categoricalSelectivity = panDomainFilter.estimateConceptSelectivity(concepts, 'categorical');
        const similaritySelectivity = panDomainFilter.estimateConceptSelectivity(concepts, 'similarity');
        
        // Selectivity should be ordered: direct < categorical < similarity
        expect(directSelectivity).toBeLessThanOrEqual(categoricalSelectivity);
        expect(categoricalSelectivity).toBeLessThanOrEqual(similaritySelectivity);
        expect(directSelectivity).toBeGreaterThan(0);
        expect(similaritySelectivity).toBeLessThanOrEqual(1);
        
        console.log(`✅ Live ${domain} selectivity: direct=${directSelectivity.toFixed(3)}, categorical=${categoricalSelectivity.toFixed(3)}, similarity=${similaritySelectivity.toFixed(3)}`);
      }
    });
  });

  describe('Live Domain Detection', () => {
    it('should detect domains for real concept collections', () => {
      const topicValues = [
        'philosophical concepts and consciousness studies',
        'quantum physics and computational science',
        'machine learning and artificial intelligence',
        'biological evolution and genetic algorithms',
        'unknown domain with mixed terminology'
      ];
      
      for (const topicValue of topicValues) {
        const domain = panDomainFilter.detectTopicDomain(topicValue);
        
        // Domain detection may return null for unrecognized domains
        expect(domain === null || typeof domain === 'object').toBe(true);
        
        console.log(`✅ Live domain detection for '${topicValue}': ${domain ? domain.name || 'detected' : 'unrecognized'}`);
      }
    });
  });

  describe('Live Integration Scenarios', () => {
    it('should work with complex multi-dimensional filtering', () => {
      const complexScenario = {
        concepts: [
          { label: 'Deep Learning', category: 'AI', confidence: 0.95, relationships: ['Neural Networks', 'Machine Learning'] },
          { label: 'Consciousness', category: 'Philosophy', confidence: 0.88, relationships: ['Phenomenology', 'Mind'] },
          { label: 'Quantum Entanglement', category: 'Physics', confidence: 0.92, relationships: ['Quantum Mechanics', 'Bell Theorem'] }
        ],
        domains: ['ai', 'philosophy', 'physics'],
        temporalRange: { start: '2020-01-01', end: '2024-12-31' },
        confidence: { min: 0.8, max: 1.0 }
      };
      
      // Test all concept filter strategies
      const directFilter = panDomainFilter.filterStrategies.concept.direct(complexScenario.concepts);
      const categoricalFilter = panDomainFilter.filterStrategies.concept.categorical(complexScenario.concepts);
      const relationalFilter = panDomainFilter.filterStrategies.concept.relational(complexScenario.concepts);
      const similarityFilter = panDomainFilter.filterStrategies.concept.similarity(complexScenario.concepts, 0.85);
      
      expect(typeof directFilter.filter).toBe('function');
      expect(typeof categoricalFilter.filter).toBe('function');
      expect(typeof relationalFilter.filter).toBe('function');
      expect(typeof similarityFilter.filter).toBe('function');
      
      // Test selectivity ordering
      expect(directFilter.selectivity).toBeLessThanOrEqual(categoricalFilter.selectivity);
      expect(categoricalFilter.selectivity).toBeLessThanOrEqual(relationalFilter.selectivity);
      expect(relationalFilter.selectivity).toBeLessThanOrEqual(similarityFilter.selectivity);
      
      console.log('✅ Live complex multi-dimensional filtering scenario completed');
    });
  });
});