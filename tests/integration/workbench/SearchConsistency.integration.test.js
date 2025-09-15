/**
 * Search Consistency Integration Tests
 * Tests search reliability, consistency, and quality across different scenarios
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/workbench/SearchConsistency.integration.test.js --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Set up global fetch for integration tests
global.fetch = fetch;
globalThis.fetch = fetch;

// Test configuration
const WORKBENCH_BASE_URL = 'http://localhost:3000';
const API_BASE_URL = `${WORKBENCH_BASE_URL}/api`;

// Skip all tests if INTEGRATION_TESTS is not set
describe.skipIf(!process.env.INTEGRATION_TESTS)('Search Consistency and Quality (Live Services)', () => {
  let testFiles = [];
  let testDocuments = [];

  beforeAll(async () => {
    console.log('Setting up Search Consistency Integration Tests...');

    // Verify services are running
    try {
      const healthCheck = await fetch(`${WORKBENCH_BASE_URL}/`, { timeout: 5000 });
      if (!healthCheck.ok) {
        throw new Error(`Workbench not responding: ${healthCheck.status}`);
      }
    } catch (error) {
      console.error('❌ Workbench service not available:', error.message);
      throw error;
    }

    // Pre-populate with test documents for search consistency tests
    await setupTestDocuments();
  });

  afterAll(async () => {
    console.log('Cleaning up search consistency test files...');
    for (const filePath of testFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup ${filePath}:`, error.message);
      }
    }
  });

  async function setupTestDocuments() {
    const documents = [
      {
        id: 'robotics-001',
        content: `
Robotics Manufacturing Study RBT001

Industrial automation using collaborative robots (cobots) has shown significant improvements:
- Manufacturing productivity increased by 42%
- Workplace safety incidents reduced by 28%
- Implementation ROI achieved within 16 months
- Worker satisfaction improved due to reduced repetitive tasks

Key technologies: Computer vision, force sensors, AI-driven path planning
Applications: Assembly, quality inspection, material handling
`,
        category: 'robotics'
      },
      {
        id: 'ai-research-002',
        content: `
Artificial Intelligence Optimization Research AI002

Novel neural network optimization techniques demonstrate superior performance:
- Convergence speed improved by 35% over baseline Adam optimizer
- Memory usage reduced by 20% through gradient compression
- Training stability enhanced across multiple architectures
- Generalization performance increased by 8% on validation sets

Methodologies: Adaptive learning rates, momentum scheduling, regularization
Datasets: ImageNet, CIFAR-100, Custom industrial datasets
`,
        category: 'artificial-intelligence'
      },
      {
        id: 'sustainability-003',
        content: `
Green Technology Sustainability Report GRT003

Renewable energy integration in manufacturing facilities yields multiple benefits:
- Carbon footprint reduction of 45% year-over-year
- Energy costs decreased by 32% through solar integration
- Waste reduction achieved 60% through circular economy practices
- Employee engagement in sustainability initiatives increased 85%

Technologies: Solar panels, wind turbines, energy storage systems
Certifications: LEED Platinum, ISO 14001, B-Corp status
`,
        category: 'sustainability'
      }
    ];

    for (const doc of documents) {
      const filename = `test-${doc.id}-${Date.now()}.txt`;
      const filepath = path.join('/tmp', filename);

      fs.writeFileSync(filepath, doc.content);
      testFiles.push(filepath);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'research',
          metadata: {
            testId: doc.id,
            category: doc.category,
            testDocument: true
          }
        })
      });

      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        testDocuments.push({ ...doc, uploadResult: result });
      }
    }

    // Wait for all documents to be processed
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log(`✅ Set up ${testDocuments.length} test documents for search consistency tests`);
  }

  describe('Search Consistency Tests', () => {
    it('should return consistent results across multiple identical queries', async () => {
      const query = 'What information is available about robotics and manufacturing productivity?';
      const results = [];
      const iterations = 5;

      // Perform same query multiple times
      for (let i = 0; i < iterations; i++) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            mode: 'standard',
            useContext: true,
            threshold: 0.3
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        results.push(result);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Analyze consistency
      const responseLengths = results.map(r => r.response.length);
      const avgLength = responseLengths.reduce((a, b) => a + b) / responseLengths.length;
      const lengthVariance = responseLengths.map(len => Math.abs(len - avgLength));
      const maxVariance = Math.max(...lengthVariance);

      // Response lengths should be reasonably consistent (within 50% variance)
      expect(maxVariance / avgLength).toBeLessThan(0.5);

      // All responses should mention robotics
      const roboticsMentions = results.filter(r =>
        r.response.toLowerCase().includes('robot') ||
        r.response.toLowerCase().includes('manufacturing')
      ).length;
      expect(roboticsMentions / iterations).toBeGreaterThan(0.6);
    });

    it('should find uploaded content with different query formulations', async () => {
      const queryVariations = [
        'Tell me about productivity improvements in robotics',
        'What are the benefits of collaborative robots?',
        'How much productivity gain from cobots?',
        'What ROI is mentioned for robotic systems?',
        'Manufacturing automation productivity statistics'
      ];

      const results = [];
      for (const query of queryVariations) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            mode: 'standard',
            useContext: true,
            threshold: 0.3
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        results.push({ query, result });
      }

      // At least 80% of queries should find relevant robotics content
      const relevantResults = results.filter(({ result }) => {
        const text = result.response.toLowerCase();
        return text.includes('42%') ||
               text.includes('productivity') ||
               text.includes('robot') ||
               text.includes('cobot') ||
               text.includes('16 months') ||
               text.includes('manufacturing');
      });

      expect(relevantResults.length / queryVariations.length).toBeGreaterThan(0.8);
    });
  });

  describe('Search Quality and Relevance', () => {
    it('should provide contextually appropriate responses', async () => {
      const testCases = [
        {
          query: 'What sustainability metrics are available?',
          expectedContent: ['45%', 'carbon', 'renewable', 'solar', '32%', 'energy'],
          category: 'sustainability'
        },
        {
          query: 'Tell me about AI optimization research',
          expectedContent: ['35%', 'convergence', 'neural', 'adam', 'optimizer'],
          category: 'ai'
        },
        {
          query: 'What manufacturing improvements are documented?',
          expectedContent: ['42%', 'productivity', 'robot', 'safety', 'manufacturing'],
          category: 'robotics'
        }
      ];

      for (const testCase of testCases) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: testCase.query,
            mode: 'comprehensive',
            useContext: true,
            threshold: 0.2
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.response.length).toBeGreaterThan(100);

        // Check for expected content
        const responseText = result.response.toLowerCase();
        const foundTerms = testCase.expectedContent.filter(term =>
          responseText.includes(term.toLowerCase())
        );

        expect(foundTerms.length).toBeGreaterThan(0);
      }
    });

    it('should handle complex multi-domain queries effectively', async () => {
      const complexQueries = [
        'Compare productivity improvements between robotics and AI research',
        'What are the ROI timelines mentioned across different technologies?',
        'How do sustainability and manufacturing efficiency relate?',
        'What percentage improvements are documented in recent uploads?'
      ];

      for (const query of complexQueries) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            mode: 'comprehensive',
            useContext: true,
            threshold: 0.2
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.response.length).toBeGreaterThan(150);

        // Should synthesize information from multiple sources
        const responseText = result.response.toLowerCase();
        const hasPercentages = /\d+%/.test(result.response);
        const hasComparison = responseText.includes('compared') ||
                              responseText.includes('versus') ||
                              responseText.includes('while') ||
                              responseText.includes('whereas');

        expect(hasPercentages || hasComparison).toBe(true);
      }
    });
  });

  describe('Search Performance and Reliability', () => {
    it('should respond within reasonable time limits', async () => {
      const query = 'What are the key findings in recent research documents?';
      const startTime = Date.now();

      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          mode: 'standard',
          useContext: true,
          threshold: 0.3
        })
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.ok).toBe(true);
      expect(responseTime).toBeLessThan(15000); // 15 second timeout

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(50);
    });

    it('should handle concurrent search requests reliably', async () => {
      const queries = [
        'What robotics information is available?',
        'Tell me about AI research findings',
        'What sustainability data do you have?',
        'Show me productivity metrics',
        'What are the ROI figures mentioned?'
      ];

      const requestPromises = queries.map(query =>
        fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            mode: 'standard',
            useContext: true,
            threshold: 0.3
          })
        })
      );

      const responses = await Promise.all(requestPromises);

      // All requests should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
        expect(result.response.length).toBeGreaterThan(20);
      }
    });
  });

  describe('Search Edge Cases and Error Handling', () => {
    it('should handle very specific queries gracefully', async () => {
      const specificQuery = 'What is the exact productivity percentage for collaborative robots in document RBT001?';

      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: specificQuery,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.1
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);

      // Should either find the specific information or provide a relevant response
      expect(result.response.length).toBeGreaterThan(30);
    });

    it('should handle queries for non-existent content appropriately', async () => {
      const nonExistentQuery = 'What information is available about quantum blockchain cryptocurrency mining efficiency?';

      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nonExistentQuery,
          mode: 'standard',
          useContext: true,
          threshold: 0.3
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);

      // Should provide helpful response even when no specific match
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
    });

    it('should handle various similarity thresholds consistently', async () => {
      const query = 'Tell me about manufacturing improvements';
      const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
      const results = [];

      for (const threshold of thresholds) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            mode: 'standard',
            useContext: true,
            threshold: threshold
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        results.push({ threshold, result });
      }

      // Lower thresholds should generally return more content
      const lowThresholdResponse = results.find(r => r.threshold === 0.1);
      const highThresholdResponse = results.find(r => r.threshold === 0.5);

      expect(lowThresholdResponse.result.response.length).toBeGreaterThan(50);
      expect(highThresholdResponse.result.response.length).toBeGreaterThan(20);
    });
  });
});