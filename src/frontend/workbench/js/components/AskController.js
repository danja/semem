/**
 * Ask Controller Component
 * Manages the Ask operation UI and interactions for querying semantic memory
 */

import { showToast, escapeHtml, formatDuration, debounce, copyToClipboard } from '../utils/domUtils.js';

/**
 * AskController manages the Ask operation interface
 * Handles query input, search options, and Ask operation execution with result display
 */
export class AskController {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        
        // Query presets and examples
        this.queryExamples = [
            'What is machine learning?',
            'How do neural networks work?',
            'Explain JavaScript closures',
            'What are the benefits of functional programming?',
            'How does React state management work?',
            'What is the difference between synchronous and asynchronous programming?'
        ];
        
        this.queryCategories = {
            technical: {
                label: 'Technical',
                examples: [
                    'How to implement authentication in Node.js?',
                    'What are microservices advantages?',
                    'Explain database indexing strategies'
                ]
            },
            conceptual: {
                label: 'Conceptual',
                examples: [
                    'What is the purpose of design patterns?',
                    'Why is code documentation important?',
                    'How does agile development work?'
                ]
            },
            troubleshooting: {
                label: 'Troubleshooting',
                examples: [
                    'Why is my API response slow?',
                    'How to debug memory leaks?',
                    'What causes CORS errors?'
                ]
            }
        };
        
        // Current state
        this.currentQuery = '';
        this.queryOptions = {
            useContext: true,
            maxResults: 5,
            threshold: 0.7,
            includeMetadata: true
        };
        this.isSubmitting = false;
        this.queryHistory = [];
        
        // Bind methods
        this.handleQueryInput = debounce(this.handleQueryInput.bind(this), 300);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.insertExample = this.insertExample.bind(this);
        this.clearQuery = this.clearQuery.bind(this);
        this.copyResult = this.copyResult.bind(this);
        this.retryQuery = this.retryQuery.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize the Ask controller
     */
    initialize() {
        this.render();
        this.updateUI();
        this.loadQueryHistory();
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        document.addEventListener('input', (event) => {
            if (event.target.matches('#ask-query')) {
                this.handleQueryInput(event.target.value);
            }
        });
        
        document.addEventListener('change', (event) => {
            if (event.target.matches('#ask-use-context')) {
                this.queryOptions.useContext = event.target.checked;
            }
            
            if (event.target.matches('#ask-max-results')) {
                this.queryOptions.maxResults = parseInt(event.target.value);
            }
            
            if (event.target.matches('#ask-threshold')) {
                this.queryOptions.threshold = parseFloat(event.target.value);
            }
            
            if (event.target.matches('#ask-include-metadata')) {
                this.queryOptions.includeMetadata = event.target.checked;
            }
        });
        
        document.addEventListener('click', (event) => {
            if (event.target.matches('#ask-submit')) {
                event.preventDefault();
                this.handleSubmit();
            }
            
            if (event.target.matches('#ask-clear')) {
                event.preventDefault();
                this.clearQuery();
            }
            
            if (event.target.matches('.query-example-btn')) {
                event.preventDefault();
                const query = event.target.dataset.query;
                if (query) {
                    this.insertExample(query);
                }
            }
            
            if (event.target.matches('.history-item')) {
                event.preventDefault();
                const query = event.target.dataset.query;
                if (query) {
                    this.insertExample(query);
                }
            }
            
            if (event.target.matches('.copy-result-btn')) {
                event.preventDefault();
                this.copyResult();
            }
            
            if (event.target.matches('.retry-query-btn')) {
                event.preventDefault();
                this.retryQuery();
            }
            
            if (event.target.matches('.toggle-options')) {
                event.preventDefault();
                this.toggleOptions();
            }
        });
        
        // Handle Enter key in query input
        document.addEventListener('keydown', (event) => {
            if (event.target.matches('#ask-query') && event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.handleSubmit();
            }
        });
        
        // Listen for state changes
        this.stateManager.on('loadingStateChanged', (loadingState) => {
            this.updateLoadingState(loadingState);
        });
    }
    
