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
  /**
   * Initialize the tab manager
   */
  init() {
    if (this.initialized) {
      console.log('TabManager already initialized');
      return;
    }
    
    try {
      console.log('Initializing TabManager...');
      
      // Get all tab buttons and content sections
      this.tabButtons = document.querySelectorAll('.tabs .tab-btn');
      this.tabContents = document.querySelectorAll('main > .tab-content, main > section.tab-content');
      
      console.log(`Found ${this.tabButtons.length} tab buttons and ${this.tabContents.length} tab contents`);
      
      if (this.tabButtons.length === 0) {
        console.warn('No tab buttons found. Make sure your HTML structure includes elements with class "tabs" and "tab-btn".');
        return;
      }
      
      // Store tab information
      this.tabs = [];
      
      // First pass: find all tab buttons and their corresponding content
      this.tabButtons.forEach(button => {
        try {
          const tabId = button.getAttribute('data-tab');
          if (!tabId) {
            console.warn('Tab button is missing data-tab attribute:', button);
            return;
          }
          
          // Find the content element that has an ID matching the data-tab value with '-tab' suffix
          const content = document.querySelector(`#${tabId}-tab`);
          
          if (!content) {
            console.warn(`No content element found for tab: ${tabId}`);
            return;
          }
          
          // Add tab to our collection
          this.tabs.push({
            id: tabId,
            button,
            content
          });
          
          console.log(`Registered tab: ${tabId}`, { 
            button: button.outerHTML, 
            content: content.outerHTML 
          });
          
        } catch (error) {
          console.error('Error processing tab button:', button, error);
        }
      });
      
      if (this.tabs.length === 0) {
        console.warn('No valid tabs found with corresponding content. Check your HTML structure and data-tab attributes.');
        return;
      }
      
      // Add click event listeners to tab buttons
      this.tabs.forEach(tab => {
        try {
          tab.button.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchTab(tab.id);
          });
          tab.button.setAttribute('role', 'tab');
          tab.button.setAttribute('aria-selected', 'false');
          tab.button.setAttribute('aria-controls', `${tab.id}-tab`);
          
          // Set up content attributes
          tab.content.setAttribute('role', 'tabpanel');
          tab.content.setAttribute('aria-labelledby', tab.id);
          
        } catch (error) {
          console.error(`Error setting up tab ${tab.id}:`, error);
        }
      });
      
      // Initialize with the first tab active if none is active
      const activeTab = this.tabs.find(tab => tab.button.classList.contains('active'));
      if (activeTab) {
        console.log(`Initial active tab found: ${activeTab.id}`);
        this.switchTab(activeTab.id, true);
      } else if (this.tabs.length > 0) {
        console.log(`No active tab found, defaulting to first tab: ${this.tabs[0].id}`);
        this.switchTab(this.tabs[0].id, true);
      }
      
      // Handle browser back/forward navigation
      window.addEventListener('popstate', (e) => {
        try {
          if (e.state && e.state.tab) {
            console.log('Popstate - switching to tab:', e.state.tab);
            this.switchTab(e.state.tab);
          }
        } catch (error) {
          console.error('Error handling popstate:', error);
        }
      });
      
      console.log(`Tab Manager successfully initialized with ${this.tabs.length} tabs`);
      this.initialized = true;
      
      // Dispatch event that tabs are ready
      document.dispatchEvent(new CustomEvent('tabsReady', { 
        detail: { 
          tabCount: this.tabs.length,
          currentTab: this.currentTab
        } 
      }));
      
    } catch (error) {
      console.error('Critical error initializing TabManager:', error);
      // Try to recover by showing the first tab if possible
      if (this.tabs && this.tabs.length > 0) {
        this.switchTab(this.tabs[0].id, true);
      }
    }
  }

  /**
   * Switch to a specific tab
   * @param {string} tabId - The ID of the tab to switch to
   * @param {boolean} [force=false] - Force the tab switch even if it's already active
   * @returns {boolean} - Returns true if the tab switch was successful, false otherwise
   */
  switchTab(tabId, force = false) {
    try {
      // Validate tabId
      if (!tabId) {
        console.warn('No tab ID provided to switchTab');
        return false;
      }
      
      // Don't do anything if we're already on this tab and not forcing
      if (this.currentTab === tabId && !force) {
        console.log(`Tab '${tabId}' is already active`);
        return true;
      }
      
      console.log(`Attempting to switch to tab: ${tabId}`);
      
      // Find the tab to activate
      const tabToActivate = this.tabs.find(tab => tab.id === tabId);
      if (!tabToActivate) {
        console.warn(`Tab with ID '${tabId}' not found in registered tabs`);
        return false;
      }
      
      // Get the currently active tab
      const currentActiveTab = this.tabs.find(tab => tab.button.classList.contains('active'));
      const previousTabId = this.currentTab;
      
      // Dispatch beforeTabChange event
      const beforeChangeEvent = new CustomEvent('beforeTabChange', {
        cancelable: true,
        detail: {
          fromTab: previousTabId,
          toTab: tabId,
          fromTabElement: currentActiveTab?.content,
          toTabElement: tabToActivate.content
        }
      });
      
      const continueChange = document.dispatchEvent(beforeChangeEvent);
      
      // If the event was prevented, don't change tabs
      if (!continueChange) {
        console.log(`Tab change to '${tabId}' was cancelled by event handler`);
        return false;
      }
      
      console.log(`Hiding all tabs and deactivating buttons...`);
      
      // Update UI - hide all tabs first
      this.tabs.forEach(tab => {
        try {
          if (tab.content) {
            // Use classList to handle visibility instead of inline styles
            tab.content.classList.remove('active');
            tab.content.setAttribute('hidden', '');
            tab.content.setAttribute('aria-hidden', 'true');
          }
          if (tab.button) {
            tab.button.classList.remove('active');
            tab.button.setAttribute('aria-selected', 'false');
            tab.button.setAttribute('tabindex', '-1');
          }
        } catch (error) {
          console.error(`Error updating tab ${tab.id}:`, error);
        }
      });
      
      console.log(`Activating tab: ${tabId}`);
      
      // Show the selected tab
      try {
        // Update button state
        tabToActivate.button.classList.add('active');
        tabToActivate.button.setAttribute('aria-selected', 'true');
        tabToActivate.button.setAttribute('tabindex', '0');
        tabToActivate.button.focus();
        
        // Show tab content
        if (tabToActivate.content) {
          // Remove hidden attribute and add active class
          tabToActivate.content.removeAttribute('hidden');
          tabToActivate.content.classList.add('active');
          tabToActivate.content.setAttribute('aria-hidden', 'false');
          
          // Trigger a resize event in case any components need to adjust
          window.dispatchEvent(new Event('resize'));
        }
        
        // Update current tab
        this.currentTab = tabId;
        
        // Dispatch tabChanged event
        const changeEvent = new CustomEvent('tabChanged', {
          detail: {
            fromTab: previousTabId,
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
        
        console.log(`Successfully switched to tab: ${tabId}`);
        return true;
        
      } catch (error) {
        console.error(`Error activating tab ${tabId}:`, error);
        // Try to recover by showing the first tab if possible
        if (this.tabs.length > 0 && this.tabs[0].id !== tabId) {
          console.log('Attempting to recover by showing first tab');
          return this.switchTab(this.tabs[0].id, true);
        }
        return false;
      }
      
    } catch (error) {
      console.error('Error in switchTab:', error);
      return false;
    }
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
