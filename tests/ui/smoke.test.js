import { test, expect } from '@playwright/test';

test('basic smoke test', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:4120');
  
  // Check that the page title contains "Semem"
  await expect(page).toHaveTitle(/Semem/);
  
  // Log the page title for debugging
  console.log('Page title:', await page.title());
  
  // Take a screenshot
  await page.screenshot({ path: 'smoke-test-screenshot.png' });
});
