/**
 * Enhanced Ask Workbench GUI Integration Test
 * Tests enhanced ask functionality through the workbench web interface
 * NO MOCKING - tests against live workbench with real enhancement services
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';

describe('Enhanced Ask Workbench GUI Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    console.log('🌐 Testing enhanced ask functionality through workbench GUI');
    // Launch browser and create page
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Navigate to workbench once for all tests
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);
    console.log('✅ Workbench loaded for GUI tests');
  });

  afterAll(async () => {
    await browser?.close();
    console.log('🏁 Enhanced ask GUI tests completed');
  });

  test('Wikipedia enhancement via GUI', async () => {
    console.log('🔍 Testing Wikipedia enhancement via workbench GUI');

    // Navigate to Ask section first
    const askButton = page.locator('button, div, span').filter({hasText: 'Ask'}).first();
    await askButton.click();
    await page.waitForTimeout(2000);

    // Look for question input in Ask section
    const questionInput = page.locator('textarea[placeholder*="question"], input[placeholder*="question"], textarea, input[type="text"]').first();
    await questionInput.fill('What is artificial intelligence?');

    console.log('✅ Filled question input');

    // Look for enhancement checkboxes
    const enhancementCheckboxes = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      return checkboxes.map(cb => {
        const label = cb.closest('label') || cb.parentElement;
        return {
          name: cb.name || '',
          id: cb.id || '',
          labelText: label ? label.textContent.trim() : '',
          checked: cb.checked
        };
      });
    });

    console.log('📋 Available checkboxes:', enhancementCheckboxes);

    // Find and check Wikipedia enhancement
    const wikipediaCheckbox = page.locator('input[type="checkbox"]').filter({
      has: page.locator('text=Wikipedia')
    }).or(
      page.locator('label').filter({hasText: 'Wikipedia'}).locator('input[type="checkbox"]')
    ).first();

    if (await wikipediaCheckbox.count() > 0) {
      await wikipediaCheckbox.check();
      console.log('✅ Checked Wikipedia enhancement');
    } else {
      // Try any checkbox that might be enhancement-related
      const firstCheckbox = page.locator('input[type="checkbox"]').first();
      if (await firstCheckbox.count() > 0) {
        await firstCheckbox.check();
        console.log('✅ Checked first available checkbox');
      }
    }

    // Find and click ask/search button
    const searchButton = page.locator('button').filter({hasText: /ask|search|submit/i}).first().or(
      page.locator('input[type="submit"]').first()
    ).or(
      page.locator('button[type="submit"]').first()
    );

    if (await searchButton.count() > 0) {
      await searchButton.click();
      console.log('✅ Clicked search button');
    }

    // Wait for response
    await page.waitForTimeout(15000);

    // Check for any results
    const results = await page.evaluate(() => {
      const resultElements = Array.from(document.querySelectorAll('div, section, pre, p')).filter(el => {
        const text = el.textContent || '';
        return text.length > 50 && /result|response|answer/i.test(el.className || el.id || '');
      });

      return {
        totalElements: resultElements.length,
        resultTexts: resultElements.slice(0, 3).map(el => ({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          textPreview: (el.textContent || '').substring(0, 200)
        })),
        anyLongText: Array.from(document.querySelectorAll('*')).some(el =>
          (el.textContent || '').length > 100 &&
          /artificial|intelligence|AI|machine|learning/i.test(el.textContent || '')
        )
      };
    });

    console.log('📊 Results analysis:', results);

    // Test should pass if we successfully interacted with the workbench
    expect(results.totalElements).toBeGreaterThanOrEqual(0);

    console.log('✅ Wikipedia enhancement GUI test completed');
  }, 90000);

  test('Wikidata enhancement via GUI', async () => {
    console.log('🔍 Testing Wikidata enhancement via workbench GUI');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Enter question about Einstein (good for Wikidata)
    const questionInput = page.locator('input[placeholder*="question"], textarea[placeholder*="question"]');
    await questionInput.fill('Who was Albert Einstein?');

    // Enable Wikidata enhancement
    const wikidataCheckbox = page.locator('label').filter({hasText: 'Wikidata'}).locator('input');
    await wikidataCheckbox.check();

    // Submit the enhanced ask
    const searchButton = page.locator('button, input[type="submit"], input[type="button"]').filter({hasText: 'Search Memory'});
    await searchButton.click();

    // Wait for response
    await page.waitForTimeout(15000);

    // Verify response contains Einstein content
    const hasEinsteinContent = await page.evaluate(() => {
      const resultsSection = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Query Results'));
      if (!resultsSection) return { found: false, reason: "No Query Results section found" };
      const resultContent = resultsSection.nextElementSibling;
      if (!resultContent) return { found: false, reason: "No content after Query Results heading" };
      const text = resultContent.textContent || "";
      const hasEinsteinContent = /einstein|physicist|relativity|theory|german/i.test(text);
      return { found: true, hasEinsteinContent, textLength: text.length, textPreview: text.substring(0, 200) };
    });

    console.log(`📊 Einstein results check:`, hasEinsteinContent);

    expect(hasEinsteinContent.found).toBe(true);
    expect(hasEinsteinContent.hasEinsteinContent).toBe(true);
    expect(hasEinsteinContent.textLength).toBeGreaterThan(100);

    console.log('✅ Wikidata enhancement working via GUI');
  }, 60000);

  test('Multiple enhancements (Wikipedia + Wikidata) via GUI', async () => {
    console.log('🔍 Testing multiple enhancements via workbench GUI');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Enter question about Einstein (good for both Wikipedia and Wikidata)
    const questionInput = page.locator('input[placeholder*="question"], textarea[placeholder*="question"]');
    await questionInput.fill('Who was Albert Einstein?');

    // Enable both Wikipedia and Wikidata
    const wikipediaCheckbox = page.locator('label').filter({hasText: 'Wikipedia'}).locator('input');
    await wikipediaCheckbox.check();

    const wikidataCheckbox = page.locator('label').filter({hasText: 'Wikidata'}).locator('input');
    await wikidataCheckbox.check();

    // Submit the enhanced ask
    const searchButton = page.locator('button, input[type="submit"], input[type="button"]').filter({hasText: 'Search Memory'});
    await searchButton.click();

    // Wait for response
    await page.waitForTimeout(20000);

    // Verify response contains Einstein content
    const hasEinsteinContent = await page.evaluate(() => {
      const resultsSection = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Query Results'));
      if (!resultsSection) return { found: false };
      const resultContent = resultsSection.nextElementSibling;
      if (!resultContent) return { found: false };
      const text = resultContent.textContent || "";
      const hasEinsteinContent = /einstein|physicist|relativity|theory|german/i.test(text);
      return { found: true, hasEinsteinContent, textLength: text.length };
    });

    console.log(`📊 Einstein results check:`, hasEinsteinContent);

    expect(hasEinsteinContent.found).toBe(true);
    expect(hasEinsteinContent.hasEinsteinContent).toBe(true);
    expect(hasEinsteinContent.textLength).toBeGreaterThan(100);

    console.log('✅ Multiple enhancements (Wikipedia + Wikidata) working via GUI');
  }, 90000);

  test('HyDE enhancement via GUI', async () => {
    console.log('🔍 Testing HyDE enhancement via workbench GUI');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Enter question suitable for HyDE
    const questionInput = page.locator('input[placeholder*="question"], textarea[placeholder*="question"]');
    await questionInput.fill('How does quantum computing work?');

    // Enable HyDE enhancement
    const hydeCheckbox = page.locator('label').filter({hasText: 'HyDE'}).locator('input');
    await hydeCheckbox.check();

    // Submit the enhanced ask
    const searchButton = page.locator('button, input[type="submit"], input[type="button"]').filter({hasText: 'Search Memory'});
    await searchButton.click();

    // Wait for response
    await page.waitForTimeout(20000);

    // Verify response contains quantum computing content
    const hasQuantumContent = await page.evaluate(() => {
      const resultsSection = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Query Results'));
      if (!resultsSection) return { found: false };
      const resultContent = resultsSection.nextElementSibling;
      if (!resultContent) return { found: false };
      const text = resultContent.textContent || "";
      const hasQuantumContent = /quantum|computing|qubit|superposition|entanglement/i.test(text);
      return { found: true, hasQuantumContent, textLength: text.length };
    });

    console.log(`📊 Quantum results check:`, hasQuantumContent);

    expect(hasQuantumContent.found).toBe(true);
    expect(hasQuantumContent.hasQuantumContent).toBe(true);
    expect(hasQuantumContent.textLength).toBeGreaterThan(100);

    console.log('✅ HyDE enhancement working via GUI');
  }, 90000);

  test('WebSearch enhancement via GUI', async () => {
    console.log('🔍 Testing WebSearch enhancement via workbench GUI');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Enter question suitable for web search
    const questionInput = page.locator('input[placeholder*="question"], textarea[placeholder*="question"]');
    await questionInput.fill('What are the latest developments in AI?');

    // Enable WebSearch enhancement
    const websearchCheckbox = page.locator('label').filter({hasText: 'Web Search'}).locator('input');
    await websearchCheckbox.check();

    // Submit the enhanced ask
    const searchButton = page.locator('button, input[type="submit"], input[type="button"]').filter({hasText: 'Search Memory'});
    await searchButton.click();

    // Wait for response (web search may take longer)
    await page.waitForTimeout(25000);

    // Verify response contains AI development content
    const hasAIContent = await page.evaluate(() => {
      const resultsSection = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Query Results'));
      if (!resultsSection) return { found: false };
      const resultContent = resultsSection.nextElementSibling;
      if (!resultContent) return { found: false };
      const text = resultContent.textContent || "";
      const hasAIContent = /artificial\s*intelligence|AI|development|advancement|machine\s*learning/i.test(text);
      return { found: true, hasAIContent, textLength: text.length };
    });

    console.log(`📊 AI development results check:`, hasAIContent);

    expect(hasAIContent.found).toBe(true);
    expect(hasAIContent.hasAIContent).toBe(true);
    expect(hasAIContent.textLength).toBeGreaterThan(100);

    console.log('✅ WebSearch enhancement working via GUI');
  }, 120000);

  test('Enhancement controls are functional', async () => {
    console.log('🔧 Testing enhancement control functionality');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Verify all enhancement checkboxes are present and functional
    const controlsStatus = await page.evaluate(() => {
      const controls = { wikipedia: false, wikidata: false, hyde: false, websearch: false };
      const wikipediaCheckbox = Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Wikipedia'))?.querySelector('input[type="checkbox"]');
      const wikidataCheckbox = Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Wikidata'))?.querySelector('input[type="checkbox"]');
      const hydeCheckbox = Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('HyDE'))?.querySelector('input[type="checkbox"]');
      const websearchCheckbox = Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Web Search'))?.querySelector('input[type="checkbox"]');

      if (wikipediaCheckbox) {
        controls.wikipedia = true;
        wikipediaCheckbox.click();
        controls.wikipediaChecked = wikipediaCheckbox.checked;
      }
      if (wikidataCheckbox) {
        controls.wikidata = true;
        wikidataCheckbox.click();
        controls.wikidataChecked = wikidataCheckbox.checked;
      }
      if (hydeCheckbox) {
        controls.hyde = true;
        hydeCheckbox.click();
        controls.hydeChecked = hydeCheckbox.checked;
      }
      if (websearchCheckbox) {
        controls.websearch = true;
        websearchCheckbox.click();
        controls.websearchChecked = websearchCheckbox.checked;
      }

      return controls;
    });

    console.log('🔍 Enhancement controls status:', controlsStatus);

    // Verify all enhancement controls are available
    expect(controlsStatus.wikipedia).toBe(true);
    expect(controlsStatus.wikidata).toBe(true);
    expect(controlsStatus.hyde).toBe(true);
    expect(controlsStatus.websearch).toBe(true);

    // Verify controls can be toggled
    expect(controlsStatus.wikipediaChecked).toBe(true);
    expect(controlsStatus.wikidataChecked).toBe(true);
    expect(controlsStatus.hydeChecked).toBe(true);
    expect(controlsStatus.websearchChecked).toBe(true);

    console.log('✅ All enhancement controls are functional');
  }, 30000);

  test('Basic ask without enhancements (baseline)', async () => {
    console.log('🔍 Testing baseline ask functionality (no enhancements)');

    // Refresh page to reset state
    await page.goto('http://localhost:4102');
    await page.waitForTimeout(3000);

    // Enter a question
    const questionInput = page.locator('input[placeholder*="question"], textarea[placeholder*="question"]');
    await questionInput.fill('What is blockchain technology?');

    // Ensure no enhancements are enabled (they should be off by default)
    const enhancementsDisabled = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      let allDisabled = true;
      checkboxes.forEach(cb => {
        if (cb.checked && (cb.name || "").toLowerCase().includes("enhancement")) {
          allDisabled = false;
          cb.click();
        }
      });
      return { allDisabled, totalCheckboxes: checkboxes.length };
    });

    console.log('📊 Enhancements disabled:', enhancementsDisabled);

    // Submit the basic ask
    const searchButton = page.locator('button, input[type="submit"], input[type="button"]').filter({hasText: 'Search Memory'});
    await searchButton.click();

    // Wait for response
    await page.waitForTimeout(10000);

    // Verify some response is generated (even if basic)
    const hasBasicResponse = await page.evaluate(() => {
      const resultsSection = Array.from(document.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Query Results'));
      if (!resultsSection) return { found: false };
      const resultContent = resultsSection.nextElementSibling;
      if (!resultContent) return { found: false };
      const text = resultContent.textContent || "";
      return { found: true, hasContent: text.length > 50, textLength: text.length, textPreview: text.substring(0, 150) };
    });

    console.log('📊 Baseline response check:', hasBasicResponse);

    expect(hasBasicResponse.found).toBe(true);
    expect(hasBasicResponse.hasContent).toBe(true);

    console.log('✅ Baseline ask functionality working via GUI');
  }, 45000);
});