export class SparqlPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://localhost:4120';
    this.timeout = 10000; // 10 seconds default timeout
    
    // Query Editor
    this.queryEditor = '#sparql-query-editor';
    this.executeButton = '#execute-query';
    this.saveQueryButton = '#save-query';
    this.loadQueryButton = '#load-query';
    
    // Results
    this.resultsContainer = '#query-results';
    this.resultTable = `${this.resultsContainer} table`;
    
    // Tabs
    this.tabs = {
      query: { selector: 'button[data-tab="sparql-query"]', panel: '#sparql-query-panel' },
      graph: { selector: 'button[data-tab="sparql-graph"]', panel: '#sparql-graph-panel' },
      edit: { selector: 'button[data-tab="sparql-edit"]', panel: '#sparql-edit-panel' },
      endpoints: { selector: 'button[data-tab="sparql-endpoints"]', panel: '#sparql-endpoints-panel' }
    };
    
    // Add tab references for backward compatibility
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
    
    // Ensure we're on the query tab
    await this.switchToTab('query');
  }
  
  async waitForTab(tabName, timeout = this.timeout) {
    const tab = this.tabs[tabName];
    if (!tab) {
      throw new Error(`Unknown tab: ${tabName}`);
    }
    
    // Wait for tab button to be visible and enabled
    await this.page.waitForSelector(tab.selector, { 
      state: 'visible',
      timeout
    });
    
    // Wait for tab panel to be visible
    if (tab.panel) {
      await this.page.waitForSelector(tab.panel, { 
        state: 'visible',
        timeout
      });
    }
  }
  
  async executeQuery(query) {
    // Clear existing query
    await this.page.click(this.queryEditor);
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('A');
    await this.page.keyboard.up('Control');
    await this.page.keyboard.press('Backspace');
    
    // Enter new query
    await this.page.type(this.queryEditor, query);
    
    // Execute query
    await this.page.click(this.executeButton);
    
    // Wait for results
    await this.page.waitForSelector(this.resultTable, { state: 'attached', timeout: 10000 });
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
      throw new Error(`Unknown tab: ${tabName}`);
    }
    
    try {
      // Wait for the tab to be ready
      await this.waitForTab(tabName, timeout);
      
      // Click the tab
      await this.page.click(tab.selector);
      
      // Wait for the tab panel to be visible
      if (tab.panel) {
        await this.page.waitForSelector(tab.panel, { 
          state: 'visible',
          timeout
        });
      }
      
      // Add a small delay to ensure UI updates
      await this.page.waitForTimeout(500);
      
      return true;
    } catch (error) {
      console.error(`Failed to switch to tab '${tabName}':`, error);
      await this.page.screenshot({ path: `test-results/tab-switch-error-${tabName}.png` });
      throw error;
    }
  }
}
