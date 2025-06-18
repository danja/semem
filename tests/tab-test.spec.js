const { test, expect } = require('@playwright/test');

test('Tab switching functionality', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:4120');
  
  // Wait for the app to load
  await page.waitForSelector('.tabs', { state: 'visible' });
  
  // Log all console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // Get all tab buttons
  const tabButtons = await page.$$('.tab-btn');
  console.log(`Found ${tabButtons.length} tab buttons`);
  
  // Test each tab
  for (const button of tabButtons) {
    const tabName = await button.textContent();
    console.log(`Testing tab: ${tabName}`);
    
    // Click the tab
    await button.click();
    
    // Check if the tab is active
    const isActive = await button.evaluate(el => el.classList.contains('active'));
    console.log(`Tab ${tabName} active: ${isActive}`);
    
    // Get the target panel ID
    const targetId = await button.getAttribute('data-tab');
    console.log(`Target panel ID: ${targetId}`);
    
    if (targetId) {
      // Check if the target panel is visible
      const panel = await page.$(`#${targetId}`);
      const isPanelVisible = panel ? await panel.isVisible() : false;
      console.log(`Panel ${targetId} visible: ${isPanelVisible}`);
      
      // Check if the panel has the active class
      const panelIsActive = panel ? await panel.evaluate(el => el.classList.contains('active')) : false;
      console.log(`Panel ${targetId} has active class: ${panelIsActive}`);
      
      // Check if the panel is not hidden
      const isHidden = panel ? await panel.evaluate(el => el.style.display === 'none' || el.hidden) : true;
      console.log(`Panel ${targetId} is hidden: ${isHidden}`);
    }
    
    // Small delay between tests
    await page.waitForTimeout(500);
  }
  
  // Additional check for any JavaScript errors
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  
  if (errors.length > 0) {
    console.error('Page errors found:', errors);
  } else {
    console.log('No JavaScript errors detected');
  }
});
