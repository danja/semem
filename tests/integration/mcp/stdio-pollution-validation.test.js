/**
 * STDIO Pollution Validation Test
 * Simple validation that STDIO MCP protocol is clean of JSON pollution
 * This is a lightweight alternative to the complex process management test
 */

import { describe, test, expect } from 'vitest';
import { spawn } from 'child_process';

describe('STDIO Pollution Validation', () => {
  test('STDIO MCP produces clean JSON without pollution', async () => {
    console.log('🔍 Testing STDIO MCP for JSON pollution...');

    const result = await new Promise((resolve, reject) => {
      const mcpProcess = spawn('node', ['mcp/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send a simple tell operation
      const message = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      };

      process.stdin.write(JSON.stringify(message) + '\n');

      // Force kill after 5 seconds to prevent hanging
      const killTimer = setTimeout(() => {
        process.kill('SIGKILL');
        resolve({ stdout, stderr, killed: true });
      }, 5000);

      process.on('exit', () => {
        clearTimeout(killTimer);
        resolve({ stdout, stderr, killed: false });
      });

      process.on('error', reject);
    });

    console.log(`📊 Stdout length: ${result.stdout.length} chars`);
    console.log(`📊 Stderr length: ${result.stderr.length} chars`);

    // Verify we got some stdout (JSON response)
    expect(result.stdout.length).toBeGreaterThan(0);

    // Parse the first JSON response
    const lines = result.stdout.split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThan(0);

    // First line should be valid JSON (no pollution)
    const firstResponse = JSON.parse(lines[0]);
    expect(firstResponse.jsonrpc).toBe('2.0');
    expect(firstResponse.id).toBe(1);

    // Verify no console.log pollution in stdout
    for (const line of lines) {
      if (line.trim()) {
        expect(() => JSON.parse(line.trim())).not.toThrow();
      }
    }

    console.log('✅ STDIO MCP produces clean JSON without pollution');
  }, 15000);
});