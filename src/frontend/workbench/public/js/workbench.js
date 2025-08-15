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
      
      // Type dropdown change handler
      const typeSelect = DomUtils.$('#tell-type');
      if (typeSelect) {
        typeSelect.addEventListener('change', this.handleTellTypeChange.bind(this));
      }
      
      // File upload controls
      this.setupFileUploadControls();
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
    
    // Check if this is a file upload (document type with file selected)
    const fileInput = DomUtils.$('#document-file');
    const hasFile = fileInput && fileInput.files.length > 0;
    const isDocumentType = formData.type === 'document';
    
    const startTime = Date.now();
    const logId = consoleService.logOperationStart('tell', {
      type: formData.type,
      contentLength: formData.content?.length || 0,
      hasTags: Boolean(formData.tags),
      hasFile: hasFile
    });
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      let result;
      
      if (isDocumentType && hasFile) {
        // Handle file upload
        result = await this.handleDocumentUpload(fileInput.files[0], formData);
      } else {
        // Handle regular text input
        if (!formData.content?.trim()) {
          throw new Error('Please provide content or upload a file');
        }
        
        result = await apiService.tell({
          content: formData.content,
          type: formData.type || 'interaction',
          metadata: formData.tags ? { tags: formData.tags.split(',').map(t => t.trim()) } : {}
        });
      }
      
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

  // ===== FILE UPLOAD HANDLING =====

  setupFileUploadControls() {
    const fileInput = DomUtils.$('#document-file');
    const selectButton = DomUtils.$('#select-file-button');
    const removeButton = DomUtils.$('#remove-file-button');
    
    if (fileInput && selectButton) {
      // File select button handler
      selectButton.addEventListener('click', () => {
        fileInput.click();
      });
      
      // File input change handler
      fileInput.addEventListener('change', this.handleFileSelection.bind(this));
    }
    
    if (removeButton) {
      removeButton.addEventListener('click', this.handleFileRemoval.bind(this));
    }
  }

  handleTellTypeChange(event) {
    const selectedType = event.target.value;
    const uploadSection = DomUtils.$('#document-upload-section');
    const contentTextarea = DomUtils.$('#tell-content');
    
    if (selectedType === 'document') {
      DomUtils.show(uploadSection);
      contentTextarea.placeholder = 'Upload a document file or enter document content manually...';
      contentTextarea.removeAttribute('required');
    } else {
      DomUtils.hide(uploadSection);
      contentTextarea.placeholder = 'Enter information to store in semantic memory...';
      contentTextarea.setAttribute('required', 'required');
      // Clear any selected file
      this.clearSelectedFile();
    }
  }

  handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file) {
      this.clearSelectedFile();
      return;
    }

    // Log file selection
    consoleService.info('File selected for upload', {
      filename: file.name,
      fileSize: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });

    // Validate file type and infer document type
    const fileType = this.getFileTypeFromExtension(file.name);
    if (!fileType) {
      consoleService.logWarning('Unsupported file type selected', {
        filename: file.name,
        extension: file.name.split('.').pop()
      });
      DomUtils.showToast('Unsupported file type. Please select a PDF, TXT, or MD file.', 'error');
      this.clearSelectedFile();
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      consoleService.logWarning('File too large for upload', {
        filename: file.name,
        fileSize: file.size,
        maxSize: maxSize
      });
      DomUtils.showToast('File too large. Please select a file under 10MB.', 'error');
      this.clearSelectedFile();
      return;
    }

    // Log successful validation
    consoleService.success('File validation passed', {
      filename: file.name,
      documentType: fileType,
      fileSize: this.formatFileSize(file.size)
    });

    // Display selected file info
    this.displaySelectedFile(file, fileType);
  }

  getFileTypeFromExtension(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    const typeMap = {
      'pdf': 'pdf',
      'txt': 'text',
      'md': 'markdown'
    };
    return typeMap[extension] || null;
  }

  displaySelectedFile(file, fileType) {
    const selectedFileInfo = DomUtils.$('#selected-file-info');
    const fileName = DomUtils.$('#selected-file-name');
    const fileSize = DomUtils.$('#selected-file-size');
    
    if (selectedFileInfo && fileName && fileSize) {
      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      DomUtils.show(selectedFileInfo);
      
      // Hide the upload area
      const uploadArea = DomUtils.$('.file-upload-info');
      if (uploadArea) {
        DomUtils.hide(uploadArea);
      }
    }
  }

  handleFileRemoval() {
    this.clearSelectedFile();
  }

  clearSelectedFile() {
    const fileInput = DomUtils.$('#document-file');
    const selectedFileInfo = DomUtils.$('#selected-file-info');
    const uploadArea = DomUtils.$('.file-upload-info');
    
    if (fileInput) {
      fileInput.value = '';
    }
    
    if (selectedFileInfo) {
      DomUtils.hide(selectedFileInfo);
    }
    
    if (uploadArea) {
      DomUtils.show(uploadArea);
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async handleDocumentUpload(file, formData) {
    const fileType = this.getFileTypeFromExtension(file.name);
    const uploadStartTime = Date.now();
    
    // Log upload start
    consoleService.info('Document upload started', {
      filename: file.name,
      fileType: fileType,
      fileSize: file.size,
      mediaType: this.getMediaType(fileType)
    });
    
    try {
      // Create a temporary file URL for the MCP service
      consoleService.info('Processing file for upload...', { step: 'file_processing' });
      const fileUrl = await this.createFileUrl(file);
      
      // Call the MCP document upload service
      consoleService.info('Sending document to MCP service...', { 
        step: 'mcp_upload',
        documentType: fileType 
      });
      
      const result = await apiService.uploadDocument({
        fileUrl: fileUrl,
        filename: file.name,
        mediaType: this.getMediaType(fileType),
        documentType: fileType,
        metadata: {
          originalName: file.name,
          size: file.size,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
          uploadedAt: new Date().toISOString()
        }
      });
      
      const uploadDuration = Date.now() - uploadStartTime;
      consoleService.success('Document upload completed', {
        filename: file.name,
        duration: uploadDuration,
        processed: result.success || false,
        concepts: result.concepts || 0
      });
      
      return result;
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      consoleService.error('Document upload failed', {
        filename: file.name,
        duration: uploadDuration,
        error: error.message,
        fileType: fileType
      });
      
      console.error('Document upload failed:', error);
      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  async createFileUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  getMediaType(fileType) {
    const mediaTypes = {
      'pdf': 'application/pdf',
      'text': 'text/plain',
      'markdown': 'text/markdown'
    };
    return mediaTypes[fileType] || 'application/octet-stream';
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
        result.concepts && DomUtils.createElement('div', { className: 'concept-info' }, 
          Array.isArray(result.concepts) 
            ? DomUtils.createElement('div', { className: 'concept-list' },
                result.concepts.map(concept => 
                  DomUtils.createElement('span', { className: 'concept-tag' }, concept)
                )
              )
            : DomUtils.createElement('span', { className: 'concept-count' }, 
                `${result.concepts} concepts extracted`
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
          Array.isArray(result.concepts) 
            ? DomUtils.createElement('div', { className: 'concept-list' },
                result.concepts.map(concept =>
                  DomUtils.createElement('span', { className: 'concept-tag' }, concept)
                )
              )
            : DomUtils.createElement('span', { className: 'concept-count' }, 
                `${result.concepts} concepts found`
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