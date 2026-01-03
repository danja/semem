/**
 * ZPT Tools Integration Tests
 * Tests zpt_preview, zpt_get_schema, zpt_validate_params against live services
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

class MCPTestClient {
  constructor() {
    this.process = null;
    this.buffer = '';
    this.messageId = 1;
    this.pending = new Map();
    this.stderrBuffer = '';
  }

  async start() {
    this.process = spawn('node', ['src/mcp/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    this.process.stdout.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const jsonResponse = JSON.parse(line.trim());
          const pending = this.pending.get(jsonResponse.id);
          if (pending) {
            this.pending.delete(jsonResponse.id);
            pending.resolve(jsonResponse);
          }
        } catch (error) {
          // Ignore malformed lines from non-protocol logs
        }
      }
    });

    this.process.stderr.on('data', (data) => {
      this.stderrBuffer += data.toString();
    });

    this.process.on('exit', (code, signal) => {
      const detail = this.stderrBuffer.trim()
        ? `\nSTDERR:\n${this.stderrBuffer.trim()}`
        : '';
      const error = new Error(`MCP process exited (code ${code}, signal ${signal}).${detail}`);
      this.pending.forEach(pending => pending.reject(error));
      this.pending.clear();
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

  async send(method, params, timeout = 120000) {
    const id = this.messageId++;
    const payload = { jsonrpc: '2.0', id, method, params };

    const responsePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        const detail = this.stderrBuffer.trim()
          ? `\nSTDERR:\n${this.stderrBuffer.trim()}`
          : '';
        reject(new Error(`MCP response timeout after ${timeout}ms.${detail}`));
      }, timeout);

      this.pending.set(id, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
    });

    this.process.stdin.write(JSON.stringify(payload) + '\n');
    return responsePromise;
  }

  async callTool(toolName, args, timeout = 120000) {
    return await this.send('tools/call', { name: toolName, arguments: args }, timeout);
  }
}

const parseToolResponse = (toolResponse) => {
  if (!toolResponse?.result?.content?.[0]?.text) {
    throw new Error('Invalid tool response format');
  }
  return JSON.parse(toolResponse.result.content[0].text);
};

describe('ZPT Tools Integration Tests', () => {
  const client = new MCPTestClient();

  beforeAll(async () => {
    await client.start();
    await delay(1500);
  }, 120000);

  afterAll(async () => {
    await client.stop();
  }, 30000);

  test('zpt_preview returns a preview payload', async () => {
    const toolResponse = await client.callTool('zpt_preview', {
      query: 'semantic memory overview',
      zoom: 'entity'
    });
    const response = parseToolResponse(toolResponse);

    expect(response.success).toBe(true);
    const previewPayload = response.preview?.content ?? response.preview;
    expect(previewPayload).toBeDefined();
    expect(previewPayload).toHaveProperty('estimatedResults');
  }, 120000);

  test('zpt_get_schema returns schema metadata', async () => {
    const toolResponse = await client.callTool('zpt_get_schema', {});
    const response = parseToolResponse(toolResponse);

    expect(response.success).toBe(true);
    expect(response.schema).toBeDefined();
    expect(response.schema.parameters).toHaveProperty('zoom');
    expect(response.schema.parameters).toHaveProperty('tilt');
  }, 120000);

  test('zpt_validate_params accepts valid payload', async () => {
    const toolResponse = await client.callTool('zpt_validate_params', {
      params: {
        query: 'memory recall',
        zoom: 'entity',
        pan: { domains: ['technology'] },
        tilt: 'keywords',
        transform: {}
      }
    });
    const response = parseToolResponse(toolResponse);

    expect(response.success).toBe(true);
    expect(response.validation).toBeDefined();
    expect(response.validation.valid).toBe(true);
  }, 120000);

  test('zpt_get_options returns option payload', async () => {
    const toolResponse = await client.callTool('zpt_get_options', {
      context: 'current',
      query: 'semantic memory'
    });
    const response = parseToolResponse(toolResponse);

    expect(response.success).toBe(true);
    expect(response.options).toBeDefined();
    expect(response.options.zoom?.levels).toContain('entity');
    expect(response.options.tilt?.styles).toContain('keywords');
    expect(response.options.tilt?.styles).toContain('concept');
  }, 120000);

  test('zpt_analyze_corpus returns analysis payload', async () => {
    const toolResponse = await client.callTool('zpt_analyze_corpus', {
      analysisType: 'structure',
      includeStats: true
    });
    const response = parseToolResponse(toolResponse);

    expect(response.success).toBe(true);
    expect(response.analysis).toBeDefined();
    expect(response.analysis.analysisType).toBe('structure');
  }, 120000);
});
