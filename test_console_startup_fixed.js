import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000); // Wait for full initialization
  
  // Check console pane state on startup
  const consoleState = await page.evaluate(() => {
    const consoleContainer = document.querySelector('.console-container');
    const body = document.body;
    
    if (!consoleContainer) return { found: false };
    
    const hasOpenClass = consoleContainer.classList.contains('open');
    const bodyHasConsoleOpen = body.classList.contains('console-open');
    
    return {
      found: true,
      hasOpenClass,
      bodyHasConsoleOpen,
      classList: Array.from(consoleContainer.classList)
    };
  });
  
  console.log('\\n=== CONSOLE STARTUP STATE ===');
  console.log('Console container found:', consoleState.found);
  if (consoleState.found) {
    console.log('Has "open" class:', consoleState.hasOpenClass);
    console.log('Body has "console-open" class:', consoleState.bodyHasConsoleOpen);
    console.log('CSS classes:', consoleState.classList.join(', '));
    
    if (consoleState.hasOpenClass || consoleState.bodyHasConsoleOpen) {
      console.log('❌ Console is OPEN on startup (should be hidden)');
    } else {
      console.log('✅ Console is HIDDEN on startup (correct)');
    }
  }
  
  // Test hamburger menu toggle
  console.log('\\n=== TESTING HAMBURGER TOGGLE ===');
  const hamburgerButton = await page.$('.app-menu-button');
  if (hamburgerButton) {
    console.log('Found hamburger menu button, clicking...');
    await hamburgerButton.click();
    await page.waitForTimeout(200);
    
    // Look for console toggle option
    const consoleToggle = await page.$('.app-menu-item-button');
    if (consoleToggle) {
      console.log('Found console toggle button, clicking...');
      await consoleToggle.click();
      await page.waitForTimeout(500);
      
      // Check if console state changed
      const consoleStateAfterToggle = await page.evaluate(() => {
        const consoleContainer = document.querySelector('.console-container');
        const body = document.body;
        return {
          hasOpenClass: consoleContainer?.classList.contains('open'),
          bodyHasConsoleOpen: body.classList.contains('console-open')
        };
      });
      
      console.log('After toggle - Container open:', consoleStateAfterToggle.hasOpenClass);
      console.log('After toggle - Body console-open:', consoleStateAfterToggle.bodyHasConsoleOpen);
      
      if (consoleStateAfterToggle.hasOpenClass !== consoleState.hasOpenClass) {
        console.log('✅ Console toggle worked - state changed');
      } else {
        console.log('❓ Console toggle may have worked but state appears unchanged');
      }
    } else {
      console.log('❌ Console toggle button not found in menu');
    }
  } else {
    console.log('❌ Hamburger menu button not found');
  }
  
  await browser.close();
})();