import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Track all events and method calls related to console  
  await page.addInitScript(() => {
    // Override toggle method to log when it's called
    window.originalToggle = null;
    
    // Track when classes are added
    const originalAdd = Element.prototype.classList.add;
    Element.prototype.classList.add = function(...classes) {
      if (classes.includes('open') && this.classList.contains('console-container')) {
        console.log('🚨 CONSOLE OPENED - classList.add("open") called on console-container', new Error().stack);
      }
      if (classes.includes('console-open') && this === document.body) {
        console.log('🚨 BODY CONSOLE-OPEN - classList.add("console-open") called on body', new Error().stack);
      }
      return originalAdd.apply(this, classes);
    };
    
    // Track console toggle events
    const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(event) {
      if (event.type === 'toggleConsole') {
        console.log('🔔 toggleConsole event dispatched', new Error().stack);
      }
      return originalDispatchEvent.call(this, event);
    };
  });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🚨') || text.includes('🔔') || text.includes('toggle') || text.includes('Console initialized')) {
      console.log(`PAGE: ${text}`);
    }
  });
  
  console.log('Loading page with console debugging...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(4000); // Wait longer to see all initialization
  
  console.log('\\nPage loaded, checking final console state...');
  const finalState = await page.evaluate(() => {
    const consoleContainer = document.querySelector('.console-container');
    return {
      hasConsole: !!consoleContainer,
      hasOpenClass: consoleContainer?.classList.contains('open') || false,
      bodyHasConsoleOpen: document.body.classList.contains('console-open')
    };
  });
  
  console.log('Final state:', finalState);
  
  await browser.close();
})();