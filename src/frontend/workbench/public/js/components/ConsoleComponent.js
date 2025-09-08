/**
 * Console Component for Workbench
 * Handles console UI interactions and log display
 */

import DomUtils from '../utils/DomUtils.js';
import { consoleService } from '../services/ConsoleService.js';

export class ConsoleComponent {
  constructor() {
    this.container = null;
    this.logsContainer = null;
    this.clearButton = null;
    this.autoScrollButton = null;
    this.levelFilter = null;
    this.placeholder = null;
    
    this.isAutoScrollEnabled = true;
    this.currentFilter = 'all';
    
    // Workflow progress tracking
    this.activeOperations = new Map(); // Track active workflow operations
    this.operationElements = new Map(); // Track DOM elements for operations
    
    // Bind methods
    this.handleClearClick = this.handleClearClick.bind(this);
    this.handleAutoScrollToggle = this.handleAutoScrollToggle.bind(this);
    this.handleLevelFilterChange = this.handleLevelFilterChange.bind(this);
    this.handleConsoleEvent = this.handleConsoleEvent.bind(this);
    this.createWorkflowOperationCard = this.createWorkflowOperationCard.bind(this);
    this.updateWorkflowProgress = this.updateWorkflowProgress.bind(this);
  }

  /**
   * Initialize the console component
   */
  init() {
    this.container = DomUtils.$('#console-component');
    if (!this.container) {
      console.warn('Console component container not found');
      return;
    }

    // Get UI elements
    this.logsContainer = DomUtils.$('#console-logs');
    this.clearButton = DomUtils.$('#console-clear');
    this.autoScrollButton = DomUtils.$('#console-auto-scroll');
    this.levelFilter = DomUtils.$('#console-level-filter');
    this.placeholder = DomUtils.$('.console-placeholder');

    if (!this.logsContainer) {
      console.warn('Console logs container not found');
      return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Subscribe to console service events
    this.unsubscribe = consoleService.subscribe(this.handleConsoleEvent);

    // Initial log from console service to show it's working
    consoleService.info('Console initialized and ready');
    
    console.log('ConsoleComponent initialized successfully');
  }

  /**
   * Setup event listeners for console controls
   */
  setupEventListeners() {
    // Clear button
    if (this.clearButton) {
      this.clearButton.addEventListener('click', this.handleClearClick);
    }

    // Auto-scroll toggle
    if (this.autoScrollButton) {
      this.autoScrollButton.addEventListener('click', this.handleAutoScrollToggle);
    }

    // Level filter
    if (this.levelFilter) {
      this.levelFilter.addEventListener('change', this.handleLevelFilterChange);
    }
  }

  /**
   * Handle console service events
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  handleConsoleEvent(event, data) {
    switch (event) {
      case 'logAdded':
        this.addLogEntry(data);
        break;
      case 'logsCleared':
        this.clearDisplay();
        break;
      case 'filterChanged':
        this.refreshDisplay();
        break;
      case 'autoScrollChanged':
        this.updateAutoScrollButton(data.enabled);
        break;
    }
  }

  /**
   * Add a new log entry to the display
   * @param {Object} logEntry - Log entry to add
   */
  addLogEntry(logEntry) {
    if (!this.logsContainer) return;

    // Hide placeholder if visible
    if (this.placeholder) {
      DomUtils.hide(this.placeholder);
    }

    // Check if log passes current filter
    if (this.currentFilter !== 'all' && logEntry.level !== this.currentFilter) {
      return;
    }

    // Create log entry element
    const logElement = this.createLogElement(logEntry);
    
    // Add to container
    this.logsContainer.appendChild(logElement);

    // Auto-scroll if enabled
    if (this.isAutoScrollEnabled) {
      this.scrollToBottom();
    }

    // Limit displayed logs (keep last 500 visible for performance)
    const logEntries = this.logsContainer.querySelectorAll('.console-log-entry');
    if (logEntries.length > 500) {
      // Remove oldest entries
      for (let i = 0; i < logEntries.length - 500; i++) {
        logEntries[i].remove();
      }
    }
  }

  /**
   * Create HTML element for a log entry
   * @param {Object} logEntry - Log entry data
   * @returns {HTMLElement} Log entry element
   */
  createLogElement(logEntry) {
    // Check if this is a workflow log from backend
    const isWorkflowLog = logEntry.details?.source === 'backend-workflow';
    
    if (isWorkflowLog) {
      return this.createWorkflowLogElement(logEntry);
    }
    
    // Standard log element for non-workflow logs
    const timestamp = consoleService.formatTimestamp(logEntry.timestamp);
    
    const logElement = DomUtils.createElement('div', {
      className: `console-log-entry ${logEntry.level}`,
      'data-log-id': logEntry.id,
      'data-level': logEntry.level
    });

    // Timestamp
    const timestampEl = DomUtils.createElement('span', {
      className: 'console-log-timestamp'
    }, timestamp);

    // Level
    const levelEl = DomUtils.createElement('span', {
      className: `console-log-level ${logEntry.level}`
    }, logEntry.level);

    // Message
    const messageEl = DomUtils.createElement('span', {
      className: 'console-log-message'
    }, logEntry.message);

    // Assemble log entry
    logElement.appendChild(timestampEl);
    logElement.appendChild(levelEl);
    logElement.appendChild(messageEl);

    // Add details if present
    if (logEntry.details) {
      const detailsEl = DomUtils.createElement('div', {
        className: 'console-log-details'
      }, this.formatDetails(logEntry.details));
      
      messageEl.appendChild(detailsEl);
    }

    return logElement;
  }

  /**
   * Create workflow-specific log element with progress tracking
   * @param {Object} logEntry - Workflow log entry data
   * @returns {HTMLElement} Workflow log element
   */
  createWorkflowLogElement(logEntry) {
    const details = logEntry.details || {};
    const operationId = details.operationId;
    
    // If this is an operation start, create a new workflow card
    if (details.type === 'operation-start' || logEntry.message.includes('Processing') || logEntry.message.includes('Starting')) {
      return this.createWorkflowOperationCard(logEntry, operationId);
    }
    
    // If this is part of an existing operation, update the progress
    if (operationId && this.activeOperations.has(operationId)) {
      this.updateWorkflowProgress(operationId, logEntry);
      return null; // Don't create separate log entry, update the card instead
    }
    
    // Create a workflow step element
    return this.createWorkflowStepElement(logEntry);
  }

  /**
   * Create a workflow operation card for tracking progress
   * @param {Object} logEntry - Initial log entry
   * @param {string} operationId - Operation identifier
   * @returns {HTMLElement} Operation card element
   */
  createWorkflowOperationCard(logEntry, operationId = null) {
    const timestamp = consoleService.formatTimestamp(logEntry.timestamp);
    const details = logEntry.details || {};
    
    // Generate operation ID if not provided
    const opId = operationId || `op-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const cardElement = DomUtils.createElement('div', {
      className: `workflow-operation-card ${logEntry.level}`,
      'data-operation-id': opId,
      'data-log-id': logEntry.id
    });

    // Card header
    const headerEl = DomUtils.createElement('div', {
      className: 'workflow-card-header'
    });

    // Operation icon and title
    const titleEl = DomUtils.createElement('div', {
      className: 'workflow-card-title'
    }, logEntry.message);

    // Progress indicator
    const progressEl = DomUtils.createElement('div', {
      className: 'workflow-progress'
    });
    
    const progressBarEl = DomUtils.createElement('div', {
      className: 'workflow-progress-bar'
    });
    
    const progressFillEl = DomUtils.createElement('div', {
      className: 'workflow-progress-fill',
      style: 'width: 10%'
    });
    
    progressBarEl.appendChild(progressFillEl);
    progressEl.appendChild(progressBarEl);

    // Timestamp
    const timestampEl = DomUtils.createElement('div', {
      className: 'workflow-card-timestamp'
    }, timestamp);

    headerEl.appendChild(titleEl);
    headerEl.appendChild(progressEl);
    headerEl.appendChild(timestampEl);

    // Steps container
    const stepsEl = DomUtils.createElement('div', {
      className: 'workflow-steps'
    });

    // Add initial step
    const initialStep = DomUtils.createElement('div', {
      className: 'workflow-step active'
    }, '⏳ ' + logEntry.message);
    
    stepsEl.appendChild(initialStep);

    // Assemble card
    cardElement.appendChild(headerEl);
    cardElement.appendChild(stepsEl);

    // Track the operation
    this.activeOperations.set(opId, {
      id: opId,
      startTime: logEntry.timestamp,
      steps: [logEntry.message],
      element: cardElement,
      progressElement: progressFillEl,
      stepsElement: stepsEl,
      status: 'active'
    });

    this.operationElements.set(opId, cardElement);

    return cardElement;
  }

  /**
   * Update workflow operation progress
   * @param {string} operationId - Operation identifier
   * @param {Object} logEntry - Progress log entry
   */
  updateWorkflowProgress(operationId, logEntry) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const details = logEntry.details || {};
    
    // Add new step
    operation.steps.push(logEntry.message);
    
    // Create step element
    const stepEl = DomUtils.createElement('div', {
      className: 'workflow-step active'
    });
    
    // Determine step icon based on message content
    let icon = '⏳';
    if (logEntry.message.includes('✅') || logEntry.message.includes('Success') || logEntry.message.includes('completed')) {
      icon = '✅';
      operation.status = 'completed';
    } else if (logEntry.message.includes('❌') || logEntry.message.includes('Failed') || logEntry.message.includes('Error')) {
      icon = '❌';
      operation.status = 'failed';
    } else if (logEntry.message.includes('⚠️') || logEntry.message.includes('Warning')) {
      icon = '⚠️';
    } else if (logEntry.message.includes('🔍') || logEntry.message.includes('Search')) {
      icon = '🔍';
    } else if (logEntry.message.includes('💾') || logEntry.message.includes('Stor')) {
      icon = '💾';
    } else if (logEntry.message.includes('🎯') || logEntry.message.includes('Generat')) {
      icon = '🎯';
    }
    
    stepEl.textContent = icon + ' ' + logEntry.message;
    operation.stepsElement.appendChild(stepEl);

    // Update progress bar
    const progressPercent = Math.min(100, (operation.steps.length / 8) * 100); // Assume max 8 steps
    operation.progressElement.style.width = `${progressPercent}%`;

    // Update card status
    operation.element.className = `workflow-operation-card ${operation.status}`;

    // If operation completed, mark as finished after a delay
    if (operation.status === 'completed' || operation.status === 'failed') {
      setTimeout(() => {
        operation.element.classList.add('finished');
        this.activeOperations.delete(operationId);
      }, 2000);
    }
  }

  /**
   * Create a workflow step element
   * @param {Object} logEntry - Log entry data
   * @returns {HTMLElement} Step element
   */
  createWorkflowStepElement(logEntry) {
    const timestamp = consoleService.formatTimestamp(logEntry.timestamp);
    
    const stepElement = DomUtils.createElement('div', {
      className: `workflow-step-entry ${logEntry.level}`,
      'data-log-id': logEntry.id
    });

    // Step content
    const contentEl = DomUtils.createElement('div', {
      className: 'workflow-step-content'
    });

    // Message with icon
    const messageEl = DomUtils.createElement('span', {
      className: 'workflow-step-message'
    }, logEntry.message);

    // Timestamp
    const timestampEl = DomUtils.createElement('span', {
      className: 'workflow-step-timestamp'
    }, timestamp);

    contentEl.appendChild(messageEl);
    contentEl.appendChild(timestampEl);
    stepElement.appendChild(contentEl);

    // Add technical details if present
    if (logEntry.details?.technical) {
      const technicalEl = DomUtils.createElement('div', {
        className: 'workflow-step-technical'
      }, logEntry.details.technical);
      stepElement.appendChild(technicalEl);
    }

    return stepElement;
  }

  /**
   * Format log details for display
   * @param {*} details - Details object
   * @returns {string} Formatted details string
   */
  formatDetails(details) {
    if (typeof details === 'string') {
      return details;
    }
    
    if (typeof details === 'object') {
      try {
        return JSON.stringify(details, null, 2);
      } catch (error) {
        return '[Unable to display object details]';
      }
    }
    
    return String(details);
  }

  /**
   * Clear the console display
   */
  clearDisplay() {
    if (!this.logsContainer) return;

    // Remove all log entries
    const logEntries = this.logsContainer.querySelectorAll('.console-log-entry');
    logEntries.forEach(entry => entry.remove());

    // Show placeholder
    if (this.placeholder) {
      DomUtils.show(this.placeholder);
    }
  }

  /**
   * Refresh the entire display based on current filter
   */
  refreshDisplay() {
    if (!this.logsContainer) return;

    // Clear current display
    const logEntries = this.logsContainer.querySelectorAll('.console-log-entry');
    logEntries.forEach(entry => entry.remove());

    // Get filtered logs
    const logs = consoleService.getLogs(this.currentFilter);

    if (logs.length === 0) {
      // Show placeholder
      if (this.placeholder) {
        DomUtils.show(this.placeholder);
      }
    } else {
      // Hide placeholder
      if (this.placeholder) {
        DomUtils.hide(this.placeholder);
      }

      // Add filtered logs (limit to last 500 for performance)
      const recentLogs = logs.slice(-500);
      recentLogs.forEach(log => {
        const logElement = this.createLogElement(log);
        this.logsContainer.appendChild(logElement);
      });

      // Auto-scroll to bottom
      if (this.isAutoScrollEnabled) {
        this.scrollToBottom();
      }
    }
  }

  /**
   * Scroll console to bottom
   */
  scrollToBottom() {
    if (this.logsContainer) {
      this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }
  }

  /**
   * Handle clear button click
   */
  handleClearClick() {
    consoleService.clear();
  }

  /**
   * Handle auto-scroll toggle
   */
  handleAutoScrollToggle() {
    this.isAutoScrollEnabled = !this.isAutoScrollEnabled;
    consoleService.setAutoScroll(this.isAutoScrollEnabled);
    this.updateAutoScrollButton(this.isAutoScrollEnabled);

    // If enabling auto-scroll, scroll to bottom
    if (this.isAutoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  /**
   * Update auto-scroll button appearance
   * @param {boolean} enabled - Whether auto-scroll is enabled
   */
  updateAutoScrollButton(enabled) {
    if (!this.autoScrollButton) return;

    if (enabled) {
      DomUtils.addClass(this.autoScrollButton, 'active');
    } else {
      DomUtils.removeClass(this.autoScrollButton, 'active');
    }
  }

  /**
   * Handle level filter change
   */
  handleLevelFilterChange() {
    if (!this.levelFilter) return;

    this.currentFilter = this.levelFilter.value;
    consoleService.setLevelFilter(this.currentFilter);
    this.refreshDisplay();

    consoleService.info(`Console filter changed to: ${this.currentFilter}`);
  }

  /**
   * Get current console statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return consoleService.getStats();
  }

  /**
   * Export console logs
   * @returns {string} JSON string of logs
   */
  exportLogs() {
    return consoleService.exportLogs();
  }

  /**
   * Import console logs
   * @param {string} jsonString - JSON string to import
   */
  importLogs(jsonString) {
    const count = consoleService.importLogs(jsonString);
    this.refreshDisplay();
    return count;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Remove event listeners
    if (this.clearButton) {
      this.clearButton.removeEventListener('click', this.handleClearClick);
    }
    
    if (this.autoScrollButton) {
      this.autoScrollButton.removeEventListener('click', this.handleAutoScrollToggle);
    }
    
    if (this.levelFilter) {
      this.levelFilter.removeEventListener('change', this.handleLevelFilterChange);
    }

    // Unsubscribe from console service
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Export the component
export default ConsoleComponent;