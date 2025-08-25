import { describe, it, expect } from 'vitest';

describe('Simple MCP Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test basic imports', async () => {
    const { z } = await import('zod');
    const schema = z.string();
    expect(schema.parse('hello')).toBe('hello');
  });
});