/**
 * Zoom Tool Integration Tests
 * Tests the zoom tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

describe('Zoom Tool Integration Tests', () => {

  /**
   * Execute zoom tool via STDIO and get result
   */
  const executeZoom = async (args, timeout = 15000) => {
    console.log(`🔧 Executing zoom with args:`, args);

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
                const hasZoom = responses.some(r => r.id === 2);

                if (hasInit && hasZoom) {
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
        const zoomResponse = responses.find(r => r.id === 2);

        if (!initResponse || !zoomResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          zoomResponse,
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

          // Execute zoom
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'zoom',
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
          reject(new Error(`Zoom test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse zoom response content
   */
  const parseZoomResponse = (zoomResponse) => {
    if (!zoomResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid zoom response format');
    }
    return JSON.parse(zoomResponse.result.content[0].text);
  };

  test('should set entity zoom level', async () => {
    const result = await executeZoom({ level: 'entity' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('zoom');
    expect(response.zoom.level).toBe('entity');

    console.log(`✅ Zoom entity level test passed`);
  });

  test('should set unit zoom level', async () => {
    const result = await executeZoom({ level: 'unit' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('zoom');
    expect(response.zoom.level).toBe('unit');

    console.log(`✅ Zoom unit level test passed`);
  });

  test('should set text zoom level', async () => {
    const result = await executeZoom({ level: 'text' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('zoom');
    expect(response.zoom.level).toBe('text');

    console.log(`✅ Zoom text level test passed`);
  });

  test('should set community zoom level', async () => {
    const result = await executeZoom({ level: 'community' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('zoom');
    expect(response.zoom.level).toBe('community');

    console.log(`✅ Zoom community level test passed`);
  });

  test('should handle zoom with query context', async () => {
    const result = await executeZoom({
      level: 'entity',
      query: 'semantic memory entities related to AI'
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.level).toBe('entity');
    expect(response).toHaveProperty('context');

    console.log(`✅ Zoom with query context test passed`);
  });

  test('should support granularity control', async () => {
    const result = await executeZoom({
      level: 'unit',
      granularity: 'fine',
      maxResults: 20
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.granularity).toBe('fine');

    console.log(`✅ Zoom granularity control test passed`);
  });

  test('should handle zoom with domain filtering', async () => {
    const result = await executeZoom({
      level: 'entity',
      domain: 'artificial-intelligence',
      includeRelated: true
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.domain).toBe('artificial-intelligence');

    console.log(`✅ Zoom domain filtering test passed`);
  });

  test('should support temporal zoom constraints', async () => {
    const result = await executeZoom({
      level: 'text',
      timeRange: {
        start: '2024-01-01',
        end: '2024-12-31'
      }
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.timeRange).toBeDefined();

    console.log(`✅ Zoom temporal constraints test passed`);
  });

  test('should handle hierarchical zoom levels', async () => {
    const levels = ['entity', 'unit', 'text', 'community'];

    for (const level of levels) {
      const result = await executeZoom({
        level,
        hierarchical: true,
        includeChildren: true
      });

      const response = parseZoomResponse(result.zoomResponse);
      expect(response.success).toBe(true);
      expect(response.zoom.level).toBe(level);
      expect(response.zoom.hierarchical).toBe(true);

      console.log(`✅ Zoom hierarchical ${level} test passed`);
    }
  });

  test('should support zoom with relevance scoring', async () => {
    const result = await executeZoom({
      level: 'unit',
      query: 'machine learning concepts',
      scoreThreshold: 0.7,
      sortBy: 'relevance'
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.scoreThreshold).toBe(0.7);

    console.log(`✅ Zoom relevance scoring test passed`);
  });

  test('should handle zoom reset to default', async () => {
    // First set a specific zoom level
    await executeZoom({ level: 'entity' });

    // Then reset to default
    const result = await executeZoom({ level: 'default' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(true);
    expect(response.zoom.level).toBe('default');

    console.log(`✅ Zoom reset to default test passed`);
  });

  test('should support zoom with semantic clustering', async () => {
    const result = await executeZoom({
      level: 'unit',
      clustering: 'semantic',
      clusterThreshold: 0.8,
      maxClusters: 5
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.clustering).toBe('semantic');

    console.log(`✅ Zoom semantic clustering test passed`);
  });

  test('should handle zoom with focus target', async () => {
    const result = await executeZoom({
      level: 'entity',
      focusTarget: 'neural_networks',
      focusRadius: 2
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.focusTarget).toBe('neural_networks');

    console.log(`✅ Zoom focus target test passed`);
  });

  test('should support progressive zoom levels', async () => {
    const result = await executeZoom({
      level: 'unit',
      progressive: true,
      steps: 3,
      direction: 'in'
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.progressive).toBe(true);

    console.log(`✅ Zoom progressive levels test passed`);
  });

  test('should handle empty level gracefully', async () => {
    const result = await executeZoom({ level: '' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('level');

    console.log(`✅ Zoom empty level error handling test passed`);
  });

  test('should handle missing level parameter', async () => {
    const result = await executeZoom({ query: 'Some query without level' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Zoom missing level error handling test passed`);
  });

  test('should handle invalid zoom level', async () => {
    const result = await executeZoom({ level: 'invalid_level' });
    const response = parseZoomResponse(result.zoomResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('invalid');

    console.log(`✅ Zoom invalid level error handling test passed`);
  });

  test('should support complex zoom configuration', async () => {
    const result = await executeZoom({
      level: 'unit',
      query: 'artificial intelligence research',
      domain: 'ai-research',
      granularity: 'medium',
      clustering: 'semantic',
      timeRange: { start: '2023-01-01', end: '2024-12-31' },
      maxResults: 50,
      scoreThreshold: 0.6,
      includeRelated: true,
      sortBy: 'relevance'
    });

    const response = parseZoomResponse(result.zoomResponse);
    expect(response.success).toBe(true);
    expect(response.zoom.level).toBe('unit');
    expect(response.zoom.domain).toBe('ai-research');

    console.log(`✅ Zoom complex configuration test passed`);
  });

}, 120000); // 2 minute timeout for zoom tests
