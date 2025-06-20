import { chromium } from 'playwright';

async function checkTabs() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:4120');
    await page.waitForLoadState('networkidle');
    await page.click('[data-tab="sparql-browser"]');
    await page.waitForTimeout(2000);

    const tabSelectors = await page.evaluate(() => {
      const tabs = document.querySelectorAll('[data-tab]');
      return Array.from(tabs).map(tab => ({
        selector: tab.getAttribute('data-tab'),
        text: tab.textContent.trim(),
        class: tab.className,
        visible: getComputedStyle(tab).display !== 'none'
      }));
    });

    console.log('Available tabs:', JSON.stringify(tabSelectors, null, 2));
    
    // Also check for tab buttons specifically in SPARQL browser
    const sparqlTabs = await page.evaluate(() => {
      const sparqlContainer = document.querySelector('#sparql-browser');
      if (!sparqlContainer) return 'No SPARQL container found';
      
      const tabButtons = sparqlContainer.querySelectorAll('button[data-tab], .tab-btn, .tab-inner-btn');
      return Array.from(tabButtons).map(btn => ({
        selector: btn.getAttribute('data-tab') || 'no-data-tab',
        text: btn.textContent.trim(),
        class: btn.className,
        tagName: btn.tagName
      }));
    });
    
    console.log('SPARQL browser tabs:', JSON.stringify(sparqlTabs, null, 2));
    
    await page.screenshot({ path: 'debug-screenshots/tab-debug.png', fullPage: true });
    
  } finally {
    await browser.close();
  }
}

checkTabs().catch(console.error);