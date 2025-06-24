import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Console component should mount and function', async ({ page }) => {
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(1200); // Wait for app and console to load

  // Screenshot the initial state
  await page.screenshot({ path: 'test-results/console-initial.png' });

  // Dump HTML for manual debug if needed
  const html = await page.content();
  fs.writeFileSync('test-results/console-page.html', html);

  // Check for console container
  const container = await page.$('.console-container');
  expect(container, 'Console container should exist').not.toBeNull();

  // Check for toggle button
  const toggle = await page.$('.console-toggle');
  expect(toggle, 'Console toggle button should exist').not.toBeNull();

  // Is it visible (not display:none, not offscreen)?
  const isVisible = await page.evaluate(() => {
    const c = document.querySelector('.console-container');
    if (!c) return false;
    const style = window.getComputedStyle(c);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
  expect(isVisible, 'Console container should be visible').toBe(true);

  // Click toggle to close (should move offscreen)
  await toggle.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/console-closed.png' });

  // Click toggle to open again
  await toggle.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/console-opened.png' });

  // Log messages and check they appear
  await page.evaluate(() => {
    console.log('PLAYWRIGHT_TEST_LOG');
    console.warn('PLAYWRIGHT_TEST_WARN');
    console.error('PLAYWRIGHT_TEST_ERROR');
  });
  await page.waitForTimeout(400);

  // Check for log entries
  const logCount = await page.evaluate(() => {
    return document.querySelectorAll('.log-entry').length;
  });
  expect(logCount, 'Should have at least one log entry').toBeGreaterThan(0);

  // Screenshot with logs
  await page.screenshot({ path: 'test-results/console-logs.png' });
});
