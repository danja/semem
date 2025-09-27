/**
 * Pan Tool Integration Tests
 * Tests the pan tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

describe('Pan Tool Integration Tests', () => {

  /**
   * Execute pan tool via STDIO and get result
   */
  const executePan = async (args, timeout = 15000) => {
    console.log(`🔧 Executing pan with args:`, args);

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
                const hasPan = responses.some(r => r.id === 2);

                if (hasInit && hasPan) {
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
        const panResponse = responses.find(r => r.id === 2);

        if (!initResponse || !panResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          panResponse,
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

          // Execute pan
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'pan',
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
          reject(new Error(`Pan test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Parse pan response content
   */
  const parsePanResponse = (panResponse) => {
    if (!panResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid pan response format');
    }
    return JSON.parse(panResponse.result.content[0].text);
  };

  test('should pan in semantic direction', async () => {
    const result = await executePan({
      direction: 'semantic',
      domain: 'artificial-intelligence',
      maxResults: 20
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('pan');
    expect(response.pan.direction).toBe('semantic');

    console.log(`✅ Pan semantic direction test passed`);
  });

  test('should pan in temporal direction', async () => {
    const result = await executePan({
      direction: 'temporal',
      timeRange: '7d',
      maxResults: 15
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('temporal');

    console.log(`✅ Pan temporal direction test passed`);
  });

  test('should pan in conceptual direction', async () => {
    const result = await executePan({
      direction: 'conceptual',
      conceptFilter: ['machine learning', 'neural networks', 'deep learning'],
      threshold: 0.6
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('conceptual');

    console.log(`✅ Pan conceptual direction test passed`);
  });

  test('should pan with relevance threshold', async () => {
    const result = await executePan({
      direction: 'semantic',
      domain: 'memory',
      threshold: 0.7,
      sortBy: 'relevance'
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.threshold).toBe(0.7);

    console.log(`✅ Pan relevance threshold test passed`);
  });

  test('should support entity-based panning', async () => {
    const result = await executePan({
      direction: 'entity',
      entityType: 'concept',
      entityFilter: 'semantic_memory',
      radius: 3
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('entity');

    console.log(`✅ Pan entity-based test passed`);
  });

  test('should handle relationship-based panning', async () => {
    const result = await executePan({
      direction: 'relationship',
      relationshipType: 'associatedWith',
      fromEntity: 'neural_networks',
      maxDepth: 2
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('relationship');

    console.log(`✅ Pan relationship-based test passed`);
  });

  test('should support hierarchical panning', async () => {
    const result = await executePan({
      direction: 'hierarchical',
      hierarchy: 'knowledge_tree',
      level: 'concept',
      includeChildren: true,
      includeParents: false
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('hierarchical');

    console.log(`✅ Pan hierarchical test passed`);
  });

  test('should handle spatial panning in knowledge space', async () => {
    const result = await executePan({
      direction: 'spatial',
      coordinates: { x: 0.5, y: 0.3, z: 0.7 },
      radius: 0.2,
      spaceType: 'embedding'
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('spatial');

    console.log(`✅ Pan spatial test passed`);
  });

  test('should support multi-dimensional panning', async () => {
    const result = await executePan({
      direction: 'multi',
      dimensions: [
        { type: 'semantic', weight: 0.6 },
        { type: 'temporal', weight: 0.3 },
        { type: 'conceptual', weight: 0.1 }
      ],
      maxResults: 25
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('multi');

    console.log(`✅ Pan multi-dimensional test passed`);
  });

  test('should handle focused panning with anchor', async () => {
    const result = await executePan({
      direction: 'semantic',
      anchor: 'artificial_intelligence',
      focusRange: 0.3,
      includeNeighbors: true
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.anchor).toBe('artificial_intelligence');

    console.log(`✅ Pan focused with anchor test passed`);
  });

  test('should support filtered panning', async () => {
    const result = await executePan({
      direction: 'semantic',
      filters: {
        contentType: ['document', 'concept'],
        tags: ['ai', 'ml'],
        minScore: 0.5,
        maxAge: '30d'
      }
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.filters).toBeDefined();

    console.log(`✅ Pan filtered test passed`);
  });

  test('should handle incremental panning', async () => {
    const result = await executePan({
      direction: 'semantic',
      mode: 'incremental',
      step: 0.1,
      from: 'current_position',
      maxSteps: 5
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.mode).toBe('incremental');

    console.log(`✅ Pan incremental test passed`);
  });

  test('should support contextual panning', async () => {
    const result = await executePan({
      direction: 'contextual',
      context: 'machine_learning_research',
      contextWindow: 10,
      preserveContext: true
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('contextual');

    console.log(`✅ Pan contextual test passed`);
  });

  test('should handle bounded panning', async () => {
    const result = await executePan({
      direction: 'semantic',
      bounds: {
        minRelevance: 0.3,
        maxRelevance: 0.9,
        domains: ['ai', 'cognitive-science'],
        excludeDomains: ['obsolete']
      }
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.bounds).toBeDefined();

    console.log(`✅ Pan bounded test passed`);
  });

  test('should support adaptive panning', async () => {
    const result = await executePan({
      direction: 'adaptive',
      learningRate: 0.1,
      adaptToResults: true,
      feedbackLoop: true
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('adaptive');

    console.log(`✅ Pan adaptive test passed`);
  });

  test('should handle empty direction gracefully', async () => {
    const result = await executePan({ direction: '' });
    const response = parsePanResponse(result.panResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('direction');

    console.log(`✅ Pan empty direction error handling test passed`);
  });

  test('should handle missing direction parameter', async () => {
    const result = await executePan({ maxResults: 10 });
    const response = parsePanResponse(result.panResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Pan missing direction error handling test passed`);
  });

  test('should handle invalid direction type', async () => {
    const result = await executePan({ direction: 'invalid_direction' });
    const response = parsePanResponse(result.panResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('invalid');

    console.log(`✅ Pan invalid direction error handling test passed`);
  });

  test('should support complex pan configuration', async () => {
    const result = await executePan({
      direction: 'semantic',
      domain: 'cognitive-science',
      conceptFilter: ['memory', 'learning', 'cognition'],
      threshold: 0.65,
      maxResults: 30,
      sortBy: 'relevance',
      includeMetadata: true,
      filters: {
        contentType: ['concept', 'document'],
        minScore: 0.4,
        tags: ['research', 'validated']
      },
      bounds: {
        minRelevance: 0.3,
        maxRelevance: 0.95
      }
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.direction).toBe('semantic');
    expect(response.pan.domain).toBe('cognitive-science');

    console.log(`✅ Pan complex configuration test passed`);
  });

}, 120000); // 2 minute timeout for pan tests