import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// MCP HTTP tests - HTTP-based MCP protocol
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'mcp-http',
    include: [
      'tests/mcp/http/**/*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 30000,
    coverage: {
      reportsDirectory: './coverage/mcp-http',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
}));