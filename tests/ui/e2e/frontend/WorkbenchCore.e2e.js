import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';

test.describe('Semantic Memory Workbench - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Wait for workbench initialization
    await expect(page.locator('.semantic-memory-workbench')).toBeVisible();
  });

  test('should load application with correct structure', async ({ page }) => {
    // Verify main components are present
    await expect(page.locator('header.session-dashboard')).toBeVisible();
    await expect(page.locator('nav.main-nav')).toBeVisible();
    await expect(page.locator('main.main-content')).toBeVisible();
    
    // Verify all navigation tabs
    await expect(page.getByRole('button', { name: '🧠 Semantic Memory' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📊 System Monitor' })).toBeVisible();
    await expect(page.getByRole('button', { name: '⚙️ Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🔧 SPARQL Browser' })).toBeVisible();
    
    // Verify session dashboard is visible and populated
    await expect(page.locator('.session-dashboard')).toBeVisible();
    await expect(page.locator('h3:has-text("Session Cache")')).toBeVisible();
  });

  test('should handle tab navigation correctly', async ({ page }) => {
    // Test each tab
    const tabs = [
      { name: '📊 System Monitor', content: 'System Monitor' },
      { name: '⚙️ Settings', content: 'Settings' },
      { name: '🔧 SPARQL Browser', content: 'SPARQL Browser' },
      { name: '🧠 Semantic Memory', content: 'Tell' }
    ];

    for (const tab of tabs) {
      await page.getByRole('button', { name: tab.name }).click();
      await expect(page.locator(`h2:has-text("${tab.content}")`)).toBeVisible();
      
      // Verify active state
      await expect(page.getByRole('button', { name: tab.name })).toHaveClass(/active/);
    }
  });

  test('should display session statistics correctly', async ({ page }) => {
    // Verify session cache statistics
    await expect(page.locator('text=Interactions:')).toBeVisible();
    await expect(page.locator('text=Concepts:')).toBeVisible();
    await expect(page.locator('text=Embeddings:')).toBeVisible();
    await expect(page.locator('text=Cache Size:')).toBeVisible();
    
    // Verify performance metrics
    await expect(page.locator('text=Operations:')).toBeVisible();
    await expect(page.locator('text=Session Time:')).toBeVisible();
    
    // Verify connection status
    await expect(page.locator('text=Status:')).toBeVisible();
    await expect(page.locator('text=Last Ping:')).toBeVisible();
    
    // Verify ZPT state
    await expect(page.locator('text=Zoom:')).toBeVisible();
    await expect(page.locator('text=Tilt:')).toBeVisible();
  });

  test('should handle session cache refresh', async ({ page }) => {
    // Click refresh button
    await page.getByRole('button', { name: '🔄' }).click();
    
    // Verify toast notification appears (using text content)
    await expect(page.locator('text=Session data refreshed')).toBeVisible();
    
    // Verify refresh button shows active state briefly
    await expect(page.getByRole('button', { name: '🔄' })).toHaveClass(/active/);
  });

  test('should track session time', async ({ page }) => {
    // Get initial session time
    const initialTime = await page.locator('text=Session Time:').locator('..').locator('span').last().textContent();
    
    // Wait a moment
    await page.waitForTimeout(2000);
    
    // Get updated session time
    const updatedTime = await page.locator('text=Session Time:').locator('..').locator('span').last().textContent();
    
    // Verify time has progressed (should be different)
    expect(updatedTime).not.toBe(initialTime);
  });
});

test.describe('Tell Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Ensure we're on the main semantic memory tab
    await page.getByRole('button', { name: '🧠 Semantic Memory' }).click();
  });

  test('should handle content input and enable store button', async ({ page }) => {
    const testContent = 'Machine learning is a subset of artificial intelligence.';
    
    // Initially store button should be disabled
    await expect(page.getByRole('button', { name: '💾 Store Content' })).toBeDisabled();
    
    // Enter content
    await page.getByRole('textbox', { name: 'Content' }).fill(testContent);
    
    // Store button should now be enabled
    await expect(page.getByRole('button', { name: '💾 Store Content' })).toBeEnabled();
    
    // Verify content is in the textbox
    await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue(testContent);
  });

  test('should handle type selection', async ({ page }) => {
    // Test type selector
    const typeSelect = page.getByRole('combobox', { name: 'Type' });
    
    // Default should be Concept
    await expect(typeSelect).toHaveValue('concept');
    
    // Change to Document
    await typeSelect.selectOption('document');
    await expect(typeSelect).toHaveValue('document');
    
    // Change to Interaction
    await typeSelect.selectOption('interaction');
    await expect(typeSelect).toHaveValue('interaction');
  });

  test('should show concept preview area', async ({ page }) => {
    await expect(page.locator('text=Concept Preview')).toBeVisible();
    await expect(page.locator('text=0 concepts')).toBeVisible();
    await expect(page.locator('text=Start typing to see extracted concepts...')).toBeVisible();
  });

  test('should handle tags input', async ({ page }) => {
    const testTags = 'machine-learning, AI, technology';
    
    await page.getByRole('textbox', { name: 'Tags' }).fill(testTags);
    await expect(page.getByRole('textbox', { name: 'Tags' })).toHaveValue(testTags);
  });
});

