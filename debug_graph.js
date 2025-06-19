import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen to console events
  page.on('console', msg => {
    console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
  });
  
  // Listen to page errors
  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
  });
  
  // Navigate to the page
  await page.goto('http://localhost:4120');
  
  // Wait a bit for the page to load and any errors to appear
  await page.waitForTimeout(10000);
  
  // Check if graph container exists
  const graphContainer = await page.$('#graph-container');
  if (graphContainer) {
    console.log('Graph container found');
    const rect = await graphContainer.boundingBox();
    console.log('Graph container dimensions:', rect);
  } else {
    console.log('Graph container NOT found');
  }
  
  // Check for vis-network canvas
  const canvas = await page.$('canvas');
  if (canvas) {
    console.log('Canvas element found');
  } else {
    console.log('Canvas element NOT found');
  }
  
  // Try clicking on a tab or triggering graph view
  try {
    await page.click('button:has-text("Graph")');
    await page.waitForTimeout(2000);
    console.log('Clicked Graph tab');
  } catch (e) {
    console.log('Could not click Graph tab:', e.message);
  }
  
  await browser.close();
})();