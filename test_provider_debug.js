import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  // Switch to chat tab
  const chatTab = await page.$('[data-tab="chat"]');
  if (chatTab) {
    await chatTab.click();
    await page.waitForTimeout(500);
  }
  
  console.log('\n=== TESTING OLLAMA PROVIDER ===');
  
  // Select Ollama provider specifically
  await page.selectOption('#chat-provider', 'provider-2'); // Ollama should be provider-2
  await page.waitForTimeout(300);
  
  // Enter a test message
  await page.fill('#chat-input', 'Hello, just testing the provider selection - which provider am I using?');
  
  // Submit and immediately check server logs
  console.log('Submitting chat request...');
  await page.click('#chat-form button[type="submit"]');
  
  // Wait a bit for the request to process
  await page.waitForTimeout(3000);
  
  console.log('Chat request submitted. Check server console for debug logs with 🔍 and 🚀 emojis.');
  
  await browser.close();
})();