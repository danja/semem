// Base page object that other page objects will extend
export class BasePage {
  constructor(page) {
    this.page = page;
  }

  async navigateToTab(tabName) {
    await this.page.click(`button[data-tab="${tabName}"]`);
    await this.page.waitForSelector(`#${tabName}-tab`);
  }

  async getActiveTab() {
    return this.page.$eval('.tab-pane.active', el => el.id);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('body');
  }
}
