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

  const stdioTellAsk = async (fact, question) => {
    console.log(`🔵 STDIO: Testing fact: "${fact}"`);

    const mcpProcess = spawn('node', ['src/mcp/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdoutData = '';
    let stderrData = '';
    const responses = [];
    let currentResponse = '';
    const pending = new Map();
    let completed = false;

    const cleanup = () => {
      if (completed) {
        return;
      }
      completed = true;
      for (const entry of pending.values()) {
        global.clearTimeout(entry.timeoutId);
      }
      pending.clear();
      mcpProcess.kill('SIGTERM');
    };

    const fail = (error) => {
      if (completed) {
        return;
      }
      completed = true;
      for (const entry of pending.values()) {
        global.clearTimeout(entry.timeoutId);
        entry.reject(error);
      }
      pending.clear();
      mcpProcess.kill('SIGTERM');
    };

    const waitForResponse = (id, timeoutMs) => new Promise((resolve, reject) => {
      const timeoutId = global.setTimeout(() => {
        fail(new Error(`STDIO MCP test timeout waiting for response ${id}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timeoutId });
    });

    const handleResponse = (jsonResponse) => {
      responses.push(jsonResponse);
      if (typeof jsonResponse.id === 'number') {
        const pendingEntry = pending.get(jsonResponse.id);
        if (pendingEntry) {
          global.clearTimeout(pendingEntry.timeoutId);
          pending.delete(jsonResponse.id);
          pendingEntry.resolve(jsonResponse);
        }
      }
    };

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
            handleResponse(jsonResponse);
          } catch (e) {
            // If we can't parse as JSON, this indicates pollution
            console.error('❌ Non-JSON data in stdout:', line.trim());
            fail(new Error(`STDIO pollution detected: "${line.trim()}" is not valid JSON`));
            return;
          }
        }
      }
    });

    // Collect stderr data (should be minimal logging only)
    mcpProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    mcpProcess.on('close', (code) => {
      console.log(`📤 STDIO process closed with code: ${code}`);
    });

    mcpProcess.on('error', (error) => {
      fail(new Error(`MCP process error: ${error.message}`));
    });

    try {
      // 1. Initialize MCP
      const initPromise = waitForResponse(1, 60000);
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      }) + '\n');
      const initResponse = await initPromise;

      // 2. Tell (store the fact)
      const tellPromise = waitForResponse(2, 120000);
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'tell',
          arguments: { content: fact }
        }
      }) + '\n');
      const tellResponse = await tellPromise;

      // 3. Ask (query the fact)
      const askPromise = waitForResponse(3, 120000);
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ask',
          arguments: { question }
        }
      }) + '\n');
      const askResponse = await askPromise;

      cleanup();

      return {
        fact,
        question,
        initResponse,
        tellResponse,
        askResponse,
        stdoutLength: stdoutData.length,
        stderrLength: stderrData.length,
        stderrContent: stderrData,
        allResponses: responses
      };
    } catch (error) {
      cleanup();
      throw error;
    }
  };

  test('STDIO tell/ask round trip with clean protocol', async () => {
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

    console.log(`✅ STDIO test passed for: ${fact}`);
    console.log(`📊 Protocol cleanliness: stdout=${result.stdoutLength} chars, stderr=${result.stderrLength} chars`);
  }, 180000); // 180 second timeout

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
  }, 180000); // 180 second timeout

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

      console.log(`✅ Clean protocol maintained for: ${fact}`);
    }
  }, 300000); // Longer timeout for multiple operations
});
