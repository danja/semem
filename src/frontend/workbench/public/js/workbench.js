/**
 * Main Workbench Application
 * Entry point for Semantic Memory Workbench
 */

import { apiService } from './services/ApiService.js';
import { stateManager } from './services/StateManager.js';
import { consoleService } from './services/ConsoleService.js';
import ConsoleComponent from './components/ConsoleComponent.js';
import DomUtils from './utils/DomUtils.js';

class WorkbenchApp {
  constructor() {
    this.components = {};
    this.initialized = false;
    
    // Bind methods
    this.handleTellSubmit = this.handleTellSubmit.bind(this);
    this.handleAskSubmit = this.handleAskSubmit.bind(this);
    this.handleAugmentSubmit = this.handleAugmentSubmit.bind(this);
    this.handleZoomChange = this.handleZoomChange.bind(this);
    this.handlePanChange = this.handlePanChange.bind(this);
    this.handleTiltChange = this.handleTiltChange.bind(this);
    this.handlePanelToggle = this.handlePanelToggle.bind(this);
    this.handleInspectAction = this.handleInspectAction.bind(this);
    this.updateConnectionStatus = this.updateConnectionStatus.bind(this);
    this.updateSessionStats = this.updateSessionStats.bind(this);
    this.updateZptDisplay = this.updateZptDisplay.bind(this);
  }

  /**
   * Initialize the workbench application
   */
  async init() {
    if (this.initialized) return;

    console.log('🚀 Initializing Semantic Memory Workbench...');
    
    try {
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize state subscriptions
      this.setupStateSubscriptions();
      
      // Initialize UI components
      this.initializeComponents();
      
      // Update initial UI state
      this.updateUI();
      
      this.initialized = true;
      console.log('✅ Workbench initialization complete');
      
      // Log successful initialization
      consoleService.success('Workbench initialized successfully', {
        components: Object.keys(this.components),
        timestamp: new Date().toISOString()
      });
      
      // Show success toast
      DomUtils.showToast('Workbench initialized successfully', 'success', 3000);
      
    } catch (error) {
      console.error('❌ Failed to initialize workbench:', error);
      DomUtils.showToast('Failed to initialize workbench: ' + error.message, 'error');
    }
  }

  // ===== EVENT LISTENERS SETUP =====

  setupEventListeners() {
    // Tell form
    const tellForm = DomUtils.$('#tell-form');
    if (tellForm) {
      tellForm.addEventListener('submit', this.handleTellSubmit);
    }
    
    // Ask form
    const askForm = DomUtils.$('#ask-form');
    if (askForm) {
      askForm.addEventListener('submit', this.handleAskSubmit);
    }
    
    // Augment form
    const augmentForm = DomUtils.$('#augment-form');
    if (augmentForm) {
      augmentForm.addEventListener('submit', this.handleAugmentSubmit);
    }
    
    // Navigation controls
    this.setupNavigationControls();
    
    // Panel toggles
    this.setupPanelToggles();
    
    // Inspect controls
    this.setupInspectControls();
  }

  setupNavigationControls() {
    // Zoom buttons
    DomUtils.$$('.zoom-button').forEach(button => {
      button.addEventListener('click', this.handleZoomChange);
    });
    
    // Tilt buttons
    DomUtils.$$('.tilt-button').forEach(button => {
      button.addEventListener('click', this.handleTiltChange);
    });
    
    // Pan input changes (debounced)
    const panDomains = DomUtils.$('#pan-domains');
    const panKeywords = DomUtils.$('#pan-keywords');
    
    if (panDomains) {
      panDomains.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }
    
    if (panKeywords) {
      panKeywords.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }
  }

  setupPanelToggles() {
    DomUtils.$$('.panel-toggle').forEach(button => {
      button.addEventListener('click', this.handlePanelToggle);
    });
  }

  setupInspectControls() {
    DomUtils.$$('.inspect-button').forEach(button => {
      button.addEventListener('click', this.handleInspectAction);
    });
  }

  setupStateSubscriptions() {
    // Subscribe to state changes
    stateManager.subscribe('stateChange', this.updateUI.bind(this));
    stateManager.subscribe('zoomChange', this.updateZptDisplay);
    stateManager.subscribe('panChange', this.updateZptDisplay);
    stateManager.subscribe('tiltChange', this.updateZptDisplay);
    stateManager.subscribe('error', this.handleError.bind(this));
  }

  // ===== COMPONENT INITIALIZATION =====

  initializeComponents() {
    // Initialize all interactive components
    this.initializeTellComponent();
    this.initializeAskComponent();
    this.initializeNavigateComponent();
    this.initializeDashboardComponent();
    this.initializeConsoleComponent();
  }

