import { test, expect } from '@playwright/test';

test.describe('SPARQL Browser', () => {
  let page;
  
  // Selectors
  const selectors = {
    queryEditor: '#sparql-query-editor',
    executeButton: 'button:has-text("Execute")',
    resultsContainer: '.query-results',
    graphTab: '[data-tab="sparql-graph"]',
    graphContainer: '#rdf-graph-container',
    endpointSelect: '#sparql-endpoint-select',
    tabContent: '.sparql-tab-content',
    activeTab: '.sparql-tabs .tab-inner-btn.active',
  };

  test.beforeAll(async ({ browser }) => {
    // Start the server if not already running
    page = await browser.newPage();
    await page.goto('http://localhost:4120');
    await page.waitForLoadState('networkidle');
    
    // Click on SPARQL Browser tab to activate it
    await page.click('[data-tab="sparql-browser"]');
    await page.waitForSelector('#sparql-browser-tab', { state: 'visible' });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should load the SPARQL browser page', async () => {
    await expect(page).toHaveTitle(/Semem API Interface/);
    await expect(page.locator('#sparql-browser-tab')).toBeVisible();
    await expect(page.locator(selectors.queryEditor)).toBeVisible();
    await expect(page.locator(selectors.executeButton)).toBeVisible();
  });

  test('should execute a simple SPARQL query', async () => {
    // Mock the fetch response for the SPARQL endpoint
    await page.route('**/query', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/sparql-results+json',
        body: JSON.stringify({
          head: { vars: ['s', 'p', 'o'] },
          results: {
            bindings: [
              {
                s: { type: 'uri', value: 'http://example.org/subject' },
                p: { type: 'uri', value: 'http://example.org/predicate' },
                o: { type: 'literal', value: 'object' }
              }
            ]
          }
        })
      });
    });
    
    // Make sure we're on the query tab
    await page.click('[data-tab="sparql-query"]');
    await page.waitForSelector('#sparql-query', { state: 'visible' });
    
    // Clear any existing query and enter a test query
    await page.locator(selectors.queryEditor).fill('SELECT * WHERE { ?s ?p ?o }');
    
    // Click execute button
    await page.click(selectors.executeButton);
    
    // Wait for results with a longer timeout
    await page.waitForSelector(selectors.resultsContainer, { state: 'visible', timeout: 10000 });
    
    // Verify results are displayed
    const resultsText = await page.locator(selectors.resultsContainer).textContent();
    expect(resultsText).toContain('http://example.org/subject');
    expect(resultsText).toContain('http://example.org/predicate');
    expect(resultsText).toContain('object');
  });
  
  test('should switch to graph view', async () => {
    // Click on the graph tab (within SPARQL Browser)
    await page.click(selectors.graphTab);
    
    // Wait for graph tab content to be visible
    await page.waitForSelector('#sparql-graph', { state: 'visible' });
    
    // Verify the graph tab is now active
    await expect(page.locator('#sparql-graph')).toBeVisible();
  });
  
  test('should load endpoints', async () => {
    // First go to the query tab where the endpoint selector is visible
    await page.click('[data-tab="sparql-query"]');
    await page.waitForSelector('#sparql-query', { state: 'visible' });
    
    // Wait for endpoint select to be visible
    await page.waitForSelector(selectors.endpointSelect, { state: 'visible' });
    
    // Check if endpoints are loaded
    const endpointOptions = await page.locator(`${selectors.endpointSelect} option`).count();
    expect(endpointOptions).toBeGreaterThan(0);
  });
  
  test('should switch between tabs', async () => {
    const tabs = [
      { name: 'sparql-query', selector: '[data-tab="sparql-query"]', contentId: '#sparql-query' },
      { name: 'sparql-graph', selector: '[data-tab="sparql-graph"]', contentId: '#sparql-graph' },
      { name: 'sparql-edit', selector: '[data-tab="sparql-edit"]', contentId: '#sparql-edit' },
      { name: 'sparql-endpoints', selector: '[data-tab="sparql-endpoints"]', contentId: '#sparql-endpoints' }
    ];
    
    for (const tab of tabs) {
      // Click the tab
      await page.click(tab.selector);
      
      // Wait for tab content to be visible
      await page.waitForSelector(tab.contentId, { state: 'visible' });
      
      // Verify the tab content is visible
      await expect(page.locator(tab.contentId)).toBeVisible();
    }
  });

  test('should handle invalid queries', async () => {
    // Make sure we're on the query tab
    await page.click('[data-tab="sparql-query"]');
    await page.waitForSelector('#sparql-query', { state: 'visible' });

    // Enter an invalid query (malformed SPARQL)
    await page.fill(selectors.queryEditor, 'THIS IS NOT VALID SPARQL');
    
    // Click the execute button
    await page.click(selectors.executeButton);
    
    // Wait a bit for the query to be processed
    await page.waitForTimeout(3000);
    
    // Verify that the query was attempted (results container should be visible)
    await expect(page.locator(selectors.resultsContainer)).toBeVisible();
    
    // The exact error handling depends on the application, so we just verify
    // that the system doesn't crash and shows some response
    const resultsText = await page.locator(selectors.resultsContainer).textContent();
    expect(resultsText.length).toBeGreaterThan(0);
  });

  test('should show endpoints tab', async () => {
    // Switch to endpoints tab
    await page.click('[data-tab="sparql-endpoints"]');
    await page.waitForSelector('#sparql-endpoints', { state: 'visible' });
    
    // Verify the endpoints tab is visible
    await expect(page.locator('#sparql-endpoints')).toBeVisible();
    
    // Check if there are some endpoint-related elements
    const endpointsContent = await page.locator('#sparql-endpoints').textContent();
    expect(endpointsContent.length).toBeGreaterThan(0);
  });
});
