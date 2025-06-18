/**
 * Tab Manager - Handles tab switching and state management
 */

class TabManager {
  constructor() {
    this.tabs = [];
    this.currentTab = null;
    this.initialized = false;
    this.tabButtons = [];
    this.tabContents = [];
  }

  /**
   * Initialize the tab manager
   */
  init() {
    if (this.initialized) return;
    
    try {
      // Get all tab buttons and content sections
      this.tabButtons = document.querySelectorAll('.tabs .tab-btn');
      this.tabContents = document.querySelectorAll('main > .tab-content');
      
      if (this.tabButtons.length === 0 || this.tabContents.length === 0) {
        console.warn('No tabs found. Make sure your HTML structure is correct.');
        return;
      }
      
      // Store tab information
      this.tabs = Array.from(this.tabButtons).map(button => {
        const tabId = button.dataset.tab;
        const content = document.getElementById(`${tabId}-tab`);
        
        if (!content) {
          console.warn(`No content found for tab: ${tabId}`);
        }
        
        return {
          id: tabId,
          button,
          content
        };
      }).filter(tab => tab.content); // Only keep tabs with valid content
      
      // Add click event listeners to tab buttons
      this.tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab(e.currentTarget.dataset.tab);
        });
      });
      
      // Initialize with the first tab active if none is active
      const activeTab = Array.from(this.tabButtons).find(btn => btn.classList.contains('active'));
      if (activeTab) {
        this.switchTab(activeTab.dataset.tab, true);
      } else if (this.tabButtons.length > 0) {
        this.switchTab(this.tabButtons[0].dataset.tab, true);
      }
      
      console.log(`Tab Manager initialized with ${this.tabs.length} tabs`);
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing TabManager:', error);
    }
  }

  /**
   * Switch to a specific tab
   * @param {string} tabId - The ID of the tab to switch to
   * @param {boolean} [force=false] - Force the tab switch even if it's already active
   */
  switchTab(tabId, force = false) {
    if (!tabId) {
      console.warn('No tab ID provided to switchTab');
      return;
    }
    
    // Don't do anything if we're already on this tab and not forcing
    if (this.currentTab === tabId && !force) {
      return;
    }
    
    // Find the tab to activate
    const tabToActivate = this.tabs.find(tab => tab.id === tabId);
    if (!tabToActivate) {
      console.warn(`Tab with ID '${tabId}' not found`);
      return;
    }
    
    // Get the currently active tab
    const currentActiveTab = this.tabs.find(tab => tab.button.classList.contains('active'));
    
    // Dispatch beforeTabChange event
    const beforeChangeEvent = new CustomEvent('beforeTabChange', {
      cancelable: true,
      detail: {
        fromTab: this.currentTab,
        toTab: tabId,
        fromTabElement: currentActiveTab?.content,
        toTabElement: tabToActivate.content
      }
    });
    
    const continueChange = document.dispatchEvent(beforeChangeEvent);
    
    // If the event was prevented, don't change tabs
    if (!continueChange) {
      console.log(`Tab change to '${tabId}' was cancelled`);
      return;
    }
    
    // Update UI - hide all tabs first
    this.tabs.forEach(tab => {
      if (tab.content) {
        tab.content.style.display = 'none';
        tab.content.classList.remove('active');
      }
      if (tab.button) {
        tab.button.classList.remove('active');
        tab.button.setAttribute('aria-selected', 'false');
      }
    });
    
    // Show the selected tab
    tabToActivate.button.classList.add('active');
    tabToActivate.button.setAttribute('aria-selected', 'true');
    
    if (tabToActivate.content) {
      tabToActivate.content.style.display = 'block';
      tabToActivate.content.classList.add('active');
    }
    
    // Update current tab
    const previousTab = this.currentTab;
    this.currentTab = tabId;
    
    // Dispatch tabChanged event
    const changeEvent = new CustomEvent('tabChanged', {
      detail: {
        fromTab: previousTab,
        toTab: tabId,
        fromTabElement: currentActiveTab?.content,
        toTabElement: tabToActivate.content
      }
    });
    
    document.dispatchEvent(changeEvent);
    
    // Update URL hash if needed (optional)
    if (window.history && window.history.pushState) {
      const newUrl = window.location.pathname + (tabId ? `#${tabId}` : '');
      window.history.pushState({ tab: tabId }, '', newUrl);
    }
    
    console.log(`Switched to tab: ${tabId}`);
  }

  /**
   * Get the currently active tab
   * @returns {string} The ID of the currently active tab
   */
  getCurrentTab() {
    return this.currentTab;
  }
  
  /**
   * Get the DOM element of the currently active tab content
   * @returns {HTMLElement|null} The active tab content element or null if none is active
   */
  getActiveTabContent() {
    const activeTab = this.tabs.find(tab => tab.id === this.currentTab);
    return activeTab?.content || null;
  }
  
  /**
   * Get all registered tabs
   * @returns {Array} Array of tab objects with id, button, and content properties
   */
  getTabs() {
    return [...this.tabs];
  }
  
  /**
   * Add a new tab programmatically
   * @param {string} tabId - Unique ID for the tab
   * @param {string} tabName - Display name for the tab
   * @param {HTMLElement} content - The content element to show when tab is active
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.activate=true] - Whether to activate the tab after adding it
   * @param {string} [options.icon] - Optional icon class for the tab
   * @returns {boolean} True if the tab was added successfully, false otherwise
   */
  addTab(tabId, tabName, content, options = {}) {
    if (!tabId || !tabName || !content) {
      console.error('Tab ID, name, and content are required');
      return false;
    }
    
    // Check if tab with this ID already exists
    if (this.tabs.some(tab => tab.id === tabId)) {
      console.warn(`Tab with ID '${tabId}' already exists`);
      return false;
    }
    
    const { activate = true, icon = '' } = options;
    
    try {
      // Create tab button
      const tabButton = document.createElement('button');
      tabButton.className = 'tab-btn';
      tabButton.dataset.tab = tabId;
      tabButton.setAttribute('role', 'tab');
      tabButton.setAttribute('aria-selected', 'false');
      tabButton.setAttribute('aria-controls', `${tabId}-tab`);
      
      // Add icon if provided
      if (icon) {
        const iconEl = document.createElement('i');
        iconEl.className = `icon ${icon}`;
        tabButton.appendChild(iconEl);
      }
      
      // Add tab name
      const tabNameEl = document.createTextNode(tabName);
      tabButton.appendChild(tabNameEl);
      
      // Add tab to the DOM
      const tabsContainer = document.querySelector('.tabs');
      if (!tabsContainer) {
        console.error('Could not find tabs container');
        return false;
      }
      
      tabsContainer.appendChild(tabButton);
      
      // Set up content
      content.id = `${tabId}-tab`;
      content.classList.add('tab-content');
      content.style.display = 'none';
      content.setAttribute('role', 'tabpanel');
      content.setAttribute('aria-labelledby', tabId);
      
      // Add content to the DOM if it's not already there
      if (!document.body.contains(content)) {
        const main = document.querySelector('main');
        if (main) {
          main.appendChild(content);
        } else {
          document.body.appendChild(content);
        }
      }
      
      // Add to tabs array
      const tabData = {
        id: tabId,
        button: tabButton,
        content
      };
      
      this.tabs.push(tabData);
      
      // Add event listener
      tabButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchTab(tabId);
      });
      
      // Activate the tab if requested
      if (activate) {
        this.switchTab(tabId);
      }
      
      console.log(`Added tab: ${tabId} - ${tabName}`);
      return true;
      
    } catch (error) {
      console.error(`Error adding tab '${tabId}':`, error);
      return false;
    }
  }
}

// Create and export a singleton instance
const tabManager = new TabManager();

export default tabManager;
