import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Container dimensions') || text.includes('forcing size')) {
      console.log('CONTAINER:', text);
    }
  });
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(5000);
  
  // Check actual container status
  const containerInfo = await page.evaluate(() => {
    const container = document.getElementById('rdf-graph-container');
    if (!container) return 'Container not found';
    
    const style = window.getComputedStyle(container);
    return {
      offsetWidth: container.offsetWidth,
      offsetHeight: container.offsetHeight,
      display: style.display,
      visibility: style.visibility,
      position: style.position,
      width: style.width,
      height: style.height,
      minHeight: style.minHeight
    };
  });
  
  console.log('Container info:', containerInfo);
  
  await browser.close();
})();