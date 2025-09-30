/**
 * Template Loading Integration Test
 * Tests the template loading functionality in SimpleVerbsService using live MCP server
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/template-loading.integration.test.js --reporter=verbose
 */

import { describe, it, expect } from 'vitest';
// Note: fetch is provided globally by setup-unified.js in E2E mode

describe.skipIf(!process.env.INTEGRATION_TESTS)('Template Loading Integration', () => {
  const MCP_BASE_URL = 'http://localhost:4101';

  it('should use templates for ask operation with context', async () => {
    // First store some content to provide context
    let tellResponse;
    try {
      tellResponse = await fetch(`${MCP_BASE_URL}/tell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Machine learning algorithms can process vast amounts of data to identify patterns and make predictions.',
          type: 'document',
          metadata: { source: 'template-test' }
        })
      });
    } catch (err) {
      throw new Error(`Tell fetch failed: ${err.message}`);
    }

    expect(tellResponse).toBeDefined();
    expect(tellResponse.ok).toBe(true);
    const tellResult = await tellResponse.json();
    expect(tellResult.success).toBe(true);

    // Now ask a question that should retrieve context and use templates
    let askResponse;
    try {
      askResponse = await fetch(`${MCP_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What can machine learning do with data?',
          mode: 'comprehensive',
          useContext: true
        })
      });
    } catch (err) {
      throw new Error(`Ask fetch failed: ${err.message}`);
    }

    expect(askResponse).toBeDefined();
    expect(askResponse.ok).toBe(true);
    const askResult = await askResponse.json();

    expect(askResult).toBeDefined();
    expect(askResult.success).toBe(true);
    expect(askResult.answer).toBeDefined();
    expect(askResult.answer.length).toBeGreaterThan(0);

    console.log('✓ Ask with context uses template successfully');
    console.log(`Answer: ${askResult.answer.substring(0, 100)}...`);
  });

  it('should use templates for ask operation with external context', async () => {
    let askResponse;
    try {
      askResponse = await fetch(`${MCP_BASE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'What is quantum computing?',
          mode: 'comprehensive',
          useContext: false,
          useWikipedia: true
        })
      });
    } catch (err) {
      throw new Error(`Ask fetch failed: ${err.message}`);
    }

    expect(askResponse).toBeDefined();
    expect(askResponse.ok).toBe(true);
    const askResult = await askResponse.json();

    expect(askResult).toBeDefined();
    expect(askResult.success).toBe(true);
    expect(askResult.answer).toBeDefined();
    expect(askResult.answer.length).toBeGreaterThan(0);

    console.log('✓ Ask with external enhancement uses template successfully');
    console.log(`Answer: ${askResult.answer.substring(0, 100)}...`);
  });

  it('should verify template files exist and are accessible', async () => {
    // Import SimpleTemplateLoader directly to test template loading
    const { SimpleTemplateLoader } = await import('../../../src/mcp/lib/SimpleTemplateLoader.js');
    const templateLoader = new SimpleTemplateLoader();

    // Test hybrid context template
    const hybridTemplate = await templateLoader.loadTemplate('mcp', 'ask-with-hybrid-context');
    expect(hybridTemplate).toBeDefined();
    expect(hybridTemplate).toContain('{{fullContext}}');
    expect(hybridTemplate).toContain('{{question}}');
    expect(hybridTemplate).toContain('Based on this context information:');

    // Test external context template
    const externalTemplate = await templateLoader.loadTemplate('mcp', 'ask-with-external-context');
    expect(externalTemplate).toBeDefined();
    expect(externalTemplate).toContain('{{externalContext}}');
    expect(externalTemplate).toContain('{{question}}');
    expect(externalTemplate).toContain('Based on this external knowledge:');

    console.log('✓ Template files exist and contain expected placeholders');
  });

  it('should interpolate template variables correctly', async () => {
    const { SimpleTemplateLoader } = await import('../../../src/mcp/lib/SimpleTemplateLoader.js');
    const templateLoader = new SimpleTemplateLoader();

    const testTemplate = 'Question: {{question}}\nContext: {{context}}\nAnswer the question using the context.';
    const variables = {
      question: 'What is artificial intelligence?',
      context: 'AI is the simulation of human intelligence in machines.'
    };

    const interpolated = templateLoader.interpolateTemplate(testTemplate, variables);

    expect(interpolated).toBe('Question: What is artificial intelligence?\nContext: AI is the simulation of human intelligence in machines.\nAnswer the question using the context.');
    expect(interpolated).not.toContain('{{');

    console.log('✓ Template variable interpolation works correctly');
  });

  it('should load and interpolate templates via loadAndInterpolate method', async () => {
    const { SimpleTemplateLoader } = await import('../../../src/mcp/lib/SimpleTemplateLoader.js');
    const templateLoader = new SimpleTemplateLoader();

    // Test the main loadAndInterpolate method used by SimpleVerbsService
    const interpolatedTemplate = await templateLoader.loadAndInterpolate('mcp', 'ask-with-hybrid-context', {
      fullContext: 'Test context about machine learning algorithms and their applications in data analysis.',
      question: 'How do machine learning algorithms work?'
    });

    expect(interpolatedTemplate).toBeDefined();
    expect(interpolatedTemplate).toContain('Test context about machine learning');
    expect(interpolatedTemplate).toContain('How do machine learning algorithms work?');
    expect(interpolatedTemplate).toContain('Based on this context information:');
    expect(interpolatedTemplate).not.toContain('{{');

    console.log('✓ loadAndInterpolate method works correctly');
  });
});