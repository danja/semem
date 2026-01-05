/**
 * End-to-End Tell/Ask STDIO Integration Test
 * Tests STDIO MCP interface for clean protocol communication without logging pollution
 * NO MOCKING - tests against live STDIO MCP server
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Tell/Ask STDIO E2E Integration Tests', () => {

  const STDIO_TIMEOUT_MS = 60000;
  const runIntegration = process.env.INTEGRATION_TESTS === 'true';
  const integrationTest = runIntegration ? test : test.skip;

  const stdioTellAsk = async (fact, question) => {
    // Test STDIO interface against live MCP server
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', ['src/mcp/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdoutData = '';
      let stderrData = '';
      let responses = [];
      let currentResponse = '';

      // Collect all stdout data (should be clean JSON only)
      mcpProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        currentResponse += data.toString();

        // Try to parse complete JSON messages
        const lines = currentResponse.split('\n');
        currentResponse = lines.pop(); // Keep incomplete line for next iteration

        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonResponse = JSON.parse(line.trim());
              responses.push(jsonResponse);

              // Check if we have all expected responses (init=1, tell=2, ask=3)
              if (responses.length >= 3 && !resolved) {
                const hasInit = responses.some(r => r.id === 1);
                const hasTell = responses.some(r => r.id === 2);
                const hasAsk = responses.some(r => r.id === 3);

                if (hasInit && hasTell && hasAsk) {
                  // We have all responses! Kill process and resolve
                  mcpProcess.kill('SIGTERM');
                  resolveWithResults();
                  return;
                }
              }
            } catch (e) {
              // If we can't parse as JSON, this indicates pollution
              mcpProcess.kill('SIGTERM');
              reject(new Error(`STDIO pollution detected: "${line.trim()}" is not valid JSON`));
              return;
            }
          }
        }
      });

      // Collect stderr data (should be minimal logging only)
      mcpProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      let messageId = 1;
      let resolved = false;

      const resolveWithResults = () => {
        if (resolved) return;
        resolved = true;

        const initResponse = responses.find(r => r.id === 1);
        const tellResponse = responses.find(r => r.id === 2);
        const askResponse = responses.find(r => r.id === 3);

        if (!initResponse || !tellResponse || !askResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          fact,
          question,
          initResponse,
          tellResponse,
          askResponse,
          stdoutLength: stdoutData.length,
          stderrLength: stderrData.length,
          stderrContent: stderrData,
          allResponses: responses
        });
      };

      const sendMessage = (message) => {
        mcpProcess.stdin.write(JSON.stringify(message) + '\n');
      };

      // Test sequence
      const runTest = async () => {
        try {
          // 1. Initialize MCP
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

          await setTimeout(500); // Wait for initialization

          // 2. Tell (store the fact)
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'tell',
              arguments: { content: fact }
            }
          });

          await setTimeout(1000); // Wait for tell processing

          // 3. Ask (query the fact)
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'ask',
              arguments: { question }
            }
          });

          await setTimeout(2000); // Wait for ask processing

          // Process will be killed automatically when all responses are received

        } catch (error) {
          reject(error);
        }
      };

      mcpProcess.on('close', (code) => {
        // Resolution now happens immediately when we get all responses
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`MCP process error: ${error.message}`));
      });

      // Start the test sequence
      runTest().catch(reject);

      // Timeout after a longer window for live services
      global.setTimeout(() => {
        if (!resolved) {
          mcpProcess.kill();
          reject(new Error('STDIO MCP test timeout'));
        }
      }, STDIO_TIMEOUT_MS);
    });
  };

  integrationTest('STDIO tell/ask round trip with clean protocol', async () => {
    const fact = randomFactGenerator.generateFact();
    const question = randomFactGenerator.generateQuestion(fact);

    const result = await stdioTellAsk(fact, question);

    // Verify initialization worked
    expect(result.initResponse.result).toBeDefined();
    expect(result.initResponse.result.protocolVersion).toBe('2024-11-05');

    // Verify tell worked
    expect(result.tellResponse.result).toBeDefined();
    expect(result.tellResponse.result.content).toBeDefined();

    // Verify ask worked
    expect(result.askResponse.result).toBeDefined();
    expect(result.askResponse.result.content).toBeDefined();

    // Most important: verify stdout is clean JSON only
    expect(result.stderrLength).toBeLessThan(1000); // Allow some logging but not excessive

  }, 20000); // 20 second timeout

  test('STDIO protocol pollution detection', async () => {
    const fact = randomFactGenerator.generateFact();
    const question = `tell me about ${randomFactGenerator.extractSubject(fact)}`;

    try {
      const result = await stdioTellAsk(fact, question);

      // Check for specific pollution indicators
      const hasServiceManagerLogs = result.stderrContent.includes('🔧 [ServiceManager]');
      const hasConfigLogs = result.stderrContent.includes('🔧 [CONFIG]');
      const hasConsoleLogs = result.stderrContent.includes('🔥 CONSOLE:');
      const hasDebugLogs = result.stderrContent.includes('🔥 DEBUG:');


      // For now, we expect some stderr logging, but we want to minimize it
      // The key is ensuring stdout is clean JSON only
      expect(hasConsoleLogs).toBe(false); // Should be fixed by our earlier work


    } catch (error) {
      if (error.message.includes('STDIO pollution detected')) {
        throw error;
      }
      throw error;
    }
  }, 20000); // 20 second timeout

  test('Multiple STDIO operations maintain protocol cleanliness', async () => {
    const facts = [
      randomFactGenerator.generateFact(),
      randomFactGenerator.generateFact(),
      randomFactGenerator.generateFact()
    ];

    for (const fact of facts) {
      const question = `what are ${randomFactGenerator.extractSubject(fact)} like?`;
      const result = await stdioTellAsk(fact, question);

      // Each operation should maintain clean protocol
      expect(result.initResponse.result).toBeDefined();
      expect(result.tellResponse.result).toBeDefined();
      expect(result.askResponse.result).toBeDefined();

    }
  }, 45000); // Longer timeout for multiple operations
});
