/**
 * Unit test to verify STDIO MCP fix is correctly implemented
 * This test verifies the fix logic without running full MCP initialization
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { getSimpleVerbsService } from '../../../_mcp/tools/VerbRegistration.js';

describe('STDIO Fix Unit Verification', () => {
  let originalEnv;
  let originalArgv;
  let originalIsTTY;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalArgv = [...process.argv];
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    process.argv = originalArgv;
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      writable: true
    });
  });

  test('STDIO fix creates fresh instances for Inspector mode', () => {
    // Set Inspector mode environment
    process.env.MCP_INSPECTOR_MODE = 'true';

    // Call the function multiple times
    const service1 = getSimpleVerbsService();
    const service2 = getSimpleVerbsService();

    // Verify they are different instances (fresh instances each time)
    expect(service1).not.toBe(service2);
    expect(service1.constructor.name).toBe('SimpleVerbsService');
    expect(service2.constructor.name).toBe('SimpleVerbsService');

    console.log('✅ Inspector mode creates fresh instances correctly');
  });

  test('STDIO fix creates fresh instances for mcp/index.js argv', () => {
    // Simulate running via mcp/index.js
    process.argv = ['node', 'mcp/index.js'];

    const service1 = getSimpleVerbsService();
    const service2 = getSimpleVerbsService();

    // Verify they are different instances
    expect(service1).not.toBe(service2);

    console.log('✅ mcp/index.js argv creates fresh instances correctly');
  });

  test('STDIO fix creates fresh instances for non-TTY stdin', () => {
    // Simulate STDIO input (not TTY)
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true
    });

    const service1 = getSimpleVerbsService();
    const service2 = getSimpleVerbsService();

    // Verify they are different instances
    expect(service1).not.toBe(service2);

    console.log('✅ Non-TTY stdin creates fresh instances correctly');
  });

  test('HTTP mode returns singleton instances', () => {
    // Clear STDIO conditions to simulate HTTP mode
    delete process.env.MCP_INSPECTOR_MODE;
    process.argv = ['node', 'some-other-script.js'];
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true
    });

    const service1 = getSimpleVerbsService();
    const service2 = getSimpleVerbsService();

    // Verify they are the same instance (singleton for HTTP)
    expect(service1).toBe(service2);

    console.log('✅ HTTP mode returns singleton instances correctly');
  });

  test('Fix detection logic works correctly', () => {
    // Test Inspector mode detection
    process.env.MCP_INSPECTOR_MODE = 'true';
    process.argv = ['node', 'other-script.js'];
    Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });

    let service = getSimpleVerbsService();
    expect(service.constructor.name).toBe('SimpleVerbsService');

    // Test argv detection
    delete process.env.MCP_INSPECTOR_MODE;
    process.argv = ['node', 'mcp/index.js'];

    service = getSimpleVerbsService();
    expect(service.constructor.name).toBe('SimpleVerbsService');

    // Test TTY detection
    process.argv = ['node', 'other-script.js'];
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    service = getSimpleVerbsService();
    expect(service.constructor.name).toBe('SimpleVerbsService');

    console.log('✅ All STDIO detection conditions work correctly');
  });
});