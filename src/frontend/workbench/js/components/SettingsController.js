/**
 * Settings Controller Component
 * Provides UI for managing models, endpoints, and workbench preferences
 */

import { showToast, escapeHtml, getElementById, createElement } from '../utils/domUtils.js';

/**
 * SettingsController manages the settings interface
 * Provides forms for model selection, endpoint configuration, and UI preferences
 */
export class SettingsController {
    constructor(stateManager, apiService, settingsManager) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        this.settingsManager = settingsManager;
        
        // UI state
        this.activeSection = 'models';
        this.isInitialized = false;
        this.unsavedChanges = false;
        this.formData = {};
        
        // Available sections
        this.sections = {
            models: {
                label: 'Models',
                icon: '🤖',
                description: 'Configure LLM and embedding providers'
            },
            storage: {
                label: 'Storage',
                icon: '💾',
                description: 'Database and storage backend settings'
            },
            endpoints: {
                label: 'Endpoints',
                icon: '🔗',
                description: 'SPARQL endpoint configurations'
            },
            ui: {
                label: 'Interface',
                icon: '🎨',
                description: 'UI preferences and display options'
            },
            memory: {
                label: 'Memory',
                icon: '🧠',
                description: 'Semantic memory parameters'
            },
            advanced: {
                label: 'Advanced',
                icon: '⚙️',
                description: 'Advanced configuration options'
            }
        };
        
        // Bind methods
        this.handleSectionSwitch = this.handleSectionSwitch.bind(this);
        this.handleFormChange = this.handleFormChange.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.resetSettings = this.resetSettings.bind(this);
        this.importSettings = this.importSettings.bind(this);
        this.exportSettings = this.exportSettings.bind(this);
        
