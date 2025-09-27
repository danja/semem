/**
 * Inspect Tool Integration Tests
 * Tests the inspect tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

describe('Inspect Tool Integration Tests', () => {

  /**
   * Execute inspect tool via STDIO and get result
   */
  const executeInspect = async (args, timeout = 15000) => {
    console.log(`🔧 Executing inspect with args:`, args);

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
                const hasInspect = responses.some(r => r.id === 2);

                if (hasInit && hasInspect) {
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
        const inspectResponse = responses.find(r => r.id === 2);

        if (!initResponse || !inspectResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          inspectResponse,
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

          // Execute inspect
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'inspect',
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
          reject(new Error(`Inspect test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse inspect response content
   */
  const parseInspectResponse = (inspectResponse) => {
    if (!inspectResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid inspect response format');
    }
    return JSON.parse(inspectResponse.result.content[0].text);
  };

  test('should inspect system state', async () => {
    const result = await executeInspect({ type: 'system' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('inspection');
    expect(response.inspection.type).toBe('system');

    console.log(`✅ Inspect system state test passed`);
  });

  test('should inspect session state', async () => {
    const result = await executeInspect({ type: 'session' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('session');

    console.log(`✅ Inspect session state test passed`);
  });

  test('should inspect concept relationships', async () => {
    const result = await executeInspect({ type: 'concept' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('concept');

    console.log(`✅ Inspect concept relationships test passed`);
  });

  test('should inspect memory state', async () => {
    const result = await executeInspect({ type: 'memory' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('memory');

    console.log(`✅ Inspect memory state test passed`);
  });

  test('should include recommendations when requested', async () => {
    const result = await executeInspect({
      type: 'system',
      includeRecommendations: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('recommendations');

    console.log(`✅ Inspect with recommendations test passed`);
  });

  test('should inspect specific targets', async () => {
    const result = await executeInspect({
      type: 'memory',
      target: 'recent_interactions'
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.target).toBe('recent_interactions');

    console.log(`✅ Inspect specific target test passed`);
  });

  test('should inspect performance metrics', async () => {
    const result = await executeInspect({
      type: 'performance',
      includeMetrics: true,
      timeRange: '1h'
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('performance');

    console.log(`✅ Inspect performance metrics test passed`);
  });

  test('should inspect storage state', async () => {
    const result = await executeInspect({
      type: 'storage',
      includeStats: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('storage');

    console.log(`✅ Inspect storage state test passed`);
  });

  test('should inspect network connections', async () => {
    const result = await executeInspect({
      type: 'network',
      includeEndpoints: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('network');

    console.log(`✅ Inspect network connections test passed`);
  });

  test('should inspect configuration state', async () => {
    const result = await executeInspect({
      type: 'configuration',
      includeSecrets: false
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('configuration');

    console.log(`✅ Inspect configuration state test passed`);
  });

  test('should inspect knowledge graph structure', async () => {
    const result = await executeInspect({
      type: 'graph',
      includeStatistics: true,
      maxDepth: 3
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('graph');

    console.log(`✅ Inspect knowledge graph test passed`);
  });

  test('should inspect service health', async () => {
    const result = await executeInspect({
      type: 'health',
      checkServices: ['llm', 'embedding', 'sparql'],
      includeLatency: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('health');

    console.log(`✅ Inspect service health test passed`);
  });

  test('should inspect cache state', async () => {
    const result = await executeInspect({
      type: 'cache',
      includeCacheStats: true,
      showHitRates: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('cache');

    console.log(`✅ Inspect cache state test passed`);
  });

  test('should inspect API usage', async () => {
    const result = await executeInspect({
      type: 'api',
      includeUsageStats: true,
      timeWindow: '24h'
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('api');

    console.log(`✅ Inspect API usage test passed`);
  });

  test('should inspect embedding space', async () => {
    const result = await executeInspect({
      type: 'embeddings',
      includeDimensionality: true,
      sampleSize: 100
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('embeddings');

    console.log(`✅ Inspect embedding space test passed`);
  });

  test('should support detailed inspection mode', async () => {
    const result = await executeInspect({
      type: 'system',
      mode: 'detailed',
      includeAll: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.mode).toBe('detailed');

    console.log(`✅ Inspect detailed mode test passed`);
  });

  test('should support diagnostic inspection', async () => {
    const result = await executeInspect({
      type: 'diagnostic',
      runTests: true,
      includeErrors: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('diagnostic');

    console.log(`✅ Inspect diagnostic test passed`);
  });

  test('should inspect tool usage patterns', async () => {
    const result = await executeInspect({
      type: 'tools',
      includeUsagePatterns: true,
      timeRange: '7d'
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('tools');

    console.log(`✅ Inspect tool usage test passed`);
  });

  test('should inspect data quality', async () => {
    const result = await executeInspect({
      type: 'data_quality',
      checkIntegrity: true,
      validateRelationships: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('data_quality');

    console.log(`✅ Inspect data quality test passed`);
  });

  test('should inspect security status', async () => {
    const result = await executeInspect({
      type: 'security',
      checkAuthentication: true,
      validatePermissions: true
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('security');

    console.log(`✅ Inspect security status test passed`);
  });

  test('should handle empty type gracefully', async () => {
    const result = await executeInspect({ type: '' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('type');

    console.log(`✅ Inspect empty type error handling test passed`);
  });

  test('should handle missing type parameter', async () => {
    const result = await executeInspect({ includeRecommendations: true });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Inspect missing type error handling test passed`);
  });

  test('should handle invalid inspection type', async () => {
    const result = await executeInspect({ type: 'invalid_type' });
    const response = parseInspectResponse(result.inspectResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('invalid');

    console.log(`✅ Inspect invalid type error handling test passed`);
  });

  test('should support comprehensive system inspection', async () => {
    const result = await executeInspect({
      type: 'comprehensive',
      includeSystem: true,
      includeMemory: true,
      includePerformance: true,
      includeNetwork: true,
      includeStorage: true,
      includeRecommendations: true,
      mode: 'detailed',
      format: 'structured'
    });

    const response = parseInspectResponse(result.inspectResponse);
    expect(response.success).toBe(true);
    expect(response.inspection.type).toBe('comprehensive');

    console.log(`✅ Inspect comprehensive system test passed`);
  });

}, 120000); // 2 minute timeout for inspect tests