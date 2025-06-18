import { test, expect } from '@playwright/test';

test.describe('Console Component', () => {
  test('should be visible and functional', async ({ page }) => {
    // Navigate to the page
    await page.goto('http://localhost:4120');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if console container exists
    const consoleContainer = await page.$('.console-container');
    expect(consoleContainer).not.toBeNull();
    
    // Check if console is initially closed (but present in the DOM)
    const isInitiallyClosed = await page.evaluate(() => {
      const container = document.querySelector('.console-container');
      return !container.classList.contains('open');
    });
    
    expect(isInitiallyClosed).toBe(true);
    
    // Check if toggle button exists
    const toggleButton = await page.$('.console-toggle');
    expect(toggleButton).not.toBeNull();
    
    // Click the toggle button to open the console
    await page.click('.console-toggle');
    
    // Check if console opens
    const isOpen = await page.evaluate(() => {
      const container = document.querySelector('.console-container');
      return container.classList.contains('open');
    });
    
    expect(isOpen).toBe(true);
    
    // Check if logs are being captured
    const hasLogs = await page.evaluate(() => {
      const logEntries = document.querySelectorAll('.log-entry');
      return logEntries.length > 0;
    });
    
    expect(hasLogs).toBe(true);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/console-visible.png' });
  });
});
