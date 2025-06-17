import { test, expect } from '@playwright/test';

test('debug page content', async ({ page }) => {
  // Navigate to the page
  await page.goto('http://localhost:4120');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot of the full page
  await page.screenshot({ path: 'test-results/full-page.png', fullPage: true });
  
  // Log the page title
  console.log('Page title:', await page.title());
  
  // Log all buttons on the page
  const buttons = await page.$$eval('button', buttons => 
    buttons.map(btn => ({
      text: btn.innerText.trim(),
      classes: btn.className,
      id: btn.id,
      selector: 'button' + (btn.id ? `#${btn.id}` : '') + (btn.className ? `.${btn.className.split(' ').join('.')}` : '')
    }))
  );
  console.log('Buttons on page:', JSON.stringify(buttons, null, 2));
  
  // Log all elements with class containing 'console'
  const consoleElements = await page.$$eval('[class*="console"]', elements => 
    elements.map(el => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className,
      text: el.innerText.substring(0, 100) + (el.innerText.length > 100 ? '...' : '')
    }))
  );
  console.log('Console-related elements:', JSON.stringify(consoleElements, null, 2));
  
  // Save the page HTML for inspection
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('test-results/page-content.html', html);
  console.log('Page HTML saved to test-results/page-content.html');
});
