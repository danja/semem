import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GraphVisualizer') || 
        text.includes('MODEL_SYNCED') || 
        text.includes('event') ||
        text.includes('parsing') ||
        text.includes('updateGraph')) {
      console.log(`${msg.type().toUpperCase()}: ${text}`);
    }
  });
  
  await page.goto('http://localhost:4120');
  
  // Click SPARQL Browser tab
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(2000);
  
  // Check if GraphVisualizer constructor was called
  const hasGraphVisualizer = await page.evaluate(() => {
    return window.GraphVisualizer !== undefined;
  });
  console.log('GraphVisualizer class available:', hasGraphVisualizer);
  
  // Check event bus systems
  const eventBusStatus = await page.evaluate(() => {
    return {
      windowEventBus: !!window.eventBus,
      windowEvb: !!window.evb,
      windowEvents: !!window.EVENTS
    };
  });
  console.log('Event bus status:', eventBusStatus);
  
  await page.waitForTimeout(3000);
  await browser.close();
})();