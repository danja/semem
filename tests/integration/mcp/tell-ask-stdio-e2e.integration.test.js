/**
 * End-to-End Tell/Ask STDIO Integration Test
 * Tests STDIO MCP interface for clean protocol communication without logging pollution
 * NO MOCKING - tests against live STDIO MCP server
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Tell/Ask STDIO E2E Integration Tests', () => {
  class MCPStdioClient {
    constructor() {
      this.process = null;
      this.stdoutData = '';
      this.stderrData = '';
      this.buffer = '';
      this.pending = new Map();
      this.messageId = 1;
      this.responses = [];
    }

    async start() {
      this.process = spawn('node', ['src/mcp/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      this.process.stdout.on('data', (data) => {
        this.stdoutData += data.toString();
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const jsonResponse = JSON.parse(line.trim());
            this.responses.push(jsonResponse);
            if (typeof jsonResponse.id === 'number') {
              const pendingEntry = this.pending.get(jsonResponse.id);
              if (pendingEntry) {
                global.clearTimeout(pendingEntry.timeoutId);
                this.pending.delete(jsonResponse.id);
                pendingEntry.resolve(jsonResponse);
              }
            }
          } catch (error) {
            this.fail(new Error(`STDIO pollution detected: "${line.trim()}" is not valid JSON`));
            return;
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        this.stderrData += data.toString();
      });

      this.process.on('error', (error) => {
        this.fail(new Error(`MCP process error: ${error.message}`));
      });

      await this.send('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }, 120000);
    }

    async stop() {
      if (this.process) {
        this.process.kill('SIGTERM');
        this.process = null;
      }
    }

    fail(error) {
      for (const entry of this.pending.values()) {
        global.clearTimeout(entry.timeoutId);
        entry.reject(error);
      }
      this.pending.clear();
      if (this.process) {
        this.process.kill('SIGTERM');
      }
    }

    async send(method, params, timeoutMs) {
      const id = this.messageId++;
      const payload = { jsonrpc: '2.0', id, method, params };

      const responsePromise = new Promise((resolve, reject) => {
        const timeoutId = global.setTimeout(() => {
          this.pending.delete(id);
          this.fail(new Error(`STDIO MCP test timeout waiting for response ${id}`));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timeoutId });
      });

      this.process.stdin.write(JSON.stringify(payload) + '\n');
      return responsePromise;
    }

    async callTool(name, args, timeoutMs = 180000) {
      return this.send('tools/call', { name, arguments: args }, timeoutMs);
    }
  }

  const client = new MCPStdioClient();

  const stdioTellAsk = async (fact, question) => {
    console.log(`🔵 STDIO: Testing fact: "${fact}"`);

    const tellResponse = await client.callTool('tell', { content: fact }, 180000);
    const askResponse = await client.callTool('ask', { question }, 180000);

    return {
      fact,
      question,
      tellResponse,
      askResponse,
      stdoutLength: client.stdoutData.length,
      stderrLength: client.stderrData.length,
      stderrContent: client.stderrData,
      allResponses: client.responses
    };
  };

  beforeAll(async () => {
    await client.start();
    await setTimeout(500);
  }, 180000);

  afterAll(async () => {
    await client.stop();
  }, 30000);

  test('STDIO tell/ask round trip with clean protocol', async () => {
    const fact = randomFactGenerator.generateFact();
    const question = randomFactGenerator.generateQuestion(fact);

    const result = await stdioTellAsk(fact, question);

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
      expect(result.tellResponse.result).toBeDefined();
      expect(result.askResponse.result).toBeDefined();

      console.log(`✅ Clean protocol maintained for: ${fact}`);
    }
  }, 300000); // Longer timeout for multiple operations
});
