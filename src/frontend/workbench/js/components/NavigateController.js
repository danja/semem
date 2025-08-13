/**
 * Navigate Controller Component
 * Manages the ZPT (Zoom-Pan-Tilt) navigation operations for semantic memory exploration
 */

import { showToast, escapeHtml, formatDuration, debounce } from '../utils/domUtils.js';

/**
 * NavigateController manages the ZPT navigation interface
 * Handles zoom, pan, and tilt operations for exploring the semantic memory space
 */
export class NavigateController {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        
        // ZPT operation definitions
        this.zoomLevels = {
            micro: {
                label: 'Micro',
                description: 'Individual words and concepts',
                icon: '🔬'
            },
            entity: {
                label: 'Entity',
                description: 'Individual entities and concepts',
                icon: '🎯'
            },
            unit: {
                label: 'Unit',
                description: 'Semantic units and relations',
                icon: '🧩'
            },
            text: {
                label: 'Text',
                description: 'Full text documents and passages',
                icon: '📄'
            },
            community: {
                label: 'Community',
                description: 'Topic clusters and communities',
                icon: '🏘️'
            },
            corpus: {
                label: 'Corpus',
                description: 'Entire knowledge corpus',
                icon: '🌍'
            }
        };
        
        this.tiltStyles = {
            keywords: {
                label: 'Keywords',
                description: 'Keyword-based representation',
                icon: '🏷️'
            },
            embedding: {
                label: 'Embedding',
                description: 'Vector similarity representation',
                icon: '🎨'
            },
            graph: {
                label: 'Graph',
                description: 'Network relationship view',
                icon: '🕸️'
            },
            temporal: {
                label: 'Temporal',
                description: 'Time-based ordering',
                icon: '⏰'
            }
        };
        
        // Current ZPT state
        this.currentZPT = {
            zoom: 'entity',
            pan: {
                domains: [],
                keywords: [],
                entities: [],
                temporal: {}
            },
            tilt: 'keywords',
            query: ''
        };
        
        this.isNavigating = false;
        this.navigationHistory = [];
        
        // Bind methods
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handleTiltChange = this.handleTiltChange.bind(this);
        this.handlePanUpdate = debounce(this.handlePanUpdate.bind(this), 500);
        this.handleQueryChange = debounce(this.handleQueryChange.bind(this), 800);
        this.applyNavigation = this.applyNavigation.bind(this);
        this.resetNavigation = this.resetNavigation.bind(this);
        this.savePreset = this.savePreset.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize the Navigate controller
     */
    initialize() {
        // Load current ZPT state from state manager
        const currentZPT = this.stateManager.get('zpt');
        if (currentZPT) {
            this.currentZPT = { ...this.currentZPT, ...currentZPT };
        }
        
        this.render();
        this.updateUI();
        this.loadNavigationHistory();
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        document.addEventListener('change', (event) => {
            if (event.target.matches('#nav-zoom')) {
                this.handleZoomChange(event.target.value);
            }
            
            if (event.target.matches('#nav-tilt')) {
                this.handleTiltChange(event.target.value);
            }
        });
        
        document.addEventListener('input', (event) => {
            if (event.target.matches('#nav-query')) {
                this.handleQueryChange(event.target.value);
            }
            
            if (event.target.matches('#pan-domains')) {
                this.handlePanUpdate('domains', event.target.value);
            }
            
            if (event.target.matches('#pan-keywords')) {
                this.handlePanUpdate('keywords', event.target.value);
            }
            
            if (event.target.matches('#pan-entities')) {
                this.handlePanUpdate('entities', event.target.value);
            }
        });
        
        document.addEventListener('click', (event) => {
            if (event.target.matches('#nav-apply')) {
                event.preventDefault();
                this.applyNavigation();
            }
            
            if (event.target.matches('#nav-reset')) {
                event.preventDefault();
                this.resetNavigation();
            }
            
            if (event.target.matches('#nav-save-preset')) {
                event.preventDefault();
                this.savePreset();
            }
            
            if (event.target.matches('.preset-btn')) {
                event.preventDefault();
                const preset = event.target.dataset.preset;
                if (preset) {
                    this.loadPreset(preset);
                }
            }
            
            if (event.target.matches('.history-nav-item')) {
                event.preventDefault();
                const historyItem = event.target.dataset.historyItem;
                if (historyItem) {
                    this.loadFromHistory(JSON.parse(historyItem));
                }
            }
            
            if (event.target.matches('.clear-pan-field')) {
                event.preventDefault();
                const field = event.target.dataset.field;
                if (field) {
                    this.clearPanField(field);
                }
            }
        });
        
        // Listen for state changes
        this.stateManager.on('zptStateChanged', (zptState) => {
            this.currentZPT = { ...this.currentZPT, ...zptState };
            this.updateStateDisplay();
        });
        
        this.stateManager.on('loadingStateChanged', (loadingState) => {
            this.updateLoadingState(loadingState);
        });
    }
    
