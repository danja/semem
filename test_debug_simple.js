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
  
  // Get available providers
  const providers = await page.$$eval('#chat-provider option', options => 
    options.map(opt => ({ value: opt.value, text: opt.textContent }))
  );
  
  console.log('Available providers:');
  providers.forEach(p => console.log(`  - "${p.value}": ${p.text}`));
  
  // Find a working provider (not empty value)
  const workingProvider = providers.find(p => p.value && p.value !== '');
  
  if (workingProvider) {
    console.log(`\nUsing provider: ${workingProvider.text} (${workingProvider.value})`);
    
    // Select the provider
    await page.selectOption('#chat-provider', workingProvider.value);
    await page.waitForTimeout(500);
    
    // Send a message
    await page.fill('#chat-input', `Test message using ${workingProvider.text}`);
    console.log('Submitting request...');
    await page.click('#chat-form button[type="submit"]');
    
    // Wait for processing
    await page.waitForTimeout(5000);
    console.log('Request submitted - check server logs for debug output');
  } else {
    console.log('No working providers found');
  }
  
  await browser.close();
})();