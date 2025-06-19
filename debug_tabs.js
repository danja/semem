import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(1000);
  
  console.log('Finding Graph tab by text...');
  try {
    // Click the Graph tab by text content instead of data attribute
    await page.click('button:has-text("Graph")');
    console.log('Successfully clicked Graph tab by text');
    await page.waitForTimeout(2000);
    
    // Check if we're on the right tab now
    const activeTab = await page.evaluate(() => {
      const activeContent = document.querySelector('.sparql-tab-content:not([style*="display: none"])');
      return activeContent ? activeContent.id : 'unknown';
    });
    
    console.log('Active tab after click:', activeTab);
    
    // Check container dimensions after tab switch
    const containerState = await page.evaluate(() => {
      const container = document.getElementById('rdf-graph-container');
      if (!container) return null;
      
      return {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        parentDisplay: container.parentElement ? window.getComputedStyle(container.parentElement).display : 'unknown',
        parentVisibility: container.parentElement ? window.getComputedStyle(container.parentElement).visibility : 'unknown',
        containerDisplay: window.getComputedStyle(container).display,
        containerVisibility: window.getComputedStyle(container).visibility
      };
    });
    
    console.log('Container state after tab switch:', containerState);
    
    // Check canvas after tab switch
    const canvasState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return canvas ? { width: canvas.width, height: canvas.height } : null;
    });
    
    console.log('Canvas state after tab switch:', canvasState);
    
  } catch (e) {
    console.log('Failed to click Graph tab:', e.message);
  }
  
  await browser.close();
})();