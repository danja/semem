import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000);
  
  // Switch to chat tab
  const chatTab = await page.$('[data-tab="chat"]');
  if (chatTab) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  console.log('\n=== TESTING OLLAMA PROVIDER (provider-2) ===');
  
  // Select Ollama provider specifically
  await page.selectOption('#chat-provider', 'provider-2');
  await page.waitForTimeout(500);
  
  // Enter a test message
  await page.fill('#chat-input', 'Hello Ollama! Please respond so I can confirm you are working.');
  
  // Submit and wait for response
  console.log('Submitting chat request to Ollama...');
  await page.click('#chat-form button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(8000);
  
  // Check the messages
  const messages = await page.$$eval('#chat-messages .message', msgs => 
    msgs.map(msg => ({
      role: msg.querySelector('.message-role')?.textContent || 'unknown',
      content: msg.querySelector('.message-content')?.textContent || 'no content'
    }))
  );
  
  console.log(`\nFound ${messages.length} messages:`);
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
  });
  
  if (messages.length >= 2) {
    const response = messages[messages.length - 1];
    if (response.role === 'assistant') {
      console.log('\n✅ Got response from assistant - checking if it mentions Ollama or its nature...');
      if (response.content.toLowerCase().includes('ollama') || 
          response.content.toLowerCase().includes('llama') ||
          response.content.toLowerCase().includes('qwen')) {
        console.log('✅ Response appears to be from Ollama!');
      } else {
        console.log('❓ Response content doesn\'t clearly indicate Ollama');
      }
    }
  }
  
  await browser.close();
})();