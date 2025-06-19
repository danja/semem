import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('provider') || text.includes('Provider') || text.includes('chat')) {
      console.log(`PAGE: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000); // Wait for full initialization
  
  // Switch to chat tab
  console.log('\n=== SWITCHING TO CHAT TAB ===');
  const chatTab = await page.$('[data-tab="chat"]');
  if (chatTab) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }
  
  // Check if provider dropdown exists and has options
  console.log('\n=== CHECKING PROVIDER DROPDOWN ===');
  const providerSelect = await page.$('#chat-provider');
  if (providerSelect) {
    console.log('✅ Provider dropdown found');
    
    // Get all options
    const options = await page.$$eval('#chat-provider option', options => 
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    );
    
    console.log('Available options:');
    options.forEach((opt, index) => {
      console.log(`  ${index + 1}. Value: "${opt.value}", Text: "${opt.text}"`);
    });
    
    // Check if we have real providers (not just placeholder)
    const realProviders = options.filter(opt => opt.value && opt.value !== '');
    console.log(`\nFound ${realProviders.length} real provider options`);
    
    if (realProviders.length > 0) {
      console.log('✅ Provider options are available');
      
      // Test selecting different providers
      for (let i = 0; i < Math.min(realProviders.length, 3); i++) {
        const provider = realProviders[i];
        console.log(`\n--- Testing provider: ${provider.text} ---`);
        
        await page.selectOption('#chat-provider', provider.value);
        await page.waitForTimeout(200);
        
        const selectedValue = await page.$eval('#chat-provider', el => el.value);
        console.log(`Selected value: "${selectedValue}"`);
        
        if (selectedValue === provider.value) {
          console.log(`✅ Successfully selected ${provider.text}`);
        } else {
          console.log(`❌ Failed to select ${provider.text}, got: ${selectedValue}`);
        }
      }
    } else {
      console.log('❌ No real provider options found');
    }
  } else {
    console.log('❌ Provider dropdown not found');
  }
  
  // Also check streaming chat provider dropdown  
  console.log('\n=== CHECKING STREAMING CHAT PROVIDER DROPDOWN ===');
  const streamProviderSelect = await page.$('#chat-stream-provider');
  if (streamProviderSelect) {
    console.log('✅ Streaming provider dropdown found');
    
    const streamOptions = await page.$$eval('#chat-stream-provider option', options => 
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    );
    
    const realStreamProviders = streamOptions.filter(opt => opt.value && opt.value !== '');
    console.log(`Found ${realStreamProviders.length} real streaming provider options`);
    
    if (realStreamProviders.length > 0) {
      console.log('✅ Streaming provider options are available');
    } else {
      console.log('❌ No real streaming provider options found');
    }
  } else {
    console.log('❌ Streaming provider dropdown not found');
  }
  
  // Check the API endpoint directly
  console.log('\n=== CHECKING /api/providers ENDPOINT ===');
  try {
    const response = await page.evaluate(async () => {
      const resp = await fetch('/api/providers');
      return {
        status: resp.status,
        data: await resp.json()
      };
    });
    
    console.log(`API Response Status: ${response.status}`);
    console.log(`Number of providers: ${response.data.providers?.length || 0}`);
    
    if (response.data.providers && response.data.providers.length > 0) {
      console.log('Providers from API:');
      response.data.providers.forEach((provider, index) => {
        console.log(`  ${index + 1}. ID: ${provider.id}, Type: ${provider.type}, Name: ${provider.name}`);
      });
    }
  } catch (error) {
    console.log('❌ Failed to fetch providers API:', error.message);
  }
  
  await browser.close();
})();