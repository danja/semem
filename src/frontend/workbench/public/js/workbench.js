/**
 * Main Workbench Application
 * Entry point for Semantic Memory Workbench
 */

import { apiService } from './services/ApiService.js';
import { stateManager } from './services/StateManager.js';
import { consoleService } from './services/ConsoleService.js';
import ConsoleComponent from './components/ConsoleComponent.js';
import MemoryComponent from './components/MemoryComponent.js';
import ChatComponent from './components/ChatComponent.js';
import DomUtils from './utils/DomUtils.js';

class WorkbenchApp {
  constructor() {
    this.components = {};
    this.initialized = false;
    
    // Bind methods
    this.handleTellSubmit = this.handleTellSubmit.bind(this);
    this.handleAskSubmit = this.handleAskSubmit.bind(this);
    this.handleAugmentSubmit = this.handleAugmentSubmit.bind(this);
    this.handleAugmentOperationChange = this.handleAugmentOperationChange.bind(this);
    this.handleZoomChange = this.handleZoomChange.bind(this);
    this.handlePanChange = this.handlePanChange.bind(this);
    this.handleTiltChange = this.handleTiltChange.bind(this);
    this.handleThresholdChange = this.handleThresholdChange.bind(this);
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
      
      // Initialize navigation display
      this.updateNavigationDisplay();
      
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
      tellForm.addEventListener('submit', this.handleTellSubmit.bind(this));
      
      // Type dropdown change handler
      const typeSelect = DomUtils.$('#tell-type');
      if (typeSelect) {
        typeSelect.addEventListener('change', this.handleTellTypeChange.bind(this));
        // Initialize UI state based on current selection
        this.handleTellTypeChange({ target: typeSelect });
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
      
      // Operation dropdown change handler
      const operationSelect = DomUtils.$('#augment-operation');
      if (operationSelect) {
        operationSelect.addEventListener('change', this.handleAugmentOperationChange.bind(this));
        // Initialize UI state based on current selection
        this.handleAugmentOperationChange({ target: operationSelect });
      }
    }
    
    // Navigation controls
    this.setupNavigationControls();
    
    // Panel toggles
    this.setupPanelToggles();
    
    // Inspect controls
    this.setupInspectControls();
    
    // Modal controls
    this.setupModalControls();
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
    
    // Threshold slider
    const thresholdSlider = DomUtils.$('#similarity-threshold');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', this.handleThresholdChange);
    }
    
    // Pan input changes (debounced)
    const panDomains = DomUtils.$('#pan-domains');
    const panKeywords = DomUtils.$('#pan-keywords');
    
    if (panDomains) {
      panDomains.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }
    
    if (panKeywords) {
      panKeywords.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }
    
