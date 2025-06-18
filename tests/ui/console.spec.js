import { test, expect } from '@playwright/test';

test.describe('Console Component', () => {
  test('should initialize and display console', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Navigate to the page
    await page.goto('http://localhost:4120');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if console container exists
    const consoleContainer = await page.$('.console-container');
    expect(consoleContainer).not.toBeNull();
    
    // Check if console is initially closed
    const isInitiallyClosed = await page.evaluate(() => {
      const container = document.querySelector('.console-container');
      return !container.classList.contains('open');
    });
    expect(isInitiallyClosed).toBe(true);
    
    // Click the console toggle button
    await page.click('.console-toggle');
    
    // Check if console opens
    const isOpen = await page.evaluate(() => {
      const container = document.querySelector('.console-container');
      return container.classList.contains('open');
    });
    expect(isOpen).toBe(true);
    
    // Check for test messages
    const logMessages = await page.$$eval('.log-entry', (entries) => 
      entries.map(entry => ({
        level: entry.className.includes('error') ? 'error' : 
               entry.className.includes('warn') ? 'warn' :
               entry.className.includes('info') ? 'info' : 'debug',
        text: entry.textContent
      }))
    );
    
    // Check if we have any log messages
    expect(logMessages.length).toBeGreaterThan(0);
    
    // Check if test messages are present
    const hasTestMessages = logMessages.some(msg => 
      msg.text.includes('Console component initialized')
    );
    expect(hasTestMessages).toBe(true);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/console-open.png' });
  });
});
