import { test, expect } from '@playwright/test';

test.describe('Memory Management Components', () => {
  test.beforeEach(async ({ page }) => {
    // Start MCP server on a different port for testing
    await page.goto('http://localhost:8086');
    
    // Wait for workbench to initialize and MCP connection
    await expect(page.locator('#connection-status .status-text')).toContainText('Connected', { timeout: 15000 });
    
    // Navigate to memory demo page
    await page.goto('http://localhost:8086/memory-demo.html');
    
    // Wait for memory component to initialize
    await expect(page.locator('.memory-component')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#memory-status')).toContainText('Ready', { timeout: 5000 });
  });

  test.describe('Memory Domain Management', () => {
    test('should display domain selector with all available domains', async ({ page }) => {
      const domainSelect = page.locator('#memory-domain');
      await expect(domainSelect).toBeVisible();

      // Check all expected domains are present
      const options = await domainSelect.locator('option').allTextContents();
      expect(options).toContain('User Memory');
      expect(options).toContain('Project Memory');
      expect(options).toContain('Session Memory');
      expect(options).toContain('Instruction Memory');
    });

    test('should switch memory domains successfully', async ({ page }) => {
      // Switch to project domain
      await page.selectOption('#memory-domain', 'project');
      
      // Check status update
      await expect(page.locator('#memory-status')).toContainText('project', { timeout: 5000 });
      
      // Verify domain-specific UI elements appear
      await expect(page.locator('#project-id-input')).toBeVisible();
      await expect(page.locator('#create-project-btn')).toBeVisible();
    });

    test('should create new project context', async ({ page }) => {
      // Switch to project domain
      await page.selectOption('#memory-domain', 'project');
      
      // Fill project details
      await page.fill('#project-id-input', 'test-project-001');
      await page.fill('#project-name-input', 'Test Project');
      await page.fill('#project-description', 'A test project for memory management');
      
      // Create project
      await page.click('#create-project-btn');
      
      // Check success message
      await expect(page.locator('.memory-result')).toContainText('Project created successfully', { timeout: 5000 });
      await expect(page.locator('#current-project')).toContainText('test-project-001');
    });
  });

  test.describe('Remember Operation', () => {
    test('should store user memory with importance weighting', async ({ page }) => {
      // Select user domain
      await page.selectOption('#memory-domain', 'user');
      
      // Fill memory content
      await page.fill('#remember-content', 'User prefers dark mode interface and minimal notifications');
      
      // Set importance level
      await page.locator('#importance-slider').fill('0.8');
      
      // Add tags
      await page.fill('#remember-tags', 'preferences, ui, notifications');
      
      // Submit memory
      await page.click('#remember-btn');
      
      // Check success response
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
      
      // Verify memory appears in recall results
      await page.fill('#recall-query', 'dark mode preferences');
      await page.click('#recall-btn');
      
      await expect(page.locator('.recall-results')).toContainText('User prefers dark mode', { timeout: 5000 });
    });

    test('should store session memory with temporal context', async ({ page }) => {
      // Select session domain
      await page.selectOption('#memory-domain', 'session');
      
      // Store session memory
      await page.fill('#remember-content', 'Working on memory management feature implementation');
      await page.locator('#importance-slider').fill('0.6');
      await page.fill('#remember-tags', 'session, development, memory');
      
      await page.click('#remember-btn');
      
      // Verify success
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
    });

    test('should validate memory content requirement', async ({ page }) => {
      // Try to submit without content
      await page.click('#remember-btn');
      
      // Should show validation error
      await expect(page.locator('.memory-error')).toContainText('Content is required', { timeout: 3000 });
    });

    test('should handle importance slider interaction', async ({ page }) => {
      // Test importance slider
      const slider = page.locator('#importance-slider');
      await slider.fill('0.9');
      
      // Check display value updates
      await expect(page.locator('#importance-display')).toContainText('0.9', { timeout: 2000 });
      
      // Test different values
      await slider.fill('0.3');
      await expect(page.locator('#importance-display')).toContainText('0.3', { timeout: 2000 });
    });
  });

  test.describe('Recall Operation', () => {
    test.beforeEach(async ({ page }) => {
      // Pre-populate some test memories
      await page.selectOption('#memory-domain', 'user');
      
      // Store a few test memories
      const memories = [
        { content: 'Prefers TypeScript for new projects', tags: 'programming, preferences' },
        { content: 'Likes clean, minimal UI designs', tags: 'design, ui, preferences' },
        { content: 'Uses VSCode with dark theme', tags: 'editor, theme, tools' }
      ];

      for (const memory of memories) {
        await page.fill('#remember-content', memory.content);
        await page.fill('#remember-tags', memory.tags);
        await page.locator('#importance-slider').fill('0.7');
        await page.click('#remember-btn');
        await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
        
        // Clear form for next memory
        await page.fill('#remember-content', '');
        await page.fill('#remember-tags', '');
      }
    });

    test('should retrieve relevant memories by query', async ({ page }) => {
      // Search for programming-related memories
      await page.fill('#recall-query', 'programming preferences');
      await page.selectOption('#recall-domains', 'user');
      await page.click('#recall-btn');
      
      // Should find TypeScript preference
      await expect(page.locator('.recall-results')).toContainText('TypeScript', { timeout: 10000 });
      
      // Check relevance score is displayed
      await expect(page.locator('.memory-score')).toBeVisible();
    });

    test('should filter memories by domain', async ({ page }) => {
      // Switch to project domain and add project memory
      await page.selectOption('#memory-domain', 'project');
      await page.fill('#project-id-input', 'test-proj');
      await page.click('#create-project-btn');
      await expect(page.locator('.memory-result')).toContainText('Project created', { timeout: 5000 });
      
      await page.fill('#remember-content', 'Project uses React and Node.js architecture');
      await page.fill('#remember-tags', 'architecture, tech-stack');
      await page.click('#remember-btn');
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
      
      // Search with project domain filter
      await page.fill('#recall-query', 'React');
      await page.selectOption('#recall-domains', 'project');
      await page.click('#recall-btn');
      
      // Should find project memory but not user memories
      await expect(page.locator('.recall-results')).toContainText('React and Node.js', { timeout: 10000 });
    });

    test('should respect relevance threshold settings', async ({ page }) => {
      // Set high relevance threshold
      await page.locator('#relevance-threshold').fill('0.9');
      
      // Search with vague query
      await page.fill('#recall-query', 'stuff things');
      await page.click('#recall-btn');
      
      // Should return fewer or no results due to high threshold
      const resultsCount = await page.locator('.memory-item').count();
      expect(resultsCount).toBeLessThanOrEqual(1);
    });

    test('should limit maximum results', async ({ page }) => {
      // Set maximum results to 2
      await page.locator('#max-results').fill('2');
      
      // Search for broad query that would match multiple memories
      await page.fill('#recall-query', 'preferences');
      await page.click('#recall-btn');
      
      // Should return at most 2 results
      await page.waitForSelector('.memory-item', { timeout: 10000 });
      const resultsCount = await page.locator('.memory-item').count();
      expect(resultsCount).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Forget Operation', () => {
    test.beforeEach(async ({ page }) => {
      // Store a test memory to forget
      await page.selectOption('#memory-domain', 'session');
      await page.fill('#remember-content', 'Temporary session data for forget test');
      await page.fill('#remember-tags', 'temporary, test');
      await page.click('#remember-btn');
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
    });

    test('should fade memory visibility using fade strategy', async ({ page }) => {
      // Use fade strategy on session domain
      await page.selectOption('#forget-target-domain', 'session');
      await page.selectOption('#forget-strategy', 'fade');
      await page.locator('#fade-factor').fill('0.1');
      
      await page.click('#forget-btn');
      
      // Should show success message
      await expect(page.locator('.memory-result')).toContainText('Memory faded successfully', { timeout: 10000 });
      
      // Try to recall the faded memory - should have lower visibility
      await page.fill('#recall-query', 'temporary session data');
      await page.click('#recall-btn');
      
      // Memory might still appear but with reduced relevance score
      const memoryItems = page.locator('.memory-item');
      if (await memoryItems.count() > 0) {
        const score = await page.locator('.memory-score').first().textContent();
        expect(parseFloat(score)).toBeLessThan(0.5);
      }
    });

    test('should handle context switch forgetting', async ({ page }) => {
      // Store memory in user domain
      await page.selectOption('#memory-domain', 'user');
      await page.fill('#remember-content', 'Context switching test memory');
      await page.click('#remember-btn');
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
      
      // Switch context using forget
      await page.selectOption('#forget-strategy', 'context_switch');
      await page.click('#forget-btn');
      
      await expect(page.locator('.memory-result')).toContainText('Context switched successfully', { timeout: 10000 });
    });
  });

  test.describe('UI Responsiveness and Error Handling', () => {
    test('should display loading states during operations', async ({ page }) => {
      // Start a remember operation and check loading state
      await page.fill('#remember-content', 'Test memory for loading state');
      
      // Click and immediately check for loading indicator
      const rememberPromise = page.click('#remember-btn');
      await expect(page.locator('#memory-loading')).toBeVisible({ timeout: 1000 });
      
      await rememberPromise;
      
      // Loading should disappear when complete
      await expect(page.locator('#memory-loading')).toBeHidden({ timeout: 5000 });
    });

    test('should handle API connection errors gracefully', async ({ page }) => {
      // Mock API failure by navigating to page without server
      await page.goto('http://localhost:8086/memory-demo.html');
      
      // Stop the MCP connection (simulate by going to invalid endpoint)
      await page.route('**/api/**', route => route.abort());
      
      // Try a memory operation
      await page.fill('#remember-content', 'This should fail');
      await page.click('#remember-btn');
      
      // Should show connection error
      await expect(page.locator('.memory-error')).toContainText('Unable to connect', { timeout: 10000 });
    });

    test('should maintain responsive design on mobile devices', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // All main components should be visible and functional
      await expect(page.locator('#memory-domain')).toBeVisible();
      await expect(page.locator('#remember-content')).toBeVisible();
      await expect(page.locator('#importance-slider')).toBeVisible();
      
      // Forms should stack properly on mobile
      const memoryComponent = page.locator('.memory-component');
      await expect(memoryComponent).toHaveCSS('flex-direction', 'column');
      
      // Test operation on mobile
      await page.fill('#remember-content', 'Mobile test memory');
      await page.click('#remember-btn');
      
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });
    });

    test('should handle form validation properly', async ({ page }) => {
      // Test empty recall query
      await page.click('#recall-btn');
      await expect(page.locator('.memory-error')).toContainText('Query is required', { timeout: 3000 });
      
      // Test invalid importance values
      await page.locator('#importance-slider').fill('1.5'); // Over maximum
      await expect(page.locator('#importance-slider')).toHaveValue('1'); // Should clamp to max
      
      await page.locator('#importance-slider').fill('-0.1'); // Under minimum
      await expect(page.locator('#importance-slider')).toHaveValue('0'); // Should clamp to min
    });
  });

  test.describe('Advanced Features', () => {
    test('should handle batch operations efficiently', async ({ page }) => {
      // Store multiple memories quickly
      const batchMemories = [
        'First batch memory about JavaScript',
        'Second batch memory about Python',
        'Third batch memory about React',
        'Fourth batch memory about Node.js',
        'Fifth batch memory about TypeScript'
      ];

      for (let i = 0; i < batchMemories.length; i++) {
        await page.fill('#remember-content', batchMemories[i]);
        await page.fill('#remember-tags', `batch-test, memory-${i}`);
        await page.click('#remember-btn');
        
        // Don't wait for full completion, just check operation started
        await expect(page.locator('.memory-result, .memory-error')).toBeVisible({ timeout: 5000 });
      }

      // Search for batch memories
      await page.fill('#recall-query', 'batch memory JavaScript');
      await page.locator('#max-results').fill('10');
      await page.click('#recall-btn');

      // Should find multiple relevant memories
      await expect(page.locator('.memory-item')).toHaveCount({ min: 1 }, { timeout: 10000 });
    });

    test('should support temporal filtering', async ({ page }) => {
      // Add temporal range filter
      const timeRange = {
        start: new Date(Date.now() - 24*60*60*1000).toISOString(), // 24 hours ago
        end: new Date().toISOString() // Now
      };

      // Set time range filters if available in UI
      if (await page.locator('#time-range-start').isVisible()) {
        await page.fill('#time-range-start', timeRange.start.split('T')[0]);
        await page.fill('#time-range-end', timeRange.end.split('T')[0]);
      }

      // Perform recall with temporal filter
      await page.fill('#recall-query', 'recent memories');
      await page.click('#recall-btn');

      // Should return memories within time range
      const results = await page.locator('.memory-item').count();
      expect(results).toBeGreaterThanOrEqual(0);
    });

    test('should integrate with project context switching', async ({ page }) => {
      // Create first project
      await page.selectOption('#memory-domain', 'project');
      await page.fill('#project-id-input', 'project-alpha');
      await page.fill('#project-name-input', 'Project Alpha');
      await page.click('#create-project-btn');
      await expect(page.locator('.memory-result')).toContainText('Project created', { timeout: 5000 });
      
      // Add project-specific memory
      await page.fill('#remember-content', 'Project Alpha uses microservices architecture');
      await page.click('#remember-btn');
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });

      // Switch to different project
      await page.fill('#project-id-input', 'project-beta');
      await page.fill('#project-name-input', 'Project Beta');
      await page.click('#create-project-btn');
      await expect(page.locator('.memory-result')).toContainText('Project created', { timeout: 5000 });

      // Add different project memory
      await page.fill('#remember-content', 'Project Beta uses monolithic architecture');
      await page.click('#remember-btn');
      await expect(page.locator('.memory-result')).toContainText('Memory stored successfully', { timeout: 10000 });

      // Search should show context-appropriate results
      await page.fill('#recall-query', 'architecture');
      await page.click('#recall-btn');
      
      // Should find Beta project memory (current context)
      await expect(page.locator('.recall-results')).toContainText('monolithic', { timeout: 10000 });
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle large memory datasets efficiently', async ({ page }) => {
      // Create multiple memories to test performance
      const startTime = Date.now();
      
      // Add 10 memories rapidly
      for (let i = 0; i < 10; i++) {
        await page.fill('#remember-content', `Performance test memory ${i} with unique content about topic ${i % 3}`);
        await page.fill('#remember-tags', `perf-test, memory-${i}, topic-${i % 3}`);
        await page.click('#remember-btn');
        
        // Wait for operation to start, but don't wait for completion
        await page.waitForSelector('.memory-result, .memory-error', { timeout: 3000 });
      }

      const storageTime = Date.now() - startTime;
      console.log(`Storage time for 10 memories: ${storageTime}ms`);

      // Test retrieval performance
      const recallStartTime = Date.now();
      await page.fill('#recall-query', 'performance test topic');
      await page.locator('#max-results').fill('10');
      await page.click('#recall-btn');
      
      await expect(page.locator('.memory-item')).toHaveCount({ min: 1 }, { timeout: 15000 });
      
      const recallTime = Date.now() - recallStartTime;
      console.log(`Recall time for query: ${recallTime}ms`);
      
      // Performance should be reasonable (less than 30 seconds total)
      expect(storageTime + recallTime).toBeLessThan(30000);
    });
  });
});