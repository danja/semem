import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Console') || text.includes('hidden by default')) {
      console.log(`CONSOLE: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000); // Wait for app initialization
  
  // Check console pane state on startup
  const consoleState = await page.evaluate(() => {
    const consolePane = document.querySelector('.console-pane');
    const consoleRoot = document.getElementById('console-root');
    
    if (!consolePane) return { found: false };
    
    const computedStyle = window.getComputedStyle(consolePane);
    const transform = computedStyle.transform;
    const hasOpenClass = consolePane.classList.contains('open');
    
    return {
      found: true,
      hasOpenClass,
      transform,
      isVisible: transform === 'matrix(1, 0, 0, 1, 0, 0)' || transform === 'none',
      classList: Array.from(consolePane.classList)
    };
  });
  
  console.log('\\n=== CONSOLE STARTUP STATE ===');
  console.log('Console pane found:', consoleState.found);
  if (consoleState.found) {
    console.log('Has "open" class:', consoleState.hasOpenClass);
    console.log('Transform value:', consoleState.transform);
    console.log('Is visible:', consoleState.isVisible);
    console.log('CSS classes:', consoleState.classList.join(', '));
    
    if (consoleState.hasOpenClass || consoleState.isVisible) {
      console.log('❌ Console is OPEN on startup (should be hidden)');
    } else {
      console.log('✅ Console is HIDDEN on startup (correct)');
    }
  }
  
  // Test hamburger menu toggle
  console.log('\\n=== TESTING HAMBURGER TOGGLE ===');
  const hamburgerButton = await page.$('.hamburger-menu');
  if (hamburgerButton) {
    console.log('Found hamburger menu, clicking...');
    await hamburgerButton.click();
    await page.waitForTimeout(100);
    
    // Look for console toggle option
    const consoleToggle = await page.$('text=Console');
    if (consoleToggle) {
      console.log('Found console toggle option, clicking...');
      await consoleToggle.click();
      await page.waitForTimeout(500);
      
      // Check if console opened
      const consoleStateAfterToggle = await page.evaluate(() => {
        const consolePane = document.querySelector('.console-pane');
        return consolePane ? {
          hasOpenClass: consolePane.classList.contains('open'),
          transform: window.getComputedStyle(consolePane).transform
        } : null;
      });
      
      if (consoleStateAfterToggle?.hasOpenClass) {
        console.log('✅ Console opened successfully via hamburger menu');
      } else {
        console.log('❌ Console failed to open via hamburger menu');
      }
    } else {
      console.log('❌ Console toggle option not found in hamburger menu');
    }
  } else {
    console.log('❌ Hamburger menu not found');
  }
  
  await browser.close();
})();