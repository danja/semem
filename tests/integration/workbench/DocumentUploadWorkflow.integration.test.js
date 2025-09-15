/**
 * Workbench Document Upload Workflow Integration Tests
 * Tests the complete upload -> chunk -> embed -> ask workflow
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/workbench/DocumentUploadWorkflow.integration.test.js --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
describe.skipIf(!process.env.INTEGRATION_TESTS)('Workbench Document Upload Workflow (Live Services)', () => {
  let testFiles = [];
  let uploadedDocuments = [];

  beforeAll(async () => {
    console.log('Setting up Document Upload Workflow Integration Tests...');

    // Verify services are running
    try {
      const healthCheck = await fetch(`${WORKBENCH_BASE_URL}/`, {
        timeout: 5000
      });
      if (!healthCheck.ok) {
        throw new Error(`Workbench not responding: ${healthCheck.status}`);
      }
    } catch (error) {
      console.error('❌ Workbench service not available:', error.message);
      console.error('Please ensure workbench is running on port 3000');
      throw error;
    }
  });

  afterAll(async () => {
    console.log('Cleaning up test files and documents...');

    // Clean up test files
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

  beforeEach(() => {
    // Reset arrays for each test
    testFiles.length = 0;
    uploadedDocuments.length = 0;
  });

  describe('Document Upload with Immediate Processing', () => {
    it('should upload and immediately process a text document', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `robotics-research-${testId}.txt`;
      const content = `
Advanced Manufacturing Robotics Research ${testId}

This document presents comprehensive research on collaborative robotics systems.
Key findings include 40% productivity improvements and 25% safety improvements.
ROI typically achieved within 18-24 months.

Test identifier: ${testId}
Research conducted at Robotics Manufacturing Institute.
`;

      // Create test file
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      // Upload document
      const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'research',
          metadata: {
            testId,
            category: 'robotics-research'
          }
        })
      });

      expect(uploadResponse.ok).toBe(true);
      const uploadResult = await uploadResponse.json();
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.filename).toBe(filename);

      uploadedDocuments.push(uploadResult);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test immediate searchability
      const searchResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `What information is available about robotics research ${testId}?`,
          mode: 'basic',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(searchResponse.ok).toBe(true);
      const searchResult = await searchResponse.json();
      expect(searchResult.success).toBe(true);
      expect(searchResult.response).toBeDefined();
      expect(searchResult.response.length).toBeGreaterThan(50);

      // Should find the uploaded content
      const responseText = searchResult.response.toLowerCase();
      expect(
        responseText.includes(testId.toLowerCase()) ||
        responseText.includes('robotics') ||
        responseText.includes('manufacturing')
      ).toBe(true);
    });

    it('should process chunking and embeddings workflow', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `technical-specs-${testId}.txt`;
      const content = `
Technical Specifications Document ${testId}

System Architecture:
- Microservices-based design with event-driven communication
- Container orchestration using Kubernetes
- Message queuing via Apache Kafka
- Database: PostgreSQL with Redis caching
- API Gateway: Kong with rate limiting

Performance Metrics:
- Response time: <100ms for 95th percentile
- Throughput: 10,000 requests per second
- Availability: 99.9% SLA
- Scalability: Auto-scaling from 2-50 instances

Security Features:
- OAuth 2.0 with PKCE for authentication
- JWT tokens with 15-minute expiry
- TLS 1.3 encryption for all communications
- CORS policies for cross-origin requests
- Input validation and sanitization

Test identifier: ${testId}
Document version: 2.1.0
Last updated: ${new Date().toISOString()}
`;

      // Create and upload test file
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      const uploadResult = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'technical',
          metadata: { testId, category: 'specifications' }
        })
      });

      expect(uploadResult.ok).toBe(true);
      const upload = await uploadResult.json();
      expect(upload.success).toBe(true);

      // Test chunking operation
      const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'chunk_documents',
          options: {
            maxChunkSize: 1500,
            minChunkSize: 100,
            overlapSize: 50,
            strategy: 'semantic'
          }
        })
      });

      expect(chunkingResponse.ok).toBe(true);
      const chunkingResult = await chunkingResponse.json();
      expect(chunkingResult.success).toBe(true);

      // Wait for chunking to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test embedding generation
      const embeddingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'process_lazy',
          options: {}
        })
      });

      expect(embeddingResponse.ok).toBe(true);
      const embeddingResult = await embeddingResponse.json();
      expect(embeddingResult.success).toBe(true);

      // Wait for embedding generation
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test comprehensive ask workflow
      const askResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `What are the performance metrics and security features mentioned in document ${testId}?`,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(askResponse.ok).toBe(true);
      const askResult = await askResponse.json();
      expect(askResult.success).toBe(true);
      expect(askResult.response).toBeDefined();
      expect(askResult.response.length).toBeGreaterThan(100);

      // Should mention specific technical details
      const responseText = askResult.response.toLowerCase();
      const mentionsPerformance = responseText.includes('100ms') ||
                                 responseText.includes('10,000') ||
                                 responseText.includes('99.9%');
      const mentionsSecurity = responseText.includes('oauth') ||
                              responseText.includes('jwt') ||
                              responseText.includes('tls');

      expect(mentionsPerformance || mentionsSecurity).toBe(true);
    });
  });

  describe('Search Quality and Relevance', () => {
    it('should provide high-quality search results for uploaded content', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `research-paper-${testId}.txt`;
      const content = `
Machine Learning Research Paper ${testId}

Abstract:
This paper presents a novel approach to neural network optimization using
gradient descent variants. Our method achieves 15% better convergence rates
compared to standard Adam optimizer.

Introduction:
Deep learning has revolutionized artificial intelligence applications.
However, optimization challenges remain in training large-scale models.
We propose AdaptiveGrad, a new optimization algorithm.

Methodology:
- Dataset: ImageNet-1K with 1.2M training samples
- Architecture: ResNet-50 with batch normalization
- Training: 100 epochs with learning rate scheduling
- Hardware: 8x NVIDIA V100 GPUs with 32GB memory each

Results:
- Top-1 accuracy: 76.8% (baseline: 76.1%)
- Top-5 accuracy: 93.2% (baseline: 92.9%)
- Training time: 8.5 hours (baseline: 10.2 hours)
- Memory usage: 28GB peak (baseline: 30GB peak)

Conclusion:
AdaptiveGrad demonstrates superior performance across multiple metrics.
Future work will explore applications to transformer architectures.

Test identifier: ${testId}
Authors: AI Research Team
Publication: ICML 2024
`;

      // Upload research document
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      const uploadResult = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'research',
          metadata: { testId, category: 'machine-learning' }
        })
      });

      expect(uploadResult.ok).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test multiple search queries
      const queries = [
        {
          question: `What are the results of the machine learning research in document ${testId}?`,
          expectedTerms: ['accuracy', '76.8%', 'training', 'hours']
        },
        {
          question: 'What optimization algorithms are discussed in recent uploads?',
          expectedTerms: ['adaptivegrad', 'adam', 'gradient', 'optimizer']
        },
        {
          question: 'What hardware specifications are mentioned in research papers?',
          expectedTerms: ['nvidia', 'v100', 'gpu', 'memory']
        }
      ];

      for (const query of queries) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query.question,
            mode: 'comprehensive',
            useContext: true,
            threshold: 0.2
          })
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
        expect(result.response.length).toBeGreaterThan(50);

        // Check if response contains expected terms
        const responseText = result.response.toLowerCase();
        const foundTerms = query.expectedTerms.filter(term =>
          responseText.includes(term.toLowerCase())
        );

        expect(foundTerms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed document uploads gracefully', async () => {
      const response = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: 'invalid://url',
          filename: '',
          mediaType: 'text/plain'
        })
      });

      // Should handle error gracefully, not crash
      expect([400, 422, 500].includes(response.status)).toBe(true);
    });

    it('should handle empty search queries appropriately', async () => {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: '',
          mode: 'basic',
          useContext: true
        })
      });

      // Should return meaningful response or appropriate error
      if (response.ok) {
        const result = await response.json();
        expect(result.response).toBeDefined();
      } else {
        expect([400, 422].includes(response.status)).toBe(true);
      }
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle multiple concurrent uploads efficiently', async () => {
      const concurrentUploads = 3;
      const uploadPromises = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const testId = `concurrent${i}_${uuidv4().replace(/-/g, '')}`;
        const filename = `concurrent-test-${testId}.txt`;
        const content = `Concurrent Upload Test ${testId}\n\nThis is test document ${i+1} of ${concurrentUploads} concurrent uploads.\nContent includes unique identifier ${testId} for verification.`;

        const filepath = path.join('/tmp', filename);
        fs.writeFileSync(filepath, content);
        testFiles.push(filepath);

        const uploadPromise = fetch(`${API_BASE_URL}/upload-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: `file://${filepath}`,
            filename,
            mediaType: 'text/plain',
            documentType: 'test',
            metadata: { testId, concurrentTest: true }
          })
        });

        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      const responses = await Promise.all(uploadPromises);

      // All should succeed
      for (const response of responses) {
        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test that all documents are searchable
      const searchResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What concurrent upload test documents are available?',
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(searchResponse.ok).toBe(true);
      const searchResult = await searchResponse.json();
      expect(searchResult.success).toBe(true);
      expect(searchResult.response.length).toBeGreaterThan(100);

      // Should mention concurrent uploads
      const responseText = searchResult.response.toLowerCase();
      expect(responseText.includes('concurrent')).toBe(true);
    });
  });
});