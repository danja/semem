/**
 * Tell Controller Component
 * Manages the Tell operation UI and interactions for storing content in semantic memory
 */

import { showToast, showLoading, escapeHtml, debounce } from '../utils/domUtils.js';

/**
 * TellController manages the Tell operation interface
 * Handles content input, type selection, metadata entry, and Tell operation execution
 */
export class TellController {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        
        // Content type definitions
        this.contentTypes = {
            concept: {
                label: 'Concept',
                description: 'A standalone concept or idea',
                placeholder: 'Enter a concept, fact, or piece of knowledge...',
                examples: [
                    'Machine learning uses neural networks for pattern recognition',
                    'JavaScript closures capture variables from outer scope',
                    'The mitochondria is the powerhouse of the cell'
                ]
            },
            interaction: {
                label: 'Interaction',
                description: 'A question-answer pair or conversation',
                placeholder: 'Enter interaction content (question/answer format)...',
                examples: [
                    'Q: What is recursion?\nA: A programming technique where a function calls itself',
                    'Q: How does photosynthesis work?\nA: Plants convert sunlight into energy using chlorophyll'
                ]
            },
            document: {
                label: 'Document',
                description: 'Structured document or text passage',
                placeholder: 'Enter document content or text passage...',
                examples: [
                    'API Documentation: The /users endpoint accepts GET and POST requests...',
                    'Meeting Notes: Discussed project timeline and resource allocation...'
                ]
            }
        };
        
        // Current state
        this.currentContent = '';
        this.currentType = 'concept';
        this.currentMetadata = {};
        this.isSubmitting = false;
        
        // Bind methods
        this.handleContentInput = debounce(this.handleContentInput.bind(this), 300);
        this.handleTypeChange = this.handleTypeChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.insertExample = this.insertExample.bind(this);
        this.clearContent = this.clearContent.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize the Tell controller
     */
    initialize() {
        this.render();
        this.updateUI();
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        document.addEventListener('input', (event) => {
            if (event.target.matches('#tell-content')) {
                this.handleContentInput(event.target.value);
            }
            
            if (event.target.matches('#tell-metadata')) {
                this.handleMetadataInput(event.target.value);
            }
        });
        
        document.addEventListener('change', (event) => {
            if (event.target.matches('#tell-type')) {
                this.handleTypeChange(event.target.value);
            }
        });
        
        document.addEventListener('click', (event) => {
            if (event.target.matches('#tell-submit')) {
                event.preventDefault();
                this.handleSubmit();
            }
            
            if (event.target.matches('#tell-clear')) {
                event.preventDefault();
                this.clearContent();
            }
            
            if (event.target.matches('.example-btn')) {
                event.preventDefault();
                const example = event.target.dataset.example;
                if (example) {
                    this.insertExample(example);
                }
            }
        });
        
        // Listen for state changes
        this.stateManager.on('loadingStateChanged', (loadingState) => {
            this.updateLoadingState(loadingState);
        });
    }
    