  initializeTellComponent() {
    const component = DomUtils.$('#tell-component');
    if (!component) return;
    
    this.components.tell = {
      form: DomUtils.$('#tell-form', component),
      results: DomUtils.$('#tell-results', component),
      button: DomUtils.$('#tell-submit', component)
    };
  }

  initializeAskComponent() {
    const component = DomUtils.$('#ask-component');
    if (!component) return;
    
    this.components.ask = {
      form: DomUtils.$('#ask-form', component),
      results: DomUtils.$('#ask-results', component),
      button: DomUtils.$('#ask-submit', component)
    };
  }

  initializeNavigateComponent() {
    const component = DomUtils.$('#navigate-component');
    if (!component) return;
    
    this.components.navigate = {
      zoomButtons: DomUtils.$$('.zoom-button', component),
      tiltButtons: DomUtils.$$('.tilt-button', component),
      panDomains: DomUtils.$('#pan-domains', component),
      panKeywords: DomUtils.$('#pan-keywords', component)
    };
  }

  initializeDashboardComponent() {
    this.components.dashboard = {
      interactionsCount: DomUtils.$('#interactions-count'),
      conceptsCount: DomUtils.$('#concepts-count'),
      sessionDuration: DomUtils.$('#session-duration'),
      zoomState: DomUtils.$('#zoom-state'),
      panState: DomUtils.$('#pan-state'),
      tiltState: DomUtils.$('#tilt-state'),
      connectionStatus: DomUtils.$('#connection-status')
    };
  }

  initializeConsoleComponent() {
    this.components.console = new ConsoleComponent();
    this.components.console.init();
  }

  // ===== EVENT HANDLERS =====

  async handleTellSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = DomUtils.getFormData(form);
    const button = this.components.tell.button;
    const results = this.components.tell.results;
    
    const startTime = Date.now();
    const logId = consoleService.logOperationStart('tell', {
      type: formData.type,
      contentLength: formData.content?.length || 0,
      hasTags: Boolean(formData.tags)
    });
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      const result = await apiService.tell({
        content: formData.content,
        type: formData.type || 'interaction',
        metadata: formData.tags ? { tags: formData.tags.split(',').map(t => t.trim()) } : {}
      });
      
      const duration = Date.now() - startTime;
      consoleService.logOperationSuccess('tell', result, duration);
      
      // Update session stats
      stateManager.updateSessionStats({
        interactionsCount: stateManager.getState().session.interactionsCount + 1
      });
      
      // Show results
      this.displayTellResults(results, result);
      
      // Clear form
      DomUtils.resetForm(form);
      