        this.initializeEventListeners();
    }
    
    /**
     * Initialize the settings controller
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Wait for settings manager to be ready
            await this.waitForSettingsManager();
            
            // Load current settings into form data
            this.loadCurrentSettings();
            
            // Render the interface
            this.render();
            
            // Set up settings manager event listeners
            this.setupSettingsManagerListeners();
            
            this.isInitialized = true;
            console.log('SettingsController initialized');
            
        } catch (error) {
            console.error('Failed to initialize SettingsController:', error);
            showToast('Failed to load settings interface', 'error');
        }
    }
    
    /**
     * Wait for settings manager to be initialized
     */
    async waitForSettingsManager() {
        return new Promise((resolve) => {
            if (this.settingsManager.settings) {
                resolve();
            } else {
                this.settingsManager.on('initialized', () => resolve());
            }
        });
    }
    
    /**
     * Load current settings into form data
     */
    loadCurrentSettings() {
        this.formData = {
            models: {
                chat: {
                    provider: this.settingsManager.get('models.chat.provider'),
                    model: this.settingsManager.get('models.chat.model'),
                    apiKey: this.settingsManager.get('models.chat.options.apiKey') || '',
                    baseUrl: this.settingsManager.get('models.chat.options.baseUrl') || ''
                },
                embedding: {
                    provider: this.settingsManager.get('models.embedding.provider'),
                    model: this.settingsManager.get('models.embedding.model'),
                    apiKey: this.settingsManager.get('models.embedding.options.apiKey') || '',
                    baseUrl: this.settingsManager.get('models.embedding.options.baseUrl') || ''
                }
            },
            storage: {
                type: this.settingsManager.get('storage.type'),
                query: this.settingsManager.get('storage.options.query') || '',
                update: this.settingsManager.get('storage.options.update') || '',
                user: this.settingsManager.get('storage.options.user') || '',
                password: this.settingsManager.get('storage.options.password') || ''
            },
            ui: {
                theme: this.settingsManager.get('ui.theme'),
                autoSave: this.settingsManager.get('ui.autoSave'),
                showPerformanceMetrics: this.settingsManager.get('ui.showPerformanceMetrics'),
                showAdvancedOptions: this.settingsManager.get('ui.showAdvancedOptions'),
                defaultTab: this.settingsManager.get('ui.defaultTab'),
                maxHistoryItems: this.settingsManager.get('ui.maxHistoryItems')
            },
            memory: {
                dimension: this.settingsManager.get('memory.dimension'),
                similarityThreshold: this.settingsManager.get('memory.similarityThreshold'),
                contextWindow: this.settingsManager.get('memory.contextWindow'),
                decayRate: this.settingsManager.get('memory.decayRate')
            }
        };
    }
    
    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        document.addEventListener('click', (event) => {
            if (event.target.matches('.settings-section-btn')) {
                const section = event.target.dataset.section;
                if (section) {
                    this.handleSectionSwitch(section);
                }
            }
            
            if (event.target.matches('#settings-save')) {
                event.preventDefault();
                this.saveSettings();
            }
            
            if (event.target.matches('#settings-reset')) {
                event.preventDefault();
                this.resetSettings();
            }
            
            if (event.target.matches('#settings-import')) {
                event.preventDefault();
                this.importSettings();
            }
            
            if (event.target.matches('#settings-export')) {
                event.preventDefault();
                this.exportSettings();
            }
            
            if (event.target.matches('.test-connection-btn')) {
                event.preventDefault();
                const type = event.target.dataset.type;
                if (type) {
                    this.testConnection(type);
                }
            }
            
            if (event.target.matches('.add-endpoint-btn')) {
                event.preventDefault();
                this.addEndpoint();
            }
            
            if (event.target.matches('.remove-endpoint-btn')) {
                event.preventDefault();
                const index = parseInt(event.target.dataset.index);
                this.removeEndpoint(index);
            }
        });
        
        document.addEventListener('change', (event) => {
            if (event.target.matches('.settings-form input, .settings-form select, .settings-form textarea')) {
                this.handleFormChange(event);
            }
        });
        
        document.addEventListener('input', (event) => {
            if (event.target.matches('.settings-form input[type="range"]')) {
                this.handleRangeInput(event);
            }
        });
    }
    
    /**
     * Setup settings manager event listeners
     */
    setupSettingsManagerListeners() {
        this.settingsManager.on('settingChanged', (event) => {
            this.updateFormField(event.path, event.value);
        });
        
        this.settingsManager.on('error', (event) => {
            showToast(`Settings error: ${event.error.message}`, 'error');
        });
        
        this.settingsManager.on('warning', (event) => {
            showToast(`Settings warning: ${event.error.message}`, 'warning');
        });
    }
    
    /**
     * Render the settings interface
     */
    render() {
        const settingsTab = getElementById('settings-tab');
        if (!settingsTab) {
            console.error('Settings tab element not found');
            return;
        }
        
        settingsTab.innerHTML = `
            <div class="settings-container">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <p class="settings-description">Configure models, storage, and workbench preferences</p>
                </div>
                
                <div class="settings-layout">
                    <div class="settings-sidebar">
                        <nav class="settings-nav">
                            ${Object.entries(this.sections).map(([key, section]) => `
                                <button 
                                    class="settings-section-btn ${key === this.activeSection ? 'active' : ''}" 
                                    data-section="${key}"
                                    title="${section.description}"
                                >
                                    <span class="section-icon">${section.icon}</span>
                                    <span class="section-label">${section.label}</span>
                                </button>
                            `).join('')}
                        </nav>
                        
                        <div class="settings-actions">
                            <button id="settings-save" class="btn btn-primary" disabled>
                                <span class="btn-icon">💾</span>
                                Save Changes
                            </button>
                            <button id="settings-reset" class="btn btn-secondary">
                                <span class="btn-icon">🔄</span>
                                Reset
                            </button>
                        </div>
                        
                        <div class="settings-utils">
                            <button id="settings-export" class="btn btn-outline">
                                <span class="btn-icon">📤</span>
                                Export
                            </button>
                            <button id="settings-import" class="btn btn-outline">
                                <span class="btn-icon">📥</span>
                                Import
                            </button>
                        </div>
                    </div>
                    
                    <div class="settings-content">
                        <div id="settings-form" class="settings-form">
                            ${this.renderSection(this.activeSection)}
                        </div>
                    </div>
                </div>
                
                <div class="settings-status">
                    <div id="settings-status-message" class="status-message"></div>
                </div>
            </div>
        `;
        
        // Initialize dynamic elements
        this.initializeRangeInputs();
        this.updateUnsavedIndicator();
    }
    
    /**
     * Render a specific settings section
     * @param {string} section - Section name
     * @returns {string} - Section HTML
     */
    renderSection(section) {
        switch (section) {
            case 'models':
                return this.renderModelsSection();
            case 'storage':
                return this.renderStorageSection();
            case 'endpoints':
                return this.renderEndpointsSection();
            case 'ui':
                return this.renderUISection();
            case 'memory':
                return this.renderMemorySection();
            case 'advanced':
                return this.renderAdvancedSection();
            default:
                return '<div class="section-placeholder">Select a section to configure</div>';
        }
    }
    
    /**
     * Render models configuration section
     * @returns {string} - Models section HTML
     */
    renderModelsSection() {
        const chatProviders = this.settingsManager.getAvailableProviders('llm');
        const embeddingProviders = this.settingsManager.getAvailableProviders('embedding');
        
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>🤖 Model Configuration</h3>
                    <p>Configure language models and embedding providers</p>
                </div>
                
                <div class="model-section">
                    <h4>Chat Model</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="chat-provider">Provider</label>
                            <select id="chat-provider" name="models.chat.provider" class="form-select">
                                ${Object.entries(chatProviders).map(([key, provider]) => `
                                    <option value="${key}" ${key === this.formData.models.chat.provider ? 'selected' : ''}>
                                        ${provider.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="chat-model">Model</label>
                            <select id="chat-model" name="models.chat.model" class="form-select">
                                ${this.renderModelOptions('chat', this.formData.models.chat.provider)}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="chat-api-key">API Key</label>
                            <input 
                                type="password" 
                                id="chat-api-key" 
                                name="models.chat.apiKey" 
                                class="form-input"
                                value="${escapeHtml(this.formData.models.chat.apiKey)}"
                                placeholder="Enter API key (if required)"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="chat-base-url">Base URL</label>
                            <input 
                                type="url" 
                                id="chat-base-url" 
                                name="models.chat.baseUrl" 
                                class="form-input"
                                value="${escapeHtml(this.formData.models.chat.baseUrl)}"
                                placeholder="http://localhost:11434"
                            >
                        </div>
                    </div>
                    
                    <button class="test-connection-btn" data-type="chat" title="Test chat model connection">
                        🔍 Test Connection
                    </button>
                </div>
                
                <div class="model-section">
                    <h4>Embedding Model</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="embedding-provider">Provider</label>
                            <select id="embedding-provider" name="models.embedding.provider" class="form-select">
                                ${Object.entries(embeddingProviders).map(([key, provider]) => `
                                    <option value="${key}" ${key === this.formData.models.embedding.provider ? 'selected' : ''}>
                                        ${provider.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="embedding-model">Model</label>
                            <select id="embedding-model" name="models.embedding.model" class="form-select">
                                ${this.renderModelOptions('embedding', this.formData.models.embedding.provider)}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="embedding-api-key">API Key</label>
                            <input 
                                type="password" 
                                id="embedding-api-key" 
                                name="models.embedding.apiKey" 
                                class="form-input"
                                value="${escapeHtml(this.formData.models.embedding.apiKey)}"
                                placeholder="Enter API key (if required)"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label for="embedding-base-url">Base URL</label>
                            <input 
                                type="url" 
                                id="embedding-base-url" 
                                name="models.embedding.baseUrl" 
                                class="form-input"
                                value="${escapeHtml(this.formData.models.embedding.baseUrl)}"
                                placeholder="http://localhost:11434"
                            >
                        </div>
                    </div>
                    
                    <button class="test-connection-btn" data-type="embedding" title="Test embedding model connection">
                        🔍 Test Connection
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Render model options for a provider
     * @param {string} type - Model type ('chat' or 'embedding')
     * @param {string} provider - Provider name
     * @returns {string} - Options HTML
     */
    renderModelOptions(type, provider) {
        const models = this.settingsManager.getAvailableModels(type === 'chat' ? 'llm' : 'embedding', provider);
        const currentModel = this.formData.models[type].model;
        
        return models.map(model => `
            <option value="${model}" ${model === currentModel ? 'selected' : ''}>
                ${model}
            </option>
        `).join('');
    }
    
    /**
     * Render storage configuration section
     * @returns {string} - Storage section HTML
     */
    renderStorageSection() {
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>💾 Storage Configuration</h3>
                    <p>Configure database and storage backend</p>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="storage-type">Storage Type</label>
                        <select id="storage-type" name="storage.type" class="form-select">
                            <option value="memory" ${this.formData.storage.type === 'memory' ? 'selected' : ''}>In-Memory (Development)</option>
                            <option value="json" ${this.formData.storage.type === 'json' ? 'selected' : ''}>JSON Files</option>
                            <option value="sparql" ${this.formData.storage.type === 'sparql' ? 'selected' : ''}>SPARQL Endpoint</option>
                            <option value="cached-sparql" ${this.formData.storage.type === 'cached-sparql' ? 'selected' : ''}>Cached SPARQL</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="sparql-config" style="${this.formData.storage.type.includes('sparql') ? 'display: block' : 'display: none'}">
                        <label for="storage-query-endpoint">Query Endpoint</label>
                        <input 
                            type="url" 
                            id="storage-query-endpoint" 
                            name="storage.query" 
                            class="form-input"
                            value="${escapeHtml(this.formData.storage.query)}"
                            placeholder="http://localhost:4030/semem/query"
                        >
                    </div>
                    
                    <div class="form-group" id="sparql-update-config" style="${this.formData.storage.type.includes('sparql') ? 'display: block' : 'display: none'}">
                        <label for="storage-update-endpoint">Update Endpoint</label>
                        <input 
                            type="url" 
                            id="storage-update-endpoint" 
                            name="storage.update" 
                            class="form-input"
                            value="${escapeHtml(this.formData.storage.update)}"
                            placeholder="http://localhost:4030/semem/update"
                        >
                    </div>
                    
                    <div class="form-group" id="sparql-auth-user" style="${this.formData.storage.type.includes('sparql') ? 'display: block' : 'display: none'}">
                        <label for="storage-user">Username</label>
                        <input 
                            type="text" 
                            id="storage-user" 
                            name="storage.user" 
                            class="form-input"
                            value="${escapeHtml(this.formData.storage.user)}"
                            placeholder="admin"
                        >
                    </div>
                    
                    <div class="form-group" id="sparql-auth-password" style="${this.formData.storage.type.includes('sparql') ? 'display: block' : 'display: none'}">
                        <label for="storage-password">Password</label>
                        <input 
                            type="password" 
                            id="storage-password" 
                            name="storage.password" 
                            class="form-input"
                            value="${escapeHtml(this.formData.storage.password)}"
                            placeholder="Enter password"
                        >
                    </div>
                </div>
                
                <button class="test-connection-btn" data-type="storage" title="Test storage connection">
                    🔍 Test Storage Connection
                </button>
                
                <div class="storage-info">
                    <h4>Storage Type Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>Memory:</strong> Fast, temporary storage for development
                        </div>
                        <div class="info-item">
                            <strong>JSON:</strong> File-based storage for small deployments
                        </div>
                        <div class="info-item">
                            <strong>SPARQL:</strong> Production RDF database storage
                        </div>
                        <div class="info-item">
                            <strong>Cached SPARQL:</strong> SPARQL with local caching layer
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render SPARQL endpoints section
     * @returns {string} - Endpoints section HTML
     */
    renderEndpointsSection() {
        const endpoints = this.settingsManager.get('sparqlEndpoints') || [];
        
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>🔗 SPARQL Endpoints</h3>
                    <p>Manage SPARQL endpoint configurations</p>
                    <button class="add-endpoint-btn btn btn-primary">
                        <span class="btn-icon">➕</span>
                        Add Endpoint
                    </button>
                </div>
                
                <div class="endpoints-list">
                    ${endpoints.map((endpoint, index) => this.renderEndpointItem(endpoint, index)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render individual endpoint item
     * @param {object} endpoint - Endpoint configuration
     * @param {number} index - Endpoint index
     * @returns {string} - Endpoint HTML
     */
    renderEndpointItem(endpoint, index) {
        return `
            <div class="endpoint-item">
                <div class="endpoint-header">
                    <h4>${escapeHtml(endpoint.label || `Endpoint ${index + 1}`)}</h4>
                    <button class="remove-endpoint-btn" data-index="${index}" title="Remove endpoint">❌</button>
                </div>
                
                <div class="endpoint-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Label</label>
                            <input 
                                type="text" 
                                name="endpoints.${index}.label" 
                                class="form-input"
                                value="${escapeHtml(endpoint.label || '')}"
                                placeholder="Endpoint Label"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label>Base URL</label>
                            <input 
                                type="url" 
                                name="endpoints.${index}.urlBase" 
                                class="form-input"
                                value="${escapeHtml(endpoint.urlBase || '')}"
                                placeholder="http://localhost:4030"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label>Dataset</label>
                            <input 
                                type="text" 
                                name="endpoints.${index}.dataset" 
                                class="form-input"
                                value="${escapeHtml(endpoint.dataset || '')}"
                                placeholder="dataset-name"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label>Username</label>
                            <input 
                                type="text" 
                                name="endpoints.${index}.user" 
                                class="form-input"
                                value="${escapeHtml(endpoint.user || '')}"
                                placeholder="admin"
                            >
                        </div>
                        
                        <div class="form-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                name="endpoints.${index}.password" 
                                class="form-input"
                                value="${escapeHtml(endpoint.password || '')}"
                                placeholder="Enter password"
                            >
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render UI preferences section
     * @returns {string} - UI section HTML
     */
    renderUISection() {
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>🎨 Interface Preferences</h3>
                    <p>Customize workbench appearance and behavior</p>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="ui-theme">Theme</label>
                        <select id="ui-theme" name="ui.theme" class="form-select">
                            <option value="auto" ${this.formData.ui.theme === 'auto' ? 'selected' : ''}>Auto (System)</option>
                            <option value="light" ${this.formData.ui.theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="dark" ${this.formData.ui.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="ui-default-tab">Default Tab</label>
                        <select id="ui-default-tab" name="ui.defaultTab" class="form-select">
                            <option value="tell" ${this.formData.ui.defaultTab === 'tell' ? 'selected' : ''}>Tell</option>
                            <option value="ask" ${this.formData.ui.defaultTab === 'ask' ? 'selected' : ''}>Ask</option>
                            <option value="navigate" ${this.formData.ui.defaultTab === 'navigate' ? 'selected' : ''}>Navigate</option>
                            <option value="sparql" ${this.formData.ui.defaultTab === 'sparql' ? 'selected' : ''}>SPARQL</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="ui-max-history">Max History Items</label>
                        <input 
                            type="number" 
                            id="ui-max-history" 
                            name="ui.maxHistoryItems" 
                            class="form-input"
                            value="${this.formData.ui.maxHistoryItems}"
                            min="10" max="200" step="10"
                        >
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>Display Options</h4>
                    <div class="checkbox-group">
                        <label class="checkbox-item">
                            <input 
                                type="checkbox" 
                                name="ui.autoSave" 
                                ${this.formData.ui.autoSave ? 'checked' : ''}
                            >
                            <span>Auto-save form data</span>
                        </label>
                        
                        <label class="checkbox-item">
                            <input 
                                type="checkbox" 
                                name="ui.showPerformanceMetrics" 
                                ${this.formData.ui.showPerformanceMetrics ? 'checked' : ''}
                            >
                            <span>Show performance metrics</span>
                        </label>
                        
                        <label class="checkbox-item">
                            <input 
                                type="checkbox" 
                                name="ui.showAdvancedOptions" 
                                ${this.formData.ui.showAdvancedOptions ? 'checked' : ''}
                            >
                            <span>Show advanced options</span>
                        </label>
                        
                        <label class="checkbox-item">
                            <input 
                                type="checkbox" 
                                name="ui.autoExpandResults" 
                                ${this.formData.ui.autoExpandResults ? 'checked' : ''}
                            >
                            <span>Auto-expand result sections</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render memory parameters section
     * @returns {string} - Memory section HTML
     */
    renderMemorySection() {
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>🧠 Memory Parameters</h3>
                    <p>Configure semantic memory behavior</p>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="memory-dimension">Vector Dimension</label>
                        <input 
                            type="number" 
                            id="memory-dimension" 
                            name="memory.dimension" 
                            class="form-input"
                            value="${this.formData.memory.dimension}"
                            min="128" max="4096" step="1"
                        >
                        <div class="form-help">Size of embedding vectors (must match model)</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="memory-threshold">Similarity Threshold</label>
                        <input 
                            type="range" 
                            id="memory-threshold" 
                            name="memory.similarityThreshold" 
                            class="form-range"
                            value="${this.formData.memory.similarityThreshold}"
                            min="0.1" max="1.0" step="0.05"
                        >
                        <div class="range-display">
                            <span class="range-value">${this.formData.memory.similarityThreshold}</span>
                            <span class="range-label">Minimum similarity for matches</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="memory-context-window">Context Window</label>
                        <input 
                            type="number" 
                            id="memory-context-window" 
                            name="memory.contextWindow" 
                            class="form-input"
                            value="${this.formData.memory.contextWindow}"
                            min="1" max="20" step="1"
                        >
                        <div class="form-help">Number of context items to retrieve</div>
                    </div>
                    
                    <div class="form-group">
                        <label for="memory-decay-rate">Memory Decay Rate</label>
                        <input 
                            type="range" 
                            id="memory-decay-rate" 
                            name="memory.decayRate" 
                            class="form-range"
                            value="${this.formData.memory.decayRate}"
                            min="0.0001" max="0.01" step="0.0001"
                        >
                        <div class="range-display">
                            <span class="range-value">${this.formData.memory.decayRate}</span>
                            <span class="range-label">Rate of memory importance decay</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render advanced options section
     * @returns {string} - Advanced section HTML
     */
    renderAdvancedSection() {
        return `
            <div class="section-content">
                <div class="section-header">
                    <h3>⚙️ Advanced Configuration</h3>
                    <p>Debug and development options</p>
                </div>
                
                <div class="advanced-section">
                    <h4>Configuration Export/Import</h4>
                    <div class="export-import-tools">
                        <textarea 
                            id="config-json" 
                            class="config-textarea"
                            rows="15" 
                            placeholder="Configuration JSON will appear here..."
                        ></textarea>
                        
                        <div class="config-actions">
                            <button class="btn btn-secondary" onclick="this.previousElementSibling.previousElementSibling.value = JSON.stringify(window.workbench?.stateManager?.settingsManager?.settings || {}, null, 2)">
                                Load Current Config
                            </button>
                            <button class="btn btn-primary" onclick="try { const config = JSON.parse(this.parentElement.previousElementSibling.value); window.workbench?.stateManager?.settingsManager?.import({settings: config}); } catch(e) { alert('Invalid JSON: ' + e.message); }">
                                Apply Config
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="advanced-section">
                    <h4>Reset Options</h4>
                    <div class="reset-options">
                        <button class="btn btn-warning" onclick="if(confirm('Reset all settings to defaults?')) window.workbench?.stateManager?.settingsManager?.reset()">
                            Reset All Settings
                        </button>
                        <button class="btn btn-warning" onclick="if(confirm('Clear all stored data including history?')) { localStorage.clear(); location.reload(); }">
                            Clear All Data
                        </button>
                    </div>
                </div>
                
                <div class="advanced-section">
                    <h4>Debug Information</h4>
                    <div id="debug-info" class="debug-info">
                        <button class="btn btn-outline" onclick="this.nextElementSibling.innerHTML = '<pre>' + JSON.stringify(window.workbench?.getStatus() || {}, null, 2) + '</pre>'">
                            Show Debug Info
                        </button>
                        <div class="debug-output"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Handle section switching
     * @param {string} section - Section to switch to
     */
    handleSectionSwitch(section) {
        if (this.activeSection === section) return;
        
        // Check for unsaved changes
        if (this.unsavedChanges && !confirm('You have unsaved changes. Continue anyway?')) {
            return;
        }
        
        // Update active section
        this.activeSection = section;
        
        // Update UI
        this.updateSectionNavigation();
        this.updateSectionContent();
    }
    
    /**
     * Update section navigation UI
     */
    updateSectionNavigation() {
        const navButtons = document.querySelectorAll('.settings-section-btn');
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === this.activeSection);
        });
    }
    
    /**
     * Update section content
     */
    updateSectionContent() {
        const formElement = getElementById('settings-form');
        if (formElement) {
            formElement.innerHTML = this.renderSection(this.activeSection);
            this.initializeRangeInputs();
        }
    }
    
    /**
     * Handle form input changes
     * @param {Event} event - Change event
     */
    handleFormChange(event) {
        const { name, value, type, checked } = event.target;
        
        // Update form data
        const actualValue = type === 'checkbox' ? checked : 
                           type === 'number' ? parseFloat(value) : value;
        
        this.setFormValue(name, actualValue);
        
        // Mark as having unsaved changes
        this.unsavedChanges = true;
        this.updateUnsavedIndicator();
        
        // Handle dynamic form updates
        this.handleDynamicFormChanges(name, actualValue);
    }
    
    /**
     * Handle range input changes
     * @param {Event} event - Input event
     */
    handleRangeInput(event) {
        const { name, value } = event.target;
        const rangeDisplay = event.target.parentElement.querySelector('.range-value');
        
        if (rangeDisplay) {
            rangeDisplay.textContent = value;
        }
        
        this.setFormValue(name, parseFloat(value));
        this.unsavedChanges = true;
        this.updateUnsavedIndicator();
    }
    
    /**
     * Set form value by dot notation path
     * @param {string} path - Form field path
     * @param {any} value - Field value
     */
    setFormValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.formData);
        
        target[lastKey] = value;
    }
    
    /**
     * Update form field from settings
     * @param {string} path - Settings path
     * @param {any} value - New value
     */
    updateFormField(path, value) {
        const fieldName = path.replace(/\./g, '.');
        const field = document.querySelector(`[name="${fieldName}"]`);
        
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = value;
            } else {
                field.value = value;
            }
        }
    }
    
    /**
     * Handle dynamic form changes (show/hide fields, update options, etc.)
     * @param {string} name - Field name
     * @param {any} value - Field value
     */
    handleDynamicFormChanges(name, value) {
        switch (name) {
            case 'storage.type':
                this.toggleSparqlFields(value.includes('sparql'));
                break;
                
            case 'models.chat.provider':
                this.updateModelOptions('chat', value);
                break;
                
            case 'models.embedding.provider':
                this.updateModelOptions('embedding', value);
                break;
        }
    }
    
    /**
     * Toggle SPARQL configuration fields visibility
     * @param {boolean} show - Whether to show SPARQL fields
     */
    toggleSparqlFields(show) {
        const sparqlFields = document.querySelectorAll('#sparql-config, #sparql-update-config, #sparql-auth-user, #sparql-auth-password');
        sparqlFields.forEach(field => {
            field.style.display = show ? 'block' : 'none';
        });
    }
    
    /**
     * Update model options when provider changes
     * @param {string} type - Model type ('chat' or 'embedding')
     * @param {string} provider - Provider name
     */
    updateModelOptions(type, provider) {
        const modelSelect = getElementById(`${type}-model`);
        if (modelSelect) {
            modelSelect.innerHTML = this.renderModelOptions(type, provider);
        }
    }
    
    /**
     * Initialize range input displays
     */
    initializeRangeInputs() {
        const rangeInputs = document.querySelectorAll('.form-range');
        rangeInputs.forEach(input => {
            const display = input.parentElement.querySelector('.range-value');
            if (display) {
                display.textContent = input.value;
            }
        });
    }
    
    /**
     * Update unsaved changes indicator
     */
    updateUnsavedIndicator() {
        const saveButton = getElementById('settings-save');
        if (saveButton) {
            saveButton.disabled = !this.unsavedChanges;
            saveButton.innerHTML = this.unsavedChanges 
                ? '<span class="btn-icon">💾</span> Save Changes*'
                : '<span class="btn-icon">💾</span> Save Changes';
        }
    }
    
    /**
     * Save current settings
     */
    async saveSettings() {
        if (!this.unsavedChanges) return;
        
        try {
            // Validate form data
            const validation = this.validateFormData();
            if (!validation.valid) {
                showToast('Please fix validation errors before saving', 'error');
                this.showValidationErrors(validation.errors);
                return;
            }
            
            // Apply settings to settings manager
            const success = this.settingsManager.setMultiple(this.flattenFormData(), true);
            
            if (success) {
                this.unsavedChanges = false;
                this.updateUnsavedIndicator();
                showToast('Settings saved successfully', 'success');
            } else {
                showToast('Failed to save some settings', 'error');
            }
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            showToast('Failed to save settings: ' + error.message, 'error');
        }
    }
    
    /**
     * Reset settings to current saved values
     */
    resetSettings() {
        if (!confirm('Reset all changes to last saved values?')) return;
        
        this.loadCurrentSettings();
        this.updateSectionContent();
        this.unsavedChanges = false;
        this.updateUnsavedIndicator();
        
        showToast('Settings reset to saved values', 'info');
    }
    
    /**
     * Export settings to file
     */
    exportSettings() {
        try {
            const settings = this.settingsManager.export();
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = createElement('a', {
                href: url,
                download: `semem-settings-${new Date().toISOString().split('T')[0]}.json`
            });
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Settings exported successfully', 'success');
            
        } catch (error) {
            console.error('Failed to export settings:', error);
            showToast('Failed to export settings', 'error');
        }
    }
    
    /**
     * Import settings from file
     */
    importSettings() {
        const input = createElement('input', { type: 'file', accept: '.json' });
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const success = this.settingsManager.import(data, true);
                    
                    if (success) {
                        this.loadCurrentSettings();
                        this.updateSectionContent();
                        this.unsavedChanges = false;
                        this.updateUnsavedIndicator();
                    }
                    
                } catch (error) {
                    console.error('Failed to import settings:', error);
                    showToast('Invalid settings file format', 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Test connection for a service
     * @param {string} type - Service type ('chat', 'embedding', 'storage')
     */
    async testConnection(type) {
        showToast(`Testing ${type} connection...`, 'info', 2000);
        
        try {
            // This would test the actual connection using current form data
            // For now, simulate the test
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Simulate success/failure
            const success = Math.random() > 0.3; // 70% success rate for demo
            
            if (success) {
                showToast(`${type} connection successful`, 'success');
            } else {
                showToast(`${type} connection failed`, 'error');
            }
            
        } catch (error) {
            showToast(`${type} connection test failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Validate form data
     * @returns {object} - Validation result
     */
    validateFormData() {
        const errors = {};
        
        // Add validation logic here
        // For now, return valid
        
        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
    
    /**
     * Show validation errors in UI
     * @param {object} errors - Validation errors
     */
    showValidationErrors(errors) {
        // Clear previous errors
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        
        // Show new errors
        for (const [field, message] of Object.entries(errors)) {
            const fieldElement = document.querySelector(`[name="${field}"]`);
            if (fieldElement) {
                const errorEl = createElement('div', { className: 'field-error' }, message);
                fieldElement.parentElement.appendChild(errorEl);
            }
        }
    }
    
    /**
     * Flatten form data to dot notation paths
     * @returns {object} - Flattened settings object
     */
    flattenFormData() {
        const flattened = {};
        
        const flatten = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const path = prefix ? `${prefix}.${key}` : key;
                
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, path);
                } else {
                    flattened[path] = value;
                }
            }
        };
        
        flatten(this.formData);
        return flattened;
    }
    
    /**
     * Add new SPARQL endpoint
     */
    addEndpoint() {
        const endpoints = this.settingsManager.get('sparqlEndpoints') || [];
        const newEndpoint = {
            label: `Endpoint ${endpoints.length + 1}`,
            urlBase: 'http://localhost:4030',
            dataset: 'semem',
            query: '/semem/query',
            update: '/semem/update',
            upload: '/semem/upload',
            gspRead: '/semem/data',
            gspWrite: '/semem/data',
            user: 'admin',
            password: ''
        };
        
        endpoints.push(newEndpoint);
        this.settingsManager.set('sparqlEndpoints', endpoints);
        
        // Refresh endpoints section
        if (this.activeSection === 'endpoints') {
            this.updateSectionContent();
        }
        
        showToast('New endpoint added', 'success');
    }
    
    /**
     * Remove SPARQL endpoint
     * @param {number} index - Endpoint index
     */
    removeEndpoint(index) {
        if (!confirm('Remove this endpoint configuration?')) return;
        
        const endpoints = this.settingsManager.get('sparqlEndpoints') || [];
        endpoints.splice(index, 1);
        this.settingsManager.set('sparqlEndpoints', endpoints);
        
        // Refresh endpoints section
        if (this.activeSection === 'endpoints') {
            this.updateSectionContent();
        }
        
        showToast('Endpoint removed', 'info');
    }
    
    /**
     * Get current settings state
     * @returns {object} - Current state
     */
    getState() {
        return {
            activeSection: this.activeSection,
            formData: this.formData,
            unsavedChanges: this.unsavedChanges
        };
    }
    
    /**
     * Set settings state
     * @param {object} state - State to restore
     */
    setState(state) {
        if (state.activeSection) {
            this.activeSection = state.activeSection;
        }
        
        if (state.formData) {
            this.formData = state.formData;
        }
        
        if (state.unsavedChanges !== undefined) {
            this.unsavedChanges = state.unsavedChanges;
        }
        
        if (this.isInitialized) {
            this.updateSectionNavigation();
            this.updateSectionContent();
            this.updateUnsavedIndicator();
        }
    }
}