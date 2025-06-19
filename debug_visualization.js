import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Track all relevant logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    
    // Show key events
    if (text.includes('GraphVisualizer') || 
        text.includes('Graph stats') ||
        text.includes('Canvas') ||
        text.includes('Container dimensions') ||
        text.includes('nodes:') ||
        text.includes('edges:')) {
      console.log(`LOG: ${text}`);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(2000);
  
  console.log('Clicking Graph sub-tab...');
  try {
    // Check if graph sub-tab exists
    const graphTab = await page.$('button[data-inner-tab="sparql-graph"]');
    if (graphTab) {
      await page.click('button[data-inner-tab="sparql-graph"]');
      console.log('Successfully clicked Graph sub-tab');
    } else {
      console.log('Graph sub-tab not found, checking available tabs...');
      const tabs = await page.$$eval('.sparql-tabs button', buttons => 
        buttons.map(btn => ({ text: btn.textContent, dataTab: btn.getAttribute('data-inner-tab') }))
      );
      console.log('Available tabs:', tabs);
    }
  } catch (e) {
    console.log('Failed to click Graph sub-tab:', e.message);
  }
  
  await page.waitForTimeout(3000);
  
  // Check final state
  const finalState = await page.evaluate(() => {
    const container = document.getElementById('rdf-graph-container');
    const canvas = document.querySelector('canvas');
    
    return {
      containerExists: !!container,
      containerVisible: container ? window.getComputedStyle(container).display !== 'none' : false,
      containerDimensions: container ? {
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight,
        style: {
          width: container.style.width,
          height: container.style.height,
          display: container.style.display
        }
      } : null,
      canvasExists: !!canvas,
      canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : null,
      activeTab: document.querySelector('.sparql-tab-content:not([style*="display: none"])')?.id || 'unknown'
    };
  });
  
  console.log('\n=== FINAL STATE ===');
  console.log('Container exists:', finalState.containerExists);
  console.log('Container visible:', finalState.containerVisible);
  console.log('Container dimensions:', finalState.containerDimensions);
  console.log('Canvas exists:', finalState.canvasExists);
  console.log('Canvas dimensions:', finalState.canvasDimensions);
  console.log('Active tab:', finalState.activeTab);
  
  // Check for repeated log patterns
  const statsLogs = logs.filter(log => log.includes('Graph stats updated'));
  if (statsLogs.length > 5) {
    console.log(`\n⚠️  Warning: Found ${statsLogs.length} "Graph stats updated" messages (possible loop)`);
  }
  
  await browser.close();
})();