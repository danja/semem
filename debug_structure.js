import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(2000);
  
  console.log('Clicking SPARQL Browser tab...');
  await page.click('button[data-tab="sparql-browser"]');
  await page.waitForTimeout(1000);
  
  // Get the full structure of SPARQL tabs
  const tabStructure = await page.evaluate(() => {
    const sparqlSection = document.getElementById('sparql-browser-tab');
    if (!sparqlSection) return 'SPARQL section not found';
    
    const tabs = sparqlSection.querySelectorAll('button');
    const tabData = Array.from(tabs).map((tab, index) => ({
      index,
      text: tab.textContent.trim(),
      class: tab.className,
      dataTab: tab.getAttribute('data-tab'),
      dataInnerTab: tab.getAttribute('data-inner-tab'),
      visible: window.getComputedStyle(tab).display !== 'none',
      disabled: tab.disabled
    }));
    
    return {
      totalTabs: tabs.length,
      tabs: tabData.slice(0, 10) // First 10 tabs
    };
  });
  
  console.log('SPARQL Tab Structure:', JSON.stringify(tabStructure, null, 2));
  
  // Find graph-related elements
  const graphElements = await page.evaluate(() => {
    const graphContainer = document.getElementById('rdf-graph-container');
    const graphTabContent = document.getElementById('sparql-graph');
    
    return {
      graphContainer: !!graphContainer,
      graphTabContent: !!graphTabContent,
      graphContainerParent: graphContainer ? graphContainer.parentElement?.id : null,
      allTabContents: Array.from(document.querySelectorAll('[id*="sparql"]')).map(el => ({
        id: el.id,
        display: window.getComputedStyle(el).display
      }))
    };
  });
  
  console.log('Graph Elements:', JSON.stringify(graphElements, null, 2));
  
  await browser.close();
})();