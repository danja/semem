import { BasePage } from './BasePage.js';

export class VSOMPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      vsomContainer: '.vsom-container',
      visualizationCanvas: '.visualization-canvas',
      visualizationTypeSelect: '.visualization-type-select',
      // Add more selectors as needed
    };
  }

  async navigateToVSOM() {
    await this.navigateToTab('vsom');
    await this.page.waitForSelector(this.selectors.vsomContainer);
  }

  async selectVisualizationType(type) {
    await this.page.selectOption(this.selectors.visualizationTypeSelect, type);
  }

  async isVisualizationVisible() {
    return this.page.isVisible(this.selectors.visualizationCanvas);
  }

  // Add more helper methods as needed
}
