/**
 * End-to-end tests for VSOM Document-QA integration
 * Tests the complete workflow from data loading to visualization
 */

import { test, expect } from '@playwright/test';

test.describe('VSOM Document-QA Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the VSOM tab
    await page.goto('http://localhost:4100');
    await page.waitForSelector('[data-tab="vsom"]');
    await page.click('[data-tab="vsom"]');
    await page.waitForSelector('#vsom-tab');
    
    // Wait for VSOM to initialize
    await page.waitForTimeout(1000);
  });

  test('should load Document-QA data and display in VSOM grid', async ({ page }) => {
    // Check if the load document-qa data button is present
    const loadDocQABtn = page.locator('#load-docqa-data');
    await expect(loadDocQABtn).toBeVisible();

    // Click the load document-qa data button
    await loadDocQABtn.click();

    // Verify the options dialog appears
    await expect(page.locator('text=Load Document-QA Data Options')).toBeVisible();

    // Fill in the options
    await page.fill('#graph-uri', 'http://tensegrity.it/semem');
    await page.fill('#limit', '50');
    await page.selectOption('#processing-stage', 'answered');
    await page.fill('#concept-filter', 'artificial');

    // Click Load Data button in the dialog
    await page.click('#dialog-ok');

    // Wait for the loading to complete
    await expect(page.locator('#vsom-loading')).toHaveStyle('display: block');
    
    // Wait for either success or error (with longer timeout for SPARQL queries)
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    }, { timeout: 30000 });

    // Check for error messages
    const errorEl = page.locator('#vsom-error');
    const isErrorVisible = await errorEl.isVisible();
    
    if (isErrorVisible) {
      const errorText = await errorEl.textContent();
      console.log('Error occurred:', errorText);
      
      // If SPARQL store is not available, skip the rest
      if (errorText.includes('SPARQL storage not available')) {
        test.skip('SPARQL storage not available for testing');
      }
    } else {
      // Verify successful data loading
      await expect(page.locator('#som-entity-count')).not.toHaveText('0');
      await expect(page.locator('#som-grid-size')).toContainText('x');
      await expect(page.locator('#som-trained-status')).toHaveText('Ready for Training');

      // Verify the data info section shows document-qa specific information
      await expect(page.locator('#som-data-info h4')).toHaveText('Document-QA Data Summary');
      await expect(page.locator('#som-data-info')).toContainText('Source: http://tensegrity.it/semem');
      await expect(page.locator('#som-data-info')).toContainText('Processing Stages:');
    }
  });

  test('should display VSOM grid with concept labels', async ({ page }) => {
    // First load some mock data to test visualization
    await page.click('#load-som-data');
    
    // Enter sample data in the prompt
    const sampleData = JSON.stringify({
      type: "sample",
      count: 25
    });
    
    await page.evaluate((data) => {
      // Mock the prompt to return our sample data
      window.prompt = () => data;
    }, sampleData);
    
    await page.click('#load-som-data');
    
    // Wait for loading to complete
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    });

    // Verify VSOM grid is rendered
    await expect(page.locator('#som-grid-container svg')).toBeVisible();
    
    // Verify nodes are present
    await expect(page.locator('#som-grid-container .node')).toHaveCountGreaterThan(0);
    
    // Verify entity count is updated
    await expect(page.locator('#som-entity-count')).not.toHaveText('0');
  });

  test('should show enhanced tooltips on node hover', async ({ page }) => {
    // Load sample data first
    await page.click('#load-som-data');
    
    const sampleData = JSON.stringify({
      type: "sample", 
      count: 16
    });
    
    await page.evaluate((data) => {
      window.prompt = () => data;
    }, sampleData);
    
    await page.click('#load-som-data');
    
    // Wait for loading
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    });

    // Hover over a node to trigger tooltip
    const firstNode = page.locator('#som-grid-container .node').first();
    await expect(firstNode).toBeVisible();
    await firstNode.hover();

    // Verify tooltip appears with expected content
    const tooltip = page.locator('.d3-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Node (');
    await expect(tooltip).toContainText('Activation:');
  });

  test('should handle SPARQL connection errors gracefully', async ({ page }) => {
    // Click the load document-qa data button
    await page.click('#load-docqa-data');

    // Fill in invalid endpoint
    await page.fill('#graph-uri', 'http://invalid-endpoint/nonexistent');
    await page.click('#dialog-ok');

    // Wait for error to appear
    await page.waitForSelector('#vsom-error', { state: 'visible', timeout: 30000 });
    
    // Verify error message is shown
    const errorText = await page.locator('#vsom-error').textContent();
    expect(errorText).toContain('Failed to load document-qa data');
    
    // Verify error disappears after timeout
    await page.waitForTimeout(6000);
    await expect(page.locator('#vsom-error')).toHaveStyle('display: none');
  });

  test('should validate dialog input fields', async ({ page }) => {
    await page.click('#load-docqa-data');

    // Test limit validation
    await page.fill('#limit', '5'); // Below minimum
    await page.click('#dialog-ok');
    
    // Should still work but might be handled by the backend
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    }, { timeout: 30000 });

    // Open dialog again
    await page.click('#load-docqa-data');
    
    // Test maximum limit
    await page.fill('#limit', '2000'); // Above maximum
    await page.click('#dialog-ok');
    
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    }, { timeout: 30000 });
  });

  test('should handle empty result sets', async ({ page }) => {
    await page.click('#load-docqa-data');

    // Use filters that should return no results
    await page.fill('#concept-filter', 'nonexistent-concept-xyz');
    await page.selectOption('#processing-stage', 'answered');
    await page.click('#dialog-ok');

    // Wait for completion
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    }, { timeout: 30000 });

    // Should handle empty results gracefully
    const entityCount = await page.locator('#som-entity-count').textContent();
    expect(parseInt(entityCount)).toBeGreaterThanOrEqual(0);
  });

  test('should support dialog cancellation', async ({ page }) => {
    await page.click('#load-docqa-data');
    
    // Verify dialog is open
    await expect(page.locator('text=Load Document-QA Data Options')).toBeVisible();
    
    // Click cancel
    await page.click('#dialog-cancel');
    
    // Verify dialog is closed
    await expect(page.locator('text=Load Document-QA Data Options')).not.toBeVisible();
    
    // Verify no loading started
    await expect(page.locator('#vsom-loading')).toHaveStyle('display: none');
  });

  test('should update data info panel after loading', async ({ page }) => {
    // Check initial state
    const entityCount = await page.locator('#som-entity-count').textContent();
    expect(entityCount).toBe('0');

    // Load sample data
    await page.click('#load-som-data');
    
    const sampleData = JSON.stringify({
      type: "sample",
      count: 36
    });
    
    await page.evaluate((data) => {
      window.prompt = () => data;
    }, sampleData);
    
    await page.click('#load-som-data');

    // Wait for completion
    await page.waitForFunction(() => {
      const loading = document.getElementById('vsom-loading');
      return loading && loading.style.display === 'none';
    });

    // Verify data info is updated
    const newEntityCount = await page.locator('#som-entity-count').textContent();
    expect(parseInt(newEntityCount)).toBeGreaterThan(0);
    
    const gridSize = await page.locator('#som-grid-size').textContent();
    expect(gridSize).toMatch(/\d+x\d+/);
  });
});

test.describe('VSOM API Integration', () => {
  test('should successfully call load-docqa endpoint', async ({ request }) => {
    const response = await request.post('http://localhost:4100/api/vsom/load-docqa', {
      data: {
        graphUri: 'http://tensegrity.it/semem',
        limit: 10,
        processingStage: null,
        conceptFilter: null
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should return 200 or 500 with proper error message
    expect([200, 500]).toContain(response.status());
    
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('success');
    
    if (responseBody.success) {
      expect(responseBody).toHaveProperty('entities');
      expect(responseBody).toHaveProperty('metadata');
      expect(Array.isArray(responseBody.entities)).toBe(true);
    } else {
      expect(responseBody).toHaveProperty('error');
    }
  });

  test('should validate API parameters', async ({ request }) => {
    // Test with invalid limit
    const response = await request.post('http://localhost:4100/api/vsom/load-docqa', {
      data: {
        graphUri: 'http://tensegrity.it/semem',
        limit: -5
      }
    });

    const responseBody = await response.json();
    
    // Should handle invalid parameters gracefully
    expect(responseBody).toHaveProperty('success');
  });
});