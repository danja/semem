import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('_createVisualization complete') || 
        text.includes('Graph stats') ||
        text.includes('nodes:') ||
        text.includes('edges:') ||
        text.includes('Nodes:') ||
        text.includes('Edges:')) {
      console.log('VIS:', text);
    }
  });
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(8000);
  
  // Check current node/edge count in UI
  const stats = await page.evaluate(() => {
    const statsElement = document.querySelector('.graph-stats');
    return statsElement ? statsElement.textContent : 'No stats element';
  });
  
  console.log('UI Stats:', stats);
  
  // Check if canvas has content
  const hasCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  });
  
  console.log('Canvas:', hasCanvas);
  
  await browser.close();
})();