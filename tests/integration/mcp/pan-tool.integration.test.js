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

  test('should pan with domain filters', async () => {
    const result = await executePan({
      domains: ['artificial-intelligence', 'cognitive-science']
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('pan');
    expect(response.pan.domains).toEqual(['artificial-intelligence', 'cognitive-science']);

    console.log(`✅ Pan domain filters test passed`);
  });

  test('should pan with keyword and entity filters', async () => {
    const result = await executePan({
      keywords: ['memory', 'learning'],
      entities: ['http://example.org/entity/memory-system']
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.keywords).toEqual(['memory', 'learning']);
    expect(response.pan.entities).toEqual(['http://example.org/entity/memory-system']);

    console.log(`✅ Pan keyword/entity filters test passed`);
  });

  test('should pan with temporal bounds', async () => {
    const result = await executePan({
      temporal: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      }
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.temporal).toEqual({
      start: '2024-01-01T00:00:00Z',
      end: '2024-12-31T23:59:59Z'
    });

    console.log(`✅ Pan temporal filter test passed`);
  });

  test('should pan with corpuscle scope', async () => {
    const result = await executePan({
      corpuscle: ['http://example.org/corpuscle/ai', 'http://example.org/corpuscle/ml']
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.corpuscle).toEqual([
      'http://example.org/corpuscle/ai',
      'http://example.org/corpuscle/ml'
    ]);

    console.log(`✅ Pan corpuscle filter test passed`);
  });

  test('should reject invalid pan types', async () => {
    const result = await executePan({ domains: 'ai' });
    const response = parsePanResponse(result.panResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Pan invalid types error handling test passed`);
  });

  test('should support complex pan configuration', async () => {
    const result = await executePan({
      domains: ['cognitive-science'],
      keywords: ['memory', 'learning'],
      entities: ['http://example.org/entity/cognition'],
      corpuscle: ['http://example.org/corpuscle/intro'],
      temporal: {
        start: '2024-01-01T00:00:00Z'
      }
    });

    const response = parsePanResponse(result.panResponse);
    expect(response.success).toBe(true);
    expect(response.pan.domains).toEqual(['cognitive-science']);
    expect(response.pan.keywords).toEqual(['memory', 'learning']);
    expect(response.pan.entities).toEqual(['http://example.org/entity/cognition']);
    expect(response.pan.corpuscle).toEqual(['http://example.org/corpuscle/intro']);
    expect(response.pan.temporal).toEqual({ start: '2024-01-01T00:00:00Z' });

    console.log(`✅ Pan complex configuration test passed`);
  });

}, 120000); // 2 minute timeout for pan tests