    /**
     * Render the Ask interface
     */
    render() {
        const askTab = document.getElementById('ask-tab');
        if (!askTab) {
            console.error('Ask tab element not found');
            return;
        }
        
        askTab.innerHTML = `
            <div class="ask-container">
                <div class="ask-header">
                    <h2>Ask</h2>
                    <p class="ask-description">Query semantic memory with natural language</p>
                </div>
                
                <div class="ask-form">
                    <div class="query-input-group">
                        <label for="ask-query" class="form-label">Your Question</label>
                        <div class="query-input-container">
                            <textarea 
                                id="ask-query" 
                                class="query-textarea" 
                                rows="3"
                                placeholder="Ask a question about your stored knowledge..."
                                value="${escapeHtml(this.currentQuery)}"
                            ></textarea>
                            <div class="query-actions">
                                <button id="ask-clear" class="action-btn secondary" title="Clear query">
                                    🗑️
                                </button>
                                <button class="toggle-options action-btn secondary" title="Toggle search options">
                                    ⚙️
                                </button>
                            </div>
                        </div>
                        <div class="query-meta">
                            <span id="query-length" class="meta-info">0 characters</span>
                            <span class="meta-separator">•</span>
                            <span class="meta-info">Press Enter to search, Shift+Enter for new line</span>
                        </div>
                    </div>
                    
                    <div id="ask-options" class="ask-options" style="display: none;">
                        <h4>Search Options</h4>
                        <div class="options-grid">
                            <div class="option-item">
                                <label class="option-label">
                                    <input type="checkbox" id="ask-use-context" ${this.queryOptions.useContext ? 'checked' : ''}>
                                    Use ZPT context
                                </label>
                                <div class="option-help">Apply current zoom/pan/tilt settings</div>
                            </div>
                            
                            <div class="option-item">
                                <label class="option-label" for="ask-max-results">Max Results</label>
                                <select id="ask-max-results" class="option-select">
                                    <option value="3" ${this.queryOptions.maxResults === 3 ? 'selected' : ''}>3</option>
                                    <option value="5" ${this.queryOptions.maxResults === 5 ? 'selected' : ''}>5</option>
                                    <option value="10" ${this.queryOptions.maxResults === 10 ? 'selected' : ''}>10</option>
                                    <option value="20" ${this.queryOptions.maxResults === 20 ? 'selected' : ''}>20</option>
                                </select>
                            </div>
                            
                            <div class="option-item">
                                <label class="option-label" for="ask-threshold">Similarity Threshold</label>
                                <input type="range" id="ask-threshold" class="option-range" 
                                       min="0.3" max="1.0" step="0.1" value="${this.queryOptions.threshold}">
                                <span class="range-value">${this.queryOptions.threshold}</span>
                            </div>
                            
                            <div class="option-item">
                                <label class="option-label">
                                    <input type="checkbox" id="ask-include-metadata" ${this.queryOptions.includeMetadata ? 'checked' : ''}>
                                    Include metadata
                                </label>
                                <div class="option-help">Show source metadata in results</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button id="ask-submit" class="btn btn-primary" disabled>
                            <span class="btn-icon">🔍</span>
                            Search Knowledge
                        </button>
                        <div class="form-status">
                            <span id="ask-status" class="status-text"></span>
                        </div>
                    </div>
                </div>
                
                <div class="ask-examples">
                    <h4>Example Questions</h4>
                    <div class="examples-categories">
                        ${Object.entries(this.queryCategories).map(([category, config]) => `
                            <div class="category-section">
                                <h5>${config.label}</h5>
                                <div class="examples-list">
                                    ${config.examples.map((example, index) => `
                                        <button class="query-example-btn" data-query="${escapeHtml(example)}">
                                            ${escapeHtml(example)}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="query-history">
                    <h4>Recent Queries</h4>
                    <div id="history-list" class="history-list">
                        <div class="history-empty">No recent queries</div>
                    </div>
                </div>
                
                <div class="ask-results">
                    <div id="ask-result" class="result-panel" style="display: none;"></div>
                </div>
            </div>
        `;
        
        // Update threshold display
        this.updateThresholdDisplay();
    }
    
    /**
     * Update UI based on current state
     */
    updateUI() {
        this.updateQueryLength();
        this.updateSubmitButton();
        this.updateHistoryDisplay();
    }
    
    /**
     * Update query length display
     */
    updateQueryLength() {
        const lengthElement = document.getElementById('query-length');
        if (lengthElement) {
            const length = this.currentQuery.length;
            lengthElement.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        }
    }
    
    /**
     * Update submit button state
     */
    updateSubmitButton() {
        const submitButton = document.getElementById('ask-submit');
        if (submitButton) {
            const hasQuery = this.currentQuery.trim().length > 0;
            
            submitButton.disabled = !hasQuery || this.isSubmitting;
            
            if (this.isSubmitting) {
                submitButton.innerHTML = '<span class="btn-spinner">⏳</span> Searching...';
            } else {
                submitButton.innerHTML = '<span class="btn-icon">🔍</span> Search Knowledge';
            }
        }
    }
    
    /**
     * Update threshold display
     */
    updateThresholdDisplay() {
        const thresholdInput = document.getElementById('ask-threshold');
        const rangeValue = document.querySelector('.range-value');
        
        if (thresholdInput) {
            thresholdInput.addEventListener('input', (event) => {
                this.queryOptions.threshold = parseFloat(event.target.value);
                if (rangeValue) {
                    rangeValue.textContent = this.queryOptions.threshold;
                }
            });
        }
    }
    
    /**
     * Handle query input changes
     * @param {string} query - Input query
     */
    handleQueryInput(query) {
        this.currentQuery = query;
        this.updateUI();
    }
    
    /**
     * Handle form submission
     */
    async handleSubmit() {
        if (this.isSubmitting || !this.currentQuery.trim()) return;
        
        this.isSubmitting = true;
        this.stateManager.setLoading(true, 'Searching semantic memory...', 'ask');
        
        try {
            const startTime = Date.now();
            
            // Build query options
            const options = {
                ...this.queryOptions,
                // Add ZPT context if enabled
                ...(this.queryOptions.useContext && {
                    zoom: this.stateManager.get('zpt.zoom'),
                    pan: this.stateManager.get('zpt.pan'),
                    tilt: this.stateManager.get('zpt.tilt')
                })
            };
            
            // Execute ask operation
            const result = await this.apiService.ask(this.currentQuery.trim(), options);
            
            const duration = Date.now() - startTime;
            
            // Record performance
            this.stateManager.recordPerformance('ask', duration, {
                queryLength: this.currentQuery.length,
                useContext: this.queryOptions.useContext,
                maxResults: this.queryOptions.maxResults,
                threshold: this.queryOptions.threshold,
                resultCount: result.results ? result.results.length : 0
            });
            
            // Add to history
            this.addToHistory(this.currentQuery, result, duration);
            
            // Show results
            this.showResult(result, duration);
            
            // Update session cache if result contains cache info
            if (result.sessionCache) {
                this.stateManager.updateSessionCache(result.sessionCache);
            }
            
            showToast(`Query completed (${duration}ms, ${result.results?.length || 0} results)`, 'success');
            
        } catch (error) {
            console.error('Ask operation failed:', error);
            this.showError(error);
            showToast('Query failed: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
            this.stateManager.setLoading(false);
            this.updateUI();
        }
    }
    
    /**
     * Insert example query
     * @param {string} query - Query text
     */
    insertExample(query) {
        this.currentQuery = query;
        
        const queryElement = document.getElementById('ask-query');
        if (queryElement) {
            queryElement.value = query;
            queryElement.focus();
            
            // Move cursor to end
            queryElement.setSelectionRange(query.length, query.length);
        }
        
        this.updateUI();
    }
    
    /**
     * Clear query
     */
    clearQuery() {
        this.currentQuery = '';
        
        const queryElement = document.getElementById('ask-query');
        if (queryElement) {
            queryElement.value = '';
            queryElement.focus();
        }
        
        this.clearResult();
        this.updateUI();
    }
    
    /**
     * Toggle options visibility
     */
    toggleOptions() {
        const optionsElement = document.getElementById('ask-options');
        if (optionsElement) {
            const isVisible = optionsElement.style.display !== 'none';
            optionsElement.style.display = isVisible ? 'none' : 'block';
            
            const toggleButton = document.querySelector('.toggle-options');
            if (toggleButton) {
                toggleButton.classList.toggle('active', !isVisible);
            }
        }
    }
    
    /**
     * Show query result
     * @param {object} result - Ask operation result
     * @param {number} duration - Operation duration
     */
    showResult(result, duration) {
        const resultElement = document.getElementById('ask-result');
        if (!resultElement) return;
        
        const hasResults = result.results && result.results.length > 0;
        const hasAnswer = result.answer && result.answer.trim();
        
        resultElement.innerHTML = `
            <div class="result-header">
                <div class="result-title">
                    <h4>${hasResults ? '🎯' : '🔍'} Search Results</h4>
                    <div class="result-actions">
                        <button class="copy-result-btn action-btn" title="Copy results to clipboard">📋</button>
                        <button class="retry-query-btn action-btn" title="Run query again">🔄</button>
                    </div>
                </div>
                <div class="result-meta">
                    <span>Duration: ${formatDuration(duration)}</span>
                    <span>Results: ${hasResults ? result.results.length : 0}</span>
                    <span>Query: "${this.currentQuery.length > 50 ? this.currentQuery.substring(0, 50) + '...' : this.currentQuery}"</span>
                </div>
            </div>
            
            ${hasAnswer ? `
                <div class="result-answer">
                    <h5>Answer</h5>
                    <div class="answer-content">${this.formatText(result.answer)}</div>
                </div>
            ` : ''}
            
            ${hasResults ? `
                <div class="result-matches">
                    <h5>Related Content (${result.results.length} matches)</h5>
                    <div class="matches-list">
                        ${result.results.map((match, index) => this.renderMatch(match, index)).join('')}
                    </div>
                </div>
            ` : `
                <div class="result-empty">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-message">No matching content found</div>
                    <div class="empty-suggestions">
                        <p>Try:</p>
                        <ul>
                            <li>Using different keywords</li>
                            <li>Lowering the similarity threshold</li>
                            <li>Storing more content with the Tell operation</li>
                        </ul>
                    </div>
                </div>
            `}
            
            ${result.context ? `
                <div class="result-context">
                    <details>
                        <summary>Query Context</summary>
                        <div class="context-info">
                            <div class="context-item">
                                <span class="context-label">ZPT State:</span>
                                <span class="context-value">
                                    Zoom: ${result.context.zoom || 'entity'}, 
                                    Tilt: ${result.context.tilt || 'keywords'}
                                </span>
                            </div>
                            ${result.context.sessionCache ? `
                                <div class="context-item">
                                    <span class="context-label">Session Cache:</span>
                                    <span class="context-value">
                                        ${result.context.sessionCache.interactions || 0} interactions,
                                        ${result.context.sessionCache.concepts || 0} concepts
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </details>
                </div>
            ` : ''}
        `;
        
        resultElement.style.display = 'block';
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Render individual match result
     * @param {object} match - Match result
     * @param {number} index - Match index
     * @returns {string} - Match HTML
     */
    renderMatch(match, index) {
        const similarity = match.similarity || match.score || 0;
        const content = match.content || match.text || '';
        const metadata = match.metadata || {};
        
        return `
            <div class="match-item" data-similarity="${similarity}">
                <div class="match-header">
                    <span class="match-number">${index + 1}</span>
                    <div class="match-score">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${similarity * 100}%"></div>
                        </div>
                        <span class="score-text">${(similarity * 100).toFixed(1)}%</span>
                    </div>
                    ${metadata.type ? `<span class="match-type">${metadata.type}</span>` : ''}
                </div>
                
                <div class="match-content">
                    ${this.highlightQuery(this.formatText(content), this.currentQuery)}
                </div>
                
                ${this.queryOptions.includeMetadata && Object.keys(metadata).length > 0 ? `
                    <div class="match-metadata">
                        <details>
                            <summary>Metadata (${Object.keys(metadata).length} items)</summary>
                            <div class="metadata-content">
                                ${Object.entries(metadata).map(([key, value]) => `
                                    <div class="metadata-item">
                                        <span class="metadata-key">${escapeHtml(key)}:</span>
                                        <span class="metadata-value">${escapeHtml(JSON.stringify(value))}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Format text content for display
     * @param {string} text - Text to format
     * @returns {string} - Formatted HTML
     */
    formatText(text) {
        if (!text) return '';
        
        // Convert newlines to <br> and escape HTML
        return escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    }
    
    /**
     * Highlight query terms in content
     * @param {string} content - Content to highlight
     * @param {string} query - Query terms
     * @returns {string} - Content with highlighted terms
     */
    highlightQuery(content, query) {
        if (!content || !query) return content;
        
        // Extract meaningful words from query (ignore common words)
        const stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where'];
        const queryWords = query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word))
            .slice(0, 5); // Limit to 5 words for performance
        
        let highlighted = content;
        
        queryWords.forEach(word => {
            const regex = new RegExp(`\\b(${escapeHtml(word)})\\b`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        
        return highlighted;
    }
    
    /**
     * Show operation error
     * @param {Error} error - Error object
     */
    showError(error) {
        const resultElement = document.getElementById('ask-result');
        if (!resultElement) return;
        
        resultElement.innerHTML = `
            <div class="result-header error">
                <h4>❌ Query Failed</h4>
                <div class="result-actions">
                    <button class="retry-query-btn action-btn" title="Try again">🔄</button>
                </div>
            </div>
            
            <div class="result-details">
                <div class="error-message">
                    ${escapeHtml(error.message)}
                </div>
                
                ${error.details ? `
                    <details class="error-details">
                        <summary>Error Details</summary>
                        <pre>${escapeHtml(JSON.stringify(error.details, null, 2))}</pre>
                    </details>
                ` : ''}
                
                <div class="error-suggestions">
                    <h5>Troubleshooting</h5>
                    <ul>
                        <li>Check your internet connection</li>
                        <li>Verify the MCP server is running</li>
                        <li>Try simplifying your query</li>
                        <li>Check if semantic memory contains relevant content</li>
                    </ul>
                </div>
            </div>
        `;
        
        resultElement.style.display = 'block';
    }
    
    /**
     * Clear result display
     */
    clearResult() {
        const resultElement = document.getElementById('ask-result');
        if (resultElement) {
            resultElement.style.display = 'none';
            resultElement.innerHTML = '';
        }
    }
    
    /**
     * Copy result to clipboard
     */
    async copyResult() {
        const resultElement = document.getElementById('ask-result');
        if (!resultElement) return;
        
        try {
            // Extract text content from result
            const textContent = resultElement.textContent || '';
            const success = await copyToClipboard(textContent);
            
            if (success) {
                showToast('Results copied to clipboard', 'success', 2000);
            } else {
                showToast('Failed to copy results', 'error');
            }
        } catch (error) {
            showToast('Copy failed: ' + error.message, 'error');
        }
    }
    
    /**
     * Retry current query
     */
    retryQuery() {
        if (this.currentQuery.trim()) {
            this.handleSubmit();
        }
    }
    
    /**
     * Add query to history
     * @param {string} query - Query text
     * @param {object} result - Query result
     * @param {number} duration - Query duration
     */
    addToHistory(query, result, duration) {
        const historyItem = {
            query,
            timestamp: Date.now(),
            duration,
            resultCount: result.results ? result.results.length : 0,
            hasAnswer: !!(result.answer && result.answer.trim())
        };
        
        // Add to beginning and limit to 10 items
        this.queryHistory.unshift(historyItem);
        this.queryHistory = this.queryHistory.slice(0, 10);
        
        // Save to localStorage
        this.saveQueryHistory();
        this.updateHistoryDisplay();
    }
    
    /**
     * Update history display
     */
    updateHistoryDisplay() {
        const historyElement = document.getElementById('history-list');
        if (!historyElement) return;
        
        if (this.queryHistory.length === 0) {
            historyElement.innerHTML = '<div class="history-empty">No recent queries</div>';
            return;
        }
        
        historyElement.innerHTML = this.queryHistory.map(item => `
            <div class="history-item" data-query="${escapeHtml(item.query)}">
                <div class="history-query">${escapeHtml(item.query)}</div>
                <div class="history-meta">
                    ${new Date(item.timestamp).toLocaleTimeString()} • 
                    ${formatDuration(item.duration)} • 
                    ${item.resultCount} results
                    ${item.hasAnswer ? ' • Has answer' : ''}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Load query history from localStorage
     */
    loadQueryHistory() {
        try {
            const stored = localStorage.getItem('semem-query-history');
            if (stored) {
                this.queryHistory = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load query history:', error);
            this.queryHistory = [];
        }
    }
    
    /**
     * Save query history to localStorage
     */
    saveQueryHistory() {
        try {
            localStorage.setItem('semem-query-history', JSON.stringify(this.queryHistory));
        } catch (error) {
            console.warn('Failed to save query history:', error);
        }
    }
    
    /**
     * Update loading state UI
     * @param {object} loadingState - Loading state object
     */
    updateLoadingState(loadingState) {
        if (loadingState.operation === 'ask') {
            this.updateUI();
        }
    }
    
    /**
     * Get current form state
     * @returns {object} - Current form state
     */
    getState() {
        return {
            query: this.currentQuery,
            options: { ...this.queryOptions },
            isSubmitting: this.isSubmitting,
            history: this.queryHistory
        };
    }
    
    /**
     * Set form state
     * @param {object} state - State to restore
     */
    setState(state) {
        if (state.query !== undefined) {
            this.currentQuery = state.query;
            const queryElement = document.getElementById('ask-query');
            if (queryElement) {
                queryElement.value = state.query;
            }
        }
        
        if (state.options !== undefined) {
            this.queryOptions = { ...this.queryOptions, ...state.options };
            this.updateOptionsUI();
        }
        
        if (state.history !== undefined) {
            this.queryHistory = state.history;
            this.updateHistoryDisplay();
        }
        
        this.updateUI();
    }
    
    /**
     * Update options UI elements
     */
    updateOptionsUI() {
        const elements = {
            useContext: document.getElementById('ask-use-context'),
            maxResults: document.getElementById('ask-max-results'),
            threshold: document.getElementById('ask-threshold'),
            includeMetadata: document.getElementById('ask-include-metadata')
        };
        
        if (elements.useContext) {
            elements.useContext.checked = this.queryOptions.useContext;
        }
        
        if (elements.maxResults) {
            elements.maxResults.value = this.queryOptions.maxResults;
        }
        
        if (elements.threshold) {
            elements.threshold.value = this.queryOptions.threshold;
            const rangeValue = document.querySelector('.range-value');
            if (rangeValue) {
                rangeValue.textContent = this.queryOptions.threshold;
            }
        }
        
        if (elements.includeMetadata) {
            elements.includeMetadata.checked = this.queryOptions.includeMetadata;
        }
    }
}