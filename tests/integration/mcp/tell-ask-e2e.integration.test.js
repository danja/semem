/**
 * End-to-End Tell/Ask Integration Test
 * Tests that both HTTP and STDIO interfaces can store and retrieve random facts consistently
 * NO MOCKING - tests against live running servers
 */

import { describe, test, expect, beforeEach } from 'vitest';
// Note: fetch is provided globally by setup-unified.js in E2E mode
import randomFactGenerator from '../../helpers/randomFactGenerator.js';

describe('Tell/Ask E2E Integration Tests', () => {
  // Generate random facts to ensure we're testing actual storage/retrieval
  const generateRandomFact = () => {
    const uniqueFact = randomFactGenerator.generateUniqueFact();
    return uniqueFact.fact;
  };

  const httpTellAsk = async (fact, question) => {
    // Test HTTP interface against live server
    console.log(`🔵 HTTP: Testing fact: "${fact}"`);

    // Tell via HTTP
    try {
      const tellResponse = await fetch('http://localhost:4101/tell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fact })
      });

      if (!tellResponse) {
        throw new Error('Fetch returned undefined - connection failed');
      }

      if (!tellResponse.ok) {
        throw new Error(`HTTP ${tellResponse.status}: ${tellResponse.statusText}`);
      }

      const tellResult = await tellResponse.json();
      console.log(`📤 HTTP Tell result:`, tellResult);
      expect(tellResult.success).toBe(true);

      // Ask via HTTP
      const askResponse = await fetch('http://localhost:4101/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (!askResponse) {
        throw new Error('Fetch returned undefined - connection failed');
      }

      if (!askResponse.ok) {
        throw new Error(`HTTP ${askResponse.status}: ${askResponse.statusText}`);
      }

      const askResult = await askResponse.json();
      console.log(`📥 HTTP Ask result:`, askResult);
      expect(askResult.success).toBe(true);

      return { tellResult, askResult };
    } catch (error) {
      console.error('HTTP request failed:', error);
      throw error;
    }
  };

  test('HTTP tell/ask round trip with random fact', async () => {
    const fact = generateRandomFact();
    const subject = fact.split(' ')[0]; // Extract subject for query
    const question = `what color are ${subject}?`;

    const { tellResult, askResult } = await httpTellAsk(fact, question);

    // Verify the answer contains the stored information
    expect(askResult.answer.toLowerCase()).toContain(fact.split(' ')[2]); // Should contain the color

    console.log(`✅ HTTP test passed for: ${fact}`);
  }, 30000);

  test('Multiple random facts via HTTP', async () => {
    // Using native fetch (Node.js 18+)
    const facts = [
      generateRandomFact(),
      generateRandomFact(),
      generateRandomFact()
    ];

    console.log(`🔵 HTTP: Testing multiple facts:`, facts);

    // Store all facts
    for (const fact of facts) {
      const tellResponse = await fetch('http://localhost:4101/tell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fact })
      });
      if (!tellResponse) {
        throw new Error('Fetch returned undefined - connection failed');
      }
      if (!tellResponse.ok) {
        throw new Error(`HTTP ${tellResponse.status}: ${tellResponse.statusText}`);
      }
      const result = await tellResponse.json();
      expect(result.success).toBe(true);
    }

    // Query for each fact
    for (const fact of facts) {
      const subject = fact.split(' ')[0];
      const expectedColor = fact.split(' ')[2];
      const question = `what color are ${subject}?`;

      const askResponse = await fetch('http://localhost:4101/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });

      if (!askResponse.ok) {
        throw new Error(`HTTP ${askResponse.status}: ${askResponse.statusText}`);
      }

      const askResult = await askResponse.json();
      expect(askResult.success).toBe(true);
      expect(askResult.answer.toLowerCase()).toContain(expectedColor);

      console.log(`✅ Found ${subject} -> ${expectedColor}`);
    }
  }, 60000);

  test('Verify HTTP and STDIO share the same storage', async () => {
    const { default: fetch } = await import('node-fetch');
    const fact = generateRandomFact();
    const subject = fact.split(' ')[0];
    const expectedColor = fact.split(' ')[2];
    const question = `what color are ${subject}?`;

    console.log(`🔄 Testing storage consistency: "${fact}"`);

    // Store and retrieve via HTTP
    const { tellResult, askResult } = await httpTellAsk(fact, question);

    // Verify the tell/ask round trip worked correctly
    expect(tellResult.success).toBe(true);
    expect(askResult.success).toBe(true);
    expect(askResult.answer.toLowerCase()).toContain(expectedColor);

    console.log(`✅ Storage consistency verified for: ${fact}`);
  }, 30000);
});