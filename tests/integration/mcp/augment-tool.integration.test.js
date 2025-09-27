/**
 * Augment Tool Integration Tests
 * Tests the augment tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Augment Tool Integration Tests', () => {

  /**
   * Execute augment tool via STDIO and get result
   */
  const executeAugment = async (args, timeout = 15000) => {
    console.log(`🔧 Executing augment with args:`, args);

    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', ['src/mcp/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let responses = [];
      let currentResponse = '';
      let resolved = false;

      mcpProcess.stdout.on('data', (data) => {
        currentResponse += data.toString();
        const lines = currentResponse.split('\n');
        currentResponse = lines.pop();

        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonResponse = JSON.parse(line.trim());
              responses.push(jsonResponse);

              if (responses.length >= 2 && !resolved) {
                const hasInit = responses.some(r => r.id === 1);
                const hasAugment = responses.some(r => r.id === 2);

                if (hasInit && hasAugment) {
                  mcpProcess.kill('SIGTERM');
                  resolveWithResults();
                  return;
                }
              }
            } catch (e) {
              mcpProcess.kill('SIGTERM');
              reject(new Error(`Invalid JSON response: ${line.trim()}`));
              return;
            }
          }
        }
      });

      mcpProcess.stderr.on('data', () => {
        // Allow stderr logging
      });

      let messageId = 1;

      const resolveWithResults = () => {
        if (resolved) return;
        resolved = true;

        const initResponse = responses.find(r => r.id === 1);
        const augmentResponse = responses.find(r => r.id === 2);

        if (!initResponse || !augmentResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          augmentResponse,
          allResponses: responses
        });
      };

      const sendMessage = (message) => {
        mcpProcess.stdin.write(JSON.stringify(message) + '\n');
      };

      const runTest = async () => {
        try {
          // Initialize MCP
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'test-client', version: '1.0.0' }
            }
          });

          await delay(500);

          // Execute augment
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'augment',
              arguments: args
            }
          });

          await delay(2000);
        } catch (error) {
          reject(error);
        }
      };

      mcpProcess.on('close', () => {
        // Resolution happens when responses are received
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`MCP process error: ${error.message}`));
      });

      runTest().catch(reject);

      setTimeout(() => {
        if (!resolved) {
          mcpProcess.kill();
          reject(new Error(`Augment test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse augment response content
   */
  const parseAugmentResponse = (augmentResponse) => {
    if (!augmentResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid augment response format');
    }
    return JSON.parse(augmentResponse.result.content[0].text);
  };

  test('should extract concepts from text', async () => {
    const text = 'Artificial intelligence and machine learning are transforming how we process semantic information and build knowledge graphs.';

    const result = await executeAugment({
      operation: 'extract_concepts',
      text
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('concepts');
    expect(Array.isArray(response.concepts)).toBe(true);

    console.log(`✅ Augment concept extraction test passed`);
  });

  test('should generate embeddings', async () => {
    const text = 'Semantic memory systems enable intelligent information retrieval.';

    const result = await executeAugment({
      operation: 'generate_embedding',
      text,
      options: { embedding: true }
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('embeddingDimension');
    expect(response.embeddingDimension).toBeGreaterThan(0);

    console.log(`✅ Augment embedding generation test passed`);
  });

  test('should handle remember operation (legacy semem_store_memory)', async () => {
    const content = randomFactGenerator.generateFact();

    const result = await executeAugment({
      operation: 'remember',
      content,
      domain: 'test',
      importance: 0.8
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('content');

    console.log(`✅ Augment remember operation test passed for: ${content}`);
  });

  test('should handle forget operation', async () => {
    const content = 'Temporary information to be forgotten';

    // First store something
    await executeAugment({
      operation: 'remember',
      content,
      domain: 'temp'
    });

    // Then forget it
    const result = await executeAugment({
      operation: 'forget',
      content,
      domain: 'temp'
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Augment forget operation test passed`);
  });

  test('should auto-detect operation type', async () => {
    const text = 'Auto-detection should work for concept extraction from this text about neural networks and deep learning.';

    const result = await executeAugment({
      operation: 'auto',
      text
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('detectedOperation');

    console.log(`✅ Augment auto-detection test passed, detected: ${response.detectedOperation}`);
  });

  test('should handle concept enhancement', async () => {
    const concepts = ['artificial intelligence', 'machine learning', 'neural networks'];

    const result = await executeAugment({
      operation: 'enhance_concepts',
      concepts,
      enhanceWithWikipedia: false,
      enhanceWithWikidata: false
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('enhancedConcepts');

    console.log(`✅ Augment concept enhancement test passed`);
  });

  test('should process text with multiple operations', async () => {
    const text = 'Semantic web technologies like RDF and SPARQL enable knowledge graph construction and querying.';

    const result = await executeAugment({
      operation: 'full_processing',
      text,
      includeEmbeddings: true,
      extractConcepts: true,
      storeResults: false
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('concepts');
    expect(response).toHaveProperty('embeddingDimension');

    console.log(`✅ Augment full processing test passed`);
  });

  test('should handle different embedding options', async () => {
    const text = 'Testing different embedding configurations for semantic processing.';

    const result = await executeAugment({
      operation: 'generate_embedding',
      text,
      options: {
        embedding: true,
        normalize: true,
        dimensions: 1536
      }
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response.embeddingDimension).toBe(768);

    console.log(`✅ Augment embedding options test passed`);
  });

  test('should support memory operations with metadata', async () => {
    const content = 'Important semantic memory fact with detailed metadata';
    const metadata = {
      category: 'knowledge',
      tags: ['semantic', 'memory', 'test'],
      importance: 0.9,
      source: 'integration-test'
    };

    const result = await executeAugment({
      operation: 'remember',
      content,
      metadata,
      domain: 'test'
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('stored');

    console.log(`✅ Augment memory with metadata test passed`);
  });

  test('should handle legacy semem_extract_concepts format', async () => {
    const text = 'Legacy format test for concept extraction from natural language processing text.';

    const result = await executeAugment({
      operation: 'extract_concepts',
      text,
      maxConcepts: 5,
      confidenceThreshold: 0.3
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response.concepts.length).toBeLessThanOrEqual(5);

    console.log(`✅ Augment legacy concept extraction test passed`);
  });

  test('should handle empty operation gracefully', async () => {
    const result = await executeAugment({ operation: '' });
    const response = parseAugmentResponse(result.augmentResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('operation');

    console.log(`✅ Augment empty operation error handling test passed`);
  });

  test('should handle missing operation parameter', async () => {
    const result = await executeAugment({ text: 'Some text without operation' });
    const response = parseAugmentResponse(result.augmentResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Augment missing operation error handling test passed`);
  });

  test('should handle invalid operation type', async () => {
    const result = await executeAugment({
      operation: 'invalid_operation',
      text: 'Test text'
    });
    const response = parseAugmentResponse(result.augmentResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Augment invalid operation error handling test passed`);
  });

  test('should support batch concept processing', async () => {
    const texts = [
      'First text about artificial intelligence and machine learning.',
      'Second text discussing semantic web and knowledge graphs.',
      'Third text exploring natural language processing techniques.'
    ];

    const result = await executeAugment({
      operation: 'batch_extract_concepts',
      texts,
      batchSize: 3
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('batchResults');
    expect(Array.isArray(response.batchResults)).toBe(true);

    console.log(`✅ Augment batch processing test passed`);
  });

  test('should handle concept relationships', async () => {
    const concepts = ['neural networks', 'deep learning', 'backpropagation'];

    const result = await executeAugment({
      operation: 'analyze_relationships',
      concepts,
      findRelationships: true
    });

    const response = parseAugmentResponse(result.augmentResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('relationships');

    console.log(`✅ Augment concept relationships test passed`);
  });

}, 180000); // 3 minute timeout for augment tests