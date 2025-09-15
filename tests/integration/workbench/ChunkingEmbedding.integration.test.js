/**
 * Chunking and Embedding Workflow Integration Tests
 * Tests the document processing pipeline: upload -> chunk -> embed -> search
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/workbench/ChunkingEmbedding.integration.test.js --reporter=verbose
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
describe.skipIf(!process.env.INTEGRATION_TESTS)('Chunking and Embedding Workflow (Live Services)', () => {
  let testFiles = [];

  beforeAll(async () => {
    console.log('Setting up Chunking and Embedding Integration Tests...');

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
  });

  afterAll(async () => {
    console.log('Cleaning up chunking and embedding test files...');
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

  describe('Document Chunking Workflow', () => {
    it('should successfully chunk uploaded documents', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `large-document-${testId}.txt`;

      // Create a large document that will definitely need chunking
      const sections = [
        `Introduction to Advanced AI Systems ${testId}`,
        'Large language models have revolutionized natural language processing.',
        'These models can understand context, generate coherent text, and perform complex reasoning tasks.',
        'The architecture typically involves transformer networks with attention mechanisms.',

        'Technical Architecture Overview',
        'The system consists of multiple components working in coordination.',
        'Data ingestion handles various file formats and content types.',
        'Preprocessing includes tokenization, normalization, and feature extraction.',
        'The embedding layer converts text into high-dimensional vector representations.',

        'Performance Optimization Strategies',
        'Caching mechanisms improve response times for frequently accessed data.',
        'Batch processing reduces computational overhead for large datasets.',
        'Memory management ensures efficient resource utilization.',
        'Load balancing distributes requests across multiple processing units.',

        'Security and Privacy Considerations',
        'Data encryption protects sensitive information during transmission and storage.',
        'Access controls ensure only authorized users can modify system configurations.',
        'Audit logging tracks all system interactions for compliance purposes.',
        'Privacy filters remove personally identifiable information from training data.',

        'Future Development Roadmap',
        'Multimodal capabilities will integrate text, image, and audio processing.',
        'Federated learning approaches will enable distributed model training.',
        'Edge deployment will reduce latency for real-time applications.',
        'Continuous learning systems will adapt to changing user needs.',

        `Conclusion and Test Identifier: ${testId}`,
        'This comprehensive overview demonstrates the complexity of modern AI systems.',
        'Each component must work seamlessly with others to achieve optimal performance.',
        'Future innovations will continue to push the boundaries of artificial intelligence.'
      ];

      const content = sections.join('\n\n');
      expect(content.length).toBeGreaterThan(2000); // Ensure it's large enough to chunk

      // Create and upload the document
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'technical',
          metadata: { testId, category: 'chunking-test' }
        })
      });

      expect(uploadResponse.ok).toBe(true);
      const uploadResult = await uploadResponse.json();
      expect(uploadResult.success).toBe(true);

      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Perform chunking operation
      const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'chunk_documents',
          options: {
            maxChunkSize: 800,  // Smaller chunks for testing
            minChunkSize: 200,
            overlapSize: 100,
            strategy: 'semantic',
            minContentLength: 300
          }
        })
      });

      expect(chunkingResponse.ok).toBe(true);
      const chunkingResult = await chunkingResponse.json();
      expect(chunkingResult.success).toBe(true);

      // Should have created multiple chunks
      const chunks = chunkingResult.chunks || chunkingResult.result?.chunks;
      expect(chunks).toBeGreaterThan(1);

      // Wait for chunking to complete
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Test that chunked content is searchable
      const searchResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `What technical architecture information is in document ${testId}?`,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(searchResponse.ok).toBe(true);
      const searchResult = await searchResponse.json();
      expect(searchResult.success).toBe(true);
      expect(searchResult.response.length).toBeGreaterThan(100);

      // Should find content from different sections
      const responseText = searchResult.response.toLowerCase();
      expect(
        responseText.includes('architecture') ||
        responseText.includes('component') ||
        responseText.includes('transformer') ||
        responseText.includes('embedding')
      ).toBe(true);
    });

    it('should handle different chunking strategies appropriately', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `strategy-test-${testId}.txt`;

      const content = `
Strategy Test Document ${testId}

Section A: Natural Language Processing
This section discusses various NLP techniques including tokenization,
parsing, and semantic analysis. Modern approaches leverage deep learning
models to achieve state-of-the-art performance across multiple tasks.

Section B: Computer Vision Applications
Computer vision systems process visual data to extract meaningful information.
Convolutional neural networks excel at image classification, object detection,
and semantic segmentation tasks in various domains.

Section C: Reinforcement Learning Methods
Reinforcement learning enables agents to learn optimal policies through
interaction with environments. Q-learning and policy gradient methods
are fundamental approaches in this field.

Section D: Data Engineering Practices
Effective data pipelines ensure reliable data flow from sources to models.
ETL processes, data validation, and monitoring are critical components
of production machine learning systems.

Test identifier: ${testId}
Document created for chunking strategy evaluation.
`;

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
          documentType: 'test',
          metadata: { testId, category: 'strategy-test' }
        })
      });

      expect(uploadResponse.ok).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test different chunking strategies
      const strategies = ['semantic', 'sliding_window'];

      for (const strategy of strategies) {
        const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'all',
            operation: 'chunk_documents',
            options: {
              maxChunkSize: 600,
              minChunkSize: 150,
              overlapSize: 50,
              strategy: strategy,
              minContentLength: 200
            }
          })
        });

        expect(chunkingResponse.ok).toBe(true);
        const result = await chunkingResponse.json();

        // Should succeed regardless of strategy
        expect(result.success).toBe(true);

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Verify content is still searchable after multiple chunking operations
      const searchResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `What sections are discussed in document ${testId}?`,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(searchResponse.ok).toBe(true);
      const searchResult = await searchResponse.json();
      expect(searchResult.success).toBe(true);

      const responseText = searchResult.response.toLowerCase();
      expect(
        responseText.includes('nlp') ||
        responseText.includes('computer vision') ||
        responseText.includes('reinforcement') ||
        responseText.includes('data engineering')
      ).toBe(true);
    });
  });

  describe('Embedding Generation Workflow', () => {
    it('should generate embeddings for chunked documents', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `embedding-test-${testId}.txt`;

      const content = `
Embedding Test Document ${testId}

Machine Learning Fundamentals:
Supervised learning involves training models with labeled datasets.
Common algorithms include linear regression, decision trees, and neural networks.
Feature engineering and model evaluation are critical success factors.

Deep Learning Architectures:
Convolutional Neural Networks excel at image processing tasks.
Recurrent Neural Networks handle sequential data effectively.
Transformer architectures have revolutionized natural language processing.

Optimization Techniques:
Gradient descent variations optimize model parameters iteratively.
Regularization methods prevent overfitting in complex models.
Learning rate scheduling improves convergence stability.

Test identifier for embedding verification: ${testId}
This content should be properly embedded and searchable.
`;

      // Upload and chunk document first
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'ml-content',
          metadata: { testId, category: 'embedding-test' }
        })
      });

      expect(uploadResponse.ok).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Perform chunking
      const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'chunk_documents',
          options: {
            maxChunkSize: 1200,
            minChunkSize: 300,
            overlapSize: 100,
            strategy: 'semantic'
          }
        })
      });

      expect(chunkingResponse.ok).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate embeddings
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

      // Wait for embedding generation to complete
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Test semantic search capabilities with embeddings
      const semanticQueries = [
        `What machine learning concepts are in document ${testId}?`,
        'Tell me about neural network architectures',
        'What optimization techniques are mentioned?',
        'Explain gradient descent variations'
      ];

      for (const query of semanticQueries) {
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
        expect(result.response.length).toBeGreaterThan(50);

        // Should find relevant ML content
        const responseText = result.response.toLowerCase();
        expect(
          responseText.includes('learning') ||
          responseText.includes('neural') ||
          responseText.includes('model') ||
          responseText.includes('algorithm')
        ).toBe(true);
      }
    });

    it('should handle embedding generation for various content types', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const documents = [
        {
          filename: `technical-spec-${testId}.txt`,
          content: `Technical Specification ${testId}\n\nSystem Requirements:\n- CPU: 8 cores minimum\n- RAM: 32GB recommended\n- Storage: 1TB SSD\n- Network: Gigabit Ethernet\n\nPerformance benchmarks and compliance standards included.`,
          type: 'technical'
        },
        {
          filename: `research-paper-${testId}.txt`,
          content: `Research Paper ${testId}\n\nAbstract: This paper presents novel findings in quantum computing.\nMethodology: Experimental validation using superconducting qubits.\nResults: 99.8% fidelity achieved in quantum gate operations.\nConclusions: Significant advancement in quantum error correction.`,
          type: 'research'
        },
        {
          filename: `user-guide-${testId}.txt`,
          content: `User Guide ${testId}\n\nGetting Started:\n1. Install required dependencies\n2. Configure environment variables\n3. Run initial setup script\n4. Verify installation\n\nTroubleshooting common issues and FAQ section included.`,
          type: 'documentation'
        }
      ];

      // Upload all documents
      for (const doc of documents) {
        const filepath = path.join('/tmp', doc.filename);
        fs.writeFileSync(filepath, doc.content);
        testFiles.push(filepath);

        const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: `file://${filepath}`,
            filename: doc.filename,
            mediaType: 'text/plain',
            documentType: doc.type,
            metadata: { testId, category: 'multi-type-test' }
          })
        });

        expect(uploadResponse.ok).toBe(true);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Chunk all documents
      const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'chunk_documents',
          options: {
            maxChunkSize: 1000,
            minChunkSize: 200,
            overlapSize: 50,
            strategy: 'semantic'
          }
        })
      });

      expect(chunkingResponse.ok).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Generate embeddings for all content
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
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Test cross-document search capabilities
      const crossDocumentQuery = `What information is available across all document types for ${testId}?`;
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: crossDocumentQuery,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.2
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.response.length).toBeGreaterThan(150);

      // Should integrate content from multiple document types
      const responseText = result.response.toLowerCase();
      const mentionsTechnical = responseText.includes('cpu') || responseText.includes('system');
      const mentionsResearch = responseText.includes('quantum') || responseText.includes('fidelity');
      const mentionsGuide = responseText.includes('install') || responseText.includes('setup');

      expect(mentionsTechnical || mentionsResearch || mentionsGuide).toBe(true);
    });
  });

  describe('End-to-End Pipeline Validation', () => {
    it('should complete full pipeline: upload -> chunk -> embed -> search with high quality', async () => {
      const testId = uuidv4().replace(/-/g, '');
      const filename = `e2e-pipeline-${testId}.txt`;

      // Create comprehensive content for end-to-end testing
      const content = `
Comprehensive System Analysis ${testId}

Executive Summary:
This document provides a complete analysis of system performance, security,
and scalability considerations for modern distributed architectures.
Key findings indicate 40% performance improvement and 60% cost reduction.

System Architecture:
The microservices architecture employs containerized deployments with
Kubernetes orchestration. Service mesh technology ensures secure communication
between components while maintaining observability and traffic management.

Performance Metrics:
- Average response time: 85ms (target: <100ms)
- Throughput: 15,000 requests/second peak capacity
- Availability: 99.95% uptime over 12-month period
- Error rate: 0.02% across all service endpoints

Security Implementation:
Zero-trust security model with mutual TLS authentication between services.
OAuth 2.0 with PKCE for user authentication and RBAC for authorization.
Comprehensive audit logging and real-time threat detection systems.

Scalability Analysis:
Horizontal scaling capabilities tested up to 100 service instances.
Auto-scaling policies triggered based on CPU and memory utilization.
Database sharding implemented for data partitioning across regions.

Cost Optimization:
Cloud resource optimization reduced infrastructure costs by 35%.
Reserved instance purchases and spot instance utilization for batch processing.
Automated resource cleanup policies prevent cost overruns.

Future Recommendations:
1. Implement chaos engineering practices for resilience testing
2. Migrate to serverless functions for event-driven workloads
3. Adopt GitOps methodology for deployment automation
4. Integrate AI/ML capabilities for predictive maintenance

Test identifier: ${testId}
Document classification: Comprehensive Technical Analysis
Generated for end-to-end pipeline validation testing.
`;

      // Step 1: Upload document
      const filepath = path.join('/tmp', filename);
      fs.writeFileSync(filepath, content);
      testFiles.push(filepath);

      const uploadResponse = await fetch(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: `file://${filepath}`,
          filename,
          mediaType: 'text/plain',
          documentType: 'analysis',
          metadata: { testId, category: 'e2e-test' }
        })
      });

      expect(uploadResponse.ok).toBe(true);
      const uploadResult = await uploadResponse.json();
      expect(uploadResult.success).toBe(true);

      // Step 2: Chunking with optimal parameters
      await new Promise(resolve => setTimeout(resolve, 2000));

      const chunkingResponse = await fetch(`${API_BASE_URL}/augment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'all',
          operation: 'chunk_documents',
          options: {
            maxChunkSize: 1500,
            minChunkSize: 400,
            overlapSize: 200,
            strategy: 'semantic',
            minContentLength: 500
          }
        })
      });

      expect(chunkingResponse.ok).toBe(true);
      const chunkingResult = await chunkingResponse.json();
      expect(chunkingResult.success).toBe(true);

      // Step 3: Generate embeddings
      await new Promise(resolve => setTimeout(resolve, 4000));

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

      // Step 4: Comprehensive search testing
      await new Promise(resolve => setTimeout(resolve, 8000));

      const testQueries = [
        {
          question: `What are the key performance metrics in document ${testId}?`,
          expectedContent: ['85ms', '15,000', '99.95%', 'response time']
        },
        {
          question: `What security measures are implemented according to ${testId}?`,
          expectedContent: ['zero-trust', 'oauth', 'tls', 'rbac']
        },
        {
          question: `What cost optimizations are mentioned in the analysis?`,
          expectedContent: ['35%', 'reserved', 'spot', 'cleanup']
        },
        {
          question: `What future recommendations are provided?`,
          expectedContent: ['chaos', 'serverless', 'gitops', 'ai/ml']
        }
      ];

      for (const testQuery of testQueries) {
        const response = await fetch(`${API_BASE_URL}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: testQuery.question,
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
        const foundContent = testQuery.expectedContent.some(content =>
          responseText.includes(content.toLowerCase())
        );

        expect(foundContent).toBe(true);
      }

      // Step 5: Validate search quality and completeness
      const comprehensiveQuery = `Provide a complete summary of all information in document ${testId}`;
      const summaryResponse = await fetch(`${API_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: comprehensiveQuery,
          mode: 'comprehensive',
          useContext: true,
          threshold: 0.1
        })
      });

      expect(summaryResponse.ok).toBe(true);
      const summaryResult = await summaryResponse.json();
      expect(summaryResult.success).toBe(true);
      expect(summaryResult.response.length).toBeGreaterThan(300);

      // Summary should cover multiple sections
      const summaryText = summaryResult.response.toLowerCase();
      const sectionsCovered = [
        summaryText.includes('performance') || summaryText.includes('metrics'),
        summaryText.includes('security') || summaryText.includes('authentication'),
        summaryText.includes('scalability') || summaryText.includes('scaling'),
        summaryText.includes('cost') || summaryText.includes('optimization'),
        summaryText.includes('recommendation') || summaryText.includes('future')
      ].filter(Boolean).length;

      expect(sectionsCovered).toBeGreaterThan(2);
    });
  });
});