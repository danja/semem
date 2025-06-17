import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Debug Page', () => {
  test('inspect page structure', async ({ page }) => {
    // Navigate to the page
    await page.goto('http://localhost:4120');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/full-page.png', fullPage: true });
    
    // Log page title
    console.log('Page title:', await page.title());
    
    // Get all buttons
    const buttons = await page.$$eval('button', buttons => 
      buttons.map(btn => ({
        text: btn.innerText.trim(),
        classes: btn.className,
        id: btn.id,
        html: btn.outerHTML
      }))
    );
    
    console.log('Found buttons:', JSON.stringify(buttons, null, 2));
    
    // Save page HTML
    const html = await page.content();
    await fs.promises.writeFile('test-results/page.html', html);
    console.log('Page HTML saved to test-results/page.html');
  });
});
