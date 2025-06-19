import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Track console message patterns to detect loops
  const messageTracker = new Map();
  let totalMessages = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    totalMessages++;
    
    // Track frequency of specific messages
    const key = text.substring(0, 50); // First 50 chars as key
    const count = messageTracker.get(key) || 0;
    messageTracker.set(key, count + 1);
    
    // Alert on rapid repetition
    if (count > 5) {
      console.log(`🚨 LOOP DETECTED: "${key}" occurred ${count + 1} times`);
    }
    
    // Show event bus related messages
    if (text.includes('EVENT') || text.includes('emit') || text.includes('listener') || text.includes('MODEL_SYNCED')) {
      console.log(`EVENT: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  
  // Wait just long enough to detect initial patterns
  await page.waitForTimeout(3000);
  console.log(`Total messages in 3s: ${totalMessages}`);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(2000);
  
  console.log(`Total messages after SPARQL tab: ${totalMessages}`);
  
  console.log('Clicking Graph tab (with timeout protection)...');
  
  // Add timeout protection
  const clickPromise = page.click('button[data-tab="sparql-graph"]');
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Click timeout')), 5000)
  );
  
  try {
    await Promise.race([clickPromise, timeoutPromise]);
    console.log('Graph tab clicked successfully');
  } catch (error) {
    console.log('Graph tab click timed out - browser may be unresponsive');
  }
  
  await page.waitForTimeout(1000);
  console.log(`Final total messages: ${totalMessages}`);
  
  // Show top repeated messages
  const sortedMessages = Array.from(messageTracker.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log('\nTop repeated messages:');
  sortedMessages.forEach(([msg, count]) => {
    if (count > 2) {
      console.log(`  ${count}x: ${msg}`);
    }
  });
  
  await browser.close();
})();