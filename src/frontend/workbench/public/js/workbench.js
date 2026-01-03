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
import NavigationController from './controllers/NavigationController.js';
import InspectController from './controllers/InspectController.js';

class WorkbenchApp {
  constructor() {
    this.components = {};
    this.initialized = false;
    
    // Bind methods
    this.handleTellSubmit = this.handleTellSubmit.bind(this);
    this.handleAskSubmit = this.handleAskSubmit.bind(this);
    this.handleAugmentSubmit = this.handleAugmentSubmit.bind(this);
    this.handleAugmentOperationChange = this.handleAugmentOperationChange.bind(this);
    this.handlePanelToggle = this.handlePanelToggle.bind(this);
    this.updateConnectionStatus = this.updateConnectionStatus.bind(this);
    this.updateSessionStats = this.updateSessionStats.bind(this);
    this.navigationController = new NavigationController();
    this.inspectController = new InspectController();
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

      // Initialize controllers
      this.navigationController.init();
      this.inspectController.init();
      
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
    
    // Panel toggles
    this.setupPanelToggles();
  }

  setupPanelToggles() {
    DomUtils.$$('.panel-toggle').forEach(button => {
      button.addEventListener('click', this.handlePanelToggle);
    });

    // Verbs toggle button
    const verbsToggle = DomUtils.$('#verbs-toggle');
    if (verbsToggle) {
      verbsToggle.addEventListener('click', this.handleVerbsToggle.bind(this));
    }
  }


  setupStateSubscriptions() {
    // Subscribe to state changes
    stateManager.subscribe('stateChange', this.updateUI.bind(this));
    this.navigationController.subscribeToState();
    stateManager.subscribe('error', this.handleError.bind(this));
  }

  // ===== COMPONENT INITIALIZATION =====

  initializeComponents() {
    // Initialize all interactive components
    this.initializeTellComponent();
    this.initializeAskComponent();
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


  initializeDashboardComponent() {
    this.components.dashboard = {
      interactionsCount: DomUtils.$('#interactions-count-bottom'),
      conceptsCount: DomUtils.$('#concepts-count-bottom'),
      sessionDuration: DomUtils.$('#session-duration-bottom'),
      documentsCount: DomUtils.$('#documents-count-bottom'),
      chunksCount: DomUtils.$('#chunks-count-bottom'),
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
    
    // Check if this is a file upload (document type with file selected)
    const fileInput = DomUtils.$('#document-file');
    const hasFile = fileInput && fileInput.files.length > 0;
    const isDocumentType = formData.type === 'document';
    
    const startTime = Date.now();
    
    // Start operation with human-friendly message
    if (isDocumentType && hasFile) {
      consoleService.info(`🚀 Starting document upload workflow...`);
    } else if (formData.content) {
      const contentType = formData.type === 'fact' ? 'fact' : 
                         formData.type === 'note' ? 'note' : 
                         formData.type === 'idea' ? 'idea' : 'information';
      const wordCount = formData.content.split(/\s+/).length;
      consoleService.info(`🧠 Storing ${contentType} in semantic memory (${wordCount} words)...`);
    }
    
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
        
        consoleService.info(`🔄 Analyzing content and generating embeddings...`);
        
        result = await apiService.tell({
          content: formData.content,
          type: formData.type || 'interaction',
          lazy: formData.lazy || false,
          metadata: formData.tags ? { tags: formData.tags.split(',').map(t => t.trim()) } : {}
        });
      }
      
      const duration = Date.now() - startTime;
      
      // Report success with human-friendly message
      if (result.success) {
        if (isDocumentType) {
          // Document upload success handled in handleDocumentUpload
        } else if (result.concepts) {
          consoleService.success(`✅ Content stored successfully! Extracted ${result.concepts} concepts in ${duration}ms`);
        } else {
          consoleService.success(`✅ Content stored successfully in semantic memory (${duration}ms)`);
        }
      }

      // Update session stats
      const currentState = stateManager.getState().session;
      const statsUpdate = {
        interactionsCount: currentState.interactionsCount + 1
      };

      // Track document and chunk counts
      if (isDocumentType && result.success) {
        statsUpdate.documentsCount = currentState.documentsCount + 1;

        // Track chunks if available
        if (result.chunks || result.chunking?.chunkCount) {
          const chunkCount = result.chunks || result.chunking.chunkCount || 0;
          statsUpdate.chunksCount = currentState.chunksCount + chunkCount;
        }
      }

      stateManager.updateSessionStats(statsUpdate);
      
      // Show results
      this.displayTellResults(results, result);
      
      // Clear form
      DomUtils.resetForm(form);
      
      DomUtils.showToast('Content stored successfully', 'success');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.error(`❌ Failed to store content: ${error.message}`);
      
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
    consoleService.info(`📎 Selected "${file.name}" (${this.formatFileSize(file.size)}) for upload`);

    // Validate file type and infer document type
    const fileType = this.getFileTypeFromExtension(file.name);
    if (!fileType) {
      const extension = file.name.split('.').pop();
      consoleService.error(`❌ Unsupported file type ".${extension}" - please use PDF, TXT, or MD files`);
      DomUtils.showToast('Unsupported file type. Please select a PDF, TXT, or MD file.', 'error');
      this.clearSelectedFile();
      return;
    }

    // Validate file size (25MB limit for documents, especially PDFs)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      consoleService.error(`❌ File too large (${this.formatFileSize(file.size)}) - maximum size is ${this.formatFileSize(maxSize)}`);
      DomUtils.showToast('File too large. Please select a file under 25MB.', 'error');
      this.clearSelectedFile();
      return;
    }

    // Log successful validation
    consoleService.success(`✅ File validation passed - ready to upload ${fileType.toUpperCase()} document`);

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
      // Step 1: Prepare metadata and upload options
      consoleService.info(`📄 Preparing "${file.name}" for upload...`);

      const tags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const uploadMetadata = this.sanitizeMetadata({
        source: formData.source || 'workbench',
        originalName: file.name,
        size: file.size,
        tags,
        documentType: fileType,
        uploadedAt: new Date().toISOString()
      });

      const uploadOptions = {
        convert: true,
        chunk: true,
        ingest: true
      };

      // Step 2: Upload and process document via Document API
      consoleService.info(`🚀 Uploading ${fileType.toUpperCase()} document to semantic memory...`);

      const result = await apiService.uploadDocument({
        file,
        documentType: fileType,
        metadata: uploadMetadata,
        options: uploadOptions
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Document upload failed');
      }

      // Step 3: Summarize processing results
      const chunkCount =
        result.chunking?.chunkCount ??
        result.chunking?.fullResult?.chunks?.length ??
        0;
      const triplesCreated = result.ingestion?.triplesCreated ?? 0;
      const processingDuration = Date.now() - uploadStartTime;

      if (chunkCount > 0) {
        consoleService.success(`✅ Document processed into ${chunkCount} chunks in ${processingDuration}ms`);
      } else {
        consoleService.success(`✅ Document stored successfully in ${processingDuration}ms`);
      }

      if (triplesCreated > 0) {
        consoleService.info(`📚 Ingested ${triplesCreated} triples into semantic memory`);
      }

      if (result.conversion?.metadata?.pages) {
        consoleService.info(`📄 Document spans approximately ${result.conversion.metadata.pages} pages`);
      }

      await this.applyTopicFromUpload(result, file);

      // Step 4: Return summarized result for UI consumption
      return {
        ...result,
        chunks: chunkCount,
        triplesCreated,
        processingDuration
      };
    } catch (error) {
      const uploadDuration = Date.now() - uploadStartTime;
      consoleService.error(`❌ Failed to upload "${file.name}": ${error.message}`);
      consoleService.error(`⏱️ Upload attempt took ${uploadDuration}ms before failing`);

      throw new Error(`Failed to upload document: ${error.message}`);
    }
  }

