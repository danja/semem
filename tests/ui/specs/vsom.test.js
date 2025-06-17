import { test, expect } from '@playwright/test';
import { VSOMPage } from '../helpers/pageObjects/VSOMPage.js';

test.describe('VSOM Visualization', () => {
  let vsomPage;

  test.beforeEach(async ({ page }) => {
    vsomPage = new VSOMPage(page);
    await page.goto('/');
    await vsomPage.waitForLoad();
    await vsomPage.navigateToVSOM();
  });

  test('should load VSOM tab', async () => {
    const isVisible = await vsomPage.isVisualizationVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should switch between visualization types', async () => {
    // Test grid view
    await vsomPage.selectVisualizationType('grid');
    // Add assertions for grid view
    
    // Test training view
    await vsomPage.selectVisualizationType('training');
    // Add assertions for training view
    
    // Test feature maps
    await vsomPage.selectVisualizationType('featureMaps');
    // Add assertions for feature maps
    
    // Test clustering
    await vsomPage.selectVisualizationType('clustering');
    // Add assertions for clustering
  });

  // Add more tests for interactions, zoom, pan, etc.
});