    // Navigation execute button
    const navExecuteButton = DomUtils.$('#nav-execute');
    if (navExecuteButton) {
      navExecuteButton.addEventListener('click', this.handleNavigationExecute.bind(this));
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

  setupModalControls() {
    // Close button for inspect modal
    const closeButton = DomUtils.$('#close-inspect-results');
    const modal = DomUtils.$('#inspect-results-modal');
    const backdrop = modal?.querySelector('.modal-backdrop');
    
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeInspectModal();
      });
    }
    
    // Close on backdrop click
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        this.closeInspectModal();
      });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = DomUtils.$('#inspect-results-modal');
        if (modal && modal.style.display !== 'none') {
          this.closeInspectModal();
        }
      }
    });
  }

  closeInspectModal() {
    const modal = DomUtils.$('#inspect-results-modal');
    if (modal) {
      // Hide modal immediately without animation for better UX
      modal.style.display = 'none';
      modal.style.animation = '';
    }
    
    // Clear active states from inspect buttons
    DomUtils.$$('.inspect-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
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
    this.initializeMemoryComponent();
    this.initializeChatComponent();
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

  initializeMemoryComponent() {
    // Only initialize if memory panel exists in the DOM
    const memoryPanel = DomUtils.$('#memory-panel');
    if (memoryPanel) {
      this.components.memory = new MemoryComponent();
      this.components.memory.init().catch(error => {
        consoleService.error('Failed to initialize Memory Component', error);
      });
    }
  }

  initializeChatComponent() {
    // Initialize the chat component
    const chatContainer = DomUtils.$('#chat-container');
    if (chatContainer) {
      this.components.chat = new ChatComponent();
      this.components.chat.init().catch(error => {
        consoleService.error('Failed to initialize Chat Component', error);
        console.error('❌ Chat component initialization failed:', error);
      });
    } else {
      console.warn('⚠️ Chat container not found, chat component not initialized');
    }
  }

  // ===== EVENT HANDLERS =====

  async handleTellSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = DomUtils.getFormData(form);
    const button = this.components.tell.button;
    const results = this.components.tell.results;
    
    // Debug: Log form data to console
    console.log('DEBUG: Form data extracted:', formData);
    
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
      } else if (isDocumentType && !hasFile) {
        // Document type selected but no file provided
        throw new Error('Please select a file to upload for document type');
      } else {
        // Handle regular text input
        if (!formData.content?.trim()) {
          throw new Error('Please provide content to store');
        }
        
        result = await apiService.tell({
          content: formData.content,
          type: formData.type || 'interaction',
          lazy: formData.lazy || false,
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
      
      // Show user-friendly error message
      DomUtils.showMessage(results, error.message, 'error');
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
      // Show upload section
      if (uploadSection) {
        uploadSection.style.display = 'block';
      }
      contentTextarea.placeholder = 'Upload a document file or enter document content manually...';
      contentTextarea.removeAttribute('required');
    } else {
      // Hide upload section
      if (uploadSection) {
        uploadSection.style.display = 'none';
      }
      contentTextarea.placeholder = 'Enter information to store in semantic memory...';
      contentTextarea.setAttribute('required', 'required');
      // Clear any selected file
      this.clearSelectedFile();
    }
    
  }

  handleAugmentOperationChange(event) {
    const selectedOperation = event.target.value;
    const chunkingOptions = DomUtils.$('#chunking-options-section');
    const targetTextarea = DomUtils.$('#augment-target');
    
    if (selectedOperation === 'chunk_documents') {
      // Show chunking options
      if (chunkingOptions) {
        chunkingOptions.style.display = 'block';
      }
      // Update placeholder text to clarify that target is optional for chunking
      if (targetTextarea) {
        targetTextarea.placeholder = 'Leave empty to chunk all unprocessed documents, or enter specific document URI...';
        targetTextarea.removeAttribute('required');
      }
    } else {
      // Hide chunking options
      if (chunkingOptions) {
        chunkingOptions.style.display = 'none';
      }
      // Reset placeholder text for other operations
      if (targetTextarea) {
        if (selectedOperation === 'process_lazy') {
          targetTextarea.placeholder = 'Enter text to analyze (or leave empty for \'Process Lazy Content\')...';
        } else {
          targetTextarea.placeholder = 'Enter text to analyze...';
        }
      }
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

    // Validate file size (25MB limit for documents, especially PDFs)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      consoleService.logWarning('File too large for upload', {
        filename: file.name,
        fileSize: file.size,
        maxSize: maxSize
      });
      DomUtils.showToast('File too large. Please select a file under 25MB.', 'error');
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
    
    // Log upload start with comprehensive details
    console.log('🔄 [WORKBENCH UPLOAD] Document upload started');
    console.log(`📄 [WORKBENCH UPLOAD] File: ${file.name} (${file.size} bytes, type: ${fileType})`);
    consoleService.info('Document upload started', {
      filename: file.name,
      fileType: fileType,
      fileSize: file.size,
      mediaType: this.getMediaType(fileType)
    });
    
    try {
      // Create a temporary file URL for the MCP service
      console.log('🔄 [WORKBENCH UPLOAD] Step 1: Creating file URL...');
      consoleService.info('Processing file for upload...', { step: 'file_processing' });
      const fileUrl = await this.createFileUrl(file);
      console.log(`✅ [WORKBENCH UPLOAD] File URL created, length: ${fileUrl.length} chars`);
      
      // Prepare upload payload
      const uploadPayload = {
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
      };
      
      console.log('🔄 [WORKBENCH UPLOAD] Step 2: Prepared upload payload');
      console.log(`📤 [WORKBENCH UPLOAD] Payload metadata:`, uploadPayload.metadata);
      
      // Call the MCP document upload service
      console.log('🔄 [WORKBENCH UPLOAD] Step 3: Sending to MCP service...');
      consoleService.info('Sending document to MCP service...', { 
        step: 'mcp_upload',
        documentType: fileType 
      });
      
      const result = await apiService.uploadDocument(uploadPayload);
      
      const uploadDuration = Date.now() - uploadStartTime;
      console.log(`✅ [WORKBENCH UPLOAD] Document upload completed in ${uploadDuration}ms`);
      console.log('📊 [WORKBENCH UPLOAD] Result:', result);
      
      consoleService.success('Document upload completed', {
        filename: file.name,
        duration: uploadDuration,
        processed: result.success || false,
        concepts: result.concepts || 0,
        resultKeys: Object.keys(result || {})
      });
      
      return result;
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      console.error(`❌ [WORKBENCH UPLOAD] Document upload failed after ${uploadDuration}ms:`, error);
      
      consoleService.error('Document upload failed', {
        filename: file.name,
        duration: uploadDuration,
        error: error.message,
        errorStack: error.stack,
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
      useHyDE: Boolean(formData.useHyDE),
      useWikipedia: Boolean(formData.useWikipedia),
      useWikidata: Boolean(formData.useWikidata),
      questionLength: formData.question?.length || 0
    });
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      const result = await apiService.ask({
        question: formData.question,
        mode: formData.mode || 'standard',
        useContext: Boolean(formData.useContext),
        useHyDE: Boolean(formData.useHyDE),
        useWikipedia: Boolean(formData.useWikipedia),
        useWikidata: Boolean(formData.useWikidata),
        threshold: stateManager.getState().threshold
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
    
    // Handle special operations differently
    const isProcessLazy = formData.operation === 'process_lazy';
    const isChunkDocuments = formData.operation === 'chunk_documents';
    const target = isProcessLazy ? 'all' : (isChunkDocuments ? (formData.target || 'all') : formData.target);
    
    // Validate target content for non-special operations
    if (!isProcessLazy && !isChunkDocuments && !target?.trim()) {
      DomUtils.showMessage(results, 'Please provide target content to analyze', 'error');
      return;
    }
    
    const startTime = Date.now();
    const logId = consoleService.logOperationStart('augment', {
      operation: formData.operation || 'auto',
      targetLength: target?.length || 0,
      isProcessLazy,
      isChunkDocuments
    });
    
    // Build options object based on operation type
    let options = {};
    if (isProcessLazy) {
      options = { limit: 10 };
    } else if (isChunkDocuments) {
      // Collect chunking options from form
      options = {
        maxChunkSize: parseInt(formData.maxChunkSize) || 2000,
        minChunkSize: parseInt(formData.minChunkSize) || 100,
        overlapSize: parseInt(formData.overlapSize) || 100,
        strategy: formData.strategy || 'semantic',
        minContentLength: parseInt(formData.minContentLength) || 2000
      };
    }
    
    try {
      stateManager.setLoadingState('augment', true);
      
      const result = await apiService.augment({
        target: target,
        operation: formData.operation || 'auto',
        options: options
      });
      
      const duration = Date.now() - startTime;
      consoleService.logOperationSuccess('augment', result, duration);
      
      // Show results
      this.displayAugmentResults(results, result);
      
      let successMessage;
      if (isProcessLazy) {
        successMessage = 'Lazy content processed successfully';
      } else if (isChunkDocuments) {
        successMessage = 'Document chunking completed successfully';
      } else {
        successMessage = 'Analysis completed';
      }
      DomUtils.showToast(successMessage, 'success');
      
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
      
      // Update visual feedback
      this.updateNavigationDisplay();
      
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
      
      // Update visual feedback
      this.updateNavigationDisplay();
      
    } catch (error) {
      console.error('Tilt change failed:', error);
      consoleService.error('Failed to change view style', { style, error: error.message });
      DomUtils.showToast('Failed to change view style', 'error');
    }
  }

  async handleThresholdChange(event) {
    const slider = event.target;
    const threshold = parseFloat(slider.value);
    
    if (isNaN(threshold)) return;
    
    try {
      // Update threshold display
      const thresholdValue = DomUtils.$('#threshold-value');
      if (thresholdValue) {
        thresholdValue.textContent = threshold.toFixed(2);
      }
      
      // Store threshold in state manager for use in ask queries
      stateManager.setSimilarityThreshold(threshold);
      
      // Log threshold change
      consoleService.info(`Similarity threshold changed to ${threshold.toFixed(2)}`, { 
        threshold,
        type: 'threshold_change'
      });
      
    } catch (error) {
      console.error('Threshold change failed:', error);
      consoleService.error('Failed to change similarity threshold', { threshold, error: error.message });
      DomUtils.showToast('Failed to change threshold', 'error');
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
      
      // Update visual feedback
      this.updateNavigationDisplay();
      
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
    const button = event.target.closest('button');
    const inspectType = button.dataset.inspect;
    
    if (!inspectType) return;
    
    // Clear previous active states
    DomUtils.$$('.inspect-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
    });
    
    // Set current button as active
    DomUtils.addClass(button, 'active');
    
    const startTime = Date.now();
    consoleService.info(`Starting inspect operation: ${inspectType}`, {
      action: inspectType,
      buttonElement: button.textContent.trim(),
      timestamp: new Date().toISOString()
    });
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      let result;
      switch (inspectType) {
        case 'session':
          result = await apiService.inspectSession();
          break;
        case 'concepts':
          result = await apiService.inspectConcepts();
          break;
        case 'all':
          result = await apiService.inspectAllData();
          break;
        default:
          throw new Error(`Unknown inspect type: ${inspectType}`);
      }
      
      const duration = Date.now() - startTime;
      consoleService.success(`Inspect ${inspectType} completed`, {
        action: inspectType,
        dataKeys: Object.keys(result),
        recordCount: this.getRecordCount(result),
        duration
      });
      
      // Display results
      this.displayInspectResults(inspectType, result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.error(`Inspect ${inspectType} failed`, {
        action: inspectType,
        duration,
        error: error.message
      });
      
      DomUtils.showToast(`Failed to inspect ${inspectType}: ${apiService.getErrorMessage(error)}`, 'error');
    } finally {
      DomUtils.setButtonLoading(button, false);
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

  displayInspectResults(inspectType, result) {
    const resultsContainer = DomUtils.$('#inspect-results-modal');
    const titleElement = DomUtils.$('#inspect-results-title');
    const contentElement = DomUtils.$('#inspect-results-content');
    
    if (!resultsContainer || !titleElement || !contentElement) {
      // Fallback to showing in inline results container
      const fallbackContainer = DomUtils.$('#inspect-results');
      if (fallbackContainer) {
        this.displayInspectResultsFallback(fallbackContainer, inspectType, result);
      }
      return;
    }
    
    titleElement.textContent = `${inspectType.charAt(0).toUpperCase() + inspectType.slice(1)} Inspection`;
    
    let html = '';
    
    switch (inspectType) {
      case 'session':
        html = this.formatSessionResults(result);
        break;
      case 'concepts':
        html = this.formatConceptsResults(result);
        break;
      case 'all':
        html = this.formatAllDataResults(result);
        break;
      default:
        html = this.formatGenericResults(result);
    }
    
    contentElement.innerHTML = html;
    DomUtils.show(resultsContainer);
  }

  displayInspectResultsFallback(container, inspectType, result) {
    container.innerHTML = '';
    DomUtils.show(container);
    
    const codeBlock = DomUtils.createElement('div', { className: 'code-block' });
    codeBlock.textContent = JSON.stringify(result, null, 2);
    
    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, `${inspectType} Inspection Data`)
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, codeBlock)
    ]);
    
    container.appendChild(resultElement);
  }

  formatSessionResults(result) {
    const sessionInfo = result.zptState || result.sessionCache || result;
    
    return `
      <div class="session-info">
        <h5>Session State</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Session ID:</span>
            <span class="value">${sessionInfo.sessionId || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Zoom Level:</span>
            <span class="value">${sessionInfo.zoom || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Interactions:</span>
            <span class="value">${sessionInfo.interactions || 0}</span>
          </div>
          <div class="info-item">
            <span class="label">Concepts:</span>
            <span class="value">${sessionInfo.concepts || 0}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Raw Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatConceptsResults(result) {
    const conceptCount = result.conceptCount || result.concepts?.length || 0;
    
    return `
      <div class="concepts-summary">
        <h5>Concepts Overview</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Total Concepts:</span>
            <span class="value">${conceptCount}</span>
          </div>
          <div class="info-item">
            <span class="label">Storage Type:</span>
            <span class="value">${result.storageType || 'Unknown'}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Full Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatAllDataResults(result) {
    return `
      <div class="all-data-summary">
        <h5>Complete System State</h5>
        <div class="data-sections">
          ${Object.keys(result).map(section => `
            <div class="data-section">
              <h6>${section}</h6>
              <pre class="json-data">${JSON.stringify(result[section], null, 2)}</pre>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatGenericResults(result) {
    return `
      <div class="generic-results">
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  getRecordCount(result) {
    if (result.conceptCount) return result.conceptCount;
    if (result.concepts?.length) return result.concepts.length;
    if (result.sessionCache?.interactions) return result.sessionCache.interactions;
    if (Array.isArray(result)) return result.length;
    return Object.keys(result).length;
  }

  // Navigation Enhancement Methods
  updateNavigationDisplay() {
    const state = stateManager.getState();
    
    // Update zoom display
    const zoomValue = DomUtils.$('#current-zoom');
    const zoomDescription = DomUtils.$('#zoom-description');
    if (zoomValue && zoomDescription) {
      zoomValue.textContent = this.formatZoomLevel(state.zoom);
      zoomDescription.textContent = this.getZoomDescription(state.zoom);
    }
    
    // Update tilt display
    const tiltValue = DomUtils.$('#current-tilt');
    const tiltDescription = DomUtils.$('#tilt-description');
    if (tiltValue && tiltDescription) {
      tiltValue.textContent = this.formatTiltStyle(state.tilt);
      tiltDescription.textContent = this.getTiltDescription(state.tilt);
    }
    
    // Update pan display
    const panValue = DomUtils.$('#current-pan');
    const panDescription = DomUtils.$('#pan-description');
    if (panValue && panDescription) {
      const panText = this.formatPanFilters(state.pan);
      panValue.textContent = panText;
      panDescription.textContent = this.getPanDescription(state.pan);
    }
  }

  formatZoomLevel(zoom) {
    const levels = {
      'entity': 'Entity',
      'unit': 'Unit', 
      'text': 'Text',
      'community': 'Community',
      'corpus': 'Corpus'
    };
    return levels[zoom] || 'Entity';
  }

  getZoomDescription(zoom) {
    const descriptions = {
      'entity': 'Individual entities and concepts',
      'unit': 'Semantic text units and paragraphs',
      'text': 'Full documents and articles',
      'community': 'Groups of related concepts',
      'corpus': 'Entire knowledge collection'
    };
    return descriptions[zoom] || 'Individual entities and concepts';
  }

  formatTiltStyle(tilt) {
    const styles = {
      'keywords': 'Keywords',
      'embedding': 'Embedding',
      'graph': 'Graph',
      'temporal': 'Temporal',
      'memory': 'Memory'
    };
    return styles[tilt] || 'Keywords';
  }

  getTiltDescription(tilt) {
    const descriptions = {
      'keywords': 'Keyword-based view of content',
      'embedding': 'Vector similarity view',
      'graph': 'Relationship network view',
      'temporal': 'Time-based organization',
      'memory': 'Memory importance and access patterns'
    };
    return descriptions[tilt] || 'Keyword-based view of content';
  }

  formatPanFilters(pan) {
    const parts = [];
    if (pan?.domains) parts.push(`Domains: ${pan.domains}`);
    if (pan?.keywords) parts.push(`Keywords: ${pan.keywords}`);
    return parts.length > 0 ? parts.join(', ') : 'All domains';
  }

  getPanDescription(pan) {
    if (pan?.domains || pan?.keywords) {
      return 'Filtered by specified criteria';
    }
    return 'No domain filters applied';
  }

  async handleNavigationExecute(event) {
    event.preventDefault();
    
    const button = event.target.closest('button');
    const buttonText = button.querySelector('.button-text');
    const buttonLoader = button.querySelector('.button-loader');
    
    try {
      // Show loading state
      button.disabled = true;
      DomUtils.hide(buttonText);
      DomUtils.show(buttonLoader);
      
      const state = stateManager.getState();
      
      // Build navigation query
      const query = "Navigate knowledge space";  // Default query
      const navigationParams = {
        zoom: state.zoom || 'entity',
        pan: state.pan || {},
        tilt: state.tilt || 'keywords'
      };
      
      consoleService.info('Executing navigation', navigationParams);
      
      // Call ZPT navigation API
      const result = await apiService.zptNavigate({
        query,
        ...navigationParams
      });
      
      // Display results
      this.displayNavigationResults(result);
      
      consoleService.success('Navigation executed successfully', result);
      DomUtils.showToast('Navigation executed successfully', 'success');
      
    } catch (error) {
      console.error('Navigation execution failed:', error);
      consoleService.error('Navigation execution failed', { error: error.message });
      DomUtils.showToast('Navigation execution failed', 'error');
    } finally {
      // Reset button state
      button.disabled = false;
      DomUtils.show(buttonText);
      DomUtils.hide(buttonLoader);
    }
  }

  displayNavigationResults(result) {
    const resultsContainer = DomUtils.$('#nav-results-content');
    if (!resultsContainer) return;
    
    DomUtils.show(resultsContainer);
    
    let html = '<div class="navigation-results">';
    
    if (result.success && result.data) {
      html += '<h4>Navigation Results</h4>';
      
      if (result.data.entities && result.data.entities.length > 0) {
        html += '<div class="result-section">';
        html += '<h5>📍 Found Entities</h5>';
        html += '<ul class="entity-list">';
        result.data.entities.slice(0, 10).forEach(entity => {
          html += `<li class="entity-item">
            <strong>${DomUtils.escapeHtml(entity.name || entity.id)}</strong>
            ${entity.content ? `<p>${DomUtils.escapeHtml(entity.content.substring(0, 100))}...</p>` : ''}
          </li>`;
        });
        html += '</ul>';
        html += '</div>';
      }
      
      if (result.data.stats) {
        html += '<div class="result-section">';
        html += '<h5>📊 Statistics</h5>';
        html += '<div class="stats-grid">';
        Object.entries(result.data.stats).forEach(([key, value]) => {
          html += `<div class="stat-item">
            <span class="stat-label">${key}:</span>
            <span class="stat-value">${value}</span>
          </div>`;
        });
        html += '</div>';
        html += '</div>';
      }
    } else {
      html += '<div class="result-placeholder">';
      html += '<p>No results found for current navigation settings.</p>';
      html += '<p>Try adjusting the zoom level, domain filters, or view style.</p>';
      html += '</div>';
    }
    
    html += '</div>';
    resultsContainer.innerHTML = html;
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new WorkbenchApp();
  await app.init();
  
  // Expose app instance to global scope for event handlers
  window.workbenchApp = app;
});

// Export for testing
export default WorkbenchApp;