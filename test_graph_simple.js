import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen to console events for graph-related messages only
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Graph') || text.includes('Network') || text.includes('Canvas') || text.includes('vis-network')) {
      console.log(`${msg.type().toUpperCase()}: ${text}`);
    }
  });
  
  // Navigate to the page
  await page.goto('http://localhost:4120');
  
  // Click on SPARQL Browser tab
  try {
    await page.click('button[data-tab="sparql-browser"]');
    console.log('Clicked SPARQL Browser tab');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Could not click SPARQL Browser tab:', e.message);
  }
  
  // Click on Graph sub-tab
  try {
    await page.click('button[data-inner-tab="sparql-graph"]');
    console.log('Clicked Graph sub-tab');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Could not click Graph sub-tab:', e.message);
  }
  
  // Check for canvas element
  const canvas = await page.$('canvas');
  console.log('Canvas element found:', !!canvas);
  
  // Check graph container
  const graphContainer = await page.$('#rdf-graph-container');
  if (graphContainer) {
    const rect = await graphContainer.boundingBox();
    console.log('Graph container dimensions:', rect?.width, 'x', rect?.height);
  }
  
  await browser.close();
})();