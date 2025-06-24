export class SparqlPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://localhost:4120';
    this.timeout = 15000; // 15 seconds default timeout
    
    // Main SPARQL Browser tab (must be activated first)
    this.sparqlBrowserTab = '[data-tab="sparql-browser"]';
    this.sparqlBrowserContainer = '#sparql-browser-tab';
    
    // Query Editor (correct selectors)
    this.queryEditor = '#sparql-query-editor';
    this.executeButton = 'button:has-text("Execute")';
    this.saveQueryButton = '#save-query';
    this.loadQueryButton = '#load-query';
    
    // Results (correct selectors)
    this.resultsContainer = '.query-results';
    this.resultTable = `${this.resultsContainer} table`;
    
    // Sub-tabs within SPARQL Browser (correct selectors and content IDs)
    this.tabs = {
      query: { selector: '[data-tab="sparql-query"]', contentId: '#sparql-query' },
      graph: { selector: '[data-tab="sparql-graph"]', contentId: '#sparql-graph' },
      edit: { selector: '[data-tab="sparql-edit"]', contentId: '#sparql-edit' },
      endpoints: { selector: '[data-tab="sparql-endpoints"]', contentId: '#sparql-endpoints' }
    };
    
    // Additional elements
    this.endpointSelect = '#sparql-endpoint-select';
    
    // Backward compatibility properties
    this.queryTab = this.tabs.query.selector;
    this.graphTab = this.tabs.graph.selector;
    this.editTab = this.tabs.edit.selector;
    this.endpointsTab = this.tabs.endpoints.selector;
  }
  
  async waitForPageReady() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('body', { state: 'visible' });
  }
  
  async navigate() {
    await this.page.goto(this.url);
    await this.waitForPageReady();
    
    // CRITICAL: First activate the main SPARQL Browser tab
    await this.page.click(this.sparqlBrowserTab);
    await this.page.waitForSelector(this.sparqlBrowserContainer, { state: 'visible', timeout: this.timeout });
    
    // Now ensure we're on the query sub-tab (default)
    await this.switchToTab('query');
  }
  
  async waitForTab(tabName, timeout = this.timeout) {
    const tab = this.tabs[tabName];
    if (!tab) {
      throw new Error(`Unknown tab: ${tabName}. Available tabs: ${Object.keys(this.tabs).join(', ')}`);
    }
    
    // Ensure main SPARQL Browser tab is active first
    await this.page.waitForSelector(this.sparqlBrowserContainer, { state: 'visible', timeout });
    
    // Wait for sub-tab button to be present (it may be hidden but clickable)
    await this.page.waitForSelector(tab.selector, { state: 'attached', timeout });
    
    // Wait for tab content to be present in DOM
    await this.page.waitForSelector(tab.contentId, { state: 'attached', timeout });
  }
  
  async executeQuery(query) {
    // Ensure we're on the query tab
    await this.switchToTab('query');
    
    // Clear existing query and enter new one
    await this.page.fill(this.queryEditor, query);
    
    // Execute query
    await this.page.click(this.executeButton);
    
    // Wait for results container to be visible
    await this.page.waitForSelector(this.resultsContainer, { state: 'visible', timeout: 10000 });
  }
  
  async getQueryResults() {
    return await this.page.$$eval(`${this.resultTable} tr`, rows => {
      const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.textContent.trim());
      const resultRows = [];
      
      for (let i = 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td'));
        const row = {};
        cells.forEach((cell, index) => {
          row[headers[index]] = cell.textContent.trim();
        });
        resultRows.push(row);
      }
      
      return resultRows;
    });
  }
  
  async switchToTab(tabName, timeout = this.timeout) {
    const tab = this.tabs[tabName.toLowerCase()];
    if (!tab) {
      throw new Error(`Unknown tab: ${tabName}. Available tabs: ${Object.keys(this.tabs).join(', ')}`);
    }
    
    try {
      // Ensure main SPARQL Browser is active first
      await this.page.waitForSelector(this.sparqlBrowserContainer, { state: 'visible', timeout });
      
      // Click the sub-tab
      await this.page.click(tab.selector);
      
      // Wait for the tab content to become visible
      await this.page.waitForSelector(tab.contentId, { state: 'visible', timeout });
      
      // Add a small delay to ensure UI updates complete
      await this.page.waitForTimeout(200);
      
      return true;
    } catch (error) {
      console.error(`Failed to switch to tab '${tabName}':`, error.message);
      
      // Create directory if it doesn't exist
      await this.page.evaluate(() => {
        if (typeof window !== 'undefined') {
          console.log('Current page title:', document.title);
          console.log('SPARQL Browser tab visible:', !!document.querySelector('#sparql-browser-tab'));
          console.log('Tab selector exists:', !!document.querySelector(arguments[0]));
        }
      }, tab.selector);
      
      throw error;
    }
  }
}
