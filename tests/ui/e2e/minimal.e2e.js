import { test, expect } from '@playwright/test';

test('minimal test', async ({ page }) => {
  console.log('Starting test...');
  await page.goto('https://example.com');
  const title = await page.title();
  console.log('Page title:', title);
  expect(title).toContain('Example');
  console.log('Test completed');
});
