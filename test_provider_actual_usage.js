import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for all console logs to see debug output
  page.on('console', msg => {
    const text = msg.text();
    console.log(`PAGE: ${text}`);
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000);
  
  // Switch to chat tab
  console.log('\n=== SWITCHING TO CHAT TAB ===');
  const chatTab = await page.$('[data-tab="chat"]');
  if (chatTab) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  // Get available providers
  const providers = await page.$$eval('#chat-provider option', options => 
    options.filter(opt => opt.value && opt.value !== '').map(opt => ({ 
      value: opt.value, 
      text: opt.textContent 
    }))
  );
  
  console.log(`Found ${providers.length} providers to test`);
  
  // Test with the first two providers (to avoid overwhelming)
  for (let i = 0; i < Math.min(providers.length, 2); i++) {
    const provider = providers[i];
    console.log(`\n=== TESTING PROVIDER: ${provider.text} (${provider.value}) ===`);
    
    // Select the provider
    await page.selectOption('#chat-provider', provider.value);
    await page.waitForTimeout(500);
    
    // Enter a simple test message
    const testMessage = `Hello from ${provider.text} - test message ${i + 1}`;
    await page.fill('#chat-input', testMessage);
    
    // Submit the form and watch the logs
    console.log(`Sending message: "${testMessage}"`);
    await page.click('#chat-form button[type="submit"]');
    
    // Wait for response (but not too long to avoid hanging)
    await page.waitForTimeout(5000);
    
    // Check if there's a response in the chat
    const messages = await page.$$eval('#chat-messages .message', msgs => 
      msgs.map(msg => ({
        role: msg.querySelector('.message-role')?.textContent || 'unknown',
        content: msg.querySelector('.message-content')?.textContent?.substring(0, 100) || 'no content'
      }))
    );
    
    console.log(`Messages in chat: ${messages.length}`);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log(`Last message role: ${lastMessage.role}`);
      console.log(`Last message content preview: "${lastMessage.content}..."`);
    }
    
    console.log(`--- End of test for ${provider.text} ---\n`);
  }
  
  await browser.close();
})();