    /**
     * Render the Navigate interface
     */
    render() {
        const navigateTab = document.getElementById('navigate-tab');
        if (!navigateTab) {
            console.error('Navigate tab element not found');
            return;
        }
        
        navigateTab.innerHTML = `
            <div class="navigate-container">
                <div class="navigate-header">
                    <h2>Navigate</h2>
                    <p class="navigate-description">Explore semantic memory space with Zoom, Pan, and Tilt</p>
                </div>
                
                <div class="zpt-controls">
                    <div class="zpt-section">
                        <div class="zpt-header">
                            <h3>🔍 Zoom - Abstraction Level</h3>
                            <div class="current-state" id="zoom-state">${this.zoomLevels[this.currentZPT.zoom].icon} ${this.zoomLevels[this.currentZPT.zoom].label}</div>
                        </div>
                        <div class="zoom-controls">
                            <select id="nav-zoom" class="zpt-select">
                                ${Object.entries(this.zoomLevels).map(([level, config]) =>
                                    `<option value="${level}" ${level === this.currentZPT.zoom ? 'selected' : ''}>
                                        ${config.icon} ${config.label}
                                    </option>`
                                ).join('')}
                            </select>
                            <div class="zpt-description" id="zoom-description">
                                ${this.zoomLevels[this.currentZPT.zoom].description}
                            </div>
                        </div>
                    </div>
                    
                    <div class="zpt-section">
                        <div class="zpt-header">
                            <h3>🎚️ Pan - Domain Filters</h3>
                            <div class="filter-count" id="pan-count">0 filters active</div>
                        </div>
                        <div class="pan-controls">
                            <div class="pan-field">
                                <label for="pan-domains" class="pan-label">
                                    Domains
                                    <button class="clear-pan-field" data-field="domains" title="Clear domains">×</button>
                                </label>
                                <input 
                                    id="pan-domains" 
                                    type="text" 
                                    class="pan-input" 
                                    placeholder="e.g., AI, programming, science"
                                    value="${this.currentZPT.pan.domains.join(', ')}"
                                >
                                <div class="pan-help">Comma-separated domain names</div>
                            </div>
                            
                            <div class="pan-field">
                                <label for="pan-keywords" class="pan-label">
                                    Keywords
                                    <button class="clear-pan-field" data-field="keywords" title="Clear keywords">×</button>
                                </label>
                                <input 
                                    id="pan-keywords" 
                                    type="text" 
                                    class="pan-input" 
                                    placeholder="e.g., machine learning, algorithms"
                                    value="${this.currentZPT.pan.keywords.join(', ')}"
                                >
                                <div class="pan-help">Comma-separated keywords</div>
                            </div>
                            
                            <div class="pan-field">
                                <label for="pan-entities" class="pan-label">
                                    Entities
                                    <button class="clear-pan-field" data-field="entities" title="Clear entities">×</button>
                                </label>
                                <input 
                                    id="pan-entities" 
                                    type="text" 
                                    class="pan-input" 
                                    placeholder="e.g., TensorFlow, React, JavaScript"
                                    value="${this.currentZPT.pan.entities.join(', ')}"
                                >
                                <div class="pan-help">Comma-separated entity names</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="zpt-section">
                        <div class="zpt-header">
                            <h3>🎨 Tilt - View Perspective</h3>
                            <div class="current-state" id="tilt-state">${this.tiltStyles[this.currentZPT.tilt].icon} ${this.tiltStyles[this.currentZPT.tilt].label}</div>
                        </div>
                        <div class="tilt-controls">
                            <select id="nav-tilt" class="zpt-select">
                                ${Object.entries(this.tiltStyles).map(([style, config]) =>
                                    `<option value="${style}" ${style === this.currentZPT.tilt ? 'selected' : ''}>
                                        ${config.icon} ${config.label}
                                    </option>`
                                ).join('')}
                            </select>
                            <div class="zpt-description" id="tilt-description">
                                ${this.tiltStyles[this.currentZPT.tilt].description}
                            </div>
                        </div>
                    </div>
                    
                    <div class="zpt-section">
                        <div class="zpt-header">
                            <h3>🧭 Navigation Query</h3>
                        </div>
                        <div class="query-controls">
                            <textarea 
                                id="nav-query" 
                                class="nav-query-input" 
                                rows="3"
                                placeholder="Enter navigation context or query to guide exploration..."
                            >${escapeHtml(this.currentZPT.query)}</textarea>
                            <div class="query-help">Optional context to guide navigation through the semantic space</div>
                        </div>
                    </div>
                </div>
                
                <div class="navigation-actions">
                    <button id="nav-apply" class="btn btn-primary" disabled>
                        <span class="btn-icon">🧭</span>
                        Apply Navigation
                    </button>
                    <button id="nav-reset" class="btn btn-secondary">
                        <span class="btn-icon">🔄</span>
                        Reset to Default
                    </button>
                    <button id="nav-save-preset" class="btn btn-outline">
                        <span class="btn-icon">💾</span>
                        Save as Preset
                    </button>
                </div>
                
                <div class="navigation-status">
                    <div id="nav-status" class="status-display"></div>
                </div>
                
                <div class="navigation-presets">
                    <h4>Quick Presets</h4>
                    <div class="presets-list">
                        <button class="preset-btn" data-preset="default">
                            🎯 Default View
                        </button>
                        <button class="preset-btn" data-preset="detailed">
                            🔬 Detailed Analysis  
                        </button>
                        <button class="preset-btn" data-preset="overview">
                            🌍 Corpus Overview
                        </button>
                        <button class="preset-btn" data-preset="graph">
                            🕸️ Relationship Graph
                        </button>
                    </div>
                </div>
                
                <div class="navigation-history">
                    <h4>Navigation History</h4>
                    <div id="nav-history" class="history-list">
                        <div class="history-empty">No navigation history</div>
                    </div>
                </div>
                
                <div class="navigation-results">
                    <div id="nav-result" class="result-panel" style="display: none;"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * Update UI based on current state
     */
    updateUI() {
        this.updateNavigationButton();
        this.updatePanCount();
        this.updateStateDisplay();
        this.updateHistoryDisplay();
    }
    
    /**
     * Update navigation button state
     */
    updateNavigationButton() {
        const applyButton = document.getElementById('nav-apply');
        if (applyButton) {
            applyButton.disabled = this.isNavigating;
            
            if (this.isNavigating) {
                applyButton.innerHTML = '<span class="btn-spinner">⏳</span> Navigating...';
            } else {
                applyButton.innerHTML = '<span class="btn-icon">🧭</span> Apply Navigation';
            }
        }
    }
    
    /**
     * Update pan filter count display
     */
    updatePanCount() {
        const countElement = document.getElementById('pan-count');
        if (countElement) {
            const totalFilters = 
                this.currentZPT.pan.domains.length +
                this.currentZPT.pan.keywords.length +
                this.currentZPT.pan.entities.length;
            
            countElement.textContent = `${totalFilters} filter${totalFilters !== 1 ? 's' : ''} active`;
        }
    }
    
    /**
     * Update current state display
     */
    updateStateDisplay() {
        const zoomState = document.getElementById('zoom-state');
        const tiltState = document.getElementById('tilt-state');
        const zoomDesc = document.getElementById('zoom-description');
        const tiltDesc = document.getElementById('tilt-description');
        
        if (zoomState) {
            const zoomConfig = this.zoomLevels[this.currentZPT.zoom];
            zoomState.textContent = `${zoomConfig.icon} ${zoomConfig.label}`;
        }
        
        if (tiltState) {
            const tiltConfig = this.tiltStyles[this.currentZPT.tilt];
            tiltState.textContent = `${tiltConfig.icon} ${tiltConfig.label}`;
        }
        
        if (zoomDesc) {
            zoomDesc.textContent = this.zoomLevels[this.currentZPT.zoom].description;
        }
        
        if (tiltDesc) {
            tiltDesc.textContent = this.tiltStyles[this.currentZPT.tilt].description;
        }
    }
    
    /**
     * Handle zoom level change
     * @param {string} level - New zoom level
     */
    handleZoomChange(level) {
        this.currentZPT.zoom = level;
        this.updateUI();
    }
    
    /**
     * Handle tilt style change
     * @param {string} style - New tilt style
     */
    handleTiltChange(style) {
        this.currentZPT.tilt = style;
        this.updateUI();
    }
    
    /**
     * Handle pan filter updates
     * @param {string} field - Pan field (domains, keywords, entities)
     * @param {string} value - Filter value
     */
    handlePanUpdate(field, value) {
        const filters = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
        this.currentZPT.pan[field] = filters;
        this.updateUI();
    }
    
    /**
     * Handle navigation query changes
     * @param {string} query - Navigation query
     */
    handleQueryChange(query) {
        this.currentZPT.query = query;
    }
    
    /**
     * Apply current navigation settings
     */
    async applyNavigation() {
        if (this.isNavigating) return;
        
        this.isNavigating = true;
        this.stateManager.setLoading(true, 'Applying navigation settings...', 'navigate');
        
        try {
            const startTime = Date.now();
            const operations = [];
            
            // Execute zoom operation
            const zoomResult = await this.apiService.zoom(this.currentZPT.zoom, this.currentZPT.query);
            operations.push({ operation: 'zoom', result: zoomResult, duration: zoomResult._performance?.duration });
            
            // Execute pan operation if filters are set
            const hasPanFilters = 
                this.currentZPT.pan.domains.length > 0 ||
                this.currentZPT.pan.keywords.length > 0 ||
                this.currentZPT.pan.entities.length > 0;
                
            if (hasPanFilters) {
                const panResult = await this.apiService.pan(
                    this.currentZPT.pan.domains,
                    this.currentZPT.pan.keywords,
                    this.currentZPT.pan.temporal,
                    this.currentZPT.pan.entities,
                    this.currentZPT.query
                );
                operations.push({ operation: 'pan', result: panResult, duration: panResult._performance?.duration });
            }
            
            // Execute tilt operation
            const tiltResult = await this.apiService.tilt(this.currentZPT.tilt, this.currentZPT.query);
            operations.push({ operation: 'tilt', result: tiltResult, duration: tiltResult._performance?.duration });
            
            const totalDuration = Date.now() - startTime;
            
            // Record performance for each operation
            operations.forEach(op => {
                if (op.duration) {
                    this.stateManager.recordPerformance(op.operation, op.duration, {
                        hasQuery: this.currentZPT.query.length > 0,
                        filterCount: hasPanFilters ? 
                            this.currentZPT.pan.domains.length + 
                            this.currentZPT.pan.keywords.length + 
                            this.currentZPT.pan.entities.length : 0
                    });
                }
            });
            
            // Update state manager with new ZPT state
            this.stateManager.updateZPT(this.currentZPT);
            
            // Add to navigation history
            this.addToHistory(this.currentZPT, operations, totalDuration);
            
            // Show results
            this.showNavigationResult(operations, totalDuration);
            
            showToast(`Navigation applied (${formatDuration(totalDuration)})`, 'success');
            
        } catch (error) {
            console.error('Navigation failed:', error);
            this.showNavigationError(error);
            showToast('Navigation failed: ' + error.message, 'error');
        } finally {
            this.isNavigating = false;
            this.stateManager.setLoading(false);
            this.updateUI();
        }
    }
    
    /**
     * Reset navigation to default settings
     */
    resetNavigation() {
        this.currentZPT = {
            zoom: 'entity',
            pan: {
                domains: [],
                keywords: [],
                entities: [],
                temporal: {}
            },
            tilt: 'keywords',
            query: ''
        };
        
        // Update form elements
        const elements = {
            zoom: document.getElementById('nav-zoom'),
            tilt: document.getElementById('nav-tilt'),
            query: document.getElementById('nav-query'),
            domains: document.getElementById('pan-domains'),
            keywords: document.getElementById('pan-keywords'),
            entities: document.getElementById('pan-entities')
        };
        
        if (elements.zoom) elements.zoom.value = 'entity';
        if (elements.tilt) elements.tilt.value = 'keywords';
        if (elements.query) elements.query.value = '';
        if (elements.domains) elements.domains.value = '';
        if (elements.keywords) elements.keywords.value = '';
        if (elements.entities) elements.entities.value = '';
        
        this.clearNavigationResult();
        this.updateUI();
        
        showToast('Navigation reset to defaults', 'info');
    }
    
    /**
     * Clear specific pan field
     * @param {string} field - Field to clear
     */
    clearPanField(field) {
        this.currentZPT.pan[field] = [];
        
        const inputElement = document.getElementById(`pan-${field}`);
        if (inputElement) {
            inputElement.value = '';
        }
        
        this.updateUI();
    }
    
    /**
     * Load navigation preset
     * @param {string} presetName - Preset name
     */
    loadPreset(presetName) {
        const presets = {
            default: {
                zoom: 'entity',
                pan: { domains: [], keywords: [], entities: [], temporal: {} },
                tilt: 'keywords',
                query: ''
            },
            detailed: {
                zoom: 'micro',
                pan: { domains: [], keywords: [], entities: [], temporal: {} },
                tilt: 'embedding',
                query: 'detailed analysis'
            },
            overview: {
                zoom: 'corpus',
                pan: { domains: [], keywords: [], entities: [], temporal: {} },
                tilt: 'temporal',
                query: 'corpus overview'
            },
            graph: {
                zoom: 'unit',
                pan: { domains: [], keywords: [], entities: [], temporal: {} },
                tilt: 'graph',
                query: 'relationship analysis'
            }
        };
        
        const preset = presets[presetName];
        if (preset) {
            this.currentZPT = { ...preset };
            this.updateFormElements();
            this.updateUI();
            showToast(`Loaded ${presetName} preset`, 'info');
        }
    }
    
    /**
     * Update form elements to match current ZPT state
     */
    updateFormElements() {
        const elements = {
            zoom: document.getElementById('nav-zoom'),
            tilt: document.getElementById('nav-tilt'),
            query: document.getElementById('nav-query'),
            domains: document.getElementById('pan-domains'),
            keywords: document.getElementById('pan-keywords'),
            entities: document.getElementById('pan-entities')
        };
        
        if (elements.zoom) elements.zoom.value = this.currentZPT.zoom;
        if (elements.tilt) elements.tilt.value = this.currentZPT.tilt;
        if (elements.query) elements.query.value = this.currentZPT.query;
        if (elements.domains) elements.domains.value = this.currentZPT.pan.domains.join(', ');
        if (elements.keywords) elements.keywords.value = this.currentZPT.pan.keywords.join(', ');
        if (elements.entities) elements.entities.value = this.currentZPT.pan.entities.join(', ');
    }
    
    /**
     * Show navigation operation results
     * @param {Array} operations - Completed operations
     * @param {number} totalDuration - Total navigation duration
     */
    showNavigationResult(operations, totalDuration) {
        const resultElement = document.getElementById('nav-result');
        if (!resultElement) return;
        
        const successfulOps = operations.filter(op => op.result.success !== false);
        const failedOps = operations.filter(op => op.result.success === false);
        
        resultElement.innerHTML = `
            <div class="result-header">
                <h4>✅ Navigation Applied</h4>
                <div class="result-meta">
                    <span>Total Duration: ${formatDuration(totalDuration)}</span>
                    <span>Operations: ${successfulOps.length}/${operations.length}</span>
                </div>
            </div>
            
            <div class="navigation-summary">
                <div class="nav-state-display">
                    <div class="state-item">
                        <span class="state-icon">${this.zoomLevels[this.currentZPT.zoom].icon}</span>
                        <span class="state-label">Zoom:</span>
                        <span class="state-value">${this.zoomLevels[this.currentZPT.zoom].label}</span>
                    </div>
                    
                    <div class="state-item">
                        <span class="state-icon">🎚️</span>
                        <span class="state-label">Pan:</span>
                        <span class="state-value">
                            ${this.currentZPT.pan.domains.length + this.currentZPT.pan.keywords.length + this.currentZPT.pan.entities.length} filters
                        </span>
                    </div>
                    
                    <div class="state-item">
                        <span class="state-icon">${this.tiltStyles[this.currentZPT.tilt].icon}</span>
                        <span class="state-label">Tilt:</span>
                        <span class="state-value">${this.tiltStyles[this.currentZPT.tilt].label}</span>
                    </div>
                    
                    ${this.currentZPT.query ? `
                        <div class="state-item">
                            <span class="state-icon">🧭</span>
                            <span class="state-label">Query:</span>
                            <span class="state-value">${escapeHtml(this.currentZPT.query.substring(0, 50))}${this.currentZPT.query.length > 50 ? '...' : ''}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="operation-results">
                <h5>Operation Details</h5>
                ${operations.map(op => `
                    <div class="operation-item ${op.result.success === false ? 'error' : 'success'}">
                        <div class="operation-header">
                            <span class="operation-icon">${op.result.success === false ? '❌' : '✅'}</span>
                            <span class="operation-name">${op.operation.toUpperCase()}</span>
                            ${op.duration ? `<span class="operation-time">${formatDuration(op.duration)}</span>` : ''}
                        </div>
                        
                        ${op.result.message ? `
                            <div class="operation-message">
                                ${escapeHtml(op.result.message)}
                            </div>
                        ` : ''}
                        
                        ${op.result.data && Object.keys(op.result.data).length > 0 ? `
                            <div class="operation-data">
                                <details>
                                    <summary>Operation Data</summary>
                                    <pre>${escapeHtml(JSON.stringify(op.result.data, null, 2))}</pre>
                                </details>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${failedOps.length > 0 ? `
                <div class="navigation-warnings">
                    <h5>⚠️ Warnings</h5>
                    <ul>
                        ${failedOps.map(op => `
                            <li>${op.operation} operation failed: ${op.result.error || 'Unknown error'}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
        
        resultElement.style.display = 'block';
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    /**
     * Show navigation error
     * @param {Error} error - Error object
     */
    showNavigationError(error) {
        const resultElement = document.getElementById('nav-result');
        if (!resultElement) return;
        
        resultElement.innerHTML = `
            <div class="result-header error">
                <h4>❌ Navigation Failed</h4>
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
                        <li>Check MCP server connectivity</li>
                        <li>Verify navigation parameters are valid</li>
                        <li>Try resetting to default navigation settings</li>
                        <li>Ensure semantic memory contains content to navigate</li>
                    </ul>
                </div>
            </div>
        `;
        
        resultElement.style.display = 'block';
    }
    
    /**
     * Clear navigation results display
     */
    clearNavigationResult() {
        const resultElement = document.getElementById('nav-result');
        if (resultElement) {
            resultElement.style.display = 'none';
            resultElement.innerHTML = '';
        }
    }
    
    /**
     * Add navigation to history
     * @param {object} zptState - ZPT state
     * @param {Array} operations - Navigation operations
     * @param {number} duration - Total duration
     */
    addToHistory(zptState, operations, duration) {
        const historyItem = {
            zpt: JSON.parse(JSON.stringify(zptState)),
            timestamp: Date.now(),
            duration,
            operations: operations.length,
            successful: operations.filter(op => op.result.success !== false).length
        };
        
        // Add to beginning and limit to 10 items
        this.navigationHistory.unshift(historyItem);
        this.navigationHistory = this.navigationHistory.slice(0, 10);
        
        // Save to localStorage
        this.saveNavigationHistory();
        this.updateHistoryDisplay();
    }
    
    /**
     * Load from navigation history
     * @param {object} historyItem - History item to load
     */
    loadFromHistory(historyItem) {
        this.currentZPT = { ...historyItem.zpt };
        this.updateFormElements();
        this.updateUI();
        showToast('Navigation state restored from history', 'info');
    }
    
    /**
     * Update navigation history display
     */
    updateHistoryDisplay() {
        const historyElement = document.getElementById('nav-history');
        if (!historyElement) return;
        
        if (this.navigationHistory.length === 0) {
            historyElement.innerHTML = '<div class="history-empty">No navigation history</div>';
            return;
        }
        
        historyElement.innerHTML = this.navigationHistory.map(item => {
            const filterCount = item.zpt.pan.domains.length + item.zpt.pan.keywords.length + item.zpt.pan.entities.length;
            
            return `
                <div class="history-nav-item" data-history-item="${escapeHtml(JSON.stringify(item))}">
                    <div class="history-nav-summary">
                        ${this.zoomLevels[item.zpt.zoom].icon} ${item.zpt.zoom} • 
                        ${this.tiltStyles[item.zpt.tilt].icon} ${item.zpt.tilt}
                        ${filterCount > 0 ? ` • ${filterCount} filters` : ''}
                    </div>
                    <div class="history-nav-meta">
                        ${new Date(item.timestamp).toLocaleTimeString()} • 
                        ${formatDuration(item.duration)} • 
                        ${item.successful}/${item.operations} ops
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Save navigation preset
     */
    savePreset() {
        const presetName = prompt('Enter preset name:', 'My Navigation Preset');
        if (!presetName) return;
        
        try {
            const presets = this.loadSavedPresets();
            presets[presetName] = { ...this.currentZPT };
            localStorage.setItem('semem-navigation-presets', JSON.stringify(presets));
            showToast(`Preset "${presetName}" saved`, 'success');
        } catch (error) {
            console.error('Failed to save preset:', error);
            showToast('Failed to save preset', 'error');
        }
    }
    
    /**
     * Load saved presets from localStorage
     * @returns {object} - Saved presets
     */
    loadSavedPresets() {
        try {
            const stored = localStorage.getItem('semem-navigation-presets');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load presets:', error);
            return {};
        }
    }
    
    /**
     * Load navigation history from localStorage
     */
    loadNavigationHistory() {
        try {
            const stored = localStorage.getItem('semem-navigation-history');
            if (stored) {
                this.navigationHistory = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load navigation history:', error);
            this.navigationHistory = [];
        }
    }
    
    /**
     * Save navigation history to localStorage
     */
    saveNavigationHistory() {
        try {
            localStorage.setItem('semem-navigation-history', JSON.stringify(this.navigationHistory));
        } catch (error) {
            console.warn('Failed to save navigation history:', error);
        }
    }
    
    /**
     * Update loading state UI
     * @param {object} loadingState - Loading state object
     */
    updateLoadingState(loadingState) {
        if (['zoom', 'pan', 'tilt', 'navigate'].includes(loadingState.operation)) {
            this.updateUI();
        }
    }
    
    /**
     * Get current controller state
     * @returns {object} - Current state
     */
    getState() {
        return {
            zpt: { ...this.currentZPT },
            isNavigating: this.isNavigating,
            history: this.navigationHistory
        };
    }
    
    /**
     * Set controller state
     * @param {object} state - State to restore
     */
    setState(state) {
        if (state.zpt) {
            this.currentZPT = { ...state.zpt };
            this.updateFormElements();
        }
        
        if (state.history) {
            this.navigationHistory = state.history;
            this.updateHistoryDisplay();
        }
        
        this.updateUI();
    }
}