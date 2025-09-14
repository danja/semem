/**
 * ZPT Controls Component
 * Handles Zoom/Pan/Tilt navigation controls
 */

import VSOMUtils from '../utils/VSOMUtils.js';

export default class ZPTControls {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            onZPTChange: null,
            initialState: {
                zoom: 'entity',
                pan: { domains: '', keywords: '' },
                tilt: 'keywords',
                threshold: 0.3
            },
            ...options
        };
        
        this.state = { ...this.options.initialState };
        this.initialized = false;
        
        // Bind methods
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handlePanChange = this.handlePanChange.bind(this);
        this.handleTiltChange = this.handleTiltChange.bind(this);
        this.handleThresholdChange = this.handleThresholdChange.bind(this);
        // Create debounced input handler
        this._handleInputChangeBase = this._handleInputChangeBase.bind(this);
        this.handleInputChange = VSOMUtils.debounce(this._handleInputChangeBase, 500);
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('Initializing ZPT Controls...');
        
        try {
            this.setupEventListeners();
            this.updateDisplay();
            
            this.initialized = true;
            console.log('ZPT Controls initialized');
        } catch (error) {
            console.error('Failed to initialize ZPT Controls:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Zoom controls
        const zoomButtons = this.container.querySelectorAll('.zoom-button');
        zoomButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const level = event.target.dataset.level;
                if (level) {
                    this.handleZoomChange(level);
                }
            });
        });
        
        // Tilt controls
        const tiltButtons = this.container.querySelectorAll('.tilt-button');
        tiltButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const style = event.target.dataset.style;
                if (style) {
                    this.handleTiltChange(style);
                }
            });
        });
        
        // Pan inputs
        const domainsInput = document.getElementById('pan-domains');
        const keywordsInput = document.getElementById('pan-keywords');
        
        if (domainsInput) {
            domainsInput.addEventListener('input', this.handleInputChange);
            domainsInput.addEventListener('change', this.handleInputChange);
        }
        
        if (keywordsInput) {
            keywordsInput.addEventListener('input', this.handleInputChange);
            keywordsInput.addEventListener('change', this.handleInputChange);
        }
        
        // Threshold slider
        const thresholdSlider = document.getElementById('similarity-threshold');
        if (thresholdSlider) {
            thresholdSlider.addEventListener('input', (event) => {
                this.handleThresholdChange(parseFloat(event.target.value));
            });
        }
    }
    
    handleZoomChange(level) {
        if (this.state.zoom === level) return;
        
        console.log('Zoom changed to:', level);
        
        // Update state
        this.state.zoom = level;
        
        // Update UI
        this.updateZoomDisplay();
        this.updateStateDisplay();
        
        // Notify parent
        this.notifyChange({ zoom: level });
    }
    
    handlePanChange(panData) {
        const newPan = { domains: '', keywords: '', ...panData };
        
        // Check if pan state actually changed
        if (this.state.pan.domains === newPan.domains && this.state.pan.keywords === newPan.keywords) {
            return;
        }
        
        console.log('Pan changed to:', newPan);
        
        // Update state
        this.state.pan = newPan;
        
        // Update UI
        this.updatePanDisplay();
        this.updateStateDisplay();
        
        // Notify parent
        this.notifyChange({ pan: newPan });
    }
    
    handleTiltChange(style) {
        if (this.state.tilt === style) return;
        
        console.log('Tilt changed to:', style);
        
        // Update state
        this.state.tilt = style;
        
        // Update UI
        this.updateTiltDisplay();
        this.updateStateDisplay();
        
        // Notify parent
        this.notifyChange({ tilt: style });
    }
    
    _handleInputChangeBase() {
        const domainsInput = document.getElementById('pan-domains');
        const keywordsInput = document.getElementById('pan-keywords');
        
        const domains = domainsInput?.value.trim() || '';
        const keywords = keywordsInput?.value.trim() || '';
        
        const newPan = { domains, keywords };
        
        // Check if pan state actually changed
        if (this.state.pan.domains === domains && this.state.pan.keywords === keywords) {
            return;
        }
        
        console.log('Pan changed to:', newPan);
        
        // Update state
        this.state.pan = newPan;
        
        // Update UI
        this.updateStateDisplay();
        
        // Notify parent
        this.notifyChange({ pan: newPan });
    }
    
    handleThresholdChange(threshold) {
        if (Math.abs(this.state.threshold - threshold) < 0.01) return;
        
        console.log('Threshold changed to:', threshold);
        
        // Update state
        this.state.threshold = threshold;
        
        // Update UI
        this.updateThresholdDisplay();
        this.updateStateDisplay();
        
        // Notify parent
        this.notifyChange({ threshold });
    }
    
    updateDisplay() {
        this.updateZoomDisplay();
        this.updateTiltDisplay();
        this.updatePanDisplay();
        this.updateThresholdDisplay();
        this.updateStateDisplay();
    }
    
    updateZoomDisplay() {
        const zoomButtons = this.container.querySelectorAll('.zoom-button');
        zoomButtons.forEach(button => {
            const level = button.dataset.level;
            if (level === this.state.zoom) {
                VSOMUtils.addClass(button, 'active');
            } else {
                VSOMUtils.removeClass(button, 'active');
            }
        });
    }
    
    updateTiltDisplay() {
        const tiltButtons = this.container.querySelectorAll('.tilt-button');
        tiltButtons.forEach(button => {
            const style = button.dataset.style;
            if (style === this.state.tilt) {
                VSOMUtils.addClass(button, 'active');
            } else {
                VSOMUtils.removeClass(button, 'active');
            }
        });
    }
    
    updatePanDisplay() {
        const domainsInput = document.getElementById('pan-domains');
        const keywordsInput = document.getElementById('pan-keywords');
        
        if (domainsInput) {
            domainsInput.value = this.state.pan.domains || '';
        }
        
        if (keywordsInput) {
            keywordsInput.value = this.state.pan.keywords || '';
        }
    }
    
    updateThresholdDisplay() {
        const thresholdSlider = document.getElementById('similarity-threshold');
        const thresholdValue = document.getElementById('threshold-value');
        
        if (thresholdSlider) {
            thresholdSlider.value = this.state.threshold;
        }
        
        if (thresholdValue) {
            thresholdValue.textContent = this.state.threshold.toFixed(2);
        }
    }
    
    updateStateDisplay() {
        // Update the ZPT state display at the top
        const currentZoom = document.getElementById('current-zoom');
        const currentPan = document.getElementById('current-pan');
        const currentTilt = document.getElementById('current-tilt');
        
        if (currentZoom) {
            currentZoom.textContent = this.state.zoom;
        }
        
        if (currentPan) {
            const panText = this.getPanDisplayText();
            currentPan.textContent = panText;
        }
        
        if (currentTilt) {
            currentTilt.textContent = this.state.tilt;
        }
    }
    
    getPanDisplayText() {
        const { domains, keywords } = this.state.pan;
        
        if (!domains && !keywords) {
            return 'all';
        }
        
        const filters = [];
        if (domains) filters.push('domains');
        if (keywords) filters.push('keywords');
        
        return filters.join('+');
    }
    
    async updateState(newState) {
        let changed = false;
        
        // Update zoom
        if (newState.zoom !== undefined && newState.zoom !== this.state.zoom) {
            this.state.zoom = newState.zoom;
            changed = true;
        }
        
        // Update pan
        if (newState.pan !== undefined) {
            const newPan = { ...this.state.pan, ...newState.pan };
            if (newPan.domains !== this.state.pan.domains || newPan.keywords !== this.state.pan.keywords) {
                this.state.pan = newPan;
                changed = true;
            }
        }
        
        // Update tilt
        if (newState.tilt !== undefined && newState.tilt !== this.state.tilt) {
            this.state.tilt = newState.tilt;
            changed = true;
        }
        
        // Update threshold
        if (newState.threshold !== undefined && Math.abs(newState.threshold - this.state.threshold) >= 0.01) {
            this.state.threshold = newState.threshold;
            changed = true;
        }
        
        if (changed) {
            this.updateDisplay();
        }
    }
    
    notifyChange(changes) {
        if (this.options.onZPTChange) {
            this.options.onZPTChange(changes);
        }
    }
    
    getState() {
        return VSOMUtils.deepClone(this.state);
    }
    
    resetToDefaults() {
        console.log('Resetting ZPT controls to defaults');
        
        this.state = { ...this.options.initialState };
        this.updateDisplay();
        
        // Notify of complete reset
        this.notifyChange(this.state);
        
        VSOMUtils.showToast('ZPT settings reset to defaults', 'info');
    }
    
    applyPreset(preset) {
        console.log('Applying ZPT preset:', preset);
        
        const presets = {
            overview: {
                zoom: 'corpus',
                pan: { domains: '', keywords: '' },
                tilt: 'temporal',
                threshold: 0.1
            },
            detailed: {
                zoom: 'entity',
                pan: { domains: '', keywords: '' },
                tilt: 'keywords',
                threshold: 0.7
            },
            semantic: {
                zoom: 'unit',
                pan: { domains: '', keywords: '' },
                tilt: 'embedding',
                threshold: 0.5
            },
            temporal: {
                zoom: 'text',
                pan: { domains: '', keywords: '' },
                tilt: 'temporal',
                threshold: 0.3
            }
        };
        
        const presetConfig = presets[preset];
        if (presetConfig) {
            this.state = { ...presetConfig };
            this.updateDisplay();
            this.notifyChange(this.state);
            
            VSOMUtils.showToast(`Applied ${preset} preset`, 'success');
        }
    }
    
    saveAsPreset(name) {
        const preset = {
            name,
            config: VSOMUtils.deepClone(this.state),
            createdAt: new Date().toISOString()
        };
        
        // Save to localStorage
        const presets = JSON.parse(localStorage.getItem('vsom-presets') || '[]');
        const existingIndex = presets.findIndex(p => p.name === name);
        
        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }
        
        localStorage.setItem('vsom-presets', JSON.stringify(presets));
        
        VSOMUtils.showToast(`Preset "${name}" saved`, 'success');
    }
    
    loadPreset(name) {
        const presets = JSON.parse(localStorage.getItem('vsom-presets') || '[]');
        const preset = presets.find(p => p.name === name);
        
        if (preset) {
            this.state = { ...preset.config };
            this.updateDisplay();
            this.notifyChange(this.state);
            
            VSOMUtils.showToast(`Loaded preset "${name}"`, 'success');
        } else {
            VSOMUtils.showToast(`Preset "${name}" not found`, 'error');
        }
    }
    
    getSavedPresets() {
        return JSON.parse(localStorage.getItem('vsom-presets') || '[]');
    }
    
    deletePreset(name) {
        const presets = JSON.parse(localStorage.getItem('vsom-presets') || '[]');
        const filteredPresets = presets.filter(p => p.name !== name);
        
        localStorage.setItem('vsom-presets', JSON.stringify(filteredPresets));
        
        VSOMUtils.showToast(`Preset "${name}" deleted`, 'info');
    }
    
    exportSettings() {
        const settings = {
            zptState: this.state,
            presets: this.getSavedPresets(),
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(settings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `vsom-settings-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        VSOMUtils.showToast('Settings exported successfully', 'success');
    }
    
    importSettings(file) {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const settings = JSON.parse(event.target.result);
                
                if (settings.zptState) {
                    this.state = { ...this.options.initialState, ...settings.zptState };
                    this.updateDisplay();
                    this.notifyChange(this.state);
                }
                
                if (settings.presets && Array.isArray(settings.presets)) {
                    localStorage.setItem('vsom-presets', JSON.stringify(settings.presets));
                }
                
                VSOMUtils.showToast('Settings imported successfully', 'success');
            } catch (error) {
                console.error('Failed to import settings:', error);
                VSOMUtils.showToast('Failed to import settings: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    getZoomLevelDescription(level) {
        const descriptions = {
            entity: 'Individual interactions as separate entities',
            unit: 'Semantic units grouping related interactions',
            text: 'Document or conversation-level groupings',
            community: 'Concept communities and topic clusters',
            corpus: 'Corpus-wide overview and statistics'
        };
        
        return descriptions[level] || 'Unknown zoom level';
    }
    
    getTiltStyleDescription(style) {
        const descriptions = {
            keywords: 'Focus on concept keywords and topics',
            embedding: 'Use vector embeddings for similarity',
            graph: 'Show relationship networks and connections',
            temporal: 'Arrange by time and sequence'
        };
        
        return descriptions[style] || 'Unknown tilt style';
    }
    
    cleanup() {
        this.state = { ...this.options.initialState };
        console.log('ZPT Controls cleaned up');
    }
}