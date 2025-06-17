import { test, expect } from '@playwright/test';
import { SparqlPage } from './helpers/pageObjects/SparqlPage';

test.describe('SPARQL Browser', () => {
  let page;
  let sparqlPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    sparqlPage = new SparqlPage(page);
    await sparqlPage.navigate();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should initialize with default state', async () => {
    // Test that the page loads with the correct title
    await expect(page).toHaveTitle(/SPARQL Browser/);
    
    // Verify the query editor is visible
    await expect(page.locator(sparqlPage.queryEditor)).toBeVisible();
    
    // Verify the execute button is visible and enabled
    await expect(page.locator(sparqlPage.executeButton)).toBeVisible();
    await expect(page.locator(sparqlPage.executeButton)).toBeEnabled();
  });

  test('should execute a simple SPARQL query', async () => {
    // Mock the fetch response for the SPARQL endpoint
    await page.route('**/sparql', route => {
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

    // Enter a test query
    const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 10';
    await page.fill(sparqlPage.queryEditor, testQuery);
    
    // Click the execute button
    await page.click(sparqlPage.executeButton);
    
    // Wait for results to load
    await page.waitForSelector(`${sparqlPage.resultsContainer} table`);
    
    // Verify results are displayed
    const resultRows = await page.$$(`${sparqlPage.resultTable} tbody tr`);
    expect(resultRows.length).toBeGreaterThan(0);
  });

  test('should handle query errors', async () => {
    // Mock an error response from the SPARQL endpoint
    await page.route('**/sparql', route => {
      route.fulfill({
        status: 400,
        body: 'Invalid SPARQL query'
      });
    });

    // Enter an invalid query
    await page.fill(sparqlPage.queryEditor, 'INVALID SPARQL QUERY');
    
    // Click the execute button
    await page.click(sparqlPage.executeButton);
    
    // Verify error message is displayed
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should switch between tabs', async () => {
    // Test switching to each tab
    for (const [tabName, tab] of Object.entries(sparqlPage.tabs)) {
      await page.click(tab.selector);
      await expect(page.locator(tab.panel)).toBeVisible();
    }
  });

  test('should update endpoint and execute query', async () => {
    const testEndpoint = 'http://example.org/sparql';
    
    // Mock the endpoint update and query response
    await page.route('**/api/endpoints', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: testEndpoint,
          available: [testEndpoint]
        })
      });
    });
    
    await page.route(testEndpoint, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/sparql-results+json',
        body: JSON.stringify({
          head: { vars: ['s'] },
          results: { bindings: [] }
        })
      });
    });
    
    // Switch to endpoints tab
    await page.click(sparqlPage.tabs.endpoints.selector);
    
    // Update endpoint
    const endpointInput = await page.$('#endpoint-input');
    await endpointInput.fill(testEndpoint);
    await page.click('#update-endpoint');
    
    // Switch back to query tab and execute query
    await page.click(sparqlPage.tabs.query.selector);
    await page.fill(sparqlPage.queryEditor, 'SELECT * WHERE { ?s ?p ?o } LIMIT 1');
    await page.click(sparqlPage.executeButton);
    
    // Verify the query was sent to the correct endpoint
    const request = await page.waitForRequest(testEndpoint);
    expect(request).toBeTruthy();
  });
});
