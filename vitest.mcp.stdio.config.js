import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// MCP Stdio tests - Standard input/output MCP protocol
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'mcp-stdio',
    include: [
      'tests/mcp/stdio/**/*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 20000,
    coverage: {
      reportsDirectory: './coverage/mcp-stdio',
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75
      }
    }
  }
}));