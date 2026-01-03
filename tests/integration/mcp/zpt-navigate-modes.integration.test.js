/**
 * ZPT Navigate Integration Tests
 * Exercises zoom levels, pan filters, and tilt styles via MCP HTTP /zpt/navigate
 */

import { describe, test, expect } from 'vitest';

const navigate = async (payload) => {
  const response = await fetch('http://localhost:4101/zpt/navigate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response) {
    throw new Error('Fetch returned undefined - connection failed');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
  }

  return await response.json();
};

describe('ZPT navigate modes (HTTP)', () => {
  test('supports all zoom levels', async () => {
    const zoomLevels = ['micro', 'entity', 'unit', 'text', 'community', 'corpus'];

    for (const level of zoomLevels) {
      const result = await navigate({
        query: `Navigate ${level} view`,
        zoom: level,
        pan: {},
        tilt: 'keywords'
      });

      expect(result.success).toBe(true);
      expect(result.navigation?.zoom).toBe(level);
    }
  }, 120000);

  test('supports pan filter types', async () => {
    const panCases = [
      { name: 'domains', pan: { domains: ['ai', 'science'] } },
      { name: 'keywords', pan: { keywords: ['memory', 'retrieval'] } },
      { name: 'entities', pan: { entities: ['http://example.org/entity/memory-system'] } },
      { name: 'corpuscle', pan: { corpuscle: ['http://example.org/corpuscle/intro'] } },
      { name: 'temporal', pan: { temporal: { start: '2024-01-01T00:00:00Z', end: '2024-12-31T23:59:59Z' } } }
    ];

    for (const testCase of panCases) {
      const result = await navigate({
        query: `Navigate with ${testCase.name} filter`,
        zoom: 'entity',
        pan: testCase.pan,
        tilt: 'keywords'
      });

      expect(result.success).toBe(true);
      expect(result.navigation?.pan).toMatchObject(testCase.pan);
    }
  }, 120000);

  test('supports all tilt styles', async () => {
    const tiltStyles = ['keywords', 'embedding', 'graph', 'temporal'];

    for (const style of tiltStyles) {
      const result = await navigate({
        query: `Navigate with ${style} tilt`,
        zoom: 'entity',
        pan: {},
        tilt: style
      });

      expect(result.success).toBe(true);
      expect(result.navigation?.tilt).toBe(style);
    }
  }, 120000);

  test('supports concept tilt projections', async () => {
    const tellResponse = await fetch('http://localhost:4101/tell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Phenomenology studies consciousness and lived experience.'
      })
    });

    if (!tellResponse.ok) {
      throw new Error(`HTTP ${tellResponse.status}: ${tellResponse.statusText}`);
    }

    const result = await navigate({
      query: 'Phenomenology and consciousness',
      zoom: 'entity',
      pan: {},
      tilt: 'concept'
    });

    expect(result.success).toBe(true);
    expect(result.navigation?.tilt).toBe('concept');
    expect(result.content?.projection?.representation).toBe('concept');
    expect(Array.isArray(result.content?.projection?.data?.concepts)).toBe(true);
  }, 120000);
});
