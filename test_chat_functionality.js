import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let consoleErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.log(`ERROR: ${text}`);
    } else if (text.includes('Chat') || text.includes('formatMessageContent') || text.includes('replace')) {
      console.log(`CHAT: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking Chat tab...');
  await page.click('button[data-tab="chat"]');
  await page.waitForTimeout(1000);
  
  // Test sending a message
  console.log('Testing chat functionality...');
  const chatInput = await page.$('#chat-input');
  if (chatInput) {
    await chatInput.fill('Hello, test message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  } else {
    console.log('Chat input not found');
  }
  
  // Check for any errors related to content.replace
  const replaceErrors = consoleErrors.filter(error => 
    error.includes('content.replace') || 
    error.includes('formatMessageContent') ||
    error.includes('TypeError')
  );
  
  console.log(`\nFound ${replaceErrors.length} replace-related errors:`);
  replaceErrors.forEach(error => console.log(`  - ${error}`));
  
  console.log(`\nTotal console errors: ${consoleErrors.length}`);
  
  await browser.close();
})();