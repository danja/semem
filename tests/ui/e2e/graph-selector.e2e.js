import { test, expect } from '@playwright/test';

test.describe('Graph Selector E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('http://localhost:4120');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
        
        // Wait for the page to be ready
        await page.waitForSelector('body', { state: 'visible' });
        
        // Check if search tab exists and is visible
        const searchTab = page.locator('#search-tab');
        try {
            await searchTab.waitFor({ state: 'visible', timeout: 10000 });
        } catch (error) {
            console.log('Search tab not found, trying to activate search tab button');
            const searchTabBtn = page.locator('button[data-tab="search"]');
            if (await searchTabBtn.isVisible()) {
                await searchTabBtn.click();
                await searchTab.waitFor({ state: 'visible' });
            }
        }
    });

    test('should display graph selector with default graph', async ({ page }) => {
        // Check that graph selector elements are present
        await expect(page.locator('#graph-selector')).toBeVisible();
        await expect(page.locator('#add-graph-btn')).toBeVisible();
        await expect(page.locator('#remove-graph-btn')).toBeVisible();
        
        // Check default graph is selected
        const graphSelector = page.locator('#graph-selector');
        await expect(graphSelector).toHaveValue('http://hyperdata.it/content');
        
        // Check default option exists
        await expect(graphSelector.locator('option[value="http://hyperdata.it/content"]')).toBeAttached();
    });

    test('should add a new graph to the selector', async ({ page }) => {
        const newGraphUri = 'http://example.org/test-graph';
        
        // Set up dialog handler before clicking
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Enter the graph name (URI):');
            await dialog.accept(newGraphUri);
        });
        
        // Click the add button
        await page.locator('#add-graph-btn').click();
        
        // Wait a bit for the dialog to be handled and DOM to update
        await page.waitForTimeout(1000);
        
        // Check that the new graph was added and selected
        const graphSelector = page.locator('#graph-selector');
        await expect(graphSelector).toHaveValue(newGraphUri);
        await expect(graphSelector.locator(`option[value="${newGraphUri}"]`)).toBeAttached();
        
        // Verify it's persisted in localStorage
        const savedGraphs = await page.evaluate(() => {
            return localStorage.getItem('semem-graph-list');
        });
        expect(JSON.parse(savedGraphs || '[]')).toContain(newGraphUri);
        
        const selectedGraph = await page.evaluate(() => {
            return localStorage.getItem('semem-selected-graph');
        });
        expect(selectedGraph).toBe(newGraphUri);
    });

    test('should not add duplicate graphs', async ({ page }) => {
        const duplicateGraphUri = 'http://hyperdata.it/content'; // Default graph
        
        // Handle the prompt dialog and alert
        let alertShown = false;
        page.on('dialog', async dialog => {
            if (dialog.type() === 'prompt') {
                expect(dialog.message()).toContain('Enter the graph name (URI):');
                await dialog.accept(duplicateGraphUri);
            } else if (dialog.type() === 'alert') {
                expect(dialog.message()).toContain('Graph already exists in the list');
                alertShown = true;
                await dialog.accept();
            }
        });
        
        // Click the add button
        await page.locator('#add-graph-btn').click();
        
        await page.waitForTimeout(1000);
        
        // Verify alert was shown
        expect(alertShown).toBe(true);
        
        // Check that only one option exists for the default graph
        const options = await page.locator('#graph-selector option[value="http://hyperdata.it/content"]').count();
        expect(options).toBe(1);
    });

    test('should remove a non-default graph', async ({ page }) => {
        const testGraphUri = 'http://example.org/removable-graph';
        
        // First add a graph
        page.once('dialog', async dialog => {
            await dialog.accept(testGraphUri);
        });
        await page.locator('#add-graph-btn').click();
        await page.waitForTimeout(1000);
        
        // Verify it was added
        await expect(page.locator('#graph-selector')).toHaveValue(testGraphUri);
        
        // Now try to remove it
        await page.locator('#remove-graph-btn').click();
        
        // Handle the confirmation dialog
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain(`Remove graph "${testGraphUri}" from the list?`);
            await dialog.accept();
        });
        
        await page.waitForTimeout(500);
        
        // Verify it was removed and default is selected
        await expect(page.locator('#graph-selector')).toHaveValue('http://hyperdata.it/content');
        await expect(page.locator(`#graph-selector option[value="${testGraphUri}"]`)).not.toBeAttached();
    });

    test('should not remove the default graph', async ({ page }) => {
        // Ensure default graph is selected
        await page.locator('#graph-selector').selectOption('http://hyperdata.it/content');
        
        // Try to remove the default graph
        await page.locator('#remove-graph-btn').click();
        
        // Handle the alert
        let alertShown = false;
        page.once('dialog', async dialog => {
            expect(dialog.type()).toBe('alert');
            expect(dialog.message()).toContain('Cannot remove the default graph');
            alertShown = true;
            await dialog.accept();
        });
        
        await page.waitForTimeout(500);
        
        // Verify alert was shown
        expect(alertShown).toBe(true);
        
        // Verify default graph is still there
        await expect(page.locator('#graph-selector option[value="http://hyperdata.it/content"]')).toBeAttached();
        await expect(page.locator('#graph-selector')).toHaveValue('http://hyperdata.it/content');
    });

    test('should persist graph selection across page reloads', async ({ page }) => {
        const testGraphUri = 'http://example.org/persistent-graph';
        
        // Add a new graph
        await page.locator('#add-graph-btn').click();
        page.once('dialog', async dialog => {
            await dialog.accept(testGraphUri);
        });
        await page.waitForTimeout(500);
        
        // Verify it's selected
        await expect(page.locator('#graph-selector')).toHaveValue(testGraphUri);
        
        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Verify the graph is still selected after reload
        await expect(page.locator('#graph-selector')).toHaveValue(testGraphUri);
        await expect(page.locator(`#graph-selector option[value="${testGraphUri}"]`)).toBeAttached();
    });

    test('should include selected graph in search requests', async ({ page }) => {
        const testGraphUri = 'http://example.org/search-test-graph';
        
        // Add a new graph
        await page.locator('#add-graph-btn').click();
        page.once('dialog', async dialog => {
            await dialog.accept(testGraphUri);
        });
        await page.waitForTimeout(500);
        
        // Monitor network requests
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('/api/search')) {
                requests.push(request.url());
            }
        });
        
        // Perform a search
        await page.locator('#search-input').fill('test query');
        await page.locator('#search-form button[type="submit"]').click();
        
        // Wait for the request to be made
        await page.waitForTimeout(2000);
        
        // Verify the search request includes the graph parameter
        expect(requests.length).toBeGreaterThan(0);
        const searchRequest = requests[0];
        expect(searchRequest).toContain(`graph=${encodeURIComponent(testGraphUri)}`);
        expect(searchRequest).toContain('q=test+query');
    });

    test('should switch graphs and maintain separate search contexts', async ({ page }) => {
        const graph1 = 'http://example.org/graph1';
        const graph2 = 'http://example.org/graph2';
        
        // Add first graph
        await page.locator('#add-graph-btn').click();
        page.once('dialog', async dialog => {
            await dialog.accept(graph1);
        });
        await page.waitForTimeout(500);
        
        // Add second graph
        await page.locator('#add-graph-btn').click();
        page.once('dialog', async dialog => {
            await dialog.accept(graph2);
        });
        await page.waitForTimeout(500);
        
        // Verify both graphs are in the selector
        await expect(page.locator(`#graph-selector option[value="${graph1}"]`)).toBeAttached();
        await expect(page.locator(`#graph-selector option[value="${graph2}"]`)).toBeAttached();
        
        // Switch to first graph
        await page.locator('#graph-selector').selectOption(graph1);
        await expect(page.locator('#graph-selector')).toHaveValue(graph1);
        
        // Verify selection is persisted
        const selectedGraph = await page.evaluate(() => {
            return localStorage.getItem('semem-selected-graph');
        });
        expect(selectedGraph).toBe(graph1);
        
        // Switch to second graph
        await page.locator('#graph-selector').selectOption(graph2);
        await expect(page.locator('#graph-selector')).toHaveValue(graph2);
    });

    test('should handle empty graph name input gracefully', async ({ page }) => {
        // Click the add button
        await page.locator('#add-graph-btn').click();
        
        // Handle the prompt dialog with empty input
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Enter the graph name (URI):');
            await dialog.accept(''); // Empty string
        });
        
        await page.waitForTimeout(500);
        
        // Verify no new option was added
        const optionCount = await page.locator('#graph-selector option').count();
        expect(optionCount).toBe(1); // Only the default graph
        
        // Verify default graph is still selected
        await expect(page.locator('#graph-selector')).toHaveValue('http://hyperdata.it/content');
    });

    test('should handle whitespace-only graph name input', async ({ page }) => {
        // Click the add button
        await page.locator('#add-graph-btn').click();
        
        // Handle the prompt dialog with whitespace-only input
        page.once('dialog', async dialog => {
            await dialog.accept('   '); // Only whitespace
        });
        
        await page.waitForTimeout(500);
        
        // Verify no new option was added
        const optionCount = await page.locator('#graph-selector option').count();
        expect(optionCount).toBe(1); // Only the default graph
    });

    test('should clear localStorage and reset to defaults', async ({ page }) => {
        const testGraphUri = 'http://example.org/temp-graph';
        
        // Add a graph
        await page.locator('#add-graph-btn').click();
        page.once('dialog', async dialog => {
            await dialog.accept(testGraphUri);
        });
        await page.waitForTimeout(500);
        
        // Clear localStorage programmatically
        await page.evaluate(() => {
            localStorage.removeItem('semem-graph-list');
            localStorage.removeItem('semem-selected-graph');
        });
        
        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Verify only default graph remains
        await expect(page.locator('#graph-selector')).toHaveValue('http://hyperdata.it/content');
        const optionCount = await page.locator('#graph-selector option').count();
        expect(optionCount).toBe(1);
    });
});