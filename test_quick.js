import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GraphVisualizer.updateGraph') || 
        text.includes('Parsed RDF') || 
        text.includes('_createVisualization complete') ||
        text.includes('Events emitted')) {
      console.log(text);
    }
  });
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(5000);
  
  console.log('Page loaded, checking for events...');
  await browser.close();
})();