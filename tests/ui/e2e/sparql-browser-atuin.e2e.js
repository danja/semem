import { test, expect } from '@playwright/test';

test.describe('SPARQL Browser with Atuin Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Navigate to the page
    await page.goto('http://localhost:4120');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Open SPARQL Browser tab
    await page.click('[data-tab="sparql-browser"]');
    await page.waitForTimeout(1000); // Allow tab to fully load
  });

  test('should load SPARQL Browser with dual-panel layout', async ({ page }) => {
    // Check if SPARQL Browser container exists
    const sparqlContainer = await page.$('#sparql-browser');
    expect(sparqlContainer).not.toBeNull();
    
    // Check for dual-panel layout
    const dualPanel = await page.$('.sparql-dual-panel');
    expect(dualPanel).not.toBeNull();
    
    // Check left panel tabs (SPARQL and RDF)
    const leftPanel = await page.$('.sparql-left-panel');
    expect(leftPanel).not.toBeNull();
    
    const sparqlTab = await page.$('[data-tab="sparql-query"]');
    const rdfTab = await page.$('[data-tab="turtle-editor"]');
    expect(sparqlTab).not.toBeNull();
    expect(rdfTab).not.toBeNull();
    
    // Check right panel tabs (Graph and Settings)
    const rightPanel = await page.$('.sparql-right-panel');
    expect(rightPanel).not.toBeNull();
    
    const graphTab = await page.$('[data-tab="rdf-graph"]');
    const settingsTab = await page.$('[data-tab="sparql-endpoints"]');
    expect(graphTab).not.toBeNull();
    expect(settingsTab).not.toBeNull();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-browser-layout.png' });
  });

  test('should initialize Atuin components with syntax highlighting', async ({ page }) => {
    // Wait for Atuin to load
    await page.waitForTimeout(2000);
    
    // Check if SPARQL editor is initialized
    const sparqlEditor = await page.$('#sparql-query-editor');
    expect(sparqlEditor).not.toBeNull();
    
    // Check if Turtle editor is initialized
    const turtleEditor = await page.$('#turtle-editor');
    expect(turtleEditor).not.toBeNull();
    
    // Check console for Atuin initialization messages
    const logs = await page.evaluate(() => {
      return window.console._logs || [];
    });
    
    // Verify Atuin components are available
    const atuinComponentsAvailable = await page.evaluate(() => {
      return !!(window.TurtleEditor && window.SPARQLEditor && window.SPARQLClipsManager);
    });
    expect(atuinComponentsAvailable).toBe(true);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/atuin-initialization.png' });
  });

  test('should display Save/Load Query buttons', async ({ page }) => {
    // Check for Save Query button
    const saveQueryBtn = await page.$('#save-query');
    expect(saveQueryBtn).not.toBeNull();
    
    // Check for Load Query button
    const loadQueryBtn = await page.$('#load-query');
    expect(loadQueryBtn).not.toBeNull();
    
    // Check button text
    const saveButtonText = await page.textContent('#save-query');
    const loadButtonText = await page.textContent('#load-query');
    expect(saveButtonText).toBe('Save Query');
    expect(loadButtonText).toBe('Load Query');
    
    // Check button classes
    const saveButtonClass = await page.getAttribute('#save-query', 'class');
    const loadButtonClass = await page.getAttribute('#load-query', 'class');
    expect(saveButtonClass).toContain('btn secondary-btn');
    expect(loadButtonClass).toContain('btn secondary-btn');
  });

  test('should display SPARQL clips container', async ({ page }) => {
    // Check if clips container exists
    const clipsContainer = await page.$('#sparql-clips-container');
    expect(clipsContainer).not.toBeNull();
    
    // Check for placeholder text
    const placeholderText = await page.textContent('.clips-placeholder p');
    expect(placeholderText).toBe('Saved SPARQL query clips from the editor above.');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-clips-container.png' });
  });

  test('should handle SPARQL query input and save functionality', async ({ page }) => {
    // Sample SPARQL query
    const testQuery = `PREFIX ex: <http://example.org/>
SELECT ?person ?name WHERE {
  ?person a ex:Person ;
          ex:name ?name .
}`;
    
    // Enter query in SPARQL editor
    await page.fill('#sparql-query-editor', testQuery);
    
    // Verify query was entered
    const enteredQuery = await page.inputValue('#sparql-query-editor');
    expect(enteredQuery).toContain('SELECT ?person ?name');
    
    // Mock the prompt dialog for save functionality
    await page.evaluate(() => {
      window.prompt = () => 'Test Query';
    });
    
    // Click Save Query button
    await page.click('#save-query');
    
    // Wait for save operation
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-query-save.png' });
  });

  test('should handle Load Query button click', async ({ page }) => {
    // Mock the prompt dialog for load functionality
    await page.evaluate(() => {
      // Mock clips manager to return sample clips
      window.mockClips = [
        { name: 'Sample Query 1', query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10' },
        { name: 'Sample Query 2', query: 'SELECT ?person WHERE { ?person a ex:Person }' }
      ];
      
      window.prompt = () => '1'; // Select first clip
      window.alert = () => {}; // Mock alert
    });
    
    // Click Load Query button
    await page.click('#load-query');
    
    // Wait for load operation
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-query-load.png' });
  });

  test('should switch between left panel tabs (SPARQL and RDF)', async ({ page }) => {
    // Initially SPARQL tab should be active
    const sparqlTabActive = await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="sparql-query"]');
      return tab?.classList.contains('active');
    });
    expect(sparqlTabActive).toBe(true);
    
    // Click RDF tab
    await page.click('[data-tab="turtle-editor"]');
    await page.waitForTimeout(500);
    
    // Check if RDF tab is now active
    const rdfTabActive = await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="turtle-editor"]');
      return tab?.classList.contains('active');
    });
    expect(rdfTabActive).toBe(true);
    
    // Check if RDF content is visible
    const rdfContent = await page.$('#turtle-editor-content');
    expect(rdfContent).not.toBeNull();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-rdf-tabs.png' });
  });

  test('should switch between right panel tabs (Graph and Settings)', async ({ page }) => {
    // Click Graph tab
    await page.click('[data-tab="rdf-graph"]');
    await page.waitForTimeout(500);
    
    // Check if Graph tab is active
    const graphTabActive = await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="rdf-graph"]');
      return tab?.classList.contains('active');
    });
    expect(graphTabActive).toBe(true);
    
    // Check for graph container
    const graphContainer = await page.$('#rdf-graph-container');
    expect(graphContainer).not.toBeNull();
    
    // Click Settings tab
    await page.click('[data-tab="sparql-endpoints"]');
    await page.waitForTimeout(500);
    
    // Check if Settings tab is active
    const settingsTabActive = await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="sparql-endpoints"]');
      return tab?.classList.contains('active');
    });
    expect(settingsTabActive).toBe(true);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-right-tabs.png' });
  });

  test('should display Execute Query button and handle clicks', async ({ page }) => {
    // Check for Execute Query button
    const executeBtn = await page.$('#execute-query');
    expect(executeBtn).not.toBeNull();
    
    // Check button text and class
    const buttonText = await page.textContent('#execute-query');
    const buttonClass = await page.getAttribute('#execute-query', 'class');
    expect(buttonText).toBe('Execute Query');
    expect(buttonClass).toContain('btn primary-btn');
    
    // Enter a simple test query
    const testQuery = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    await page.fill('#sparql-query-editor', testQuery);
    
    // Click execute button (this may fail due to no SPARQL endpoint, but button should be clickable)
    await page.click('#execute-query');
    
    // Wait for any response
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-execute-query.png' });
  });

  test('should maintain independent tab state between panels', async ({ page }) => {
    // Set initial state - SPARQL tab active on left, Graph tab active on right
    await page.click('[data-tab="sparql-query"]');
    await page.click('[data-tab="rdf-graph"]');
    await page.waitForTimeout(500);
    
    // Verify initial state
    const leftActiveTab = await page.evaluate(() => {
      const tab = document.querySelector('.sparql-left-panel .tab-inner-btn.active');
      return tab?.getAttribute('data-tab');
    });
    const rightActiveTab = await page.evaluate(() => {
      const tab = document.querySelector('.sparql-right-panel .tab-inner-btn.active');
      return tab?.getAttribute('data-tab');
    });
    
    expect(leftActiveTab).toBe('sparql-query');
    expect(rightActiveTab).toBe('rdf-graph');
    
    // Switch left panel to RDF
    await page.click('[data-tab="turtle-editor"]');
    await page.waitForTimeout(500);
    
    // Switch right panel to Settings
    await page.click('[data-tab="sparql-endpoints"]');
    await page.waitForTimeout(500);
    
    // Verify panels switched independently
    const newLeftActiveTab = await page.evaluate(() => {
      const tab = document.querySelector('.sparql-left-panel .tab-inner-btn.active');
      return tab?.getAttribute('data-tab');
    });
    const newRightActiveTab = await page.evaluate(() => {
      const tab = document.querySelector('.sparql-right-panel .tab-inner-btn.active');
      return tab?.getAttribute('data-tab');
    });
    
    expect(newLeftActiveTab).toBe('turtle-editor');
    expect(newRightActiveTab).toBe('sparql-endpoints');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sparql-independent-tabs.png' });
  });

  test('should handle responsive layout', async ({ page }) => {
    // Test wide layout class
    const hasWideLayout = await page.evaluate(() => {
      const container = document.querySelector('#sparql-browser .modal-content');
      return container?.classList.contains('sparql-wide-layout');
    });
    expect(hasWideLayout).toBe(true);
    
    // Check dual panel is using flexbox
    const dualPanelStyle = await page.evaluate(() => {
      const panel = document.querySelector('.sparql-dual-panel');
      const computedStyle = window.getComputedStyle(panel);
      return computedStyle.display;
    });
    expect(dualPanelStyle).toBe('flex');
    
    // Test at different viewport sizes
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    // Take screenshot at normal size
    await page.screenshot({ path: 'test-results/sparql-responsive-normal.png' });
    
    // Test at smaller viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    
    // Take screenshot at smaller size
    await page.screenshot({ path: 'test-results/sparql-responsive-small.png' });
  });
});