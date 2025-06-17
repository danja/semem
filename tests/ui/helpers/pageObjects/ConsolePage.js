import { BasePage } from './BasePage.js';

export class ConsolePage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      consoleToggle: '.console-toggle',
      consoleContainer: '.console-container',
      logLevelSelect: '.log-level-select',
      logEntries: '.log-entry',
      searchInput: '.search-input',
      pauseButton: '.pause-button',
      clearButton: '.clear-button',
      copyButton: '.copy-button'
    };
  }

  async toggleConsole() {
    await this.page.click(this.selectors.consoleToggle);
  }

  async isConsoleVisible() {
    return this.page.isVisible(this.selectors.consoleContainer);
  }

  async setLogLevel(level) {
    await this.page.selectOption(this.selectors.logLevelSelect, level);
  }

  async searchLogs(term) {
    await this.page.fill(this.selectors.searchInput, term);
  }

  async pauseLogging() {
    await this.page.click(this.selectors.pauseButton);
  }

  async clearLogs() {
    await this.page.click(this.selectors.clearButton);
  }

  async copyLogs() {
    await this.page.click(this.selectors.copyButton);
  }

  async getLogCount() {
    return this.page.$$eval(this.selectors.logEntries, els => els.length);
  }

  async getLogTexts() {
    return this.page.$$eval(this.selectors.logEntries, els => 
      els.map(el => el.textContent)
    );
  }
}
