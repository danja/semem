import { test, expect } from '@playwright/test';

test.describe('Console Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4120');
    await page.waitForLoadState('networkidle');
  });

  test('should be initially hidden', async ({ page }) => {
    const consoleVisible = await page.isVisible('.console-container');
    expect(consoleVisible).toBeFalsy();
  });

  test('should toggle visibility when clicking the toggle button', async ({ page }) => {
    // Click the console toggle button
    await page.click('.console-toggle');
    
    // Check if console is visible
    const consoleVisible = await page.isVisible('.console-container');
    expect(consoleVisible).toBeTruthy();
    
    // Take a screenshot for documentation
    await page.screenshot({ path: 'console-visible.png' });
    
    // Toggle it back off
    await page.click('.console-toggle');
    const consoleHidden = await page.isHidden('.console-container');
    expect(consoleHidden).toBeTruthy();
  });

  test('should display log messages', async ({ page }) => {
    // Make sure console is visible
    await page.click('.console-toggle');
    
    // Wait for any initial logs to appear
    await page.waitForSelector('.log-entry', { state: 'attached', timeout: 5000 });
    
    // Check if there are any log entries
    const logCount = await page.$$eval('.log-entry', els => els.length);
    expect(logCount).toBeGreaterThan(0);
    
    console.log(`Found ${logCount} log entries in the console`);
  });
});
