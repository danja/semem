import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let memoryErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      if (text.includes('memories.forEach') || text.includes('prepareGraphData') || text.includes('MemoryGraphViz')) {
        memoryErrors.push(text);
      }
      console.log(`ERROR: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking Memory tab...');
  await page.click('button[data-tab="memory"]');
  await page.waitForTimeout(1000);
  
  console.log('Clicking Memory Viz sub-tab...');
  const memoryVizTab = await page.$('button[data-tab="memory-viz"]');
  if (memoryVizTab) {
    await memoryVizTab.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('Memory Viz tab not found - checking available tabs...');
    const tabs = await page.$$eval('button[data-tab]', buttons => 
      buttons.map(btn => ({ text: btn.textContent, dataTab: btn.getAttribute('data-tab') }))
    );
    console.log('Available tabs:', tabs.filter(t => t.text.toLowerCase().includes('viz') || t.text.toLowerCase().includes('visual')));
  }
  
  // Check for memory-related errors
  console.log(`\nFound ${memoryErrors.length} memory forEach errors:`);
  memoryErrors.forEach(error => console.log(`  - ${error}`));
  
  await browser.close();
})();