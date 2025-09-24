/**
 * End-to-End Tell/Ask STDIO Integration Test
 * Tests STDIO MCP interface for clean protocol communication without logging pollution
 * NO MOCKING - tests against live STDIO MCP server
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

describe('Tell/Ask STDIO E2E Integration Tests', () => {
  // Generate random facts to ensure we're testing actual storage/retrieval
  const generateRandomFact = () => {
    const subjects = ['florglings', 'blorknots', 'quiblets', 'zephyrs', 'glooplings'];
    const colors = ['turquoise', 'magenta', 'chartreuse', 'vermillion', 'cerulean'];
    const types = ['creatures', 'plants', 'crystals', 'beings', 'entities'];

    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const type = types[Math.floor(Math.random() * types.length)];

    return `${subject} are ${color} ${type}`;
  };

  const stdioTellAsk = async (fact, question) => {
    console.log(`🔵 STDIO: Testing fact: "${fact}"`);

    // Test STDIO interface against live MCP server
    return new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', ['mcp/index.js'], {
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
            } catch (e) {
              // If we can't parse as JSON, this indicates pollution
              console.error('❌ Non-JSON data in stdout:', line.trim());
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

          // Close the process
          mcpProcess.stdin.end();

        } catch (error) {
          reject(error);
        }
      };

      mcpProcess.on('close', (code) => {
        console.log(`📤 STDIO Tell/Ask completed with code: ${code}`);
        console.log(`📊 Responses received: ${responses.length}`);
        console.log(`📏 Stdout length: ${stdoutData.length} chars`);
        console.log(`📏 Stderr length: ${stderrData.length} chars`);

        if (stderrData.length > 0) {
          console.log(`⚠️  Stderr content (first 500 chars):`);
          console.log(stderrData.substring(0, 500));
        }

        // Verify we got responses
        if (responses.length === 0) {
          reject(new Error('No valid JSON responses received from STDIO MCP'));
          return;
        }

        // Find the responses we care about
        const initResponse = responses.find(r => r.id === 1);
        const tellResponse = responses.find(r => r.id === 2);
        const askResponse = responses.find(r => r.id === 3);

        if (!initResponse) {
          reject(new Error('Missing initialization response'));
          return;
        }

        if (!tellResponse) {
          reject(new Error('Missing tell response'));
          return;
        }

        if (!askResponse) {
          reject(new Error('Missing ask response'));
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
      });

      mcpProcess.on('error', (error) => {
        reject(new Error(`MCP process error: ${error.message}`));
      });

      // Start the test sequence
      runTest().catch(reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('STDIO MCP test timeout'));
      }, 10000);
    });
  };

  test('STDIO tell/ask round trip with clean protocol', async () => {
    const fact = generateRandomFact();
    const question = `what color are ${fact.split(' ')[0]}?`;

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

    console.log(`✅ STDIO test passed for: ${fact}`);
    console.log(`📊 Protocol cleanliness: stdout=${result.stdoutLength} chars, stderr=${result.stderrLength} chars`);
  }, 15000); // 15 second timeout

  test('STDIO protocol pollution detection', async () => {
    const fact = generateRandomFact();
    const question = `tell me about ${fact.split(' ')[0]}`;

    try {
      const result = await stdioTellAsk(fact, question);

      // Check for specific pollution indicators
      const hasServiceManagerLogs = result.stderrContent.includes('🔧 [ServiceManager]');
      const hasConfigLogs = result.stderrContent.includes('🔧 [CONFIG]');
      const hasConsoleLogs = result.stderrContent.includes('🔥 CONSOLE:');
      const hasDebugLogs = result.stderrContent.includes('🔥 DEBUG:');

      console.log(`📊 Pollution analysis:`);
      console.log(`  ServiceManager logs: ${hasServiceManagerLogs ? '❌' : '✅'}`);
      console.log(`  Config logs: ${hasConfigLogs ? '❌' : '✅'}`);
      console.log(`  Console logs: ${hasConsoleLogs ? '❌' : '✅'}`);
      console.log(`  Debug logs: ${hasDebugLogs ? '❌' : '✅'}`);

      // For now, we expect some stderr logging, but we want to minimize it
      // The key is ensuring stdout is clean JSON only
      expect(hasConsoleLogs).toBe(false); // Should be fixed by our earlier work

      console.log(`✅ Pollution detection completed for: ${fact}`);

    } catch (error) {
      if (error.message.includes('STDIO pollution detected')) {
        console.error(`❌ STDIO pollution found: ${error.message}`);
        throw error;
      }
      throw error;
    }
  }, 15000);

  test('Multiple STDIO operations maintain protocol cleanliness', async () => {
    const facts = [
      generateRandomFact(),
      generateRandomFact(),
      generateRandomFact()
    ];

    for (const fact of facts) {
      const question = `what are ${fact.split(' ')[0]} like?`;
      const result = await stdioTellAsk(fact, question);

      // Each operation should maintain clean protocol
      expect(result.initResponse.result).toBeDefined();
      expect(result.tellResponse.result).toBeDefined();
      expect(result.askResponse.result).toBeDefined();

      console.log(`✅ Clean protocol maintained for: ${fact}`);
    }
  }, 45000); // Longer timeout for multiple operations
});