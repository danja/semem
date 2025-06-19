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
  
  // Test Claude provider (should work)
  console.log('\n=== TESTING CLAUDE PROVIDER ===');
  
  // Select Claude provider (provider-1)
  await page.selectOption('#chat-provider', 'provider-1');
  await page.waitForTimeout(500);
  
  // Ask Claude to identify itself
  await page.fill('#chat-input', 'Please identify yourself - what AI assistant are you?');
  
  console.log('Submitting request to Claude...');
  await page.click('#chat-form button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(5000);
  
  // Check response
  let messages = await page.$$eval('#chat-messages .message', msgs => 
    msgs.map(msg => ({
      role: msg.querySelector('.message-role')?.textContent || 'unknown',
      content: msg.querySelector('.message-content')?.textContent || 'no content'
    }))
  );
  
  console.log('\nClaude response:');
  if (messages.length >= 2) {
    const response = messages[messages.length - 1];
    console.log(`${response.role}: ${response.content.substring(0, 200)}...`);
    
    if (response.content.toLowerCase().includes('claude')) {
      console.log('✅ Response identifies as Claude!');
    } else {
      console.log('❓ Response doesn\'t mention Claude');
    }
  } else {
    console.log('❌ No response received');
  }
  
  // Clear chat
  await page.evaluate(() => {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
  });
  
  // Test Ollama provider (if available)
  console.log('\n=== TESTING OLLAMA PROVIDER ===');
  
  // Select Ollama provider (provider-2)
  await page.selectOption('#chat-provider', 'provider-2');
  await page.waitForTimeout(500);
  
  // Ask a simple question that might reveal the model
  await page.fill('#chat-input', 'What model are you? Please be specific about your identity.');
  
  console.log('Submitting request to Ollama...');
  await page.click('#chat-form button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(8000); // Ollama might be slower
  
  // Check response
  messages = await page.$$eval('#chat-messages .message', msgs => 
    msgs.map(msg => ({
      role: msg.querySelector('.message-role')?.textContent || 'unknown',
      content: msg.querySelector('.message-content')?.textContent || 'no content'
    }))
  );
  
  console.log('\nOllama response:');
  if (messages.length >= 2) {
    const response = messages[messages.length - 1];
    console.log(`${response.role}: ${response.content.substring(0, 200)}...`);
    
    if (response.content.toLowerCase().includes('qwen') || 
        response.content.toLowerCase().includes('ollama') ||
        response.content.toLowerCase().includes('llama')) {
      console.log('✅ Response identifies as Ollama/Qwen/Llama model!');
    } else {
      console.log('❓ Response doesn\'t clearly identify the model');
    }
  } else {
    console.log('❌ No response received from Ollama');
  }
  
  await browser.close();
})();