import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(1000);
  
  console.log('Clicking Graph sub-tab...');
  try {
    await page.click('button[data-inner-tab="sparql-graph"]');
    console.log('Successfully clicked Graph sub-tab');
  } catch (e) {
    console.log('Failed to click Graph sub-tab, trying alternative selector...');
    // Try alternative selectors
    await page.click('.sparql-tabs button:nth-child(2)');
  }
  
  await page.waitForTimeout(2000);
  
  // Check container dimensions after making tab visible
  const containerInfo = await page.evaluate(() => {
    const container = document.getElementById('rdf-graph-container');
    if (!container) return 'Container not found';
    
    return {
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight,
      parentWidth: container.parentElement?.offsetWidth,
      parentHeight: container.parentElement?.offsetHeight
    };
  });
  
  console.log('Container after tab switch:', containerInfo);
  
  // Check canvas
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? { width: canvas.width, height: canvas.height } : 'No canvas';
  });
  
  console.log('Canvas after tab switch:', canvasInfo);
  
  await browser.close();
})();