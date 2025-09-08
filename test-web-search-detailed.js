import { chromium } from 'playwright';

async function testWebSearchDetailed() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]:', error.message);
  });

  // Listen for network requests
  page.on('request', request => {
    console.log(`[REQUEST] ${request.method()} ${request.url()}`);
  });

  // Listen for network responses
  page.on('response', response => {
    console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
    if (!response.ok()) {
      console.error('[RESPONSE ERROR]:', response.status(), response.statusText());
    }
  });

  try {
    console.log('Navigating to http://localhost:4102...');
    await page.goto('http://localhost:4102', { waitUntil: 'domcontentloaded' });
    
    // Wait for the workbench to initialize
    await page.waitForFunction(() => {
      return window.console && typeof window.console.log === 'function';
    });
    
    console.log('Page loaded, waiting for workbench initialization...');
    await page.waitForTimeout(2000);
    
    // Find and fill the question input
    const questionInput = page.locator('input[type="text"]').first();
    await questionInput.waitFor();
    
    console.log('Filling question input...');
    await questionInput.fill('where is castiglione di garfagnana');
    
    // Find and check the web search checkbox
    const webSearchCheckbox = page.locator('input[type="checkbox"]').first();
    await webSearchCheckbox.waitFor();
    
    console.log('Checking web search checkbox...');
    await webSearchCheckbox.check();
    
    // Find and click submit button
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.waitFor();
    
    console.log('Clicking submit button...');
    await submitButton.click();
    
    console.log('Form submitted, monitoring for response...');
    
    // Monitor the page for changes and responses
    let responseFound = false;
    let timeout = 60000; // 60 seconds
    let elapsed = 0;
    const checkInterval = 1000; // Check every second
    
    while (!responseFound && elapsed < timeout) {
      await page.waitForTimeout(checkInterval);
      elapsed += checkInterval;
      
      // Check for processing indicator
      const processingElement = page.locator(':text("Processing")');
      const isProcessing = await processingElement.isVisible().catch(() => false);
      
      if (isProcessing) {
        console.log(`[${elapsed/1000}s] Still processing...`);
        continue;
      }
      
      // Look for response in various places
      const responseSelectors = [
        '.response',
        '.answer',
        '.result',
        '[data-response]',
        '.chat-message',
        '.output'
      ];
      
      for (const selector of responseSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible().catch(() => false)) {
          const text = await element.textContent();
          if (text && text.trim() && text.toLowerCase().includes('castiglione')) {
            console.log('Response found!');
            console.log('='.repeat(50));
            console.log(text);
            console.log('='.repeat(50));
            responseFound = true;
            break;
          }
        }
      }
      
      // Also check console logs for any new messages
      const consoleElement = page.locator('.console-content');
      if (await consoleElement.isVisible().catch(() => false)) {
        const consoleText = await consoleElement.textContent();
        if (consoleText && consoleText.includes('castiglione')) {
          console.log('Response found in console!');
          console.log('='.repeat(50));
          console.log(consoleText);
          console.log('='.repeat(50));
          responseFound = true;
        }
      }
      
      if (elapsed % 10000 === 0) { // Every 10 seconds
        console.log(`[${elapsed/1000}s] Still waiting for response...`);
        await page.screenshot({ path: `wait-${elapsed/1000}s.png`, fullPage: true });
      }
    }
    
    if (!responseFound) {
      console.log('No response found within timeout period');
      const finalContent = await page.textContent('body');
      console.log('Final page content (last 2000 chars):');
      console.log(finalContent.substring(Math.max(0, finalContent.length - 2000)));
    }
    
    // Final screenshot
    await page.screenshot({ path: 'final-state.png', fullPage: true });
    console.log('Final screenshot saved as final-state.png');
    
  } catch (error) {
    console.error('Error during test:', error.message);
    await page.screenshot({ path: 'error-state.png', fullPage: true });
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

testWebSearchDetailed().catch(console.error);