  getTopicSourceFromUpload(result, file) {
    const chunkContent = result?.chunking?.chunks?.[0]?.content;
    if (chunkContent) {
      return chunkContent;
    }

    const conversionContent = result?.conversion?.content;
    if (conversionContent) {
      return conversionContent;
    }

    if (file?.name) {
      return `Document: ${file.name}`;
    }

    return '';
  }

  async applyTopicFromUpload(result, file) {
    const sourceText = this.getTopicSourceFromUpload(result, file);
    if (!sourceText) {
      consoleService.warn('⚠️ Unable to derive topic from upload: missing document content');
      return;
    }

    try {
      const response = await apiService.chat({
        message: `/topic ${sourceText}`,
        context: {},
        threshold: stateManager.getState().threshold
      });

      if (response?.success === false) {
        consoleService.warn('⚠️ Topic derivation failed after upload', {
          error: response?.content || 'Unknown error'
        });
      }
    } catch (error) {
      consoleService.warn('⚠️ Topic derivation request failed after upload', {
        error: error.message
      });
    }
  }

  /**
   * Sanitize metadata to prevent circular references and JSON serialization issues
   */
  sanitizeMetadata(metadata) {
    try {
      // First, try to serialize to detect issues
      JSON.stringify(metadata);
      return metadata; // If successful, return as-is
    } catch (error) {
      console.warn('Metadata serialization issue detected, sanitizing:', error.message);

      // Create a safe copy by removing problematic properties
      const sanitized = {};

      for (const [key, value] of Object.entries(metadata)) {
        try {
          if (value === null || value === undefined) {
            continue; // Skip null/undefined
          }

          if (typeof value === 'function' || typeof value === 'symbol') {
            continue; // Skip functions and symbols
          }

          if (typeof value === 'object') {
            // Test if this property can be serialized
            JSON.stringify(value);
            sanitized[key] = value;
          } else {
            // Primitive values should be safe
            sanitized[key] = value;
          }
        } catch (propError) {
          console.warn(`Skipping problematic metadata property "${key}":`, propError.message);
          // Skip this property entirely
        }
      }

      return sanitized;
    }
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
    
    // Start operation with human-friendly message
    const questionWords = formData.question?.split(/\s+/).length || 0;
    const sources = [];
    if (formData.useContext) sources.push('semantic memory');
    if (formData.useWikipedia) sources.push('Wikipedia');
    if (formData.useWikidata) sources.push('Wikidata');
    if (formData.useWebSearch) sources.push('Web Search');
    
    const sourcesText = sources.length > 0 ? ` from ${sources.join(', ')}` : '';
    consoleService.info(`🔍 Searching for answers to your ${questionWords}-word question${sourcesText}...`);
    
    try {
      DomUtils.setButtonLoading(button, true);
      
      consoleService.info(`🧠 Analyzing question and finding relevant context...`);
      
      const result = await apiService.ask({
        question: formData.question,
        mode: formData.mode || 'standard',
        useContext: Boolean(formData.useContext),
        useHyDE: Boolean(formData.useHyDE),
        useWikipedia: Boolean(formData.useWikipedia),
        useWikidata: Boolean(formData.useWikidata),
        useWebSearch: Boolean(formData.useWebSearch),
        threshold: stateManager.getState().threshold
      });
      
      const duration = Date.now() - startTime;
      
      // Report success with context information
      if (result.success) {
        const contextInfo = result.contextUsed ? ` using ${result.contextUsed} context sources` : '';
        consoleService.success(`✅ Answer generated successfully${contextInfo} (${duration}ms)`);
      }
      
      // Update session stats
      stateManager.updateSessionStats({
        interactionsCount: stateManager.getState().session.interactionsCount + 1
      });
      
      // Show results
      this.displayAskResults(results, result);
      
      DomUtils.showToast('Query completed', 'success');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.error(`❌ Failed to find answer: ${error.message} (${duration}ms)`);
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
    
    // Start operation with human-friendly message
    let operationMessage = '';
    if (isProcessLazy) {
      operationMessage = '🔄 Processing all lazy-stored content with embeddings and concepts...';
    } else if (isChunkDocuments) {
      operationMessage = '📄 Chunking large documents into searchable segments...';
    } else {
      const operation = formData.operation || 'auto';
      const operationNames = {
        'auto': 'analyzing',
        'summarize': 'summarizing', 
        'extract': 'extracting key information from',
        'expand': 'expanding on',
        'clarify': 'clarifying',
        'relate': 'finding relationships in'
      };
      const action = operationNames[operation] || 'processing';
      const targetWords = target?.split(/\s+/).length || 0;
      operationMessage = `🔬 Now ${action} your ${targetWords}-word content...`;
    }
    
    consoleService.info(operationMessage);
    
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
      
      // Report success with specific results
      if (result.success) {
        if (isProcessLazy) {
          const processed = result.processed || 0;
          consoleService.success(`✅ Processed ${processed} lazy-stored items with embeddings (${duration}ms)`);
        } else if (isChunkDocuments) {
          const chunks = result.chunks || 0;
          consoleService.success(`✅ Created ${chunks} searchable document chunks (${duration}ms)`);
        } else {
          consoleService.success(`✅ Content analysis completed successfully (${duration}ms)`);
        }
      }
      
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
      consoleService.error(`❌ Failed to complete operation: ${error.message} (${duration}ms)`);
      console.error('Augment operation failed:', error);
      DomUtils.showToast('Failed to analyze: ' + apiService.getErrorMessage(error), 'error');
    } finally {
      stateManager.setLoadingState('augment', false);
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

  handleVerbsToggle(event) {
    const button = event.currentTarget;
    const mainContent = DomUtils.$('#main-content');
    const toggleText = button.querySelector('.button-text');

    if (!mainContent) return;

    const isVisible = mainContent.style.display !== 'none';

    // Toggle visibility
    if (isVisible) {
      mainContent.style.display = 'none';
      if (toggleText) {
        toggleText.textContent = 'Show Verbs';
      }
      button.classList.remove('active');
    } else {
      mainContent.style.display = 'flex';
      if (toggleText) {
        toggleText.textContent = 'Hide Verbs';
      }
      button.classList.add('active');
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
    this.navigationController.updateZptDisplay();
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
    const { interactionsCount, conceptsCount, documentsCount, chunksCount } = state.session;

    // Update interactions count
    const interactionsElement = this.components.dashboard.interactionsCount;
    if (interactionsElement) {
      interactionsElement.textContent = interactionsCount || 0;
    }

    // Update concepts count
    const conceptsElement = this.components.dashboard.conceptsCount;
    if (conceptsElement) {
      conceptsElement.textContent = conceptsCount || 0;
    }

    // Update duration
    const durationElement = this.components.dashboard.sessionDuration;
    if (durationElement) {
      durationElement.textContent = stateManager.getFormattedDuration();
    }

    // Update documents count (if element exists and data available)
    const documentsElement = this.components.dashboard.documentsCount;
    if (documentsElement && documentsCount !== undefined) {
      documentsElement.textContent = documentsCount || 0;
    }

    // Update chunks count (if element exists and data available)
    const chunksElement = this.components.dashboard.chunksCount;
    if (chunksElement && chunksCount !== undefined) {
      chunksElement.textContent = chunksCount || 0;
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
