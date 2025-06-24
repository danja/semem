import { test, expect } from '@playwright/test';
import { SparqlPage } from '../e2e/helpers/pageObjects/SparqlPage.js'; // Moved to e2e directory

test.describe('SPARQL Query Interface', () => {
  let sparqlPage;
  let testInfo;

  test.beforeEach(async ({ page }, info) => {
    testInfo = info;
    sparqlPage = new SparqlPage(page);
    
    try {
      console.log('Navigating to SPARQL interface...');
      await sparqlPage.navigate();
      // Wait for the page to be fully interactive
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');
      console.log('Page loaded successfully');
    } catch (error) {
      console.error('Navigation failed:', error);
      await page.screenshot({ path: 'test-results/navigation-failed.png' });
      throw error;
    }
  });

  test('should load the SPARQL query interface', async ({ page }) => {
    testInfo.annotations.push({ type: 'test', description: 'Verify SPARQL interface loads correctly' });
    
    try {
      // Verify the query editor is visible
      await page.waitForSelector(sparqlPage.queryEditor, { state: 'visible', timeout: 10000 });
      const isEditorVisible = await page.isVisible(sparqlPage.queryEditor);
      expect(isEditorVisible, 'Query editor should be visible').toBeTruthy();

      // Verify the execute button is visible and enabled
      await page.waitForSelector(sparqlPage.executeButton, { state: 'visible', timeout: 10000 });
      const isExecuteButtonVisible = await page.isVisible(sparqlPage.executeButton);
      const isExecuteButtonEnabled = await page.isEnabled(sparqlPage.executeButton);
      
      expect(isExecuteButtonVisible, 'Execute button should be visible').toBeTruthy();
      expect(isExecuteButtonEnabled, 'Execute button should be enabled').toBeTruthy();
      
      // Take a screenshot for documentation
      await page.screenshot({ path: 'test-results/sparql-interface-loaded.png' });
    } catch (error) {
      await page.screenshot({ path: `test-results/sparql-interface-failed-${testInfo.retry}.png` });
      throw error;
    }
  });

  test('should execute a simple SPARQL query', async ({ page }) => {
    testInfo.annotations.push({ type: 'test', description: 'Execute basic SPARQL query' });
    
    const testQuery = `
      SELECT * WHERE {
        ?s ?p ?o
      }
      LIMIT 10
    `;

    try {
      // Ensure we're on the query tab
      await sparqlPage.switchToTab('query');
      
      // Execute the query
      await sparqlPage.executeQuery(testQuery);
      
      // Wait for results
      await page.waitForSelector(sparqlPage.resultTable, { state: 'attached', timeout: 15000 });
      
      // Get and verify results
      const results = await sparqlPage.getQueryResults();
      console.log('Query results:', JSON.stringify(results, null, 2));
      
      // Basic check that we got some results (could be empty if no data)
      expect(Array.isArray(results), 'Should return an array of results').toBeTruthy();
      
      // Take a screenshot of the results
      await page.screenshot({ path: 'test-results/query-results.png' });
    } catch (error) {
      await page.screenshot({ path: `test-results/query-failed-${testInfo.retry}.png` });
      throw error;
    }
  });

  test('should switch between tabs', async ({ page }) => {
    testInfo.annotations.push({ type: 'test', description: 'Verify tab navigation works' });
    
    const tabsToTest = ['graph', 'edit', 'endpoints', 'query'];
    
    for (const tabName of tabsToTest) {
      try {
        console.log(`Testing tab: ${tabName}`);
        
        // Switch to the tab
        await sparqlPage.switchToTab(tabName);
        
        // Verify the tab is active
        const tab = sparqlPage.tabs[tabName];
        const isActive = await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          return el ? el.classList.contains('active') : false;
        }, tab.selector);
        
        expect(isActive, `${tabName} tab should be active`).toBeTruthy();
        
        // Take a screenshot of each tab
        await page.screenshot({ path: `test-results/tab-${tabName}.png` });
        
        // Small delay between tab switches
        await page.waitForTimeout(500);
      } catch (error) {
        console.error(`Failed to switch to tab '${tabName}':`, error);
        await page.screenshot({ path: `test-results/tab-${tabName}-failed-${testInfo.retry}.png` });
        throw error;
      }
    }
  });
});