test.describe('Ask Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Ensure we're on the main semantic memory tab
    await page.getByRole('button', { name: '🧠 Semantic Memory' }).click();
  });

  test('should handle query input and enable search button', async ({ page }) => {
    const testQuery = 'What is machine learning?';
    
    // Initially search button should be disabled
    await expect(page.getByRole('button', { name: '🔍 Search Knowledge' })).toBeDisabled();
    
    // Enter query
    await page.getByRole('textbox', { name: 'Query' }).fill(testQuery);
    
    // Search button should now be enabled
    await expect(page.getByRole('button', { name: '🔍 Search Knowledge' })).toBeEnabled();
    
    // Verify query is in the textbox
    await expect(page.getByRole('textbox', { name: 'Query' })).toHaveValue(testQuery);
  });

  test('should display helpful placeholder text', async ({ page }) => {
    await expect(page.locator('text=Ask a question to search your semantic memory')).toBeVisible();
  });
});

test.describe('Navigate Component - ZPT Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Ensure we're on the main semantic memory tab
    await page.getByRole('button', { name: '🧠 Semantic Memory' }).click();
  });

  test('should handle zoom level selection', async ({ page }) => {
    // Test all zoom levels
    const zoomLevels = ['Entity', 'Unit', 'Text', 'Community', 'Corpus'];
    
    for (const level of zoomLevels) {
      await page.getByRole('button', { name: level, exact: true }).click();
      await expect(page.getByRole('button', { name: level, exact: true })).toHaveClass(/active/);
    }
  });

  test('should handle tilt view style selection', async ({ page }) => {
    // Test all tilt styles
    const tiltStyles = ['Keywords', 'Embedding', 'Graph', 'Temporal'];
    
    for (const style of tiltStyles) {
      await page.getByRole('button', { name: style }).click();
      await expect(page.getByRole('button', { name: style })).toHaveClass(/active/);
    }
  });

  test('should handle pan domain filters', async ({ page }) => {
    // Test domain filter input
    await page.getByRole('textbox', { name: 'Domains' }).fill('technology, science');
    await expect(page.getByRole('textbox', { name: 'Domains' })).toHaveValue('technology, science');
    
    // Test keywords filter input
    await page.getByRole('textbox', { name: 'Keywords' }).fill('machine learning, AI');
    await expect(page.getByRole('textbox', { name: 'Keywords' })).toHaveValue('machine learning, AI');
  });

  test('should display ZPT section headers', async ({ page }) => {
    await expect(page.locator('text=🔍')).toBeVisible();
    await expect(page.locator('text=Zoom')).toBeVisible();
    await expect(page.locator('text=Abstraction Level')).toBeVisible();
    
    await expect(page.locator('text=🎯')).toBeVisible();
    await expect(page.locator('text=Pan')).toBeVisible();
    await expect(page.locator('text=Domain Filters')).toBeVisible();
    
    await expect(page.locator('text=👁️')).toBeVisible();
    await expect(page.locator('text=Tilt')).toBeVisible();
    await expect(page.locator('text=View Style')).toBeVisible();
  });
});

