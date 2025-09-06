/**
 * ZPT Workbench End-to-End Tests
 * Tests ZPT navigation functionality through the workbench UI using Playwright
 * Based on exercises in docs/manual/zpt-exercises.md
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
  TIMEOUT: 30000, // 30 second timeout for e2e tests
  SETUP_DELAY: 2000, // 2 second delay for UI operations
  CONTENT_DELAY: 500, // Delay for content to appear
};

// Test data for seeding through the workbench UI
const TEST_CONTENT = {
  molecular: {
    content: "The mitochondria produces ATP through cellular respiration. DNA contains adenine, thymine, guanine, and cytosine bases.",
    type: "fact",
    tags: "biology,molecular,cellular"
  },
  entities: {
    content: "Albert Einstein developed the theory of relativity at Princeton University in 1915. Marie Curie won Nobel Prizes in Physics and Chemistry.",
    type: "fact", 
    tags: "physics,history,scientists"
  },
  concepts: {
    content: "Democracy requires citizen participation and transparent governance. Education empowers individuals and strengthens society.",
    type: "idea",
    tags: "politics,education,society"
  },
  science: {
    content: "NASA launched the James Webb Space Telescope to study distant galaxies. The telescope uses infrared technology to peer through cosmic dust.",
    type: "fact",
    tags: "space,astronomy,technology"
  },
  history: {
    content: "The Renaissance began in Italy during the 14th century and spread across Europe by the 16th century. Artists like Leonardo da Vinci revolutionized art and science.",
    type: "fact",
    tags: "history,art,renaissance"
  },
  technology: {
    content: "Artificial intelligence and machine learning are transforming industries. Neural networks can process vast amounts of data to identify patterns.",
    type: "concept", 
    tags: "ai,technology,computing"
  }
};

class WorkbenchZPTTester {
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

  async seedTestData() {
    console.log('🌱 Seeding test data through workbench UI...');
    
    for (const [key, data] of Object.entries(TEST_CONTENT)) {
      try {
        console.log(`  📝 Storing ${key} content...`);
        
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
        await this.page.waitForSelector('.toast.success', { timeout: 5000 });
        
        // Wait for processing to complete
        await this.page.waitForTimeout(TEST_CONFIG.CONTENT_DELAY);
        
        console.log(`  ✅ Stored ${key} content`);
        
      } catch (error) {
        console.error(`  ❌ Failed to seed ${key}:`, error.message);
        throw error;
      }
    }
    
    // Wait for indexing to complete
    console.log('⏳ Waiting for content indexing...');
    await this.page.waitForTimeout(TEST_CONFIG.SETUP_DELAY);
    console.log('✅ Test data seeded successfully');
  }

  async setZoomLevel(level) {
    console.log(`🔍 Setting zoom level to: ${level}`);
    await this.page.click(`[data-zoom="${level}"]`);
    await this.page.waitForTimeout(300);
    
    // Verify zoom was set
    const activeZoom = await this.page.getAttribute('[data-zoom].active', 'data-zoom');
    expect(activeZoom).toBe(level);
    
    // Check console for zoom change message
    const consoleMessages = await this.getConsoleMessages();
    const zoomMessage = consoleMessages.find(msg => 
      msg.includes('Zoom level changed') && msg.includes(level)
    );
    expect(zoomMessage).toBeTruthy();
  }

  async setPanFilters(domains = [], keywords = []) {
    console.log(`🔄 Setting pan filters - domains: ${domains.join(',')}, keywords: ${keywords.join(',')}`);
    
    // Open pan controls if not visible
    const panSection = this.page.locator('.pan-controls');
    if (!(await panSection.isVisible())) {
      await this.page.click('.pan-toggle');
    }
    
    // Set domain filters
    if (domains.length > 0) {
      await this.page.fill('#pan-domains', domains.join(','));
    }
    
    // Set keyword filters  
    if (keywords.length > 0) {
      await this.page.fill('#pan-keywords', keywords.join(','));
    }
    
    // Apply filters
    await this.page.click('#pan-apply');
    await this.page.waitForTimeout(300);
    
    // Check console for pan change message
    const consoleMessages = await this.getConsoleMessages();
    const panMessage = consoleMessages.find(msg => 
      msg.includes('Pan filters updated')
    );
    expect(panMessage).toBeTruthy();
  }

  async setTilt(perspective) {
    console.log(`🎯 Setting tilt to: ${perspective}`);
    await this.page.selectOption('#tilt-selector', perspective);
    await this.page.waitForTimeout(300);
    
    // Verify tilt was set
    const selectedTilt = await this.page.inputValue('#tilt-selector');
    expect(selectedTilt).toBe(perspective);
    
    // Check console for tilt change message
    const consoleMessages = await this.getConsoleMessages();
    const tiltMessage = consoleMessages.find(msg => 
      msg.includes('Tilt view changed') && msg.includes(perspective)
    );
    expect(tiltMessage).toBeTruthy();
  }

  async executeNavigation() {
    console.log('🗺️ Executing ZPT navigation...');
    await this.page.click('#zpt-navigate');
    
    // Wait for navigation to complete
    await this.page.waitForSelector('.navigation-results', { timeout: 10000 });
    
    // Check console for navigation completion
    const consoleMessages = await this.getConsoleMessages();
    const navMessage = consoleMessages.find(msg => 
      msg.includes('Navigation completed')
    );
    expect(navMessage).toBeTruthy();
    
    console.log('✅ Navigation completed');
  }

  async getNavigationResults() {
    const results = await this.page.locator('.navigation-results .result-item').all();
    
    const parsedResults = [];
    for (const result of results) {
      const id = await result.getAttribute('data-id');
      const type = await result.getAttribute('data-type');
      const label = await result.locator('.result-label').textContent();
      const content = await result.locator('.result-content').textContent();
      
      parsedResults.push({
        id,
        type,
        label: label?.trim(),
        content: content?.trim()
      });
    }
    
    return parsedResults;
  }

  async getConsoleMessages() {
    // Get console log entries from the Console panel
    const consoleEntries = await this.page.locator('.console-log-entry .log-message').allTextContents();
    return consoleEntries.map(entry => entry.trim()).filter(entry => entry.length > 0);
  }

  async openConsolePanel() {
    // Ensure console panel is visible
    const consolePanel = this.page.locator('.console-component');
    if (!(await consolePanel.isVisible())) {
      await this.page.click('#console-tab');
      await this.page.waitForTimeout(300);
    }
  }

  async clearConsole() {
    await this.openConsolePanel();
    await this.page.click('.console-clear');
    await this.page.waitForTimeout(200);
  }

  async validateZPTState(expectedZoom, expectedPan = {}, expectedTilt = null) {
    // Validate zoom state
    const activeZoom = await this.page.getAttribute('[data-zoom].active', 'data-zoom');
    expect(activeZoom).toBe(expectedZoom);
    
    // Validate pan state if specified
    if (expectedPan.domains) {
      const domains = await this.page.inputValue('#pan-domains');
      expect(domains.split(',').map(d => d.trim())).toEqual(expectedPan.domains);
    }
    
    if (expectedPan.keywords) {
      const keywords = await this.page.inputValue('#pan-keywords');
      expect(keywords.split(',').map(k => k.trim())).toEqual(expectedPan.keywords);
    }
    
    // Validate tilt state if specified
    if (expectedTilt) {
      const tilt = await this.page.inputValue('#tilt-selector');
      expect(tilt).toBe(expectedTilt);
    }
  }

  validateResultType(results, expectedType) {
    results.forEach(result => {
      expect(result.type).toMatch(new RegExp(expectedType, 'i'));
    });
  }

  validateResultContent(results, expectedTerms) {
    const allText = results.map(r => `${r.label} ${r.content}`).join(' ').toLowerCase();
    
    const foundTerms = expectedTerms.filter(term => 
      allText.includes(term.toLowerCase())
    );
    
    expect(foundTerms.length).toBeGreaterThanOrEqual(1);
    return foundTerms;
  }
}

test.describe('ZPT Workbench E2E Tests', () => {
  let tester;

  test.beforeAll(async () => {
    console.log('🚀 Starting ZPT Workbench E2E Tests');
  });

  test.beforeEach(async ({ page }) => {
    tester = new WorkbenchZPTTester(page);
    await tester.navigateToWorkbench();
    await tester.seedTestData();
    await tester.openConsolePanel();
  });

  test.describe('Exercise Set 1: Basic Zoom Navigation', () => {
    test('Exercise 1.1: Molecular Level Detail', async () => {
      await tester.clearConsole();
      
      // Set zoom to molecular level
      await tester.setZoomLevel('molecular');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} molecular-level results`);
      
      // Should contain specific molecular terms
      if (results.length > 0) {
        const molecularTerms = ['ATP', 'adenine', 'thymine', 'guanine', 'cytosine', 'mitochondria'];
        const foundTerms = tester.validateResultContent(results, molecularTerms);
        console.log(`🧬 Found molecular terms: ${foundTerms.join(', ')}`);
        
        // Validate result types are molecular/detailed
        tester.validateResultType(results, 'molecular|fact|data');
      }
      
      // Validate final state
      await tester.validateZPTState('molecular');
    });

    test('Exercise 1.2: Entity Level Navigation', async () => {
      await tester.clearConsole();
      
      // Set zoom to entity level
      await tester.setZoomLevel('entity');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} entity-level results`);
      
      // Should contain named entities
      if (results.length > 0) {
        const entities = ['Einstein', 'Princeton', 'Curie', 'Nobel', 'NASA', 'Webb'];
        const foundEntities = tester.validateResultContent(results, entities);
        console.log(`👤 Found entities: ${foundEntities.join(', ')}`);
        
        // Validate result types are entities
        tester.validateResultType(results, 'entity|person|place|organization');
      }
      
      // Validate final state
      await tester.validateZPTState('entity');
    });

    test('Exercise 1.3: Concept Level Abstraction', async () => {
      await tester.clearConsole();
      
      // Set zoom to concept level
      await tester.setZoomLevel('concept');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} concept-level results`);
      
      // Should contain abstract concepts
      if (results.length > 0) {
        const concepts = ['democracy', 'governance', 'education', 'empowerment', 'intelligence', 'learning'];
        const foundConcepts = tester.validateResultContent(results, concepts);
        console.log(`💭 Found concepts: ${foundConcepts.join(', ')}`);
        
        // Validate result types are concepts
        tester.validateResultType(results, 'concept|idea|process');
      }
      
      // Validate final state
      await tester.validateZPTState('concept');
    });

    test('Exercise 1.4: Theme Level Overview', async () => {
      await tester.clearConsole();
      
      // Set zoom to theme level
      await tester.setZoomLevel('theme');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} theme-level results`);
      
      // Should provide high-level thematic groupings
      if (results.length > 0) {
        // Validate result types are themes
        tester.validateResultType(results, 'theme|domain|category');
        
        const themes = ['science', 'technology', 'education', 'history'];
        const foundThemes = tester.validateResultContent(results, themes);
        console.log(`🎯 Found themes: ${foundThemes.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('theme');
    });
  });

  test.describe('Exercise Set 2: Pan Filtering', () => {
    test('Exercise 2.1: Domain-Based Filtering', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with science/technology domain filter
      await tester.setZoomLevel('entity');
      await tester.setPanFilters(['science', 'technology']);
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} domain-filtered results`);
      
      // Results should be filtered to science/technology domains
      if (results.length > 0) {
        const scienceTech = ['NASA', 'telescope', 'AI', 'neural', 'research', 'technology'];
        const foundTerms = tester.validateResultContent(results, scienceTech);
        console.log(`🔬 Found science/tech terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', { domains: ['science', 'technology'] });
    });

    test('Exercise 2.2: Keyword-Based Filtering', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with AI-related keyword filter
      await tester.setZoomLevel('entity');
      await tester.setPanFilters([], ['AI', 'machine learning', 'neural']);
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} keyword-filtered results`);
      
      // Results should contain AI-related keywords
      if (results.length > 0) {
        const aiTerms = ['artificial', 'intelligence', 'machine', 'learning', 'neural', 'networks'];
        const foundTerms = tester.validateResultContent(results, aiTerms);
        console.log(`🤖 Found AI terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', { keywords: ['AI', 'machine learning', 'neural'] });
    });

    test('Exercise 2.3: Combined Domain and Keyword Filtering', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with both domain and keyword filters
      await tester.setZoomLevel('entity');
      await tester.setPanFilters(['science', 'technology'], ['space', 'telescope', 'NASA']);
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} combined-filtered results`);
      
      // Should match both domain and keyword criteria
      if (results.length > 0) {
        const spaceTerms = ['space', 'telescope', 'NASA', 'galaxy', 'infrared'];
        const foundTerms = tester.validateResultContent(results, spaceTerms);
        console.log(`🚀 Found space terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', {
        domains: ['science', 'technology'],
        keywords: ['space', 'telescope', 'NASA']
      });
    });
  });

  test.describe('Exercise Set 3: Tilt Perspective Changes', () => {
    test('Exercise 3.1: Keywords Perspective', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with keywords tilt
      await tester.setZoomLevel('entity');
      await tester.setTilt('keywords');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} keyword-focused results`);
      
      // Should emphasize important keywords
      if (results.length > 0) {
        results.forEach(result => {
          // Results should have keyword emphasis
          expect(result.content || result.label).toBeTruthy();
        });
      }
      
      // Validate final state
      await tester.validateZPTState('entity', {}, 'keywords');
    });

    test('Exercise 3.2: Entities Perspective', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with entities tilt
      await tester.setZoomLevel('entity');
      await tester.setTilt('entities');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} entity-focused results`);
      
      // Should emphasize named entities
      if (results.length > 0) {
        const entities = ['NASA', 'Einstein', 'Curie', 'Princeton', 'Webb'];
        const foundEntities = tester.validateResultContent(results, entities);
        console.log(`👤 Found entities: ${foundEntities.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', {}, 'entities');
    });

    test('Exercise 3.3: Relationships Perspective', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with relationships tilt
      await tester.setZoomLevel('entity');
      await tester.setTilt('relationships');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} relationship-focused results`);
      
      // Should show connections between entities
      if (results.length > 0) {
        const relationships = ['developed', 'launched', 'won', 'revolutionized', 'transforms'];
        const foundRelationships = tester.validateResultContent(results, relationships);
        console.log(`🔗 Found relationships: ${foundRelationships.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', {}, 'relationships');
    });

    test('Exercise 3.4: Temporal Perspective', async () => {
      await tester.clearConsole();
      
      // Set entity zoom with temporal tilt
      await tester.setZoomLevel('entity');
      await tester.setTilt('temporal');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} temporal-focused results`);
      
      // Should emphasize temporal information
      if (results.length > 0) {
        const temporalTerms = ['1915', '14th century', '16th century', 'Renaissance', 'began'];
        const foundTerms = tester.validateResultContent(results, temporalTerms);
        console.log(`⏰ Found temporal terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', {}, 'temporal');
    });
  });

  test.describe('Exercise Set 4: Combined ZPT Navigation', () => {
    test('Exercise 4.1: Science Research Navigation', async () => {
      await tester.clearConsole();
      
      // Configure combined ZPT: concept zoom + science domain + relationships tilt
      await tester.setZoomLevel('concept');
      await tester.setPanFilters(['science']);
      await tester.setTilt('relationships');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} science research results`);
      
      // Should show scientific concepts with relational emphasis
      if (results.length > 0) {
        const scienceTerms = ['research', 'study', 'technology', 'cellular', 'molecular'];
        const foundTerms = tester.validateResultContent(results, scienceTerms);
        console.log(`🔬 Found science terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('concept', { domains: ['science'] }, 'relationships');
    });

    test('Exercise 4.2: Historical Entity Analysis', async () => {
      await tester.clearConsole();
      
      // Configure combined ZPT: entity zoom + historical keywords + temporal tilt
      await tester.setZoomLevel('entity');
      await tester.setPanFilters([], ['Renaissance', 'history']);
      await tester.setTilt('temporal');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} historical entity results`);
      
      // Should show historical entities with temporal emphasis
      if (results.length > 0) {
        const historicalTerms = ['Renaissance', 'century', 'Leonardo', 'Italy', 'Europe'];
        const foundTerms = tester.validateResultContent(results, historicalTerms);
        console.log(`🏛️ Found historical terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('entity', { keywords: ['Renaissance', 'history'] }, 'temporal');
    });

    test('Exercise 4.3: Technology Theme Exploration', async () => {
      await tester.clearConsole();
      
      // Configure combined ZPT: theme zoom + technology keywords + keywords tilt
      await tester.setZoomLevel('theme');
      await tester.setPanFilters([], ['technology', 'computing']);
      await tester.setTilt('keywords');
      
      // Execute navigation
      await tester.executeNavigation();
      
      // Get and validate results
      const results = await tester.getNavigationResults();
      console.log(`📊 Found ${results.length} technology theme results`);
      
      // Should show technology themes with keyword emphasis
      if (results.length > 0) {
        const techTerms = ['artificial', 'intelligence', 'machine', 'learning', 'technology', 'computing'];
        const foundTerms = tester.validateResultContent(results, techTerms);
        console.log(`💻 Found tech terms: ${foundTerms.join(', ')}`);
      }
      
      // Validate final state
      await tester.validateZPTState('theme', { keywords: ['technology', 'computing'] }, 'keywords');
    });
  });

  test.describe('Exercise Set 5: Dynamic Navigation Sequences', () => {
    test('Exercise 5.1: Zoom Progression Sequence', async () => {
      await tester.clearConsole();
      
      // Test zoom progression: theme → concept → entity → molecular
      const zoomLevels = ['theme', 'concept', 'entity', 'molecular'];
      
      for (const zoom of zoomLevels) {
        console.log(`🔍 Testing zoom level: ${zoom}`);
        
        await tester.setZoomLevel(zoom);
        await tester.executeNavigation();
        
        const results = await tester.getNavigationResults();
        console.log(`  📊 Found ${results.length} results at ${zoom} level`);
        
        // Each level should maintain topic coherence
        await tester.validateZPTState(zoom);
        
        // Wait between zoom changes
        await tester.page.waitForTimeout(500);
      }
    });

    test('Exercise 5.2: Pan Filter Refinement', async () => {
      await tester.clearConsole();
      
      // Test progressive filter refinement
      
      // Start with no filters
      await tester.setZoomLevel('entity');
      await tester.executeNavigation();
      let results = await tester.getNavigationResults();
      const initialCount = results.length;
      console.log(`📊 Initial results: ${initialCount}`);
      
      // Add domain filter
      await tester.setPanFilters(['science']);
      await tester.executeNavigation();
      results = await tester.getNavigationResults();
      console.log(`📊 After domain filter: ${results.length}`);
      
      // Add keyword filter
      await tester.setPanFilters(['science'], ['research']);
      await tester.executeNavigation();
      results = await tester.getNavigationResults();
      console.log(`📊 After keyword filter: ${results.length}`);
      
      // Should maintain relevance throughout refinement
      await tester.validateZPTState('entity', {
        domains: ['science'],
        keywords: ['research']
      });
    });

    test('Exercise 5.3: Tilt Perspective Switching', async () => {
      await tester.clearConsole();
      
      // Test different tilt perspectives on same content
      await tester.setZoomLevel('concept');
      await tester.setPanFilters(['technology']);
      
      const tilts = ['keywords', 'entities', 'relationships', 'temporal'];
      
      for (const tilt of tilts) {
        console.log(`🎯 Testing tilt perspective: ${tilt}`);
        
        await tester.setTilt(tilt);
        await tester.executeNavigation();
        
        const results = await tester.getNavigationResults();
        console.log(`  📊 Found ${results.length} results with ${tilt} tilt`);
        
        // Same base query and filters, different perspective
        await tester.validateZPTState('concept', { domains: ['technology'] }, tilt);
        
        // Wait between tilt changes
        await tester.page.waitForTimeout(500);
      }
    });
  });

  test.describe('Console Logging Validation', () => {
    test('should provide clear progress messages during ZPT operations', async () => {
      await tester.clearConsole();
      
      // Perform a series of ZPT operations
      await tester.setZoomLevel('entity');
      await tester.setPanFilters(['science'], ['research']);
      await tester.setTilt('keywords');
      await tester.executeNavigation();
      
      // Get console messages
      const messages = await tester.getConsoleMessages();
      console.log(`📝 Console messages: ${messages.length}`);
      
      // Should contain human-friendly progress messages
      const expectedPatterns = [
        /zoom level changed.*entity/i,
        /pan filters updated/i,
        /tilt view changed.*keywords/i,
        /navigation.*completed/i
      ];
      
      expectedPatterns.forEach(pattern => {
        const found = messages.some(msg => pattern.test(msg));
        expect(found).toBeTruthy();
      });
      
      // Should not contain JSON dumps or technical jargon
      const technicalPatterns = [
        /\{.*\}/,  // JSON objects
        /undefined|null/,
        /stack trace/i
      ];
      
      technicalPatterns.forEach(pattern => {
        const found = messages.some(msg => pattern.test(msg));
        expect(found).toBeFalsy();
      });
    });

    test('should show appropriate emojis and visual indicators', async () => {
      await tester.clearConsole();
      
      // Perform ZPT operations
      await tester.setZoomLevel('concept');
      await tester.executeNavigation();
      
      // Get console messages
      const messages = await tester.getConsoleMessages();
      
      // Should contain emoji indicators
      const emojiPatterns = [
        /🔍/,  // Zoom
        /🔄/,  // Pan
        /🎯/,  // Tilt
        /🗺️/,  // Navigation
        /✅/   // Success
      ];
      
      emojiPatterns.forEach(pattern => {
        const found = messages.some(msg => pattern.test(msg));
        expect(found).toBeTruthy();
      });
    });
  });

  test.describe('Performance and Error Handling', () => {
    test('should complete ZPT operations within reasonable time bounds', async () => {
      const startTime = Date.now();
      
      await tester.setZoomLevel('entity');
      await tester.setPanFilters(['science']);
      await tester.setTilt('keywords');
      await tester.executeNavigation();
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ ZPT operation completed in ${duration}ms`);
      
      // Should complete within 10 seconds for UI operations
      expect(duration).toBeLessThan(10000);
    });

    test('should handle empty results gracefully', async () => {
      await tester.clearConsole();
      
      // Use filters that should return no results
      await tester.setZoomLevel('entity');
      await tester.setPanFilters(['nonexistent'], ['completely_made_up_term_xyz123']);
      await tester.executeNavigation();
      
      // Should not crash and should show empty results
      const results = await tester.getNavigationResults();
      expect(results).toHaveLength(0);
      
      // Should have appropriate message in console
      const messages = await tester.getConsoleMessages();
      const noResultsMessage = messages.find(msg => 
        msg.includes('found 0 items') || msg.includes('no results')
      );
      expect(noResultsMessage).toBeTruthy();
    });

    test('should maintain state consistency across operations', async () => {
      // Perform multiple state changes
      await tester.setZoomLevel('concept');
      await tester.setPanFilters(['technology'], ['AI']);
      await tester.setTilt('relationships');
      
      // Validate state is maintained
      await tester.validateZPTState('concept', {
        domains: ['technology'],
        keywords: ['AI']
      }, 'relationships');
      
      // Perform navigation
      await tester.executeNavigation();
      
      // State should still be consistent after navigation
      await tester.validateZPTState('concept', {
        domains: ['technology'], 
        keywords: ['AI']
      }, 'relationships');
    });
  });
});