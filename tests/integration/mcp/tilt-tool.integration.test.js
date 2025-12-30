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

  test('should set embedding view style', async () => {
    const result = await executeTilt({ style: 'embedding' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('embedding');

    console.log(`✅ Tilt embedding style test passed`);
  });

  test('should set graph view style', async () => {
    const result = await executeTilt({ style: 'graph' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('graph');

    console.log(`✅ Tilt graph style test passed`);
  });

  test('should set temporal view style', async () => {
    const result = await executeTilt({ style: 'temporal' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('temporal');

    console.log(`✅ Tilt temporal style test passed`);
  });

  test('should handle tilt with query context', async () => {
    const result = await executeTilt({
      style: 'graph',
      query: 'show graph view of semantic memory concepts'
    });

    const response = parseTiltResponse(result.tiltResponse);
    expect(response.success).toBe(true);
    expect(response.tilt.style).toBe('graph');
    expect(response).toHaveProperty('context');

    console.log(`✅ Tilt with query context test passed`);
  });

  test('should handle invalid style type', async () => {
    const result = await executeTilt({ style: 'invalid_style' });
    const response = parseTiltResponse(result.tiltResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Tilt invalid style error handling test passed`);
  });

}, 120000); // 2 minute timeout for tilt tests
