/**
 * Settings Manager for Semantic Memory Workbench
 * Integrates with Config.js for model and endpoint configuration
 */

import { showToast } from '../utils/domUtils.js';

/**
 * SettingsManager handles configuration management for models, endpoints, and UI preferences
 * Integrates with the backend Config.js system while providing frontend settings persistence
 */
export class SettingsManager {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.apiService = apiService;
        
        // Default settings structure matching Config.js
        this.defaultSettings = {
            models: {
                chat: {
                    provider: 'ollama',
                    model: 'qwen2:1.5b',
                    options: {
                        baseUrl: 'http://localhost:11434'
                    }
                },
                embedding: {
                    provider: 'ollama',
                    model: 'nomic-embed-text',
                    options: {
                        baseUrl: 'http://localhost:11434'
                    }
                }
            },
            storage: {
                type: 'sparql',
                options: {
                    query: 'http://localhost:4030/semem/query',
                    update: 'http://localhost:4030/semem/update',
                    user: 'admin',
                    password: 'admin123'
                }
            },
            sparqlEndpoints: [
                {
                    label: 'Local Fuseki',
                    user: 'admin',
                    password: 'admin123',
                    urlBase: 'http://localhost:4030',
                    dataset: 'semem',
                    query: '/semem/query',
                    update: '/semem/update',
                    upload: '/semem/upload',
                    gspRead: '/semem/data',
                    gspWrite: '/semem/data'
                }
            ],
            ui: {
                theme: 'auto',
                autoSave: true,
                showPerformanceMetrics: true,
                showAdvancedOptions: false,
                defaultTab: 'tell',
                autoExpandResults: true,
                maxHistoryItems: 50
            },
            memory: {
                dimension: 1536,
                similarityThreshold: 0.7,
                contextWindow: 3,
                decayRate: 0.0001
            }
        };
        
        // Current settings
        this.settings = { ...this.defaultSettings };
        
        // Available providers and models (will be populated from backend)
        this.availableProviders = {
            llm: {},
            embedding: {}
        };
        
        // Settings validation rules
        this.validationRules = {
            'models.chat.provider': { type: 'string', required: true, enum: ['ollama', 'mistral', 'claude', 'openai'] },
            'models.chat.model': { type: 'string', required: true, minLength: 1 },
            'models.embedding.provider': { type: 'string', required: true, enum: ['ollama', 'nomic', 'openai'] },
            'models.embedding.model': { type: 'string', required: true, minLength: 1 },
            'storage.type': { type: 'string', required: true, enum: ['memory', 'json', 'sparql', 'cached-sparql'] },
            'ui.theme': { type: 'string', required: true, enum: ['light', 'dark', 'auto'] },
            'memory.dimension': { type: 'number', required: true, min: 128, max: 4096 },
            'memory.similarityThreshold': { type: 'number', required: true, min: 0.1, max: 1.0 }
        };
        
        // Settings persistence key
        this.storageKey = 'semem-workbench-settings';
        
        // Event listeners
        this.listeners = new Map();
        
