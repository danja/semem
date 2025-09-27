/**
 * Tell Tool Integration Tests
 * Tests the tell tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Tell Tool Integration Tests', () => {

  /**
   * Execute tell tool via STDIO and get result
   */
  const executeTell = async (args, timeout = 15000) => {
    console.log(`🔧 Executing tell with args:`, args);

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
                const hasTell = responses.some(r => r.id === 2);

                if (hasInit && hasTell) {
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
        const tellResponse = responses.find(r => r.id === 2);

        if (!initResponse || !tellResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          tellResponse,
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

          // Execute tell
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'tell',
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
          reject(new Error(`Tell test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse tell response content
   */
  const parseTellResponse = (tellResponse) => {
    if (!tellResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid tell response format');
    }
    return JSON.parse(tellResponse.result.content[0].text);
  };

  test('should store basic content', async () => {
    const fact = randomFactGenerator.generateFact();
    const result = await executeTell({ content: fact });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('content');

    console.log(`✅ Tell basic content test passed for: ${fact}`);
  });

  test('should store content with type specification', async () => {
    const types = ['interaction', 'document', 'concept'];

    for (const type of types) {
      const content = `Test ${type} content: ${randomFactGenerator.generateFact()}`;
      const result = await executeTell({ content, type });

      const response = parseTellResponse(result.tellResponse);
      expect(response.success).toBe(true);

      console.log(`✅ Tell ${type} test passed`);
    }
  });

  test('should store content with metadata', async () => {
    const content = 'This is content with metadata';
    const metadata = {
      title: 'Test Document',
      tags: ['test', 'metadata'],
      category: 'experiment',
      source: 'integration-test'
    };

    const result = await executeTell({ content, metadata });
    const response = parseTellResponse(result.tellResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('content');

    console.log(`✅ Tell with metadata test passed`);
  });

  test('should handle lazy processing', async () => {
    const content = 'Content for lazy processing test';
    const result = await executeTell({ content, lazy: true });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Tell lazy processing test passed`);
  });

  test('should store interaction format (legacy semem_store_interaction)', async () => {
    const prompt = 'What is semantic memory?';
    const response = 'Semantic memory is a type of long-term memory involving the capacity to recall words, concepts, or numbers.';

    const result = await executeTell({
      content: prompt,
      prompt: prompt,
      response: response,
      type: 'interaction'
    });

    const parsed = parseTellResponse(result.tellResponse);
    expect(parsed.success).toBe(true);

    console.log(`✅ Tell interaction format test passed`);
  });

  test('should handle document upload format', async () => {
    const content = 'Document content for upload test';
    const filename = 'test-document.txt';
    const mediaType = 'text/plain';
    const documentType = 'text';

    const result = await executeTell({
      content,
      filename,
      mediaType,
      documentType,
      metadata: { originalName: filename, size: content.length }
    });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Tell document upload test passed`);
  });

  test('should handle SPARQL ingestion format', async () => {
    const content = 'Test content for SPARQL ingestion';
    const endpoint = 'http://localhost:3030/test/query';
    const template = 'test-template';
    const limit = 10;

    const result = await executeTell({
      content,
      endpoint,
      template,
      limit,
      dryRun: true // Use dry run to avoid actual SPARQL calls in test
    });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Tell SPARQL ingestion test passed`);
  });

  test('should handle multiple unique facts', async () => {
    const facts = [
      randomFactGenerator.generateUniqueFact(),
      randomFactGenerator.generateUniqueFact(),
      randomFactGenerator.generateUniqueFact()
    ];

    for (const factObj of facts) {
      const result = await executeTell({ content: factObj.fact });
      const response = parseTellResponse(result.tellResponse);

      expect(response.success).toBe(true);
      console.log(`✅ Tell unique fact test passed for: ${factObj.fact}`);
    }
  });

  test('should handle empty content gracefully', async () => {
    const result = await executeTell({ content: '' });
    const response = parseTellResponse(result.tellResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('empty');

    console.log(`✅ Tell empty content error handling test passed`);
  });

  test('should handle missing content parameter', async () => {
    const result = await executeTell({ type: 'document' }); // Missing content
    const response = parseTellResponse(result.tellResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Tell missing content error handling test passed`);
  });

  test('should handle large content', async () => {
    const largeContent = 'A'.repeat(10000) + ' - ' + randomFactGenerator.generateFact();
    const result = await executeTell({ content: largeContent });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Tell large content test passed`);
  });

  test('should handle special characters and unicode', async () => {
    const specialContent = 'Special chars: αβγ δεζ 🚀 🔧 中文 العربية नमस्ते';
    const result = await executeTell({ content: specialContent });

    const response = parseTellResponse(result.tellResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Tell special characters test passed`);
  });

}, 120000); // 2 minute timeout for tell tests