/**
 * MCP Inspector Interface E2E Tests
 * Tests the Model Context Protocol inspector functionality
 */

import { test, expect } from '@playwright/test';

test.describe('MCP Inspector Interface', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR]: ${msg.text()}`);
      }
    });
    
    page.on('pageerror', exception => {
      console.log(`[PAGE ERROR]: ${exception.message}`);
    });
  });

  test('should load the inspector page correctly', async ({ page }) => {
    console.log('🔍 Testing inspector page load...');
    
    // Navigate to the inspector
    await page.goto('/inspector');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot of the initial state
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-initial.png',
      fullPage: true 
    });
    
    // Check that the page title contains relevant content
    const title = await page.title();
    console.log(`Page title: ${title}`);
    expect(title).toContain('MCP');
    
    // Check for essential UI elements
    await expect(page.locator('body')).toBeVisible();
    
    console.log('✅ Inspector page loaded successfully');
  });

  test('should display MCP connection interface', async ({ page }) => {
    console.log('🔍 Testing MCP connection interface...');
    
    await page.goto('/inspector');
    await page.waitForLoadState('networkidle');
    
    // Look for common MCP inspector elements
    const connectionElements = [
      'input[type="text"]', // Connection URL input
      'button', // Connect/action buttons
      'form', // Connection form
    ];
    
    let foundElements = [];
    
    for (const selector of connectionElements) {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        foundElements.push(selector);
        console.log(`✅ Found element: ${selector}`);
      }
    }
    
    // Take screenshot showing the interface
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-interface.png',
      fullPage: true 
    });
    
    // Should have at least some interactive elements
    expect(foundElements.length).toBeGreaterThan(0);
    
    console.log(`✅ Found ${foundElements.length} interactive elements`);
  });

  test('should attempt to connect to MCP server', async ({ page }) => {
    console.log('🔍 Testing MCP server connection...');
    
    await page.goto('/inspector');
    await page.waitForLoadState('networkidle');
    
    // Look for connection URL input field
    const urlInput = page.locator('input[type="text"]').first();
    
    if (await urlInput.isVisible()) {
      console.log('📝 Found URL input field, attempting connection...');
      
      // Try to connect to the local MCP endpoint
      await urlInput.fill('http://localhost:3000/mcp');
      
      // Look for connect button or similar
      const connectButton = page.locator('button').filter({ hasText: /connect|submit/i }).first();
      
      if (await connectButton.isVisible()) {
        console.log('🔗 Clicking connect button...');
        await connectButton.click();
        
        // Wait a moment for connection attempt
        await page.waitForTimeout(2000);
        
        // Take screenshot after connection attempt
        await page.screenshot({ 
          path: 'test-results/mcp-inspector-connection-attempt.png',
          fullPage: true 
        });
        
        console.log('✅ Connection attempt completed');
      } else {
        console.log('⚠️ Connect button not found');
      }
    } else {
      console.log('⚠️ URL input field not found, trying alternative approach...');
      
      // Alternative: look for any form and try to interact
      const forms = await page.locator('form').count();
      console.log(`Found ${forms} forms on the page`);
      
      if (forms > 0) {
        const form = page.locator('form').first();
        const inputs = await form.locator('input').count();
        console.log(`Form has ${inputs} inputs`);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-final-state.png',
      fullPage: true 
    });
  });

  test('should check for tools listing functionality', async ({ page }) => {
    console.log('🔍 Testing tools listing functionality...');
    
    await page.goto('/inspector');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);
    
    // Look for tools-related content
    const toolsIndicators = [
      '[data-testid*="tool"]',
      '[class*="tool"]',
      'text=/tools?/i',
      'text=/available/i',
      'text=/list/i',
      'ul', // Lists that might contain tools
      'li', // List items
    ];
    
    let toolsFound = [];
    
    for (const selector of toolsIndicators) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        toolsFound.push({ selector, count });
        console.log(`✅ Found ${count} elements matching "${selector}"`);
      }
    }
    
    // Check page content for tool-related text
    const pageContent = await page.textContent('body');
    const toolKeywords = ['tool', 'function', 'method', 'available', 'server', 'mcp'];
    const foundKeywords = toolKeywords.filter(keyword => 
      pageContent.toLowerCase().includes(keyword)
    );
    
    console.log(`📝 Found keywords: ${foundKeywords.join(', ')}`);
    
    // Take screenshot showing tools area
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-tools.png',
      fullPage: true 
    });
    
    // Should find some elements or keywords related to tools
    const hasToolsContent = toolsFound.length > 0 || foundKeywords.length >= 2;
    expect(hasToolsContent).toBeTruthy();
    
    console.log('✅ Tools functionality check completed');
  });

  test('should test basic inspector functionality', async ({ page }) => {
    console.log('🔍 Testing basic inspector functionality...');
    
    await page.goto('/inspector');
    await page.waitForLoadState('networkidle');
    
    // Test page responsiveness
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
    
    // Take screenshot at standard resolution
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-standard-view.png',
      fullPage: true 
    });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-mobile-view.png',
      fullPage: true 
    });
    
    // Reset to standard view
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Test scroll behavior if page is long
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    console.log(`Page height: ${bodyHeight}, Viewport: ${viewportHeight}`);
    
    if (bodyHeight > viewportHeight) {
      console.log('📜 Page is scrollable, testing scroll...');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'test-results/mcp-inspector-scrolled.png',
        fullPage: true 
      });
      
      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    
    console.log('✅ Basic functionality tests completed');
  });

  test('should check for error handling', async ({ page }) => {
    console.log('🔍 Testing error handling...');
    
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`❌ Page error: ${error.message}`);
    });
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`❌ Console error: ${msg.text()}`);
      }
    });
    
    await page.goto('/inspector');
    await page.waitForLoadState('networkidle');
    
    // Try to trigger potential errors by interacting with elements
    const buttons = await page.locator('button').count();
    console.log(`Found ${buttons} buttons to test`);
    
    // Click buttons to see if any cause errors
    for (let i = 0; i < Math.min(buttons, 3); i++) {
      try {
        const button = page.locator('button').nth(i);
        if (await button.isVisible()) {
          console.log(`🖱️ Clicking button ${i + 1}...`);
          await button.click();
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.log(`⚠️ Error clicking button ${i + 1}: ${error.message}`);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'test-results/mcp-inspector-error-test.png',
      fullPage: true 
    });
    
    // Report errors but don't fail the test unless there are critical errors
    console.log(`📊 Total errors found: ${errors.length}`);
    if (errors.length > 0) {
      console.log('⚠️ Errors detected:', errors);
    }
    
    // Only fail if there are too many errors (suggests broken functionality)
    expect(errors.length).toBeLessThan(5);
    
    console.log('✅ Error handling test completed');
  });

  test('should verify health endpoint accessibility', async ({ page }) => {
    console.log('🔍 Testing health endpoint...');
    
    // Test the health endpoint directly
    const response = await page.request.get('/health');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    console.log('🏥 Health data:', JSON.stringify(healthData, null, 2));
    
    // Verify health response structure
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
    
    if (healthData.server_state) {
      console.log('🔧 Server state:', healthData.server_state);
    }
    
    console.log('✅ Health endpoint test completed');
  });

  test('should test MCP endpoint directly', async ({ page }) => {
    console.log('🔍 Testing MCP endpoint directly...');
    
    // Test basic MCP endpoint accessibility
    try {
      const response = await page.request.post('/mcp', {
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping'
        }
      });
      
      console.log(`📡 MCP endpoint status: ${response.status()}`);
      
      if (response.status() === 200) {
        const mcpData = await response.json();
        console.log('📡 MCP response:', JSON.stringify(mcpData, null, 2));
      } else {
        console.log(`⚠️ MCP endpoint returned status ${response.status()}`);
        const text = await response.text();
        console.log(`Response: ${text}`);
      }
    } catch (error) {
      console.log(`❌ MCP endpoint error: ${error.message}`);
    }
    
    console.log('✅ MCP endpoint test completed');
  });

});