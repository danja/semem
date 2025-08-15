/**
 * End-to-End tests for Inspect Tools functionality
 * Tests the complete user workflow using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Inspect Tools E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the workbench
    await page.goto('http://localhost:4102');
    
    // Wait for the workbench to load
    await page.waitForSelector('.workbench-container', { timeout: 10000 });
    
    // Add some test data first so inspect operations have content to show
    await page.fill('#tell-content', 'Test content for inspection: artificial intelligence, machine learning, semantic web');
    await page.click('#tell-submit');
    
    // Wait for the operation to complete
    await page.waitForSelector('.success-message, .result-item', { timeout: 5000 });
  });

  test('should display session info when Session Info button is clicked', async ({ page }) => {
    // Click the Session Info inspect button
    await page.click('[data-inspect="session"]');
    
    // Wait for the modal to appear
    await page.waitForSelector('#inspect-results-modal', { state: 'visible', timeout: 5000 });
    
    // Verify modal title
    const title = await page.textContent('#inspect-results-title');
    expect(title).toContain('Session Inspection');
    
    // Verify session information is displayed
    const content = await page.textContent('#inspect-results-content');
    expect(content).toMatch(/Session State|Raw Data/);
    
    // Verify button is in active state
    const activeButton = await page.locator('[data-inspect="session"].active');
    await expect(activeButton).toBeVisible();
  });

  test('should display concepts when Concepts button is clicked', async ({ page }) => {
    // Click the Concepts inspect button
    await page.click('[data-inspect="concepts"]');
    
    // Wait for the modal to appear
    await page.waitForSelector('#inspect-results-modal', { state: 'visible', timeout: 5000 });
    
    // Verify modal title
    const title = await page.textContent('#inspect-results-title');
    expect(title).toContain('Concepts Inspection');
    
    // Verify concepts information is displayed
    const content = await page.textContent('#inspect-results-content');
    expect(content).toMatch(/Concepts Overview|Total Concepts|Storage Type/);
  });

  test('should display all data when All Data button is clicked', async ({ page }) => {
    // Click the All Data inspect button
    await page.click('[data-inspect="all"]');
    
    // Wait for the modal to appear
    await page.waitForSelector('#inspect-results-modal', { state: 'visible', timeout: 5000 });
    
    // Verify modal title
    const title = await page.textContent('#inspect-results-title');
    expect(title).toContain('All Inspection');
    
    // Verify comprehensive data is displayed
    const content = await page.textContent('#inspect-results-content');
    expect(content).toMatch(/Complete System State|data-section/);
  });

  test('should close modal when close button is clicked', async ({ page }) => {
    // Open the modal
    await page.click('[data-inspect="session"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Click the close button
    await page.click('#close-inspect-results');
    
    // Verify modal is hidden
    await page.waitForSelector('#inspect-results-modal', { state: 'hidden' });
    
    // Verify no buttons are in active state
    const activeButtons = await page.locator('.inspect-button.active');
    await expect(activeButtons).toHaveCount(0);
  });

  test('should close modal when backdrop is clicked', async ({ page }) => {
    // Open the modal
    await page.click('[data-inspect="concepts"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Click the backdrop
    await page.click('.modal-backdrop');
    
    // Verify modal is hidden
    await page.waitForSelector('#inspect-results-modal', { state: 'hidden' });
  });

  test('should close modal when Escape key is pressed', async ({ page }) => {
    // Open the modal
    await page.click('[data-inspect="all"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Press Escape key
    await page.keyboard.press('Escape');
    
    // Verify modal is hidden
    await page.waitForSelector('#inspect-results-modal', { state: 'hidden' });
  });

  test('should show loading states during API calls', async ({ page }) => {
    // Monitor network requests to simulate slow responses
    await page.route('**/inspect', async route => {
      // Delay the response to see loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    // Click inspect button
    const button = page.locator('[data-inspect="session"]');
    await button.click();
    
    // Verify loading state is shown (button should be disabled or show loading)
    // Note: This test may need adjustment based on actual loading UI implementation
    await expect(button).toHaveAttribute('disabled', '', { timeout: 500 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/inspect', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Click inspect button
    await page.click('[data-inspect="session"]');
    
    // Wait for error toast/message
    await page.waitForSelector('.toast.error, .error-message', { timeout: 5000 });
    
    // Verify error message is displayed
    const errorMessage = await page.textContent('.toast.error, .error-message');
    expect(errorMessage).toMatch(/failed|error/i);
  });

  test('should switch between different inspect types correctly', async ({ page }) => {
    // Click session inspect
    await page.click('[data-inspect="session"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    let title = await page.textContent('#inspect-results-title');
    expect(title).toContain('Session');
    
    // Switch to concepts without closing modal
    await page.click('[data-inspect="concepts"]');
    
    // Wait for content to update
    await page.waitForTimeout(500);
    
    title = await page.textContent('#inspect-results-title');
    expect(title).toContain('Concepts');
    
    // Verify only concepts button is active
    await expect(page.locator('[data-inspect="concepts"].active')).toBeVisible();
    await expect(page.locator('[data-inspect="session"].active')).not.toBeVisible();
  });

  test('should display formatted JSON data correctly', async ({ page }) => {
    // Click all data inspect
    await page.click('[data-inspect="all"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Check for JSON formatting
    const jsonData = page.locator('.json-data');
    await expect(jsonData).toBeVisible();
    
    // Verify JSON is properly formatted (indented)
    const jsonContent = await jsonData.textContent();
    expect(jsonContent).toMatch(/\{[\s\S]*\}/); // Contains braces with content
    expect(jsonContent).toContain('\n'); // Contains newlines (formatted)
  });

  test('should log inspect operations to console panel', async ({ page }) => {
    // Click inspect button
    await page.click('[data-inspect="session"]');
    
    // Wait for modal to appear
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Check console panel for log entries
    const consolePanel = page.locator('#console-panel');
    await expect(consolePanel).toBeVisible();
    
    // Look for inspect-related log entries
    const consoleContent = await consolePanel.textContent();
    expect(consoleContent).toMatch(/inspect|session/i);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Click inspect button
    await page.click('[data-inspect="session"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Verify modal is responsive
    const modal = page.locator('.modal-content');
    const boundingBox = await modal.boundingBox();
    
    // Modal should not exceed viewport width (with some margin)
    expect(boundingBox.width).toBeLessThanOrEqual(375 * 0.95);
    
    // Content should be scrollable if needed
    const content = page.locator('#inspect-results-content');
    await expect(content).toBeVisible();
  });

  test('should maintain modal state during page interactions', async ({ page }) => {
    // Open modal
    await page.click('[data-inspect="concepts"]');
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Interact with other parts of the page
    await page.click('#tell-content'); // Click in a different area
    
    // Modal should still be visible
    await expect(page.locator('#inspect-results-modal')).toBeVisible();
    
    // Only backdrop click should close it
    await page.click('.modal-backdrop');
    await page.waitForSelector('#inspect-results-modal', { state: 'hidden' });
  });

  test('should handle rapid button clicks gracefully', async ({ page }) => {
    // Click multiple inspect buttons rapidly
    await page.click('[data-inspect="session"]');
    await page.click('[data-inspect="concepts"]');
    await page.click('[data-inspect="all"]');
    
    // Wait for final operation to complete
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Should show the last clicked operation (all)
    const title = await page.textContent('#inspect-results-title');
    expect(title).toContain('All Inspection');
    
    // Only the last button should be active
    await expect(page.locator('[data-inspect="all"].active')).toBeVisible();
    await expect(page.locator('[data-inspect="session"].active')).not.toBeVisible();
    await expect(page.locator('[data-inspect="concepts"].active')).not.toBeVisible();
  });

  test('should work with keyboard navigation', async ({ page }) => {
    // Focus on first inspect button
    await page.focus('[data-inspect="session"]');
    
    // Press Enter to activate
    await page.keyboard.press('Enter');
    
    // Modal should open
    await page.waitForSelector('#inspect-results-modal', { state: 'visible' });
    
    // Tab to close button and activate
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // May need multiple tabs depending on modal structure
    await page.keyboard.press('Enter');
    
    // Modal should close
    await page.waitForSelector('#inspect-results-modal', { state: 'hidden' });
  });
});