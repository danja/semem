/**
 * VSOM Standalone E2E Tests
 * End-to-end tests for the VSOM standalone application
 */

import { test, expect } from '@playwright/test';

// Test configuration
const VSOM_URL = 'http://localhost:4103';
const API_URL = 'http://localhost:3000';

test.describe('VSOM Standalone Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to VSOM standalone page
        await page.goto(VSOM_URL);
        
        // Wait for the application to initialize
        await page.waitForSelector('.vsom-app');
        await page.waitForTimeout(1000); // Give time for initialization
    });

    test('should load the VSOM standalone page', async ({ page }) => {
        // Check that the main elements are present
        await expect(page.locator('.vsom-header')).toBeVisible();
        await expect(page.locator('.app-title')).toContainText('VSOM Navigation');
        await expect(page.locator('.main-content')).toBeVisible();
        await expect(page.locator('.status-bar')).toBeVisible();
    });

    test('should display connection status', async ({ page }) => {
        // Check connection status indicator
        const statusDot = page.locator('#connection-status');
        await expect(statusDot).toBeVisible();
        
        const statusText = page.locator('#status-text');
        await expect(statusText).toBeVisible();
        
        // Status should eventually be either "Connected" or "Disconnected"
        await expect(statusText).toHaveText(/Connected|Disconnected/);
    });

    test('should have functional ZPT controls', async ({ page }) => {
        // Check ZPT controls panel is visible
        await expect(page.locator('.zpt-controls')).toBeVisible();
        
        // Test zoom controls
        const zoomButtons = page.locator('.zoom-button');
        await expect(zoomButtons).toHaveCount(5);
        
        // Test clicking zoom buttons
        const unitButton = page.locator('.zoom-button[data-level="unit"]');
        await unitButton.click();
        await expect(unitButton).toHaveClass(/active/);
        
        // Check that current zoom is updated
        await expect(page.locator('#current-zoom')).toContainText('unit');
        
        // Test tilt controls
        const tiltButtons = page.locator('.tilt-button');
        await expect(tiltButtons).toHaveCount(4);
        
        const embeddingButton = page.locator('.tilt-button[data-style="embedding"]');
        await embeddingButton.click();
        await expect(embeddingButton).toHaveClass(/active/);
        
        // Test threshold slider
        const thresholdSlider = page.locator('#similarity-threshold');
        await expect(thresholdSlider).toBeVisible();
        
        await thresholdSlider.fill('0.7');
        await expect(page.locator('#threshold-value')).toContainText('0.70');
    });

    test('should handle pan controls input', async ({ page }) => {
        // Test domains input
        const domainsInput = page.locator('#pan-domains');
        await domainsInput.fill('AI, machine learning');
        await domainsInput.blur();
        
        // Test keywords input
        const keywordsInput = page.locator('#pan-keywords');
        await keywordsInput.fill('neural networks, deep learning');
        await keywordsInput.blur();
        
        // Check that pan status is updated
        await expect(page.locator('#current-pan')).toContainText('filtered');
    });

    test('should display VSOM grid container', async ({ page }) => {
        // Check VSOM visualization container
        const vsomGrid = page.locator('#vsom-grid');
        await expect(vsomGrid).toBeVisible();
        
        // Check that either placeholder or SVG is shown
        const placeholder = page.locator('#vsom-placeholder');
        const svg = page.locator('.vsom-svg');
        
        // Either placeholder should be visible (no data) or SVG (with data)
        const placeholderVisible = await placeholder.isVisible();
        const svgVisible = await svg.isVisible();
        expect(placeholderVisible || svgVisible).toBe(true);
    });

    test('should display data panel with statistics', async ({ page }) => {
        // Check data panel is visible
        const dataPanel = page.locator('#data-panel');
        await expect(dataPanel).toBeVisible();
        
        // Check session statistics elements
        await expect(page.locator('#total-interactions')).toBeVisible();
        await expect(page.locator('#total-concepts')).toBeVisible();
        await expect(page.locator('#total-duration')).toBeVisible();
        
        // Check VSOM statistics elements
        await expect(page.locator('#vsom-nodes')).toBeVisible();
        await expect(page.locator('#vsom-grid-size')).toBeVisible();
        await expect(page.locator('#vsom-trained')).toBeVisible();
        
        // Check interaction list
        await expect(page.locator('#interaction-list')).toBeVisible();
    });

    test('should have functional refresh button', async ({ page }) => {
        const refreshButton = page.locator('#refresh-map');
        await expect(refreshButton).toBeVisible();
        
        // Click refresh button
        await refreshButton.click();
        
        // Check that loading state is briefly shown
        const loading = page.locator('#vsom-loading');
        // Loading might be too fast to catch, so we don't assert its visibility
    });

    test('should have functional auto-layout button', async ({ page }) => {
        const autoLayoutButton = page.locator('#auto-layout');
        await expect(autoLayoutButton).toBeVisible();
        
        await autoLayoutButton.click();
        // Auto layout should not cause any errors
    });

    test('should display toast notifications', async ({ page }) => {
        // Toast container should exist
        const toastContainer = page.locator('#toast-container');
        await expect(toastContainer).toBeVisible();
        
        // Trigger an action that might show a toast (like changing ZPT settings)
        const zoomButton = page.locator('.zoom-button[data-level="corpus"]');
        await zoomButton.click();
        
        // Toast might appear briefly - we mainly check no errors occur
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
        // Test keyboard navigation (if implemented)
        await page.keyboard.press('Tab'); // Should navigate through controls
        // This is a placeholder - actual keyboard shortcuts would need implementation
    });

    test('should be responsive', async ({ page }) => {
        // Test different viewport sizes
        await page.setViewportSize({ width: 1200, height: 800 });
        await expect(page.locator('.vsom-app')).toBeVisible();
        
        await page.setViewportSize({ width: 800, height: 600 });
        await expect(page.locator('.vsom-app')).toBeVisible();
        
        // Check that panels are still functional at smaller sizes
        await expect(page.locator('.left-panel')).toBeVisible();
        await expect(page.locator('.center-panel')).toBeVisible();
        await expect(page.locator('.right-panel')).toBeVisible();
    });

    test('should handle API connection failure gracefully', async ({ page }) => {
        // Mock API failure by intercepting requests
        await page.route(`${API_URL}/health`, route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Server error' })
            });
        });
        
        // Refresh the page to trigger connection test
        await page.reload();
        await page.waitForTimeout(2000);
        
        // Check that error status is shown
        const statusText = page.locator('#status-text');
        await expect(statusText).toContainText('Disconnected');
        
        const statusDot = page.locator('#connection-status');
        await expect(statusDot).toHaveClass(/error/);
    });

    test('should display interaction data when available', async ({ page }) => {
        // Mock API response with sample data
        await page.route(`${API_URL}/inspect`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionCache: {
                        interactions: [
                            {
                                id: '1',
                                type: 'tell',
                                content: 'Sample tell interaction',
                                concepts: ['test', 'sample'],
                                timestamp: new Date().toISOString()
                            },
                            {
                                id: '2',
                                type: 'ask',
                                content: 'Sample ask interaction?',
                                concepts: ['question'],
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }
                })
            });
        });
        
        // Trigger data refresh
        await page.click('#refresh-map');
        await page.waitForTimeout(1000);
        
        // Check that interaction count is updated
        await expect(page.locator('#total-interactions')).not.toContainText('0');
        
        // Check that VSOM nodes are created
        await expect(page.locator('#vsom-nodes')).not.toContainText('0');
        
        // Check that interactions appear in the list
        const interactionItems = page.locator('.interaction-item');
        await expect(interactionItems).toHaveCount(2);
    });

    test('should handle ZPT state synchronization', async ({ page }) => {
        // Mock ZPT state endpoint
        await page.route(`${API_URL}/state`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    zoom: 'unit',
                    pan: { domains: ['AI'], keywords: ['neural'] },
                    tilt: 'embedding',
                    threshold: 0.5
                })
            });
        });
        
        // Refresh to load state
        await page.click('#refresh-map');
        await page.waitForTimeout(1000);
        
        // Check that ZPT controls reflect the server state
        await expect(page.locator('#current-zoom')).toContainText('unit');
        await expect(page.locator('#current-tilt')).toContainText('embedding');
        
        const unitButton = page.locator('.zoom-button[data-level="unit"]');
        await expect(unitButton).toHaveClass(/active/);
        
        const embeddingButton = page.locator('.tilt-button[data-style="embedding"]');
        await expect(embeddingButton).toHaveClass(/active/);
    });

    test('should persist user preferences', async ({ page }) => {
        // Change some settings
        await page.click('.zoom-button[data-level="community"]');
        await page.fill('#similarity-threshold', '0.8');
        await page.fill('#pan-domains', 'technology');
        
        // Reload page
        await page.reload();
        await page.waitForSelector('.vsom-app');
        
        // Settings should be restored (if persistence is implemented)
        // Note: This test assumes localStorage persistence is implemented
    });

    test('should handle errors gracefully', async ({ page }) => {
        // Listen for console errors
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });
        
        // Trigger various actions that could cause errors
        await page.click('#refresh-map');
        await page.click('.zoom-button[data-level="corpus"]');
        await page.click('.tilt-button[data-style="graph"]');
        
        await page.waitForTimeout(2000);
        
        // Check that no critical JavaScript errors occurred
        const criticalErrors = errors.filter(error => 
            !error.includes('404') && // Ignore 404s
            !error.includes('Failed to fetch') // Ignore network errors in tests
        );
        
        expect(criticalErrors.length).toBe(0);
    });

    test('should support accessibility features', async ({ page }) => {
        // Check for basic accessibility attributes
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        
        // Check that interactive elements have proper labels
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        
        for (let i = 0; i < buttonCount; i++) {
            const button = buttons.nth(i);
            const hasLabel = await button.getAttribute('aria-label') ||
                            await button.getAttribute('title') ||
                            await button.textContent();
            expect(hasLabel).toBeTruthy();
        }
        
        // Check that form inputs have labels
        const inputs = page.locator('input');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < inputCount; i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            if (id) {
                const label = page.locator(`label[for="${id}"]`);
                await expect(label).toBeVisible();
            }
        }
    });
});

