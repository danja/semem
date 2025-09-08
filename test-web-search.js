import { chromium } from 'playwright';

async function testWebSearch() {
  const browser = await chromium.launch({ headless: false }); // Set to true for headless mode
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    console.log('Console:', msg.type(), msg.text());
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.error('Page Error:', error.message);
  });

  // Listen for response errors
  page.on('response', response => {
    if (!response.ok()) {
      console.error('Response Error:', response.status(), response.url());
    }
  });

  try {
    console.log('Navigating to http://localhost:4102...');
    await page.goto('http://localhost:4102', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    console.log('Page loaded, looking for ask form...');
    
    // Wait for the page to load and find the form elements
    await page.waitForLoadState('domcontentloaded');
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'page-loaded.png', fullPage: true });
    console.log('Screenshot saved as page-loaded.png');
    
    // Look for the ask form - try different selectors
    const formSelectors = [
      'form',
      '[data-testid="ask-form"]',
      '.ask-form',
      '#ask-form',
      'input[type="text"]',
      'textarea'
    ];
    
    let questionInput = null;
    let webSearchCheckbox = null;
    
    // Try to find question input field
    for (const selector of ['input[type="text"]', 'textarea', 'input[placeholder*="question"]', 'input[placeholder*="ask"]']) {
      try {
        questionInput = await page.locator(selector).first();
        if (await questionInput.isVisible()) {
          console.log(`Found question input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Try to find web search checkbox
    for (const selector of ['input[type="checkbox"]', 'input[name*="web"]', 'input[name*="search"]', '[data-testid*="web-search"]']) {
      try {
        webSearchCheckbox = await page.locator(selector).first();
        if (await webSearchCheckbox.isVisible()) {
          console.log(`Found web search checkbox with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // If we can't find the specific elements, let's inspect the page content
    if (!questionInput || !webSearchCheckbox) {
      console.log('Could not find form elements, inspecting page...');
      const pageContent = await page.content();
      console.log('Page HTML (first 1000 chars):', pageContent.substring(0, 1000));
      
      // Get all form elements
      const forms = await page.locator('form').all();
      console.log(`Found ${forms.length} forms on the page`);
      
      // Get all input elements
      const inputs = await page.locator('input').all();
      console.log(`Found ${inputs.length} input elements`);
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const id = await input.getAttribute('id');
        console.log(`Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}, id=${id}`);
      }
    }
    
    if (questionInput) {
      console.log('Entering question: "where is castiglione di garfagnana"');
      await questionInput.fill('where is castiglione di garfagnana');
    } else {
      console.error('Could not find question input field');
      return;
    }
    
    if (webSearchCheckbox) {
      console.log('Checking web search checkbox...');
      await webSearchCheckbox.check();
    } else {
      console.error('Could not find web search checkbox');
      return;
    }
    
    // Look for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Ask")',
      'button:has-text("Search")',
      '.submit-button',
      '#submit-button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await page.locator(selector).first();
        if (await submitButton.isVisible()) {
          console.log(`Found submit button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (submitButton) {
      console.log('Submitting form...');
      await submitButton.click();
    } else {
      console.error('Could not find submit button, trying Enter key');
      await questionInput.press('Enter');
    }
    
    // Wait for response
    console.log('Waiting for response...');
    
    // Wait for any changes in the page or new content
    try {
      // Wait for potential response container or changes
      await page.waitForSelector('[data-testid="response"], .response, .answer, .result', { timeout: 30000 });
    } catch (e) {
      console.log('No specific response container found, waiting for general page changes...');
      await page.waitForTimeout(5000); // Wait 5 seconds for any response
    }
    
    // Take another screenshot after submission
    await page.screenshot({ path: 'after-submit.png', fullPage: true });
    console.log('Screenshot after submission saved as after-submit.png');
    
    // Try to capture the response
    const responseSelectors = [
      '[data-testid="response"]',
      '.response',
      '.answer',
      '.result',
      '.output',
      '#response',
      '#answer'
    ];
    
    let responseText = '';
    for (const selector of responseSelectors) {
      try {
        const responseElement = page.locator(selector);
        if (await responseElement.isVisible()) {
          responseText = await responseElement.textContent();
          console.log(`Found response with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (responseText) {
      console.log('Response received:');
      console.log('='.repeat(50));
      console.log(responseText);
      console.log('='.repeat(50));
    } else {
      console.log('No specific response element found, checking for any new content...');
      const bodyText = await page.locator('body').textContent();
      console.log('Full page content (last 1000 chars):');
      console.log(bodyText.substring(Math.max(0, bodyText.length - 1000)));
    }
    
    // Wait a bit more to catch any delayed responses
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Error during test:', error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  } finally {
    console.log('Test completed, closing browser...');
    await browser.close();
  }
}

testWebSearch().catch(console.error);