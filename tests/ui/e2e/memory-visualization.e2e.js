import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4120';

test.describe('Memory Visualization E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should load the Memory Visualization tab', async ({ page }) => {
    // Verify the Memory Visualization tab is present
    const memoryVizTab = page.locator('button[data-tab="memory-viz"]');
    await expect(memoryVizTab).toBeVisible();
    
    // Click on the Memory Visualization tab
    await memoryVizTab.click();
    
    // Wait for the tab content to be visible
    await expect(page.locator('#memory-viz-tab')).toBeVisible();
  });

  test('should have all memory visualization containers', async ({ page }) => {
    // Navigate to Memory Visualization tab
    await page.click('button[data-tab="memory-viz"]');
    await page.waitForSelector('#memory-viz-tab', { state: 'visible' });
    
    // Verify all containers are present
    await expect(page.locator('#memory-graph-container')).toBeVisible();
    await expect(page.locator('#memory-timeline-container')).toBeVisible();
    await expect(page.locator('#memory-clusters-container')).toBeVisible();
  });

  test('should load memory graph data', async ({ request }) => {
    // Test Memory Graph API
    const response = await request.post(`${BASE_URL}/api/memory/graph`, {
      data: { limit: 20, threshold: 0.7 }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('memories');
    expect(data).toHaveProperty('concepts');
    expect(data).toHaveProperty('stats');
    
    console.log(`Memory Graph API Response:
      - Memories: ${data.memories?.length || 0}
      - Concepts: ${data.concepts?.length || 0}`);
  });

  test('should load memory timeline data', async ({ request }) => {
    // Test Memory Timeline API
    const response = await request.post(`${BASE_URL}/api/memory/timeline`, {
      data: { 
        period: 'week', 
        grouping: 'day', 
        showAccess: true 
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('timeline');
    expect(data).toHaveProperty('period');
    expect(data).toHaveProperty('stats');
    
    console.log(`Memory Timeline API Response:
      - Timeline entries: ${data.timeline?.length || 0}
      - Period: ${data.period}`);
  });

  test('should load memory clusters data', async ({ request }) => {
    // Test Memory Clusters API
    const response = await request.post(`${BASE_URL}/api/memory/clusters`, {
      data: { 
        clusterCount: 5, 
        method: 'kmeans' 
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('clusters');
    expect(data).toHaveProperty('method');
    expect(data).toHaveProperty('stats');
    
    console.log(`Memory Clusters API Response:
      - Clusters: ${data.clusters?.length || 0}
      - Method: ${data.method}`);
  });

  test('should perform advanced memory search', async ({ request }) => {
    // Test Advanced Memory Search API
    const response = await request.post(`${BASE_URL}/api/memory/search/advanced`, {
      data: {
        query: 'test',
        searchIn: ['prompt', 'response'],
        filters: {
          dateRange: {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString()
          },
          minRelevance: 0.5
        },
        sortBy: 'relevance',
        limit: 10
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('query');
    expect(data).toHaveProperty('stats');
    
    console.log(`Advanced Search API Response:
      - Results: ${data.results?.length || 0}
      - Query: ${data.query}`);
  });

  test('should display memory graph in the UI', async ({ page }) => {
    // Navigate to Memory Visualization tab
    await page.click('button[data-tab="memory-viz"]');
    await page.waitForSelector('#memory-viz-tab', { state: 'visible' });
    
    // Wait for the graph to load (assuming there's a loading indicator)
    await page.waitForTimeout(2000);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'test-results/memory-visualization.png', fullPage: true });
    console.log('Screenshot saved to test-results/memory-visualization.png');
    
    // Verify graph container has content
    const graphContainer = page.locator('#memory-graph-container');
    await expect(graphContainer).toBeVisible();
    
    // Check if graph has nodes (assuming nodes have a specific class)
    const nodes = await page.locator('.memory-node').count();
    console.log(`Found ${nodes} memory nodes in the graph`);
    
    // This is just a basic check - adjust based on your actual UI
    expect(nodes).toBeGreaterThan(0);
  });
});
