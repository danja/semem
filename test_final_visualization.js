import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Graph stats') || text.includes('Canvas') || text.includes('Container dimensions')) {
      console.log(`LOG: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(1000);
  
  console.log('Clicking Graph sub-tab using correct selector...');
  await page.click('button[data-tab="sparql-graph"]');
  await page.waitForTimeout(2000);
  
  // Check final state after proper tab activation
  const finalState = await page.evaluate(() => {
    const container = document.getElementById('rdf-graph-container');
    const canvas = document.querySelector('canvas');
    const activeTabContent = document.querySelector('.sparql-tab-content:not([style*="display: none"])');
    
    return {
      containerDimensions: container ? {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight
      } : null,
      canvasDimensions: canvas ? { 
        width: canvas.width, 
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight
      } : null,
      activeTab: activeTabContent ? activeTabContent.id : 'unknown',
      graphTabVisible: document.getElementById('sparql-graph') ? 
        window.getComputedStyle(document.getElementById('sparql-graph')).display !== 'none' : false
    };
  });
  
  console.log('\n=== FINAL STATE AFTER CORRECT TAB CLICK ===');
  console.log('Container dimensions:', finalState.containerDimensions);
  console.log('Canvas dimensions:', finalState.canvasDimensions);
  console.log('Active tab:', finalState.activeTab);
  console.log('Graph tab visible:', finalState.graphTabVisible);
  
  // Take a screenshot to see what's happening
  await page.screenshot({ path: '/tmp/graph-visualization.png', fullPage: true });
  console.log('Screenshot saved to /tmp/graph-visualization.png');
  
  await browser.close();
})();