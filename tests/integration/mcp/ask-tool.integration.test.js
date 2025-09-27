/**
 * Ask Tool Integration Tests
 * Tests the ask tool in the refactored architecture
 * NO MOCKING - tests against live running servers with real data
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Ask Tool Integration Tests', () => {

  /**
   * Execute ask tool via STDIO and get result
   */
  const executeAsk = async (args, timeout = 15000) => {
    console.log(`🔧 Executing ask with args:`, args);

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
                const hasAsk = responses.some(r => r.id === 2);

                if (hasInit && hasAsk) {
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
        const askResponse = responses.find(r => r.id === 2);

        if (!initResponse || !askResponse) {
          reject(new Error('Missing expected responses'));
          return;
        }

        resolve({
          args,
          initResponse,
          askResponse,
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

          // Execute ask
          sendMessage({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/call',
            params: {
              name: 'ask',
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
          reject(new Error(`Ask test timeout after ${timeout}ms`));
        }
      }, timeout);
    });
  };

  /**
   * Store content first for testing retrieval
   */
  const storeThenAsk = async (content, question, askArgs = {}) => {
    // First store the content using tell
    await new Promise((resolve, reject) => {
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
                resolved = true;
                mcpProcess.kill('SIGTERM');
                resolve();
                return;
              }
            } catch (e) {
              // Continue parsing
            }
          }
        }
      });

      let messageId = 1;
      const sendMessage = (message) => {
        mcpProcess.stdin.write(JSON.stringify(message) + '\n');
      };

      const runStore = async () => {
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

        sendMessage({
          jsonrpc: '2.0',
          id: messageId++,
          method: 'tools/call',
          params: {
            name: 'tell',
            arguments: { content }
          }
        });

        await delay(1000);
      };

      runStore().catch(reject);

      setTimeout(() => {
        if (!resolved) {
          mcpProcess.kill();
          reject(new Error('Store timeout'));
        }
      }, 10000);
    });

    // Wait a bit for indexing
    await delay(1000);

    // Then ask the question
    return executeAsk({ question, ...askArgs });
  };

  /**
   * Parse ask response content
   */
  const parseAskResponse = (askResponse) => {
    if (!askResponse?.result?.content?.[0]?.text) {
      throw new Error('Invalid ask response format');
    }
    return JSON.parse(askResponse.result.content[0].text);
  };

  test('should query basic questions', async () => {
    const question = 'What is artificial intelligence?';
    const result = await executeAsk({ question });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);
    expect(response).toHaveProperty('content');

    console.log(`✅ Ask basic question test passed`);
  });

  test('should query stored facts', async () => {
    const fact = randomFactGenerator.generateFact();
    const question = randomFactGenerator.generateQuestion(fact);

    const result = await storeThenAsk(fact, question);
    const response = parseAskResponse(result.askResponse);

    expect(response.success).toBe(true);
    expect(response).toHaveProperty('content');

    console.log(`✅ Ask stored fact test passed for: ${fact}`);
  });

  test('should handle different query modes', async () => {
    const question = 'How does machine learning work?';
    const modes = ['basic', 'standard', 'comprehensive'];

    for (const mode of modes) {
      const result = await executeAsk({ question, mode });
      const response = parseAskResponse(result.askResponse);

      expect(response.success).toBe(true);
      expect(response).toHaveProperty('content');

      console.log(`✅ Ask ${mode} mode test passed`);
    }
  });

  test('should support context usage', async () => {
    const question = 'What are neural networks?';

    // Test with context enabled
    const withContextResult = await executeAsk({
      question,
      useContext: true
    });
    const withContextResponse = parseAskResponse(withContextResult.askResponse);

    expect(withContextResponse.success).toBe(true);

    // Test with context disabled
    const withoutContextResult = await executeAsk({
      question,
      useContext: false
    });
    const withoutContextResponse = parseAskResponse(withoutContextResult.askResponse);

    expect(withoutContextResponse.success).toBe(true);

    console.log(`✅ Ask context usage test passed`);
  });

  test('should handle enhancement options', async () => {
    const question = 'What is deep learning?';

    const result = await executeAsk({
      question,
      useHyDE: false,
      useWikipedia: false,
      useWikidata: false,
      useWebSearch: false
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask enhancement options test passed`);
  });

  test('should support memory recall (legacy recall functionality)', async () => {
    const content = 'Memory recall test: machine learning uses algorithms to find patterns in data.';
    const question = 'How does machine learning find patterns?';

    const result = await storeThenAsk(content, question, {
      domains: ['test'],
      maxResults: 5,
      relevanceThreshold: 0.1
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask memory recall test passed`);
  });

  test('should handle temporal filters', async () => {
    const question = 'What recent developments have occurred?';

    const result = await executeAsk({
      question,
      timeRange: { start: '2024-01-01', end: '2024-12-31' },
      maxResults: 3
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask temporal filters test passed`);
  });

  test('should handle domain filtering', async () => {
    const question = 'What is semantic memory?';

    const result = await executeAsk({
      question,
      domains: ['memory', 'cognitive-science'],
      relevanceThreshold: 0.3
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask domain filtering test passed`);
  });

  test('should return relevant results with scoring', async () => {
    const content = 'The hippocampus plays a crucial role in forming new memories and spatial navigation.';
    const question = 'What role does the hippocampus play?';

    const result = await storeThenAsk(content, question, {
      maxResults: 3,
      relevanceThreshold: 0.2
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask relevance scoring test passed`);
  });

  test('should handle empty questions gracefully', async () => {
    const result = await executeAsk({ question: '' });
    const response = parseAskResponse(result.askResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');
    expect(response.error).toContain('empty');

    console.log(`✅ Ask empty question error handling test passed`);
  });

  test('should handle missing question parameter', async () => {
    const result = await executeAsk({ mode: 'standard' }); // Missing question
    const response = parseAskResponse(result.askResponse);

    expect(response.success).toBe(false);
    expect(response).toHaveProperty('error');

    console.log(`✅ Ask missing question error handling test passed`);
  });

  test('should handle very long questions', async () => {
    const longQuestion = 'What is the relationship between ' + 'artificial intelligence '.repeat(50) + 'and machine learning?';

    const result = await executeAsk({ question: longQuestion });
    const response = parseAskResponse(result.askResponse);

    expect(response.success).toBe(true);

    console.log(`✅ Ask long question test passed`);
  });

  test('should handle questions with special characters', async () => {
    const specialQuestion = 'What is AI/ML? How does it work with 100% accuracy?';

    const result = await executeAsk({ question: specialQuestion });
    const response = parseAskResponse(result.askResponse);

    expect(response.success).toBe(true);

    console.log(`✅ Ask special characters test passed`);
  });

  test('should support comprehensive analysis mode', async () => {
    const question = 'Explain the relationship between semantic memory and knowledge representation.';

    const result = await executeAsk({
      question,
      mode: 'comprehensive',
      useContext: true,
      maxResults: 10
    });

    const response = parseAskResponse(result.askResponse);
    expect(response.success).toBe(true);

    console.log(`✅ Ask comprehensive analysis test passed`);
  });

}, 180000); // 3 minute timeout for ask tests