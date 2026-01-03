/**
 * MCP Chat Slash Command Integration Tests
 * Exercises /zoom, /pan, /tilt over MCP HTTP chat endpoint
 */

import { describe, test, expect } from 'vitest';

const chatCommand = async (message) => {
  const response = await fetch('http://localhost:4101/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  if (!response) {
    throw new Error('Fetch returned undefined - connection failed');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
};

describe('MCP chat ZPT slash commands', () => {
  test('sets zoom level via /zoom', async () => {
    const result = await chatCommand('/zoom unit');

    expect(result.success).toBe(true);
    expect(result.messageType).toBe('zoom_result');
    expect(result.zptState).toBeDefined();
    expect(result.zptState.zoom).toBe('unit');
  }, 30000);

  test('sets pan domain via /pan', async () => {
    const result = await chatCommand('/pan cats');

    expect(result.success).toBe(true);
    expect(result.messageType).toBe('pan_result');
    expect(result.zptState).toBeDefined();
    expect(result.zptState.pan?.domains).toEqual(['cats']);
  }, 30000);

  test('sets tilt style via /tilt', async () => {
    const result = await chatCommand('/tilt search');

    expect(result.success).toBe(true);
    expect(result.messageType).toBe('tilt_result');
    expect(result.zptState).toBeDefined();
    expect(result.zptState.tilt).toBe('keywords');
  }, 30000);
});