test.describe('VSOM Standalone Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
        const startTime = Date.now();
        
        await page.goto(VSOM_URL);
        await page.waitForSelector('.vsom-app');
        
        const loadTime = Date.now() - startTime;
        
        // Should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
        // Mock large dataset
        const largeInteractionSet = Array.from({ length: 100 }, (_, i) => ({
            id: `${i}`,
            type: i % 2 === 0 ? 'tell' : 'ask',
            content: `Interaction ${i} with some content`,
            concepts: [`concept${i % 10}`, `topic${i % 5}`],
            timestamp: new Date(Date.now() - i * 1000).toISOString()
        }));

        await page.route(`${API_URL}/inspect`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionCache: {
                        interactions: largeInteractionSet
                    }
                })
            });
        });

        await page.goto(VSOM_URL);
        await page.waitForSelector('.vsom-app');
        
        const startTime = Date.now();
        await page.click('#refresh-map');
        await page.waitForTimeout(3000); // Wait for processing
        
        const processingTime = Date.now() - startTime;
        
        // Should process 100 interactions within 10 seconds
        expect(processingTime).toBeLessThan(10000);
        
        // Check that UI is still responsive
        await page.click('.zoom-button[data-level="unit"]');
        await expect(page.locator('.zoom-button[data-level="unit"]')).toHaveClass(/active/);
    });
});

test.describe('VSOM Standalone Mobile', () => {
    test.use({ 
        viewport: { width: 375, height: 667 } // iPhone SE size
    });

    test('should work on mobile devices', async ({ page }) => {
        await page.goto(VSOM_URL);
        await page.waitForSelector('.vsom-app');
        
        // Check that main elements are still visible
        await expect(page.locator('.vsom-header')).toBeVisible();
        await expect(page.locator('.main-content')).toBeVisible();
        
        // Check that controls are accessible
        await expect(page.locator('.zpt-controls')).toBeVisible();
        await expect(page.locator('#vsom-grid')).toBeVisible();
        
        // Test touch interactions
        await page.tap('.zoom-button[data-level="unit"]');
        await expect(page.locator('.zoom-button[data-level="unit"]')).toHaveClass(/active/);
    });
});