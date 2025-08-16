/**
 * @file Playwright E2E tests for Enhancement Checkboxes
 * Tests the frontend enhancement checkbox functionality in the Ask panel
 */
import { test, expect } from '@playwright/test'

// Test configuration
const WORKBENCH_URL = 'http://localhost:8081'
const API_URL = 'http://localhost:4100'

test.describe('Enhancement Checkboxes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the workbench
    await page.goto(WORKBENCH_URL)
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Verify we're on the correct page
    await expect(page).toHaveTitle(/Semantic Memory Workbench/)
  })

  test.describe('UI Elements', () => {
    test('should display all enhancement checkboxes', async ({ page }) => {
      // Check that the enhancement options section exists
      const enhancementSection = page.locator('.enhancement-options')
      await expect(enhancementSection).toBeVisible()
      
      // Check for the enhancement options label
      const label = page.locator('.enhancement-options .form-label')
      await expect(label).toHaveText('Enhancement Options')
      
      // Check for HyDE checkbox
      const hydeCheckbox = page.locator('#use-hyde')
      await expect(hydeCheckbox).toBeVisible()
      await expect(hydeCheckbox).not.toBeChecked()
      
      const hydeLabel = page.locator('label[for="use-hyde"] .checkbox-text')
      await expect(hydeLabel).toHaveText('HyDE')
      
      const hydeHint = page.locator('label[for="use-hyde"] .checkbox-hint')
      await expect(hydeHint).toHaveText('Hypothetical Document Embeddings')
      
      // Check for Wikipedia checkbox
      const wikipediaCheckbox = page.locator('#use-wikipedia')
      await expect(wikipediaCheckbox).toBeVisible()
      await expect(wikipediaCheckbox).not.toBeChecked()
      
      const wikipediaLabel = page.locator('label[for="use-wikipedia"] .checkbox-text')
      await expect(wikipediaLabel).toHaveText('Wikipedia')
      
      const wikipediaHint = page.locator('label[for="use-wikipedia"] .checkbox-hint')
      await expect(wikipediaHint).toHaveText('Wikipedia knowledge integration')
      
      // Check for Wikidata checkbox
      const wikidataCheckbox = page.locator('#use-wikidata')
      await expect(wikidataCheckbox).toBeVisible()
      await expect(wikidataCheckbox).not.toBeChecked()
      
      const wikidataLabel = page.locator('label[for="use-wikidata"] .checkbox-text')
      await expect(wikidataLabel).toHaveText('Wikidata')
      
      const wikidataHint = page.locator('label[for="use-wikidata"] .checkbox-hint')
      await expect(wikidataHint).toHaveText('Wikidata entities and relationships')
    })

    test('should allow checking and unchecking enhancement options', async ({ page }) => {
      // Test HyDE checkbox
      const hydeCheckbox = page.locator('#use-hyde')
      await hydeCheckbox.check()
      await expect(hydeCheckbox).toBeChecked()
      await hydeCheckbox.uncheck()
      await expect(hydeCheckbox).not.toBeChecked()
      
      // Test Wikipedia checkbox
      const wikipediaCheckbox = page.locator('#use-wikipedia')
      await wikipediaCheckbox.check()
      await expect(wikipediaCheckbox).toBeChecked()
      await wikipediaCheckbox.uncheck()
      await expect(wikipediaCheckbox).not.toBeChecked()
      
      // Test Wikidata checkbox
      const wikidataCheckbox = page.locator('#use-wikidata')
      await wikidataCheckbox.check()
      await expect(wikidataCheckbox).toBeChecked()
      await wikidataCheckbox.uncheck()
      await expect(wikidataCheckbox).not.toBeChecked()
    })

    test('should allow multiple enhancements to be selected', async ({ page }) => {
      const hydeCheckbox = page.locator('#use-hyde')
      const wikipediaCheckbox = page.locator('#use-wikipedia')
      const wikidataCheckbox = page.locator('#use-wikidata')
      
      // Check all three enhancements
      await hydeCheckbox.check()
      await wikipediaCheckbox.check()
      await wikidataCheckbox.check()
      
      // Verify all are checked
      await expect(hydeCheckbox).toBeChecked()
      await expect(wikipediaCheckbox).toBeChecked()
      await expect(wikidataCheckbox).toBeChecked()
    })
  })

  test.describe('Form Integration', () => {
    test('should include enhancement options in form submission', async ({ page }) => {
      // Mock the API response
      await page.route('**/api/ask**', async route => {
        const request = await route.request()
        const postData = request.postData()
        
        // Verify the request includes enhancement parameters
        expect(postData).toContain('useHyDE')
        expect(postData).toContain('useWikipedia') 
        expect(postData).toContain('useWikidata')
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [{ type: 'text', text: 'Enhanced test response' }]
          })
        })
      })
      
      // Fill out the ask form
      const questionInput = page.locator('#question')
      await questionInput.fill('What is machine learning?')
      
      // Check some enhancement options
      await page.locator('#use-hyde').check()
      await page.locator('#use-wikipedia').check()
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()
      
      // Wait for response
      await page.waitForSelector('.response-content', { timeout: 10000 })
      
      // Verify response was received
      const response = page.locator('.response-content')
      await expect(response).toContainText('Enhanced test response')
    })

    test('should work with existing Use Context checkbox', async ({ page }) => {
      // Verify Use Context checkbox still exists and works
      const useContextCheckbox = page.locator('#use-context')
      await expect(useContextCheckbox).toBeVisible()
      
      // Check Use Context along with enhancements
      await useContextCheckbox.check()
      await page.locator('#use-hyde').check()
      
      // Both should be checked
      await expect(useContextCheckbox).toBeChecked()
      await expect(page.locator('#use-hyde')).toBeChecked()
    })

    test('should maintain checkbox state during session', async ({ page }) => {
      // Check some options
      await page.locator('#use-hyde').check()
      await page.locator('#use-wikidata').check()
      
      // Fill and submit a question
      await page.locator('#question').fill('test question')
      
      // Mock API response to avoid actual network calls
      await page.route('**/api/ask**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [{ type: 'text', text: 'Test response' }]
          })
        })
      })
      
      await page.locator('button[type="submit"]').click()
      
      // Wait for response and verify checkboxes are still checked
      await page.waitForSelector('.response-content', { timeout: 5000 })
      await expect(page.locator('#use-hyde')).toBeChecked()
      await expect(page.locator('#use-wikidata')).toBeChecked()
      await expect(page.locator('#use-wikipedia')).not.toBeChecked()
    })
  })

  test.describe('API Integration', () => {
    test('should send correct enhancement parameters to API', async ({ page }) => {
      let requestBody = null
      
      // Intercept API request
      await page.route('**/api/ask**', async route => {
        const request = route.request()
        requestBody = JSON.parse(request.postData() || '{}')
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: [{ type: 'text', text: 'API integration test response' }]
          })
        })
      })
      
      // Fill form with enhancements
      await page.locator('#question').fill('API integration test')
      await page.locator('#use-hyde').check()
      await page.locator('#use-wikipedia').check()
      
      // Submit form
      await page.locator('button[type="submit"]').click()
      
      // Wait for request to complete
      await page.waitForSelector('.response-content', { timeout: 5000 })
      
      // Verify request body
      expect(requestBody).toHaveProperty('question', 'API integration test')
      expect(requestBody).toHaveProperty('useHyDE', true)
      expect(requestBody).toHaveProperty('useWikipedia', true)
      expect(requestBody).toHaveProperty('useWikidata', false)
    })

    test('should handle API errors gracefully with enhancements', async ({ page }) => {
      // Mock API error
      await page.route('**/api/ask**', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Enhancement service temporarily unavailable'
          })
        })
      })
      
      // Fill form with enhancements
      await page.locator('#question').fill('Error test question')
      await page.locator('#use-hyde').check()
      
      // Submit form
      await page.locator('button[type="submit"]').click()
      
      // Wait for error handling
      await page.waitForTimeout(2000)
      
      // Verify error is handled (exact behavior depends on implementation)
      // The form should not crash and checkboxes should remain functional
      await expect(page.locator('#use-hyde')).toBeChecked()
      await expect(page.locator('#question')).toHaveValue('Error test question')
    })
  })

  test.describe('Accessibility', () => {
    test('should be accessible with keyboard navigation', async ({ page }) => {
      // Test keyboard navigation through enhancement checkboxes
      await page.keyboard.press('Tab') // Navigate to first form element
      
      // Continue tabbing until we reach enhancement checkboxes
      let currentElement = await page.locator(':focus').getAttribute('id')
      let tabCount = 0
      
      while (currentElement !== 'use-hyde' && tabCount < 20) {
        await page.keyboard.press('Tab')
        currentElement = await page.locator(':focus').getAttribute('id')
        tabCount++
      }
      
      // Should be focused on HyDE checkbox
      await expect(page.locator('#use-hyde')).toBeFocused()
      
      // Press space to check
      await page.keyboard.press('Space')
      await expect(page.locator('#use-hyde')).toBeChecked()
      
      // Tab to next checkbox
      await page.keyboard.press('Tab')
      await expect(page.locator('#use-wikipedia')).toBeFocused()
      
      // Check with space
      await page.keyboard.press('Space')
      await expect(page.locator('#use-wikipedia')).toBeChecked()
    })

    test('should have proper ARIA labels and accessibility attributes', async ({ page }) => {
      // Check that form elements have proper labels
      const hydeLabel = page.locator('label[for="use-hyde"]')
      await expect(hydeLabel).toBeVisible()
      
      const wikipediaLabel = page.locator('label[for="use-wikipedia"]')
      await expect(wikipediaLabel).toBeVisible()
      
      const wikidataLabel = page.locator('label[for="use-wikidata"]')
      await expect(wikidataLabel).toBeVisible()
      
      // Check that checkboxes have proper names
      await expect(page.locator('#use-hyde')).toHaveAttribute('name', 'useHyDE')
      await expect(page.locator('#use-wikipedia')).toHaveAttribute('name', 'useWikipedia')
      await expect(page.locator('#use-wikidata')).toHaveAttribute('name', 'useWikidata')
    })
  })

  test.describe('Visual Regression', () => {
    test('should maintain consistent visual appearance', async ({ page }) => {
      // Take screenshot of enhancement section
      const enhancementSection = page.locator('.enhancement-options')
      await expect(enhancementSection).toHaveScreenshot('enhancement-section.png')
      
      // Test with some options checked
      await page.locator('#use-hyde').check()
      await page.locator('#use-wikidata').check()
      
      await expect(enhancementSection).toHaveScreenshot('enhancement-section-checked.png')
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Verify enhancement section is still visible and functional
      const enhancementSection = page.locator('.enhancement-options')
      await expect(enhancementSection).toBeVisible()
      
      // Test checkbox functionality on mobile
      await page.locator('#use-hyde').check()
      await expect(page.locator('#use-hyde')).toBeChecked()
      
      // Verify touch interaction works
      await page.locator('label[for="use-wikipedia"]').tap()
      await expect(page.locator('#use-wikipedia')).toBeChecked()
    })
  })
})