        // Initialize
        this.initialize();
    }
    
    /**
     * Initialize settings manager
     */
    async initialize() {
        try {
            // Load persisted settings
            this.loadFromStorage();
            
            // Load backend configuration
            await this.loadBackendConfig();
            
            // Validate and merge settings
            this.validateAndMerge();
            
            // Apply initial settings
            this.applySettings();
            
            console.log('SettingsManager initialized');
            this.emit('initialized', this.settings);
            
        } catch (error) {
            console.error('Failed to initialize SettingsManager:', error);
            // Fall back to defaults
            this.settings = { ...this.defaultSettings };
            this.emit('error', { operation: 'initialize', error });
        }
    }
    
    /**
     * Load configuration from backend Config.js
     */
    async loadBackendConfig() {
        try {
            // This would typically call an endpoint that exposes Config.js settings
            // For now, we'll simulate based on the Config.js structure we examined
            
            const backendConfig = {
                models: {
                    chat: {
                        provider: 'mistral',
                        model: 'mistral-small-latest'
                    },
                    embedding: {
                        provider: 'ollama',
                        model: 'nomic-embed-text'
                    }
                },
                storage: {
                    type: 'sparql',
                    options: {
                        query: 'http://localhost:4030/semem/query',
                        update: 'http://localhost:4030/semem/update',
                        user: 'admin',
                        password: 'admin123'
                    }
                },
                sparqlEndpoints: [
                    {
                        label: 'Hyperdata Fuseki',
                        user: 'admin',
                        password: 'admin123',
                        urlBase: 'https://fuseki.hyperdata.it',
                        dataset: 'hyperdata.it',
                        query: '/hyperdata.it/query',
                        update: '/hyperdata.it/update',
                        upload: '/hyperdata.it/upload',
                        gspRead: '/hyperdata.it/data',
                        gspWrite: '/hyperdata.it/data'
                    },
                    {
                        label: 'Local Fuseki',
                        user: 'admin',
                        password: 'admin123',
                        urlBase: 'http://localhost:4030',
                        dataset: 'semem',
                        query: '/semem/query',
                        update: '/semem/update',
                        upload: '/semem/upload',
                        gspRead: '/semem/data',
                        gspWrite: '/semem/data'
                    }
                ]
            };
            
            // Available providers (this would come from Config.js inspection)
            this.availableProviders = {
                llm: {
                    ollama: {
                        name: 'Ollama',
                        models: ['qwen2:1.5b', 'llama2', 'codellama', 'mistral'],
                        supportsStreaming: true,
                        requiresApiKey: false
                    },
                    mistral: {
                        name: 'Mistral AI',
                        models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
                        supportsStreaming: true,
                        requiresApiKey: true
                    },
                    claude: {
                        name: 'Anthropic Claude',
                        models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
                        supportsStreaming: true,
                        requiresApiKey: true
                    }
                },
                embedding: {
                    ollama: {
                        name: 'Ollama Embeddings',
                        models: ['nomic-embed-text', 'all-minilm'],
                        dimensions: { 'nomic-embed-text': 1536, 'all-minilm': 384 },
                        requiresApiKey: false
                    },
                    nomic: {
                        name: 'Nomic AI',
                        models: ['nomic-embed-text-v1.5'],
                        dimensions: { 'nomic-embed-text-v1.5': 1536 },
                        requiresApiKey: true
                    }
                }
            };
            
            // Merge backend config with defaults, giving backend precedence
            this.settings = this.mergeConfigs(this.settings, backendConfig);
            
            console.log('Backend configuration loaded');
            this.emit('backendConfigLoaded', backendConfig);
            
        } catch (error) {
            console.warn('Failed to load backend config, using defaults:', error);
            this.emit('warning', { operation: 'loadBackendConfig', error });
        }
    }
    
    /**
     * Get setting value by dot-notation path
     * @param {string} path - Setting path (e.g., 'models.chat.provider')
     * @returns {any} - Setting value
     */
    get(path) {
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, this.settings);
    }
    
    /**
     * Set setting value by dot-notation path
     * @param {string} path - Setting path
     * @param {any} value - Setting value
     * @param {boolean} validate - Whether to validate the value
     * @returns {boolean} - Success status
     */
    set(path, value, validate = true) {
        try {
            // Validate if requested
            if (validate && !this.validateSetting(path, value)) {
                throw new Error(`Invalid value for setting ${path}`);
            }
            
            // Set the value
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {};
                return obj[key];
            }, this.settings);
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Emit change event
            this.emit('settingChanged', { path, value, oldValue });
            
            // Save to storage
            this.saveToStorage();
            
            // Apply specific setting changes
            this.applySettingChange(path, value);
            
            return true;
            
        } catch (error) {
            console.error('Failed to set setting:', error);
            this.emit('error', { operation: 'set', path, value, error });
            return false;
        }
    }
    
    /**
     * Get multiple settings as an object
     * @param {Array<string>} paths - Array of setting paths
     * @returns {object} - Settings object
     */
    getMultiple(paths) {
        const result = {};
        paths.forEach(path => {
            result[path] = this.get(path);
        });
        return result;
    }
    
    /**
     * Set multiple settings at once
     * @param {object} settings - Settings object with path-value pairs
     * @param {boolean} validate - Whether to validate values
     * @returns {boolean} - Success status
     */
    setMultiple(settings, validate = true) {
        try {
            const changes = [];
            
            // Validate all settings first
            if (validate) {
                for (const [path, value] of Object.entries(settings)) {
                    if (!this.validateSetting(path, value)) {
                        throw new Error(`Invalid value for setting ${path}`);
                    }
                }
            }
            
            // Apply all settings
            for (const [path, value] of Object.entries(settings)) {
                const oldValue = this.get(path);
                
                const keys = path.split('.');
                const lastKey = keys.pop();
                const target = keys.reduce((obj, key) => {
                    if (!obj[key]) obj[key] = {};
                    return obj[key];
                }, this.settings);
                
                target[lastKey] = value;
                changes.push({ path, value, oldValue });
            }
            
            // Emit batch change event
            this.emit('settingsChanged', changes);
            
            // Save to storage
            this.saveToStorage();
            
            // Apply setting changes
            changes.forEach(change => {
                this.applySettingChange(change.path, change.value);
            });
            
            return true;
            
        } catch (error) {
            console.error('Failed to set multiple settings:', error);
            this.emit('error', { operation: 'setMultiple', settings, error });
            return false;
        }
    }
    
    /**
     * Reset settings to defaults
     * @param {string} section - Optional section to reset (e.g., 'models', 'ui')
     */
    reset(section = null) {
        try {
            const oldSettings = { ...this.settings };
            
            if (section) {
                this.settings[section] = { ...this.defaultSettings[section] };
                this.emit('settingsSectionReset', { section, oldValue: oldSettings[section] });
            } else {
                this.settings = { ...this.defaultSettings };
                this.emit('settingsReset', { oldSettings });
            }
            
            this.saveToStorage();
            this.applySettings();
            
            showToast(section ? `${section} settings reset to defaults` : 'All settings reset to defaults', 'info');
            
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.emit('error', { operation: 'reset', section, error });
        }
    }
    
    /**
     * Validate a setting value
     * @param {string} path - Setting path
     * @param {any} value - Value to validate
     * @returns {boolean} - Validation result
     */
    validateSetting(path, value) {
        const rule = this.validationRules[path];
        if (!rule) return true; // No validation rule means it's valid
        
        // Required check
        if (rule.required && (value === undefined || value === null || value === '')) {
            return false;
        }
        
        // Type check
        if (value !== undefined && rule.type && typeof value !== rule.type) {
            return false;
        }
        
        // Enum check
        if (rule.enum && !rule.enum.includes(value)) {
            return false;
        }
        
        // String validations
        if (rule.type === 'string' && typeof value === 'string') {
            if (rule.minLength && value.length < rule.minLength) return false;
            if (rule.maxLength && value.length > rule.maxLength) return false;
        }
        
        // Number validations
        if (rule.type === 'number' && typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) return false;
            if (rule.max !== undefined && value > rule.max) return false;
        }
        
        return true;
    }
    
    /**
     * Validate all current settings
     * @returns {object} - Validation result with errors
     */
    validateAll() {
        const errors = {};
        
        for (const [path, rule] of Object.entries(this.validationRules)) {
            const value = this.get(path);
            if (!this.validateSetting(path, value)) {
                errors[path] = `Invalid value: ${value}`;
            }
        }
        
        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
    
    /**
     * Apply a specific setting change
     * @param {string} path - Setting path
     * @param {any} value - New value
     */
    applySettingChange(path, value) {
        switch (path) {
            case 'ui.theme':
                this.applyTheme(value);
                break;
                
            case 'models.chat.provider':
            case 'models.chat.model':
            case 'models.embedding.provider':
            case 'models.embedding.model':
                this.notifyModelChange();
                break;
                
            case 'storage.type':
            case 'storage.options':
                this.notifyStorageChange();
                break;
                
            case 'ui.showPerformanceMetrics':
                this.togglePerformanceDisplay(value);
                break;
        }
    }
    
    /**
     * Apply all current settings
     */
    applySettings() {
        this.applyTheme(this.get('ui.theme'));
        this.togglePerformanceDisplay(this.get('ui.showPerformanceMetrics'));
        // Add more setting applications as needed
    }
    
    /**
     * Apply theme setting
     * @param {string} theme - Theme name ('light', 'dark', 'auto')
     */
    applyTheme(theme) {
        const root = document.documentElement;
        
        switch (theme) {
            case 'light':
                root.classList.remove('theme-dark');
                root.classList.add('theme-light');
                break;
            case 'dark':
                root.classList.remove('theme-light');
                root.classList.add('theme-dark');
                break;
            case 'auto':
                root.classList.remove('theme-light', 'theme-dark');
                // Let CSS media query handle auto theme
                break;
        }
    }
    
    /**
     * Toggle performance metrics display
     * @param {boolean} show - Whether to show performance metrics
     */
    togglePerformanceDisplay(show) {
        const perfElements = document.querySelectorAll('.performance-metric, .perf-time, .duration-display');
        perfElements.forEach(element => {
            element.style.display = show ? 'inline' : 'none';
        });
    }
    
    /**
     * Notify about model configuration changes
     */
    notifyModelChange() {
        this.emit('modelConfigChanged', {
            chat: this.get('models.chat'),
            embedding: this.get('models.embedding')
        });
    }
    
    /**
     * Notify about storage configuration changes
     */
    notifyStorageChange() {
        this.emit('storageConfigChanged', {
            type: this.get('storage.type'),
            options: this.get('storage.options')
        });
    }
    
    /**
     * Get available providers for a service type
     * @param {string} type - Service type ('llm' or 'embedding')
     * @returns {object} - Available providers
     */
    getAvailableProviders(type) {
        return this.availableProviders[type] || {};
    }
    
    /**
     * Get available models for a provider
     * @param {string} serviceType - Service type ('llm' or 'embedding')
     * @param {string} provider - Provider name
     * @returns {Array} - Available models
     */
    getAvailableModels(serviceType, provider) {
        const providerConfig = this.availableProviders[serviceType]?.[provider];
        return providerConfig?.models || [];
    }
    
    /**
     * Export settings for backup
     * @returns {object} - Exported settings
     */
    export() {
        return {
            settings: JSON.parse(JSON.stringify(this.settings)),
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }
    
    /**
     * Import settings from backup
     * @param {object} data - Imported settings data
     * @param {boolean} merge - Whether to merge or replace settings
     * @returns {boolean} - Import success
     */
    import(data, merge = true) {
        try {
            if (!data.settings) {
                throw new Error('Invalid settings data format');
            }
            
            const importedSettings = data.settings;
            
            if (merge) {
                this.settings = this.mergeConfigs(this.settings, importedSettings);
            } else {
                this.settings = { ...importedSettings };
            }
            
            // Validate imported settings
            const validation = this.validateAll();
            if (!validation.valid) {
                console.warn('Some imported settings are invalid:', validation.errors);
                // Continue anyway, but emit warning
                this.emit('warning', { operation: 'import', errors: validation.errors });
            }
            
            this.saveToStorage();
            this.applySettings();
            
            this.emit('settingsImported', { data, merge });
            showToast('Settings imported successfully', 'success');
            
            return true;
            
        } catch (error) {
            console.error('Failed to import settings:', error);
            this.emit('error', { operation: 'import', error });
            showToast('Failed to import settings: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Deep merge configuration objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} - Merged object
     */
    mergeConfigs(target, source) {
        const result = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                result[key] = this.mergeConfigs(target[key], value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }
    
    /**
     * Validate and merge settings with defaults
     */
    validateAndMerge() {
        // Ensure all default sections exist
        for (const [key, value] of Object.entries(this.defaultSettings)) {
            if (!this.settings[key]) {
                this.settings[key] = { ...value };
            }
        }
        
        // Validate current settings
        const validation = this.validateAll();
        if (!validation.valid) {
            console.warn('Settings validation failed:', validation.errors);
            
            // Fix invalid settings by reverting to defaults
            for (const invalidPath of Object.keys(validation.errors)) {
                const defaultValue = this.get.call({ settings: this.defaultSettings }, invalidPath);
                if (defaultValue !== undefined) {
                    this.set(invalidPath, defaultValue, false);
                }
            }
        }
    }
    
    /**
     * Load settings from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.settings = this.mergeConfigs(this.defaultSettings, data);
                console.log('Settings loaded from storage');
            }
        } catch (error) {
            console.warn('Failed to load settings from storage:', error);
            this.settings = { ...this.defaultSettings };
        }
    }
    
    /**
     * Save settings to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings to storage:', error);
        }
    }
    
    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * Emit event to listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in settings event listener for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Get settings summary for debugging
     * @returns {object} - Settings summary
     */
    getSummary() {
        return {
            models: {
                chat: `${this.get('models.chat.provider')}:${this.get('models.chat.model')}`,
                embedding: `${this.get('models.embedding.provider')}:${this.get('models.embedding.model')}`
            },
            storage: {
                type: this.get('storage.type'),
                endpoint: this.get('storage.options.query')
            },
            sparqlEndpoints: this.get('sparqlEndpoints').length,
            ui: {
                theme: this.get('ui.theme'),
                showPerformanceMetrics: this.get('ui.showPerformanceMetrics')
            },
            validation: this.validateAll()
        };
    }
}