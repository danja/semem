import { test, expect } from '@playwright/test';

test.describe('Graph Visualization E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('http://localhost:4120');
    await page.waitForLoadState('networkidle');
    
    // Navigate to SPARQL Browser tab using correct selector
    await page.click('[data-tab="sparql-browser"]');
    await page.waitForSelector('#sparql-browser-tab', { state: 'visible' });
  });

  test('should load the SPARQL Browser interface', async ({ page }) => {
    // Verify the SPARQL Browser interface elements are present
    await expect(page.locator('#sparql-browser-tab')).toBeVisible();
    
    // Click on query tab to make it visible
    await page.click('[data-tab="sparql-query"]');
    await page.waitForSelector('#sparql-query', { state: 'visible' });
    
    await expect(page.locator('#sparql-query')).toBeVisible();
    await expect(page.locator('button:has-text("Execute")')).toBeVisible();
  });

  test('should contain sample RDF data in the editor', async ({ page }) => {
    // Navigate to Edit RDF tab using correct selector
    await page.click('[data-tab="sparql-edit"]');
    await page.waitForSelector('#sparql-edit', { state: 'visible' });
    
    // Check if turtle editor has sample data
    const turtleEditor = page.locator('#turtle-editor');
    await expect(turtleEditor).toBeVisible();
    
    const editorContent = await turtleEditor.inputValue();
    console.log('Turtle editor content length:', editorContent.length);
    
    // Verify sample RDF data is present
    expect(editorContent).toContain('@prefix');
    expect(editorContent.length).toBeGreaterThan(100); // Ensure there's reasonable content
  });

  test('should render graph visualization', async ({ page }) => {
    // Navigate to Graph tab using correct selector
    await page.click('[data-tab="sparql-graph"]');
    await page.waitForSelector('#sparql-graph', { state: 'visible' });
    await page.waitForTimeout(2000); // Wait for graph to render
    
    // Check if graph container exists and is visible
    const graphContainer = page.locator('#rdf-graph-container');
    await expect(graphContainer).toBeVisible();
    
    // Check node and edge counts
    const nodeCountText = await page.locator('#node-count').textContent();
    const edgeCountText = await page.locator('#edge-count').textContent();
    
    const nodeCount = parseInt(nodeCountText || '0');
    const edgeCount = parseInt(edgeCountText || '0');
    
    console.log(`Graph stats - Nodes: ${nodeCount}, Edges: ${edgeCount}`);
    
    // Verify graph has content
    expect(nodeCount).toBeGreaterThan(0);
    expect(edgeCount).toBeGreaterThan(0);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/graph-visualization.png', fullPage: true });
    console.log('Screenshot saved to test-results/graph-visualization.png');
  });

  test('should update graph when executing SPARQL queries', async ({ page }) => {
    // Execute a simple SPARQL query
    const query = `
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT * WHERE { ?s ?p ?o } LIMIT 10
    `;
    
    await page.fill('#sparql-query', query);
    await page.click('button:has-text("Execute")');
    await page.waitForTimeout(2000);
    
    // Check if results are displayed
    const resultsContainer = page.locator('#query-results');
    await expect(resultsContainer).toBeVisible();
    
    // Verify results are not empty
    const resultsText = await resultsContainer.textContent();
    expect(resultsText).not.toBe('');
    
    // Navigate to Graph tab to see visualization
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(3000);
    
    // Verify graph is visible and has content
    const graphContainer = page.locator('#rdf-graph-container');
    await expect(graphContainer).toBeVisible();
    
    const nodeCountText = await page.locator('#node-count').textContent();
    const nodeCount = parseInt(nodeCountText || '0');
    expect(nodeCount).toBeGreaterThan(0);
  });
});