      DomUtils.showToast('Content stored successfully', 'success');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.logOperationError('tell', error, duration);
      console.error('Tell operation failed:', error);
      DomUtils.showToast('Failed to store content: ' + apiService.getErrorMessage(error), 'error');
    } finally {
      DomUtils.setButtonLoading(button, false);
    }
  }

  async handleAskSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = DomUtils.getFormData(form);
    const button = this.components.ask.button;
    const results = this.components.ask.results;
    
    const startTime = Date.now();
    const logId = consoleService.logOperationStart('ask', {
      mode: formData.mode,
      useContext: Boolean(formData.useContext),
      questionLength: formData.question?.length || 0
    });
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      const result = await apiService.ask({
        question: formData.question,
        mode: formData.mode || 'standard',
        useContext: Boolean(formData.useContext)
      });
      
      const duration = Date.now() - startTime;
      consoleService.logOperationSuccess('ask', result, duration);
      
      // Update session stats
      stateManager.updateSessionStats({
        interactionsCount: stateManager.getState().session.interactionsCount + 1
      });
      
      // Show results
      this.displayAskResults(results, result);
      
      DomUtils.showToast('Query completed', 'success');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.logOperationError('ask', error, duration);
      console.error('Ask operation failed:', error);
      DomUtils.showToast('Failed to query: ' + apiService.getErrorMessage(error), 'error');
    } finally {
      DomUtils.setButtonLoading(button, false);
    }
  }

  async handleAugmentSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = DomUtils.getFormData(form);
    const results = DomUtils.$('#augment-results');
    
    const startTime = Date.now();
    const logId = consoleService.logOperationStart('augment', {
      operation: formData.operation || 'auto',
      targetLength: formData.target?.length || 0
    });
    
    try {
      stateManager.setLoadingState('augment', true);
      
      const result = await apiService.augment({
        target: formData.target,
        operation: formData.operation || 'auto'
      });
      
      const duration = Date.now() - startTime;
      consoleService.logOperationSuccess('augment', result, duration);
      
      // Show results
      this.displayAugmentResults(results, result);
      
      DomUtils.showToast('Analysis completed', 'success');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.logOperationError('augment', error, duration);
      console.error('Augment operation failed:', error);
      DomUtils.showToast('Failed to analyze: ' + apiService.getErrorMessage(error), 'error');
    } finally {
      stateManager.setLoadingState('augment', false);
    }
  }

  async handleZoomChange(event) {
    const button = event.target;
    const level = button.dataset.level;
    
    if (!level) return;
    
    const oldState = stateManager.getState();
    
    try {
      // Update button states
      DomUtils.$$('.zoom-button').forEach(btn => {
        DomUtils.removeClass(btn, 'active');
      });
      DomUtils.addClass(button, 'active');
      
      await stateManager.setZoom(level);
      
      const newState = stateManager.getState();
      consoleService.logStateChange('zoom', oldState, newState);
      
    } catch (error) {
      console.error('Zoom change failed:', error);
      consoleService.error('Failed to change zoom level', { level, error: error.message });
      DomUtils.showToast('Failed to change zoom level', 'error');
    }
  }

  async handleTiltChange(event) {
    const button = event.target;
    const style = button.dataset.style;
    
    if (!style) return;
    
    const oldState = stateManager.getState();
    
    try {
      // Update button states
      DomUtils.$$('.tilt-button').forEach(btn => {
        DomUtils.removeClass(btn, 'active');
      });
      DomUtils.addClass(button, 'active');
      
      await stateManager.setTilt(style);
      
      const newState = stateManager.getState();
      consoleService.logStateChange('tilt', oldState, newState);
      
    } catch (error) {
      console.error('Tilt change failed:', error);
      consoleService.error('Failed to change view style', { style, error: error.message });
      DomUtils.showToast('Failed to change view style', 'error');
    }
  }

  async handlePanChange() {
    const domainsInput = DomUtils.$('#pan-domains');
    const keywordsInput = DomUtils.$('#pan-keywords');
    
    const domains = domainsInput?.value || '';
    const keywords = keywordsInput?.value || '';
    
    const oldState = stateManager.getState();
    
    try {
      await stateManager.setPan({ domains, keywords });
      
      const newState = stateManager.getState();
      consoleService.logStateChange('pan', oldState, newState);
      
    } catch (error) {
      console.error('Pan change failed:', error);
      consoleService.error('Failed to update filters', { domains, keywords, error: error.message });
      DomUtils.showToast('Failed to update filters', 'error');
    }
  }

  handlePanelToggle(event) {
    const button = event.target;
    const panelData = button.dataset.panel;
    
    if (!panelData) return;
    
    const panel = DomUtils.$(`#${panelData}-panel`);
    const content = panel?.querySelector('.panel-content');
    const icon = button.querySelector('.toggle-icon');
    
    if (!panel || !content) return;
    
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    
    // Toggle panel
    button.setAttribute('aria-expanded', !isExpanded);
    DomUtils.toggle(content);
    
    // Update icon
    if (icon) {
      icon.textContent = isExpanded ? '▼' : '▲';
    }
    
    // Update state
    stateManager.togglePanel(panelData);
  }

  async handleInspectAction(event) {
    const button = event.target;
    const inspectType = button.dataset.inspect;
    const results = DomUtils.$('#inspect-results');
    
    if (!inspectType || !results) return;
    
    try {
      stateManager.setLoadingState('inspect', true);
      
      let result;
      
      switch (inspectType) {
        case 'session':
          result = { state: stateManager.getState() };
          break;
        case 'concepts':
          result = await apiService.getState();
          break;
        case 'all':
          result = {
            localState: stateManager.getState(),
            serverState: await apiService.getState(),
            health: await apiService.getHealth()
          };
          break;
        default:
          throw new Error(`Unknown inspect type: ${inspectType}`);
      }
      
      this.displayInspectResults(results, result);
      
    } catch (error) {
      console.error('Inspect operation failed:', error);
      DomUtils.showToast('Failed to inspect: ' + apiService.getErrorMessage(error), 'error');
    } finally {
      stateManager.setLoadingState('inspect', false);
    }
  }

  handleError(errorData) {
    console.error('State manager error:', errorData);
    DomUtils.showToast(`${errorData.type} error: ${errorData.error.message}`, 'error');
  }

  // ===== UI UPDATE METHODS =====

  updateUI() {
    this.updateConnectionStatus();
    this.updateSessionStats();
    this.updateZptDisplay();
    this.updateLoadingStates();
  }

  updateConnectionStatus() {
    const statusElement = this.components.dashboard.connectionStatus;
    if (!statusElement) return;
    
    const state = stateManager.getState();
    const { status, error } = state.connection;
    
    // Remove all status classes
    statusElement.classList.remove('connected', 'error');
    
    // Add current status class
    statusElement.classList.add(status);
    
    // Update status text
    const statusText = statusElement.querySelector('.status-text');
    if (statusText) {
      const statusTexts = {
        connecting: 'Connecting...',
        connected: 'Connected',
        error: error || 'Connection Error'
      };
      statusText.textContent = statusTexts[status] || 'Unknown';
    }
  }

  updateSessionStats() {
    const state = stateManager.getState();
    const { interactionsCount, conceptsCount } = state.session;
    
    // Update interactions count
    const interactionsElement = this.components.dashboard.interactionsCount;
    if (interactionsElement) {
      interactionsElement.textContent = interactionsCount;
    }
    
    // Update concepts count
    const conceptsElement = this.components.dashboard.conceptsCount;
    if (conceptsElement) {
      conceptsElement.textContent = conceptsCount;
    }
    
    // Update duration
    const durationElement = this.components.dashboard.sessionDuration;
    if (durationElement) {
      durationElement.textContent = stateManager.getFormattedDuration();
    }
  }

  updateZptDisplay() {
    const state = stateManager.getState();
    
    // Update zoom display
    const zoomElement = this.components.dashboard.zoomState;
    if (zoomElement) {
      zoomElement.textContent = state.zoom;
    }
    
    // Update pan display
    const panElement = this.components.dashboard.panState;
    if (panElement) {
      panElement.textContent = stateManager.getPanDisplayString();
    }
    
    // Update tilt display
    const tiltElement = this.components.dashboard.tiltState;
    if (tiltElement) {
      tiltElement.textContent = state.tilt;
    }
  }

  updateLoadingStates() {
    const state = stateManager.getState();
    const loadingStates = state.ui.loadingStates;
    
    // Update button loading states based on state manager
    Object.entries(loadingStates).forEach(([operation, loading]) => {
      const button = DomUtils.$(`[data-operation="${operation}"]`);
      if (button) {
        DomUtils.setButtonLoading(button, loading);
      }
    });
  }

  // ===== RESULT DISPLAY METHODS =====

  displayTellResults(container, result) {
    if (!container) return;
    
    container.innerHTML = '';
    DomUtils.show(container);
    
    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, 'Content Stored'),
        DomUtils.createElement('div', { className: 'result-meta' }, [
          DomUtils.createElement('span', { className: 'status-badge success' }, 'Success')
        ])
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, [
        DomUtils.createElement('p', {}, `Successfully stored content with ID: ${result.id || 'Generated'}`),
        result.concepts && DomUtils.createElement('div', { className: 'concept-list' }, 
          result.concepts.map(concept => 
            DomUtils.createElement('span', { className: 'concept-tag' }, concept)
          )
        )
      ].filter(Boolean))
    ]);
    
    container.appendChild(resultElement);
  }

  displayAskResults(container, result) {
    if (!container) return;
    
    container.innerHTML = '';
    
    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, 'Query Results'),
        DomUtils.createElement('div', { className: 'result-meta' }, [
          result.performance && DomUtils.createElement('span', { className: 'performance-badge' }, 
            `${result.performance.duration}ms`)
        ].filter(Boolean))
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, [
        result.answer && DomUtils.createElement('p', {}, result.answer),
        result.relatedConcepts && DomUtils.createElement('div', { className: 'concept-list' },
          result.relatedConcepts.map(concept =>
            DomUtils.createElement('span', { className: 'concept-tag secondary' }, concept)
          )
        )
      ].filter(Boolean))
    ]);
    
    container.appendChild(resultElement);
  }

  displayAugmentResults(container, result) {
    if (!container) return;
    
    container.innerHTML = '';
    DomUtils.show(container);
    
    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, 'Analysis Results')
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, [
        result.concepts && DomUtils.createElement('div', {}, [
          DomUtils.createElement('h4', {}, 'Extracted Concepts:'),
          DomUtils.createElement('div', { className: 'concept-list' },
            result.concepts.map(concept =>
              DomUtils.createElement('span', { className: 'concept-tag' }, concept)
            )
          )
        ]),
        result.summary && DomUtils.createElement('p', {}, result.summary)
      ].filter(Boolean))
    ]);
    
    container.appendChild(resultElement);
  }

  displayInspectResults(container, result) {
    if (!container) return;
    
    container.innerHTML = '';
    DomUtils.show(container);
    
    const codeBlock = DomUtils.createElement('div', { className: 'code-block' });
    codeBlock.textContent = JSON.stringify(result, null, 2);
    
    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, 'Inspection Data')
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, codeBlock)
    ]);
    
    container.appendChild(resultElement);
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new WorkbenchApp();
  await app.init();
});

// Export for testing
export default WorkbenchApp;