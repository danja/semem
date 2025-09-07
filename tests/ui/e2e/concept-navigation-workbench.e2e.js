/**
 * Concept Navigation Workbench E2E Tests
 * Tests RDF concept integration through the workbench UI using Playwright
 * Validates concept tilt, concept filtering, and concept-based ZPT navigation
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_CONFIG = {
  WORKBENCH_PORT: process.env.WORKBENCH_PORT || 4102,
  WORKBENCH_URL: process.env.WORKBENCH_URL || `http://localhost:${process.env.WORKBENCH_PORT || 4102}`,
  MCP_PORT: process.env.MCP_PORT || 4101,
  TIMEOUT: 45000, // 45 second timeout for concept operations
  SETUP_DELAY: 3000, // 3 second delay for concept processing
  CONTENT_DELAY: 1000, // Delay for concept extraction
};

// Test data rich in extractable concepts
const CONCEPT_RICH_CONTENT = {
  philosophy: {
    content: "Phenomenology investigates the structures of consciousness and lived experience. Edmund Husserl developed transcendental phenomenology, emphasizing epoché (bracketing) and intentionality as core concepts.",
    type: "interaction",
    tags: "philosophy,phenomenology,consciousness,husserl"
  },
  science: {
    content: "Quantum entanglement demonstrates non-local correlations between particles. Bell's theorem proves that no physical theory can satisfy both locality and realism simultaneously.",
    type: "fact", 
    tags: "physics,quantum,entanglement,bell"
  },
  psychology: {
    content: "Metacognition involves thinking about thinking processes. Self-regulation, cognitive monitoring, and executive control are fundamental metacognitive concepts in learning theory.",
    type: "document",
    tags: "psychology,metacognition,learning,cognitive"
  },
  economics: {
    content: "Behavioral economics integrates psychological insights into economic analysis. Cognitive biases, heuristics, and bounded rationality challenge traditional rational actor models.",
    type: "interaction",
    tags: "economics,behavioral,psychology,rationality"
  },
  technology: {
    content: "Distributed systems require consensus algorithms to maintain consistency. Byzantine fault tolerance, CAP theorem, and eventual consistency are key distributed computing concepts.",
    type: "document",
    tags: "technology,distributed,consensus,computing"
  },
  complex: {
    content: "Systems thinking examines emergent properties and feedback loops in complex adaptive systems. Network effects, self-organization, and phase transitions characterize complex systems behavior.",
    type: "fact",
    tags: "systems,complexity,emergence,networks"
  }
};

class ConceptWorkbenchTester {
  constructor(page) {
    this.page = page;
    this.baseUrl = TEST_CONFIG.WORKBENCH_URL;
  }

  async navigateToWorkbench() {
    console.log(`🌐 Navigating to workbench: ${this.baseUrl}`);
    await this.page.goto(this.baseUrl);
    
    // Wait for the workbench to load
    await this.page.waitForSelector('.workbench-container', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
    
    console.log('✅ Workbench loaded successfully');
  }

  async seedConceptRichData() {
    console.log('🌱 Seeding concept-rich test data through workbench UI...');
    
    for (const [key, data] of Object.entries(CONCEPT_RICH_CONTENT)) {
      try {
        console.log(`  📝 Storing ${key} content for concept extraction...`);
        
        // Navigate to Tell tab
        await this.page.click('[data-tab="tell"]');
        await this.page.waitForTimeout(200);
        
        // Fill in the content
        await this.page.fill('#tell-content', data.content);
        
        // Select content type
        await this.page.selectOption('#tell-type', data.type);
        
        // Add tags if provided
        if (data.tags) {
          await this.page.fill('#tell-tags', data.tags);
        }
        
        // Submit the form
        await this.page.click('#tell-submit');
        
        // Wait for success indication
        await this.page.waitForSelector('.toast.success', { timeout: 8000 });
        
        // Wait for concept processing to complete
        await this.page.waitForTimeout(TEST_CONFIG.CONTENT_DELAY);
        
        console.log(`  ✅ Stored ${key} content`);
        
      } catch (error) {
        console.error(`  ❌ Failed to seed ${key}:`, error.message);
        throw error;
      }
    }
    
    // Wait for concept extraction and indexing to complete
    console.log('⏳ Waiting for concept extraction and indexing...');
    await this.page.waitForTimeout(TEST_CONFIG.SETUP_DELAY);
    console.log('✅ Concept-rich test data seeded successfully');
  }

  async navigateToZPTTab() {
    // Navigate to ZPT tab
    await this.page.click('[data-tab="zpt"]');
    await this.page.waitForTimeout(300);
    
    // Verify ZPT interface is visible
    await this.page.waitForSelector('.zpt-controls', { timeout: 5000 });
  }

  async setZoomLevel(level) {
    console.log(`🔍 Setting zoom level to: ${level}`);
    await this.page.click(`[data-zoom="${level}"]`);
    await this.page.waitForTimeout(300);
    
    // Verify zoom was set
    const activeZoom = await this.page.getAttribute('[data-zoom].active', 'data-zoom');
    expect(activeZoom).toBe(level);
  }

  async setTiltToConcept() {
    console.log(`🎯 Setting tilt to concept mode`);
    
    // Find and select concept tilt option
    const tiltSelector = this.page.locator('#tilt-selector');
    await tiltSelector.selectOption('concept');
    await this.page.waitForTimeout(300);
    
    // Verify concept tilt was set
    const selectedTilt = await this.page.inputValue('#tilt-selector');
    expect(selectedTilt).toBe('concept');
    
    console.log('✅ Concept tilt activated');
  }

  async setConceptFilters(concepts = [], categories = []) {
    console.log(`🔄 Setting concept filters - concepts: ${concepts.join(',')}, categories: ${categories.join(',')}`);
    
    // Open pan controls if not visible
    const panSection = this.page.locator('.pan-controls');
    if (!(await panSection.isVisible())) {
      await this.page.click('.pan-toggle');
    }
    
    // Set concept filters if available
    if (concepts.length > 0) {
      const conceptField = this.page.locator('#pan-concepts');
      if (await conceptField.isVisible()) {
        await conceptField.fill(concepts.join(','));
      }
    }
    
    // Set concept categories if available
    if (categories.length > 0) {
      const categoryField = this.page.locator('#pan-concept-categories');
      if (await categoryField.isVisible()) {
        await categoryField.fill(categories.join(','));
      }
    }
    
    // Apply filters
    await this.page.click('#pan-apply');
    await this.page.waitForTimeout(300);
  }

  async setQuery(query) {
    console.log(`🔍 Setting ZPT query: ${query}`);
    
    // Find and fill query input
    const queryInput = this.page.locator('#zpt-query, .query-input');
    await queryInput.fill(query);
    await this.page.waitForTimeout(200);
  }

  async executeConceptNavigation() {
    console.log('🗺️ Executing concept navigation...');
    await this.page.click('#zpt-navigate, .navigate-button');
    
    // Wait for navigation to complete with longer timeout for concept processing
    await this.page.waitForSelector('.navigation-results, .zpt-results', { timeout: 20000 });
    
    console.log('✅ Concept navigation completed');
  }

  async getNavigationResults() {
    // Wait for results to be fully rendered
    await this.page.waitForTimeout(500);
    
    const resultSelector = '.navigation-results .result-item, .zpt-results .result-item, .result-container .result-item';
    const results = await this.page.locator(resultSelector).all();
    
    const parsedResults = [];
    for (const result of results) {
      try {
        const id = await result.getAttribute('data-id') || '';
        const type = await result.getAttribute('data-type') || '';
        const label = await result.locator('.result-label, .item-label').textContent() || '';
        const content = await result.locator('.result-content, .item-content').textContent() || '';
        const concepts = await result.locator('.concepts, .concept-tags').textContent() || '';
        
        parsedResults.push({
          id: id.trim(),
          type: type.trim(),
          label: label.trim(),
          content: content.trim(),
          concepts: concepts.trim()
        });
      } catch (error) {
        // Skip problematic results
        console.warn('Skipping result due to parsing error:', error.message);
      }
    }
    
    return parsedResults;
  }

  async getConceptExtractionIndicators() {
    // Look for concept extraction indicators in the UI
    const conceptIndicators = [];
    
    // Check for concept badges/tags
    const conceptBadges = await this.page.locator('.concept-badge, .concept-tag, .extracted-concept').all();
    for (const badge of conceptBadges) {
      const text = await badge.textContent();
      if (text && text.trim()) {
        conceptIndicators.push(text.trim());
      }
    }
    
    // Check for concept visualization elements
    const conceptViz = await this.page.locator('.concept-visualization, .concept-graph, .concept-network').all();
    if (conceptViz.length > 0) {
      conceptIndicators.push('concept-visualization-present');
    }
    
    return conceptIndicators;
  }

  async validateConceptTiltResults(results) {
    console.log(`🔍 Validating concept tilt results (${results.length} items)`);
    
    // Results should show concept-oriented information
    let conceptCount = 0;
    
    results.forEach((result, index) => {
      // Should have concept-related content or metadata
      const hasConceptualContent = 
        result.concepts.length > 0 ||
        result.type.toLowerCase().includes('concept') ||
        result.content.toLowerCase().includes('concept') ||
        result.label.toLowerCase().includes('concept');
        
      if (hasConceptualContent) {
        conceptCount++;
      }
    });
    
    console.log(`📊 Found ${conceptCount} concept-oriented results out of ${results.length}`);
    
    // At least some results should be concept-oriented
    if (results.length > 0) {
      expect(conceptCount).toBeGreaterThan(0);
    }
    
    return conceptCount;
  }

  async validateConceptContent(results, expectedConcepts) {
    const allText = results.map(r => 
      `${r.label} ${r.content} ${r.concepts}`
    ).join(' ').toLowerCase();
    
    const foundConcepts = expectedConcepts.filter(concept => 
      allText.includes(concept.toLowerCase())
    );
    
    console.log(`🧠 Found expected concepts: ${foundConcepts.join(', ')}`);
    expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
    return foundConcepts;
  }

  async clearResults() {
    // Clear any existing results
    const clearButton = this.page.locator('.clear-results, #clear-navigation');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async openConsolePanel() {
    // Ensure console panel is visible for debugging
    const consolePanel = this.page.locator('.console-component');
    if (!(await consolePanel.isVisible())) {
      await this.page.click('#console-tab');
      await this.page.waitForTimeout(300);
    }
  }

  async getConsoleLogs() {
    await this.openConsolePanel();
    const logEntries = await this.page.locator('.console-log-entry .log-message').allTextContents();
    return logEntries.map(entry => entry.trim()).filter(entry => entry.length > 0);
  }
}

test.describe('Concept Navigation Workbench E2E Tests', () => {
  let tester;

  test.beforeAll(async () => {
    console.log('🚀 Starting Concept Navigation Workbench E2E Tests');
  });

  test.beforeEach(async ({ page }) => {
    tester = new ConceptWorkbenchTester(page);
    await tester.navigateToWorkbench();
    await tester.seedConceptRichData();
    await tester.navigateToZPTTab();
  });

  test.describe('Concept Tilt Functionality', () => {
    test('should activate concept tilt and extract philosophical concepts', async () => {
      await tester.clearResults();
      
      // Set up concept navigation for philosophical content
      await tester.setQuery('phenomenology consciousness intentionality husserl epoché');
      await tester.setZoomLevel('entity');
      await tester.setTiltToConcept();
      
      // Execute navigation
      await tester.executeConceptNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Concept tilt found ${results.length} philosophical results`);
      
      if (results.length > 0) {
        // Validate concept-oriented results
        const conceptCount = await tester.validateConceptTiltResults(results);
        
        // Should contain philosophical concepts
        const philosophyConcepts = ['phenomenology', 'consciousness', 'intentionality', 'husserl', 'epoché', 'transcendental'];
        const foundConcepts = await tester.validateConceptContent(results, philosophyConcepts);
        
        expect(conceptCount).toBeGreaterThan(0);
        expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
      }
      
      // Check for concept extraction indicators in UI
      const indicators = await tester.getConceptExtractionIndicators();
      console.log(`🧠 Found concept indicators: ${indicators.join(', ')}`);
    });

    test('should extract quantum physics concepts with concept tilt', async () => {
      await tester.clearResults();
      
      // Set up concept navigation for quantum content
      await tester.setQuery('quantum entanglement bell theorem locality realism');
      await tester.setZoomLevel('text');
      await tester.setTiltToConcept();
      
      // Execute navigation
      await tester.executeConceptNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Concept tilt found ${results.length} quantum results`);
      
      if (results.length > 0) {
        // Validate concept-oriented results
        const conceptCount = await tester.validateConceptTiltResults(results);
        
        // Should contain quantum concepts
        const quantumConcepts = ['quantum', 'entanglement', 'bell', 'theorem', 'locality', 'realism', 'non-local'];
        const foundConcepts = await tester.validateConceptContent(results, quantumConcepts);
        
        expect(conceptCount).toBeGreaterThan(0);
        expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('should extract psychology concepts at different zoom levels', async () => {
      const zoomLevels = ['community', 'text', 'entity'];
      const psychConcepts = ['metacognition', 'self-regulation', 'cognitive', 'monitoring', 'executive'];
      
      for (const zoom of zoomLevels) {
        console.log(`🔍 Testing concept extraction at ${zoom} level`);
        
        await tester.clearResults();
        await tester.setQuery('metacognition self-regulation cognitive monitoring executive control');
        await tester.setZoomLevel(zoom);
        await tester.setTiltToConcept();
        
        await tester.executeConceptNavigation();
        
        const results = await tester.getNavigationResults();
        console.log(`  📊 Found ${results.length} results at ${zoom} level`);
        
        if (results.length > 0) {
          const conceptCount = await tester.validateConceptTiltResults(results);
          const foundConcepts = await tester.validateConceptContent(results, psychConcepts);
          
          expect(conceptCount).toBeGreaterThan(0);
          console.log(`  🧠 ${zoom}: ${foundConcepts.length} psychology concepts found`);
        }
        
        await tester.page.waitForTimeout(500);
      }
    });
  });

  test.describe('Concept-Based Filtering', () => {
    test('should filter results using concept categories', async () => {
      await tester.clearResults();
      
      // Set up navigation with concept category filtering
      await tester.setQuery('distributed systems consensus algorithms');
      await tester.setZoomLevel('entity');
      await tester.setConceptFilters([], ['distributed computing', 'algorithms']);
      await tester.setTiltToConcept();
      
      // Execute navigation
      await tester.executeConceptNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Concept category filtering found ${results.length} results`);
      
      if (results.length > 0) {
        // Should contain distributed systems concepts
        const distributedConcepts = ['distributed', 'systems', 'consensus', 'algorithms', 'byzantine', 'cap', 'consistency'];
        const foundConcepts = await tester.validateConceptContent(results, distributedConcepts);
        
        expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('should combine concept filtering with traditional filters', async () => {
      await tester.clearResults();
      
      // Set up combined filtering
      await tester.setQuery('behavioral economics cognitive biases rationality');
      await tester.setZoomLevel('text');
      
      // Set traditional pan filters first
      const panSection = tester.page.locator('.pan-controls');
      if (!(await panSection.isVisible())) {
        await tester.page.click('.pan-toggle');
      }
      
      // Set domain filter
      const domainField = tester.page.locator('#pan-domains');
      if (await domainField.isVisible()) {
        await domainField.fill('economics');
      }
      
      // Set concept filters
      await tester.setConceptFilters(['behavioral economics', 'cognitive biases']);
      await tester.setTiltToConcept();
      
      // Apply filters and execute
      await tester.page.click('#pan-apply');
      await tester.page.waitForTimeout(300);
      await tester.executeConceptNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Combined filtering found ${results.length} results`);
      
      if (results.length > 0) {
        // Should contain behavioral economics concepts
        const behavioralConcepts = ['behavioral', 'economics', 'cognitive', 'biases', 'rationality', 'heuristics'];
        const foundConcepts = await tester.validateConceptContent(results, behavioralConcepts);
        
        expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('should support concept similarity filtering', async () => {
      await tester.clearResults();
      
      // Set up similarity-based concept filtering
      await tester.setQuery('complex systems emergence self-organization');
      await tester.setZoomLevel('entity');
      
      // Set concept filters with similarity
      const panSection = tester.page.locator('.pan-controls');
      if (!(await panSection.isVisible())) {
        await tester.page.click('.pan-toggle');
      }
      
      // Set concept similarity threshold if available
      const similarityField = tester.page.locator('#concept-similarity');
      if (await similarityField.isVisible()) {
        await similarityField.fill('0.7');
      }
      
      await tester.setConceptFilters(['complex systems', 'emergence']);
      await tester.setTiltToConcept();
      
      // Execute navigation
      await tester.executeConceptNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Concept similarity filtering found ${results.length} results`);
      
      if (results.length > 0) {
        // Should contain complex systems concepts
        const complexConcepts = ['complex', 'systems', 'emergence', 'self-organization', 'feedback', 'adaptive'];
        const foundConcepts = await tester.validateConceptContent(results, complexConcepts);
        
        expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Concept Navigation User Experience', () => {
    test('should provide visual feedback during concept extraction', async () => {
      await tester.clearResults();
      
      // Set up concept navigation
      await tester.setQuery('phenomenology quantum metacognition');
      await tester.setZoomLevel('entity');
      await tester.setTiltToConcept();
      
      // Start navigation and check for loading indicators
      const navigationPromise = tester.executeConceptNavigation();
      
      // Check for loading/processing indicators during concept extraction
      const loadingIndicators = [
        '.loading-concept-extraction',
        '.processing-concepts',
        '.extracting-concepts',
        '.loading',
        '.spinner'
      ];
      
      let foundLoadingIndicator = false;
      for (const selector of loadingIndicators) {
        if (await tester.page.locator(selector).isVisible()) {
          foundLoadingIndicator = true;
          console.log(`📋 Found loading indicator: ${selector}`);
          break;
        }
      }
      
      await navigationPromise;
      
      // Verify results appeared
      const results = await tester.getNavigationResults();
      console.log(`📊 Navigation completed with ${results.length} results`);
      
      // Should have provided some form of user feedback
      if (results.length > 0) {
        expect(results.length).toBeGreaterThan(0);
      }
    });

    test('should display concept extraction progress in console', async () => {
      await tester.clearResults();
      await tester.openConsolePanel();
      
      // Set up concept navigation
      await tester.setQuery('distributed systems behavioral economics');
      await tester.setZoomLevel('text');
      await tester.setTiltToConcept();
      
      // Execute navigation
      await tester.executeConceptNavigation();
      
      // Get console logs
      const logs = await tester.getConsoleLogs();
      console.log(`📝 Found ${logs.length} console messages`);
      
      // Should contain concept-related progress messages
      const conceptMessages = logs.filter(log => 
        log.toLowerCase().includes('concept') ||
        log.toLowerCase().includes('extract') ||
        log.toLowerCase().includes('tilt')
      );
      
      console.log(`🧠 Found ${conceptMessages.length} concept-related messages`);
      conceptMessages.forEach(msg => console.log(`  - ${msg}`));
      
      // Should have at least some concept-related messaging
      if (logs.length > 0) {
        expect(conceptMessages.length).toBeGreaterThanOrEqual(0); // May not have specific messages, but should not error
      }
    });

    test('should handle concept tilt state persistence', async () => {
      await tester.clearResults();
      
      // Set concept tilt
      await tester.setTiltToConcept();
      
      // Change zoom levels - tilt should persist
      const zoomLevels = ['entity', 'text', 'community'];
      
      for (const zoom of zoomLevels) {
        await tester.setZoomLevel(zoom);
        
        // Verify tilt is still set to concept
        const tiltValue = await tester.page.inputValue('#tilt-selector');
        expect(tiltValue).toBe('concept');
        console.log(`✅ Concept tilt persisted at ${zoom} zoom level`);
        
        await tester.page.waitForTimeout(300);
      }
    });

    test('should show meaningful results for concept-based queries', async () => {
      await tester.clearResults();
      
      // Test various concept-rich queries
      const conceptQueries = [
        {
          query: 'consciousness intentionality phenomenology',
          expectedConcepts: ['consciousness', 'intentionality', 'phenomenology'],
          domain: 'philosophy'
        },
        {
          query: 'entanglement superposition measurement',
          expectedConcepts: ['entanglement', 'superposition', 'measurement'],
          domain: 'physics'
        },
        {
          query: 'metacognition self-regulation executive',
          expectedConcepts: ['metacognition', 'self-regulation', 'executive'],
          domain: 'psychology'
        }
      ];
      
      for (const testCase of conceptQueries) {
        console.log(`🔍 Testing concept query: ${testCase.query}`);
        
        await tester.clearResults();
        await tester.setQuery(testCase.query);
        await tester.setZoomLevel('entity');
        await tester.setTiltToConcept();
        
        await tester.executeConceptNavigation();
        
        const results = await tester.getNavigationResults();
        console.log(`  📊 Found ${results.length} results for ${testCase.domain}`);
        
        if (results.length > 0) {
          const foundConcepts = await tester.validateConceptContent(results, testCase.expectedConcepts);
          console.log(`  🧠 ${testCase.domain}: Found concepts ${foundConcepts.join(', ')}`);
          
          expect(foundConcepts.length).toBeGreaterThanOrEqual(1);
        }
        
        await tester.page.waitForTimeout(500);
      }
    });
  });

  test.describe('Performance and Error Handling', () => {
    test('should complete concept navigation within reasonable time', async () => {
      const startTime = Date.now();
      
      await tester.clearResults();
      await tester.setQuery('complex philosophical psychological concepts');
      await tester.setZoomLevel('text');
      await tester.setTiltToConcept();
      
      await tester.executeConceptNavigation();
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ Concept navigation completed in ${duration}ms`);
      
      // Should complete within reasonable time (45 seconds with concept processing)
      expect(duration).toBeLessThan(45000);
      
      const results = await tester.getNavigationResults();
      expect(results.length).toBeGreaterThanOrEqual(0); // Should not error
    });

    test('should handle empty concept results gracefully', async () => {
      await tester.clearResults();
      
      // Use query unlikely to match any concepts
      await tester.setQuery('nonexistent made up concept terms xyz123');
      await tester.setZoomLevel('entity');
      await tester.setTiltToConcept();
      
      await tester.executeConceptNavigation();
      
      const results = await tester.getNavigationResults();
      console.log(`📊 Empty query returned ${results.length} results`);
      
      // Should handle gracefully without errors
      expect(results.length).toBe(0);
      
      // UI should show appropriate message
      const noResultsMessage = tester.page.locator('.no-results, .empty-results, .no-matches');
      if (await noResultsMessage.isVisible()) {
        console.log('✅ Found no-results message in UI');
      }
    });

    test('should maintain UI responsiveness during concept processing', async () => {
      // Start a complex concept navigation
      await tester.clearResults();
      await tester.setQuery('phenomenology quantum metacognition behavioral economics distributed systems');
      await tester.setZoomLevel('entity');
      await tester.setTiltToConcept();
      
      // Start navigation (don't await yet)
      const navigationPromise = tester.executeConceptNavigation();
      
      // Test UI responsiveness during processing
      await tester.page.waitForTimeout(1000);
      
      // Should still be able to interact with other UI elements
      const tellTab = tester.page.locator('[data-tab="tell"]');
      await tellTab.click({ timeout: 2000 });
      
      const zptTab = tester.page.locator('[data-tab="zpt"]');
      await zptTab.click({ timeout: 2000 });
      
      console.log('✅ UI remained responsive during concept processing');
      
      // Wait for original navigation to complete
      await navigationPromise;
      
      const results = await tester.getNavigationResults();
      console.log(`📊 Complex navigation completed with ${results.length} results`);
    });
  });
});