import { test, expect } from '@playwright/test';
import { test as setup } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const TEST_ENDPOINT = 'http://localhost:3030/ds';

test.describe('SPARQL Browser', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the SPARQL browser page
    await page.goto('/sparql');
    
    // Wait for the component to be ready
    await expect(page.locator('.sparql-browser')).toBeVisible();
  });

  test('should load with default state', async ({ page }) => {
    // Verify initial UI elements
    await expect(page.locator('.sparql-editor')).toBeVisible();
    await expect(page.locator('.execute-query-btn')).toBeVisible();
    await expect(page.locator('.endpoint-selector')).toBeVisible();
    
    // Verify default query is present
    const defaultQuery = await page.locator('.sparql-editor').textContent();
    expect(defaultQuery).toContain('SELECT *');
  });

  test('should execute a SPARQL query and display results', async ({ page }) => {
    // Mock the API response
    await page.route('**/sparql', async route => {
      const request = route.request();
      
      // Verify request
      expect(request.method()).toBe('POST');
      expect(request.headers()['content-type']).toContain('application/sparql-query');
      
      // Mock successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/sparql-results+json',
        body: JSON.stringify({
          head: { vars: ['s', 'p', 'o'] },
          results: {
            bindings: [
              {
                s: { type: 'uri', value: 'http://example.org/resource1' },
                p: { type: 'uri', value: 'http://example.org/property' },
                o: { type: 'literal', value: 'Test Value' }
              }
            ]
          }
        })
      });
    });

    // Execute query
    await page.click('.execute-query-btn');
    
    // Wait for results
    await expect(page.locator('.query-results')).toBeVisible();
    
    // Verify results
    const resultsText = await page.locator('.query-results').textContent();
    expect(resultsText).toContain('http://example.org/resource1');
    expect(resultsText).toContain('Test Value');
  });

  test('should handle query errors', async ({ page }) => {
    // Mock error response
    await page.route('**/sparql', async route => {
      await route.fulfill({
        status: 400,
        body: 'Invalid SPARQL query'
      });
    });

    // Execute query
    await page.click('.execute-query-btn');
    
    // Verify error message
    await expect(page.locator('.error-message')).toBeVisible();
    const errorText = await page.locator('.error-message').textContent();
    expect(errorText).toContain('Error executing query');
  });

  test('should allow switching endpoints', async ({ page }) => {
    // Mock endpoints list
    await page.route('**/api/endpoints', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', name: 'Local Endpoint', url: 'http://localhost:3030/ds' },
          { id: '2', name: 'DBpedia', url: 'https://dbpedia.org/sparql' }
        ])
      });
    });

    // Click endpoint selector
    await page.click('.endpoint-selector');
    
    // Wait for endpoints to load
    await expect(page.locator('.endpoint-list')).toBeVisible();
    
    // Select an endpoint
    await page.click('text=DBpedia');
    
    // Verify selection
    const selectedEndpoint = await page.locator('.endpoint-selector').textContent();
    expect(selectedEndpoint).toContain('DBpedia');
  });

  test('should save and load query history', async ({ page }) => {
    const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
    
    // Clear editor
    await page.locator('.sparql-editor').fill('');
    
    // Type a query
    await page.locator('.sparql-editor').type(testQuery);
    
    // Save query
    await page.click('.save-query-btn');
    
    // Open history
    await page.click('.query-history-btn');
    await expect(page.locator('.query-history')).toBeVisible();
    
    // Verify query is in history
    await expect(page.locator('.query-history-item')).toHaveCount(1);
    
    // Load query from history
    await page.click('.query-history-item');
    
    // Verify editor content
    const editorContent = await page.locator('.sparql-editor').textContent();
    expect(editorContent).toContain(testQuery);
  });
});
