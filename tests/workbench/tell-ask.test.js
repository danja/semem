import { test, expect } from '@playwright/test';
import randomFactGenerator from '../helpers/randomFactGenerator';

test.describe('Workbench Tell/Ask Integration', () => {
  test('Tell a random fact and ask about it', async ({ page }) => {
    // Generate a random fact
    const uniqueFact = randomFactGenerator.generateUniqueFact();
    const fact = uniqueFact.fact;
    const subject = fact.split(' ')[0]; // Extract subject for the question

    // Navigate to the Workbench (assuming the service is already running)
    console.log('Navigating to Workbench UI...');
    await page.goto('http://localhost:4102');

    try {
      // Wait for the page to load completely
      console.log('Waiting for #tell-content to be visible...');
      await page.waitForSelector('#tell-content', { timeout: 15000 });
      console.log('#tell-content is visible.');

      // Tell the random fact
      console.log(`Filling #tell-content with fact: ${fact}`);
      await page.fill('#tell-content', fact);
      console.log('Clicking #tell-submit...');
      await page.click('#tell-submit');

      // Wait for confirmation that the fact was stored
      console.log('Waiting for #tell-results...');
      await page.waitForSelector('#tell-results', { timeout: 5000 });
      const tellResultsMessage = await page.textContent('#tell-results');
      console.log(`Tell results message: ${tellResultsMessage}`);
      expect(tellResultsMessage).toContain('Successfully stored content');

      // Wait a moment for session cache to update
      await page.waitForTimeout(1000);

      // Ask about the fact
      const question = `What are ${subject}?`;
      console.log(`Filling #ask-question with question: ${question}`);
      await page.fill('#ask-question', question);
      console.log('Clicking #ask-submit...');
      await page.click('#ask-submit');

      // Wait for the answer
      console.log('Waiting for #ask-results...');
      await page.waitForSelector('#ask-results', { timeout: 5000 });
      const askResultsMessage = await page.textContent('#ask-results');
      console.log(`Ask results message: ${askResultsMessage}`);

      // Verify the answer contains the stored fact
      expect(askResultsMessage.toLowerCase()).toContain(fact.toLowerCase());
    } catch (error) {
      console.error('Test failed:', error);
      const pageContent = await page.content();
      console.log('Page HTML content at failure:', pageContent);
      await page.screenshot({ path: 'error-screenshot.png' });
      throw error;
    }
  });
});