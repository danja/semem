/**
 * Tilt Tool Integration Tests
 * Tests the tilt tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

describe('Tilt Tool Integration Tests', () => {

  /**
   * Execute tilt tool via STDIO and get result
   */
  const executeTilt = async (args, timeout = 15000) => {
    console.log(`🔧 Executing tilt with args:`, args);

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
                const hasTilt = responses.some(r => r.id === 2);

                if (hasInit && hasTilt) {
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
        const tiltResponse = responses.find(r => r.id === 2);

        if (!initResponse || !tiltResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          tiltResponse,
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

          // Execute tilt
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'tilt',
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
          reject(new Error(`Tilt test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse tilt response content
   */
  const parseTiltResponse = (tiltResponse) => {
    if (!tiltResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid tilt response format');
    }
    return JSON.parse(tiltResponse.result.content[0].text);
  };

  test('should set keywords view style', async () => {
    const result = await executeTilt({ style: 'keywords' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('tilt');
    expect(response.tilt.style).toBe('keywords');

    console.log(`✅ Tilt keywords style test passed`);
  });

  test('should set summary view style', async () => {
    const result = await executeTilt({ style: 'summary' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('summary');

    console.log(`✅ Tilt summary style test passed`);
  });

  test('should set detailed view style', async () => {
    const result = await executeTilt({ style: 'detailed' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('detailed');

    console.log(`✅ Tilt detailed style test passed`);
  });

  test('should set graph view style', async () => {
    const result = await executeTilt({ style: 'graph' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('graph');

    console.log(`✅ Tilt graph style test passed`);
  });

  test('should handle tilt with query context', async () => {
    const result = await executeTilt({
      style: 'detailed',
      query: 'show detailed view of semantic memory concepts'
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('detailed');
    expect(response).toHaveProperty('context');

    console.log(`✅ Tilt with query context test passed`);
  });

  test('should support compact view mode', async () => {
    const result = await executeTilt({
      style: 'compact',
      maxItems: 10,
      showOnlyImportant: true
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('compact');

    console.log(`✅ Tilt compact view test passed`);
  });

  test('should handle hierarchical view style', async () => {
    const result = await executeTilt({
      style: 'hierarchical',
      depth: 3,
      expandAll: false
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('hierarchical');

    console.log(`✅ Tilt hierarchical view test passed`);
  });

  test('should support timeline view style', async () => {
    const result = await executeTilt({
      style: 'timeline',
      timeRange: '30d',
      groupBy: 'day'
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('timeline');

    console.log(`✅ Tilt timeline view test passed`);
  });

  test('should handle matrix view style', async () => {
    const result = await executeTilt({
      style: 'matrix',
      dimensions: ['concept', 'entity'],
      showRelationships: true
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('matrix');

    console.log(`✅ Tilt matrix view test passed`);
  });

  test('should support network view style', async () => {
    const result = await executeTilt({
      style: 'network',
      layoutAlgorithm: 'force-directed',
      showLabels: true,
      maxNodes: 50
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('network');

    console.log(`✅ Tilt network view test passed`);
  });

  test('should handle semantic view style', async () => {
    const result = await executeTilt({
      style: 'semantic',
      semanticClusters: true,
      similarityThreshold: 0.7
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('semantic');

    console.log(`✅ Tilt semantic view test passed`);
  });

  test('should support custom view configuration', async () => {
    const result = await executeTilt({
      style: 'custom',
      configuration: {
        layout: 'grid',
        itemsPerRow: 4,
        showMetadata: true,
        colorScheme: 'semantic'
      }
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('custom');

    console.log(`✅ Tilt custom view test passed`);
  });

  test('should handle interactive view style', async () => {
    const result = await executeTilt({
      style: 'interactive',
      enableZoom: true,
      enableSelection: true,
      enableFiltering: true
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('interactive');

    console.log(`✅ Tilt interactive view test passed`);
  });

  test('should support filtered view style', async () => {
    const result = await executeTilt({
      style: 'filtered',
      filters: {
        contentType: ['concept'],
        importance: 'high',
        recency: '7d'
      }
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('filtered');

    console.log(`✅ Tilt filtered view test passed`);
  });

  test('should handle perspective view style', async () => {
    const result = await executeTilt({
      style: 'perspective',
      viewpoint: 'research',
      focusArea: 'machine_learning',
      perspective: '3d'
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('perspective');

    console.log(`✅ Tilt perspective view test passed`);
  });

  test('should support comparative view style', async () => {
    const result = await executeTilt({
      style: 'comparative',
      compareItems: ['concept_a', 'concept_b'],
      comparisonDimensions: ['relevance', 'recency', 'connections']
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('comparative');

    console.log(`✅ Tilt comparative view test passed`);
  });

  test('should handle reset to default style', async () => {
    // First set a specific style
    await executeTilt({ style: 'detailed' });

    // Then reset to default
    const result = await executeTilt({ style: 'default' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('default');

    console.log(`✅ Tilt reset to default test passed`);
  });

  test('should handle empty style gracefully', async () => {
    const result = await executeTilt({ style: '' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('style');

    console.log(`✅ Tilt empty style error handling test passed`);
  });

  test('should handle missing style parameter', async () => {
    const result = await executeTilt({ query: 'Some query without style' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Tilt missing style error handling test passed`);
  });

  test('should handle invalid style type', async () => {
    const result = await executeTilt({ style: 'invalid_style' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('invalid');

    console.log(`✅ Tilt invalid style error handling test passed`);
  });

  test('should support complex tilt configuration', async () => {
    const result = await executeTilt({
      style: 'detailed',
      query: 'artificial intelligence concepts',
      maxItems: 25,
      showMetadata: true,
      includeRelationships: true,
      sortBy: 'relevance',
      groupBy: 'domain',
      filters: {
        contentType: ['concept', 'entity'],
        importance: 'medium',
        tags: ['ai', 'research']
      },
      layout: {
        columns: 3,
        spacing: 'comfortable',
        alignment: 'left'
      }
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('detailed');
    expect(response.tilt.maxItems).toBe(25);

    console.log(`✅ Tilt complex configuration test passed`);
  });

}, 120000); // 2 minute timeout for tilt tests