test.describe('Settings Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Navigate to settings tab
    await page.getByRole('button', { name: '⚙️ Settings' }).click();
  });

  test('should load settings interface with all sections', async ({ page }) => {
    // Verify settings header
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    await expect(page.locator('text=Configure models, storage, and workbench preferences')).toBeVisible();
    
    // Verify all setting categories
    await expect(page.getByRole('button', { name: '🤖 Models' })).toBeVisible();
    await expect(page.getByRole('button', { name: '💾 Storage' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🔗 Endpoints' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🎨 Interface' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🧠 Memory' })).toBeVisible();
    await expect(page.getByRole('button', { name: '⚙️ Advanced' })).toBeVisible();
  });

  test('should handle model configuration', async ({ page }) => {
    // Verify chat model configuration
    await expect(page.locator('h4:has-text("Chat Model")')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Provider' }).first()).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Model' }).first()).toBeVisible();
    
    // Verify embedding model configuration  
    await expect(page.locator('h4:has-text("Embedding Model")')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Provider' }).last()).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Model' }).last()).toBeVisible();
    
    // Verify connection test buttons
    await expect(page.getByRole('button', { name: '🔍 Test Connection' })).toHaveCount(2);
  });

  test('should handle provider selection', async ({ page }) => {
    const chatProviderSelect = page.getByRole('combobox', { name: 'Provider' }).first();
    
    // Test provider options
    await expect(chatProviderSelect).toHaveValue('mistral');
    
    // Change to Ollama
    await chatProviderSelect.selectOption('ollama');
    await expect(chatProviderSelect).toHaveValue('ollama');
    
    // Change to Claude
    await chatProviderSelect.selectOption('claude');
    await expect(chatProviderSelect).toHaveValue('claude');
  });

  test('should show import/export controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: '📤 Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: '📥 Import' })).toBeVisible();
    await expect(page.getByRole('button', { name: '💾 Save Changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🔄 Reset' })).toBeVisible();
  });
});

test.describe('SPARQL Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Navigate to SPARQL browser
    await page.getByRole('button', { name: '🔧 SPARQL Browser' }).click();
  });

  test('should load SPARQL browser with fallback interface', async ({ page }) => {
    // Verify SPARQL browser loads
    await expect(page.locator('h2:has-text("SPARQL Browser")')).toBeVisible();
    await expect(page.locator('text=Basic mode - Atuin components not available')).toBeVisible();
    
    // Verify fallback message
    await expect(page.locator('h3:has-text("⚠️ Limited Functionality")')).toBeVisible();
    await expect(page.locator('text=The enhanced SPARQL browser with syntax highlighting requires the Atuin library')).toBeVisible();
    await expect(page.locator('code:has-text("npm install atuin evb")')).toBeVisible();
  });

  test('should load sample RDF content', async ({ page }) => {
    // Verify RDF editor section
    await expect(page.locator('h3:has-text("RDF Editor")')).toBeVisible();
    
    // Verify sample content is loaded
    const rdfEditor = page.locator('textarea[placeholder="Enter Turtle RDF content here..."]');
    await expect(rdfEditor).toBeVisible();
    
    const content = await rdfEditor.inputValue();
    expect(content).toContain('@prefix foaf:');
    expect(content).toContain('@prefix ex:');
    expect(content).toContain('ex:alice a foaf:Person');
    expect(content).toContain('ragno:Concept');
  });

  test('should provide SPARQL query interface', async ({ page }) => {
    // Verify SPARQL query section
    await expect(page.locator('h3:has-text("SPARQL Query")')).toBeVisible();
    
    // Verify query editor
    const sparqlEditor = page.locator('textarea[placeholder="Enter SPARQL query here..."]');
    await expect(sparqlEditor).toBeVisible();
    
    // Verify execute button
    await expect(page.getByRole('button', { name: 'Execute Query' })).toBeVisible();
  });

  test('should handle content editing', async ({ page }) => {
    const testRDF = '@prefix test: <http://test.org/> .\ntest:subject test:predicate test:object .';
    
    // Clear and enter new RDF content
    const rdfEditor = page.locator('textarea[placeholder="Enter Turtle RDF content here..."]');
    await rdfEditor.clear();
    await rdfEditor.fill(testRDF);
    
    // Verify content was entered
    await expect(rdfEditor).toHaveValue(testRDF);
    
    // Test SPARQL query input
    const testQuery = 'SELECT * WHERE { ?s ?p ?o }';
    const sparqlEditor = page.locator('textarea[placeholder="Enter SPARQL query here..."]');
    await sparqlEditor.fill(testQuery);
    
    // Verify query was entered
    await expect(sparqlEditor).toHaveValue(testQuery);
  });
});

