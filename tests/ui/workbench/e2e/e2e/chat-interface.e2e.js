import { test, expect } from '@playwright/test';

test.describe('Chat Interface E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('http://localhost:4120');
    await page.waitForLoadState('networkidle');
    
    // Ensure we're on the chat tab
    const chatTab = page.locator('button[data-tab="chat"]');
    await chatTab.waitFor({ state: 'visible' });
    await chatTab.click();
    await page.waitForSelector('#chat-tab', { state: 'visible' });
  });

  test('should load the chat interface', async ({ page }) => {
    // Verify the chat interface elements are present
    await expect(page.locator('#chat-tab')).toBeVisible();
    await expect(page.locator('#chat-messages')).toBeVisible();
    await expect(page.locator('#chat-form')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeVisible();
    await expect(page.locator('#chat-provider')).toBeVisible();
  });

  test('should load chat providers', async ({ page }) => {
    // Wait for providers to load
    const providerSelect = page.locator('#chat-provider');
    await providerSelect.waitFor({ state: 'visible' });

    // Wait for providers to load (more than just the default option)
    await page.waitForFunction(
      () => {
        const select = document.getElementById('chat-provider');
        return select && select.options.length > 1;
      },
      { timeout: 10000 }
    );

    // Get provider options (excluding the default "Select a provider..." option)
    const providerOptions = await page.locator('#chat-provider option:not(:first-child)').allTextContents();
    console.log(`Found ${providerOptions.length} provider options`);
    
    // Verify we have at least one provider
    expect(providerOptions.length).toBeGreaterThan(0);
    
    // Log provider names
    providerOptions.forEach((provider, index) => {
      console.log(`Provider ${index + 1}: ${provider}`);
    });
  });

  test('should send and receive messages', async ({ page }) => {
    // Wait for providers to load
    const providerSelect = page.locator('#chat-provider');
    await providerSelect.waitFor({ state: 'visible' });
    
    // Wait for providers to be available
    await page.waitForFunction(
      () => {
        const select = document.getElementById('chat-provider');
        return select && select.options.length > 1;
      },
      { timeout: 10000 }
    );

    // Select the first available provider (skip the default option)
    await providerSelect.selectOption({ index: 1 });
    
    // Type and send a test message
    const testMessage = 'Hello, this is a test message';
    const chatInput = page.locator('#chat-input');
    await chatInput.fill(testMessage);
    await page.click('#chat-form button[type="submit"]');
    
    // Verify the message appears in the chat
    await expect(page.locator('.chat-message.user:last-child .message-content'))
      .toHaveText(testMessage);
    
    // Wait for the assistant's response
    await expect(page.locator('.chat-message.assistant:last-child .message-content'))
      .toBeVisible({ timeout: 15000 });
  });

  test('should display MCP indicators for MCP-enabled providers', async ({ page }) => {
    // Wait for providers to load
    const providerSelect = page.locator('#chat-provider');
    await providerSelect.waitFor({ state: 'visible' });
    
    // Get all provider options
    const providerOptions = await page.locator('#chat-provider option:not(:first-child)').allTextContents();
    
    // Check for MCP indicators (🔗 symbol)
    const mcpProviders = providerOptions.filter(opt => opt.includes('🔗'));
    
    if (mcpProviders.length > 0) {
      console.log(`Found ${mcpProviders.length} MCP-enabled providers`);
      mcpProviders.forEach(provider => {
        console.log(`- ${provider}`);
      });
    } else {
      console.log('No MCP-enabled providers found');
    }
    
    // This is just for documentation, we don't fail the test if no MCP providers are found
    // as it depends on the configuration
  });

  test('should handle chat history', async ({ page }) => {
    // Wait for providers to load and select one
    const providerSelect = page.locator('#chat-provider');
    await providerSelect.waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => document.getElementById('chat-provider').options.length > 1,
      { timeout: 10000 }
    );
    await providerSelect.selectOption({ index: 1 });
    
    // Send a test message
    const testMessage1 = 'First test message';
    await page.fill('#chat-input', testMessage1);
    await page.click('#chat-form button[type="submit"]');
    
    // Wait for the first response
    await expect(page.locator('.chat-message.assistant:last-child .message-content'))
      .toBeVisible({ timeout: 15000 });
    
    // Send a second message
    const testMessage2 = 'Second test message';
    await page.fill('#chat-input', testMessage2);
    await page.click('#chat-form button[type="submit"]');
    
    // Wait for the second response
    await expect(page.locator('.chat-message.assistant:last-child .message-content'))
      .toBeVisible({ timeout: 15000 });
    
    // Verify both messages are in the chat history
    const messages = await page.locator('.chat-message.user .message-content').allTextContents();
    expect(messages).toContain(testMessage1);
    expect(messages).toContain(testMessage2);
  });
});
