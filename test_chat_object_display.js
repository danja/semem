import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Chat') || text.includes('formatMessageContent') || text.includes('[object Object]')) {
      console.log(`CHAT: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking Chat tab...');
  await page.click('button[data-tab="chat"]');
  await page.waitForTimeout(1000);
  
  // Test sending a message to trigger response
  console.log('Testing chat with a simple message...');
  const chatInput = await page.$('#chat-input');
  if (chatInput) {
    await chatInput.fill('Hello');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000); // Wait for response
    
    // Check if any messages contain [object Object]
    const messageContents = await page.$$eval('.chat-message .message-content', elements => 
      elements.map(el => el.textContent.trim())
    );
    
    console.log('\\nMessage contents:');
    messageContents.forEach((content, i) => {
      console.log(`  ${i + 1}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      if (content.includes('[object Object]')) {
        console.log(`    ⚠️  Contains [object Object]!`);
      }
    });
    
    const hasObjectObject = messageContents.some(content => content.includes('[object Object]'));
    console.log(`\\nResult: ${hasObjectObject ? '❌ Still showing [object Object]' : '✅ No [object Object] found'}`);
  } else {
    console.log('Chat input not found');
  }
  
  await browser.close();
})();