    /**
     * Render the Tell interface
     */
    render() {
        const tellTab = document.getElementById('tell-tab');
        if (!tellTab) {
            console.error('Tell tab element not found');
            return;
        }
        
        tellTab.innerHTML = `
            <div class="tell-container">
                <div class="tell-header">
                    <h2>Tell</h2>
                    <p class="tell-description">Store content in semantic memory</p>
                </div>
                
                <div class="tell-form">
                    <div class="form-group">
                        <label for="tell-type" class="form-label">Content Type</label>
                        <select id="tell-type" class="form-select">
                            ${Object.entries(this.contentTypes).map(([type, config]) => 
                                `<option value="${type}" ${type === this.currentType ? 'selected' : ''}>
                                    ${config.label}
                                </option>`
                            ).join('')}
                        </select>
                        <div id="type-description" class="form-help">
                            ${this.contentTypes[this.currentType].description}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="tell-content" class="form-label">Content</label>
                        <textarea 
                            id="tell-content" 
                            class="form-textarea" 
                            rows="6"
                            placeholder="${this.contentTypes[this.currentType].placeholder}"
                            value="${escapeHtml(this.currentContent)}"
                        ></textarea>
                        <div class="form-meta">
                            <span id="content-length" class="meta-info">0 characters</span>
                            <span class="meta-separator">•</span>
                            <button id="tell-clear" class="meta-btn" type="button">Clear</button>
                        </div>
                    </div>
                    
                    <div class="examples-section">
                        <div class="examples-header">
                            <span class="examples-label">Examples:</span>
                        </div>
                        <div id="examples-list" class="examples-list">
                            ${this.renderExamples(this.currentType)}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="tell-metadata" class="form-label">Metadata (Optional)</label>
                        <textarea 
                            id="tell-metadata" 
                            class="form-textarea" 
                            rows="3"
                            placeholder="Enter metadata as JSON (e.g., {&quot;source&quot;: &quot;documentation&quot;, &quot;tags&quot;: [&quot;api&quot;]})"
                        ></textarea>
                        <div class="form-help">
                            Additional metadata to store with the content (JSON format)
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button id="tell-submit" class="btn btn-primary" disabled>
                            <span class="btn-icon">💾</span>
                            Store Content
                        </button>
                        <div class="form-status">
                            <span id="tell-status" class="status-text"></span>
                        </div>
                    </div>
                </div>
                
                <div class="tell-results">
                    <div id="tell-result" class="result-panel" style="display: none;"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render examples for current content type
     * @param {string} type - Content type
     * @returns {string} - Examples HTML
     */
    renderExamples(type) {
        const config = this.contentTypes[type];
        if (!config || !config.examples) return '';
        
        return config.examples.map((example, index) => `
            <button class="example-btn" data-example="${escapeHtml(example)}" title="Click to use this example">
                <span class="example-number">${index + 1}</span>
                <span class="example-text">${escapeHtml(example.substring(0, 60))}${example.length > 60 ? '...' : ''}</span>
            </button>
        `).join('');
    }
    
    /**
     * Update UI based on current state
     */
    updateUI() {
        this.updateContentLength();
        this.updateSubmitButton();
        this.updateTypeDescription();
        this.updateExamples();
    }
    
    /**
     * Update content length display
     */
    updateContentLength() {
        const lengthElement = document.getElementById('content-length');
        if (lengthElement) {
            const length = this.currentContent.length;
            lengthElement.textContent = `${length} character${length !== 1 ? 's' : ''}`;
            
            // Add warning for very long content
            if (length > 10000) {
                lengthElement.className = 'meta-info warning';
                lengthElement.title = 'Very long content may affect performance';
            } else if (length > 5000) {
                lengthElement.className = 'meta-info caution';
                lengthElement.title = 'Long content may take more time to process';
            } else {
                lengthElement.className = 'meta-info';
                lengthElement.title = '';
            }
        }
    }
    
    /**
     * Update submit button state
     */
    updateSubmitButton() {
        const submitButton = document.getElementById('tell-submit');
        if (submitButton) {
            const hasContent = this.currentContent.trim().length > 0;
            const validMetadata = this.isValidMetadata();
            
            submitButton.disabled = !hasContent || !validMetadata || this.isSubmitting;
            
            if (this.isSubmitting) {
                submitButton.innerHTML = '<span class="btn-spinner">⏳</span> Storing...';
            } else {
                submitButton.innerHTML = '<span class="btn-icon">💾</span> Store Content';
            }
        }
    }
    
    /**
     * Update type description
     */
    updateTypeDescription() {
        const descElement = document.getElementById('type-description');
        const textareaElement = document.getElementById('tell-content');
        
        if (descElement) {
            descElement.textContent = this.contentTypes[this.currentType].description;
        }
        
        if (textareaElement) {
            textareaElement.placeholder = this.contentTypes[this.currentType].placeholder;
        }
    }
    
    /**
     * Update examples display
     */
    updateExamples() {
        const examplesElement = document.getElementById('examples-list');
        if (examplesElement) {
            examplesElement.innerHTML = this.renderExamples(this.currentType);
        }
    }
    
    /**
     * Handle content input changes
     * @param {string} content - Input content
     */
    handleContentInput(content) {
        this.currentContent = content;
        this.updateUI();
    }
    
    /**
     * Handle metadata input changes
     * @param {string} metadata - Metadata JSON string
     */
    handleMetadataInput(metadata) {
        try {
            this.currentMetadata = metadata.trim() ? JSON.parse(metadata) : {};
            this.clearMetadataError();
        } catch (error) {
            this.currentMetadata = {};
            this.showMetadataError('Invalid JSON format');
        }
        this.updateUI();
    }
    
    /**
     * Handle content type change
     * @param {string} type - Selected content type
     */
    handleTypeChange(type) {
        this.currentType = type;
        this.updateUI();
        
        // Focus back to content area
        const contentElement = document.getElementById('tell-content');
        if (contentElement) {
            contentElement.focus();
        }
    }
    
    /**
     * Handle form submission
     */
    async handleSubmit() {
        if (this.isSubmitting || !this.currentContent.trim()) return;
        
        this.isSubmitting = true;
        this.stateManager.setLoading(true, 'Storing content in semantic memory...', 'tell');
        
        try {
            const startTime = Date.now();
            
            // Execute tell operation
            const result = await this.apiService.tell(
                this.currentContent.trim(),
                this.currentType,
                this.currentMetadata
            );
            
            const duration = Date.now() - startTime;
            
            // Record performance
            this.stateManager.recordPerformance('tell', duration, {
                contentLength: this.currentContent.length,
                contentType: this.currentType,
                hasMetadata: Object.keys(this.currentMetadata).length > 0
            });
            
            // Show success
            this.showResult(result, duration);
            showToast(`Content stored successfully (${duration}ms)`, 'success');
            
            // Update session cache if result contains cache info
            if (result.sessionCache) {
                this.stateManager.updateSessionCache(result.sessionCache);
            }
            
            // Clear form if successful
            this.clearContent();
            
        } catch (error) {
            console.error('Tell operation failed:', error);
            this.showError(error);
            showToast('Failed to store content: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
            this.stateManager.setLoading(false);
            this.updateUI();
        }
    }
    
    /**
     * Insert example content
     * @param {string} example - Example text
     */
    insertExample(example) {
        this.currentContent = example;
        
        const contentElement = document.getElementById('tell-content');
        if (contentElement) {
            contentElement.value = example;
            contentElement.focus();
            
            // Move cursor to end
            contentElement.setSelectionRange(example.length, example.length);
        }
        
        this.updateUI();
    }
    
    /**
     * Clear all content
     */
    clearContent() {
        this.currentContent = '';
        this.currentMetadata = {};
        
        const contentElement = document.getElementById('tell-content');
        const metadataElement = document.getElementById('tell-metadata');
        
        if (contentElement) {
            contentElement.value = '';
        }
        
        if (metadataElement) {
            metadataElement.value = '';
        }
        
        this.clearResult();
        this.clearMetadataError();
        this.updateUI();
    }
    
    /**
     * Show operation result
     * @param {object} result - Tell operation result
     * @param {number} duration - Operation duration
     */
    showResult(result, duration) {
        const resultElement = document.getElementById('tell-result');
        if (!resultElement) return;
        
        const hasEmbedding = result.embedding && Array.isArray(result.embedding);
        const hasConcepts = result.concepts && Array.isArray(result.concepts);
        
        resultElement.innerHTML = `
            <div class="result-header">
                <h4>✅ Content Stored Successfully</h4>
                <div class="result-meta">
                    <span>Duration: ${duration}ms</span>
                    <span>Type: ${this.currentType}</span>
                    <span>Size: ${this.currentContent.length} chars</span>
                </div>
            </div>
            
            <div class="result-details">
                ${result.id ? `
                    <div class="result-item">
                        <span class="result-label">ID:</span>
                        <code class="result-value">${escapeHtml(result.id)}</code>
                    </div>
                ` : ''}
                
                ${hasEmbedding ? `
                    <div class="result-item">
                        <span class="result-label">Embedding:</span>
                        <span class="result-value">Generated (${result.embedding.length} dimensions)</span>
                    </div>
                ` : ''}
                
                ${hasConcepts ? `
                    <div class="result-item">
                        <span class="result-label">Concepts:</span>
                        <div class="concepts-list">
                            ${result.concepts.map(concept => 
                                `<span class="concept-tag">${escapeHtml(concept)}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${result.stored ? `
                    <div class="result-item">
                        <span class="result-label">Storage:</span>
                        <span class="result-value success">✅ Persisted to backend</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        resultElement.style.display = 'block';
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Show operation error
     * @param {Error} error - Error object
     */
    showError(error) {
        const resultElement = document.getElementById('tell-result');
        if (!resultElement) return;
        
        resultElement.innerHTML = `
            <div class="result-header error">
                <h4>❌ Storage Failed</h4>
            </div>
            
            <div class="result-details">
                <div class="error-message">
                    ${escapeHtml(error.message)}
                </div>
                
                ${error.details ? `
                    <div class="error-details">
                        <summary>Error Details</summary>
                        <pre>${escapeHtml(JSON.stringify(error.details, null, 2))}</pre>
                    </div>
                ` : ''}
            </div>
        `;
        
        resultElement.style.display = 'block';
    }
    
    /**
     * Clear result display
     */
    clearResult() {
        const resultElement = document.getElementById('tell-result');
        if (resultElement) {
            resultElement.style.display = 'none';
            resultElement.innerHTML = '';
        }
    }
    
    /**
     * Validate metadata JSON
     * @returns {boolean} - Whether metadata is valid
     */
    isValidMetadata() {
        const metadataElement = document.getElementById('tell-metadata');
        if (!metadataElement) return true;
        
        const value = metadataElement.value.trim();
        if (!value) return true; // Empty is valid
        
        try {
            JSON.parse(value);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Show metadata validation error
     * @param {string} message - Error message
     */
    showMetadataError(message) {
        const metadataElement = document.getElementById('tell-metadata');
        if (metadataElement) {
            metadataElement.classList.add('error');
            metadataElement.title = message;
        }
    }
    
    /**
     * Clear metadata validation error
     */
    clearMetadataError() {
        const metadataElement = document.getElementById('tell-metadata');
        if (metadataElement) {
            metadataElement.classList.remove('error');
            metadataElement.title = '';
        }
    }
    
    /**
     * Update loading state UI
     * @param {object} loadingState - Loading state object
     */
    updateLoadingState(loadingState) {
        if (loadingState.operation === 'tell') {
            this.updateUI();
        }
    }
    
    /**
     * Get current form state
     * @returns {object} - Current form state
     */
    getState() {
        return {
            content: this.currentContent,
            type: this.currentType,
            metadata: this.currentMetadata,
            isSubmitting: this.isSubmitting
        };
    }
    
    /**
     * Set form state
     * @param {object} state - State to restore
     */
    setState(state) {
        if (state.content !== undefined) {
            this.currentContent = state.content;
            const contentElement = document.getElementById('tell-content');
            if (contentElement) {
                contentElement.value = state.content;
            }
        }
        
        if (state.type !== undefined) {
            this.currentType = state.type;
            const typeElement = document.getElementById('tell-type');
            if (typeElement) {
                typeElement.value = state.type;
            }
        }
        
        if (state.metadata !== undefined) {
            this.currentMetadata = state.metadata;
            const metadataElement = document.getElementById('tell-metadata');
            if (metadataElement && Object.keys(state.metadata).length > 0) {
                metadataElement.value = JSON.stringify(state.metadata, null, 2);
            }
        }
        
        this.updateUI();
    }
}