test.describe('System Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Navigate to system monitor
    await page.getByRole('button', { name: '📊 System Monitor' }).click();
  });

  test('should load system monitor interface', async ({ page }) => {
    await expect(page.locator('h2:has-text("System Monitor")')).toBeVisible();
    
    // Verify performance metrics section
    await expect(page.locator('h3:has-text("Performance Metrics")')).toBeVisible();
    
    // Verify system health section
    await expect(page.locator('h3:has-text("System Health")')).toBeVisible();
  });

  test('should show loading states initially', async ({ page }) => {
    // Both sections should show loading initially
    await expect(page.locator('text=Loading...')).toHaveCount(2);
  });
});

test.describe('Application State and Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test Ctrl+1 for main tab
    await page.keyboard.press('Control+1');
    await expect(page.getByRole('button', { name: '🧠 Semantic Memory' })).toHaveClass(/active/);
    
    // Test Ctrl+2 for monitor tab
    await page.keyboard.press('Control+2');
    await expect(page.getByRole('button', { name: '📊 System Monitor' })).toHaveClass(/active/);
    
    // Test Ctrl+3 for settings tab
    await page.keyboard.press('Control+3');
    await expect(page.getByRole('button', { name: '⚙️ Settings' })).toHaveClass(/active/);
    
    // Test Ctrl+4 for SPARQL tab
    await page.keyboard.press('Control+4');
    await expect(page.getByRole('button', { name: '🔧 SPARQL Browser' })).toHaveClass(/active/);
  });

  test('should persist state across tab switches', async ({ page }) => {
    // Enter content in Tell component
    await page.getByRole('button', { name: '🧠 Semantic Memory' }).click();
    const testContent = 'Test content for persistence';
    await page.getByRole('textbox', { name: 'Content' }).fill(testContent);
    
    // Switch to different tab
    await page.getByRole('button', { name: '⚙️ Settings' }).click();
    
    // Switch back to main tab
    await page.getByRole('button', { name: '🧠 Semantic Memory' }).click();
    
    // Verify content is still there
    await expect(page.getByRole('textbox', { name: 'Content' })).toHaveValue(testContent);
  });

  test('should show appropriate toast notifications', async ({ page }) => {
    // Test success notification from initialization
    await expect(page.locator('text=Semantic Memory Workbench loaded successfully')).toBeVisible();
    
    // Test refresh notification
    await page.getByRole('button', { name: '🔄' }).click();
    await expect(page.locator('text=Session data refreshed')).toBeVisible();
  });

  test('should handle connection status properly', async ({ page }) => {
    // Verify connection status shows disconnected (expected when server not running)
    await expect(page.locator('text=Status:')).toBeVisible();
    await expect(page.locator('text=Disconnected')).toBeVisible();
    
    // Verify last ping time is displayed
    await expect(page.locator('text=Last Ping:')).toBeVisible();
    
    // Verify server status
    await expect(page.locator('text=Server:')).toBeVisible();
    await expect(page.locator('text=Unknown')).toBeVisible();
  });
});

test.describe('Error Handling and Resilience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should handle missing Atuin components gracefully', async ({ page }) => {
    await page.getByRole('button', { name: '🔧 SPARQL Browser' }).click();
    
    // Should show fallback interface instead of crashing
    await expect(page.locator('text=Basic mode - Atuin components not available')).toBeVisible();
    await expect(page.locator('text=⚠️ Limited Functionality')).toBeVisible();
  });

  test('should handle server disconnection gracefully', async ({ page }) => {
    // Connection status should show disconnected state
    await expect(page.locator('text=Disconnected')).toBeVisible();
    
    // UI should still be functional
    await expect(page.getByRole('button', { name: '🧠 Semantic Memory' })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Content' })).toBeEnabled();
  });

  test('should show console error messages appropriately', async ({ page }) => {
    // Get console messages
    const messages = await page.evaluate(() => {
      return window.__semem_console_messages || [];
    });
    
    // Should have logged initialization without fatal errors
    expect(messages.some(msg => msg.includes('Workbench initialized successfully'))).toBeTruthy();
  });
});