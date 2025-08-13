/**
 * Semantic Memory Workbench - Main JavaScript Module
 * Handles 7 Simple Verbs operations, session management, and UI interactions
 */

// Configuration
const CONFIG = {
    API_BASE: '/api',
    WEBSOCKET_URL: 'ws://localhost:3000/ws',
    SESSION_STORAGE_KEY: 'semem-workbench-session',
    AUTO_SAVE_INTERVAL: 30000, // 30 seconds
    CONCEPT_EXTRACTION_DEBOUNCE: 500, // ms
    PERFORMANCE_UPDATE_INTERVAL: 5000, // 5 seconds
};

// Global state management
class WorkbenchState {
    constructor() {
        this.session = {
            id: this.generateSessionId(),
            startTime: Date.now(),
            zpt: {
                zoom: 'entity',
                pan: { domains: [], keywords: [], temporal: {}, entities: [] },
                tilt: 'keywords'
            },
            cache: {
                interactions: 0,
                embeddings: 0,
                concepts: 0,
                lastUpdate: Date.now()
            },
            performance: {
                lastOperationTime: null,
                cacheHitRate: 0,
                operationHistory: []
            }
        };
        this.isConnected = false;
        this.websocket = null;
        this.timers = new Map();
        
        this.loadFromStorage();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    updateCache(data) {
        if (data.sessionCacheStats) {
            this.session.cache = {
                ...this.session.cache,
                ...data.sessionCacheStats
            };
            this.saveToStorage();
            this.notifyListeners('cache', this.session.cache);
        }
    }

    updateZPT(zptData) {
        this.session.zpt = { ...this.session.zpt, ...zptData };
        this.saveToStorage();
        this.notifyListeners('zpt', this.session.zpt);
    }

    addPerformanceData(operation, duration, data) {
        const perfData = {
            operation,
            duration,
            timestamp: Date.now(),
            success: !data.error,
            cacheHit: data.sessionResults > 0
        };
        
        this.session.performance.lastOperationTime = duration;
        this.session.performance.operationHistory.unshift(perfData);
        
        // Keep only last 50 operations
        if (this.session.performance.operationHistory.length > 50) {
            this.session.performance.operationHistory = this.session.performance.operationHistory.slice(0, 50);
        }
        
        // Calculate cache hit rate
        const recentOps = this.session.performance.operationHistory.slice(0, 10);
        const cacheHits = recentOps.filter(op => op.cacheHit).length;
        this.session.performance.cacheHitRate = recentOps.length > 0 ? 
            Math.round((cacheHits / recentOps.length) * 100) : 0;
        
        this.saveToStorage();
        this.notifyListeners('performance', this.session.performance);
    }

    saveToStorage() {
        try {
            localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, JSON.stringify(this.session));
        } catch (error) {
            console.warn('Failed to save session to storage:', error);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
            if (stored) {
                const parsedSession = JSON.parse(stored);
                this.session = { ...this.session, ...parsedSession };
            }
        } catch (error) {
            console.warn('Failed to load session from storage:', error);
        }
    }

    // Simple event system
    listeners = new Map();

    addListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
}

// API service for 7 Simple Verbs operations
class APIService {
    constructor() {
        this.baseURL = window.location.origin;
    }

    async request(endpoint, options = {}) {
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const duration = Date.now() - startTime;
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            // Add performance tracking
            data._performance = { duration, timestamp: Date.now() };
            
            return data;
        } catch (error) {
            const duration = Date.now() - startTime;
            error._performance = { duration, timestamp: Date.now() };
            throw error;
        }
    }

    // Tell operation - store content in semantic memory
    async tell(content, type = 'concept', metadata = {}) {
        return this.request('/tell', {
            method: 'POST',
            body: JSON.stringify({ content, type, metadata })
        });
    }

    // Ask operation - query semantic memory
    async ask(question, options = {}) {
        return this.request('/ask', {
            method: 'POST',
            body: JSON.stringify({ question, ...options })
        });
    }

    // Augment operation - extract concepts from text
    async augment(target, operation = 'extract_concepts') {
        return this.request('/augment', {
            method: 'POST',
            body: JSON.stringify({ target, operation })
        });
    }

    // Zoom operation - set abstraction level
    async zoom(level) {
        return this.request('/zoom', {
            method: 'POST',
            body: JSON.stringify({ level })
        });
    }

    // Pan operation - set domain filters
    async pan(domains = [], keywords = [], temporal = {}, entities = []) {
        return this.request('/pan', {
            method: 'POST',
            body: JSON.stringify({ domains, keywords, temporal, entities })
        });
    }

    // Tilt operation - set view style
    async tilt(style) {
        return this.request('/tilt', {
            method: 'POST',
            body: JSON.stringify({ style })
        });
    }

    // Get current ZPT state
    async getState() {
        return this.request('/state', { method: 'GET' });
    }

    // Inspect operation - debug session cache
    async inspect(what = 'session', details = false) {
        // Note: This uses MCP interface since REST endpoint not available
        // In a real implementation, we'd add the /inspect endpoint
        return { 
            success: true, 
            what, 
            message: 'Inspect functionality available via MCP interface',
            sessionCache: workbenchState.session.cache
        };
    }
}

// UI Controllers
class SessionDashboard {
    constructor(state, apiService) {
        this.state = state;
        this.apiService = apiService;
        this.elements = this.initElements();
        this.initEventListeners();
        this.startPeriodicUpdates();
    }

    initElements() {
        return {
            sessionId: document.getElementById('session-id-display'),
            sessionDuration: document.getElementById('session-duration'),
            zoomDisplay: document.getElementById('zoom-display'),
            panDisplay: document.getElementById('pan-display'),
            tiltDisplay: document.getElementById('tilt-display'),
            cacheInteractions: document.getElementById('cache-interactions'),
            cacheConcepts: document.getElementById('cache-concepts'),
            lastOperationTime: document.getElementById('last-operation-time'),
            cacheHitRate: document.getElementById('cache-hit-rate'),
            exportBtn: document.getElementById('session-export'),
            clearBtn: document.getElementById('session-clear'),
            settingsBtn: document.getElementById('session-settings')
        };
    }

    initEventListeners() {
        this.state.addListener('cache', (cache) => this.updateCacheDisplay(cache));
        this.state.addListener('zpt', (zpt) => this.updateZPTDisplay(zpt));
        this.state.addListener('performance', (perf) => this.updatePerformanceDisplay(perf));

        this.elements.exportBtn?.addEventListener('click', () => this.exportSession());
        this.elements.clearBtn?.addEventListener('click', () => this.clearSession());
        this.elements.settingsBtn?.addEventListener('click', () => this.showSettings());
    }

    startPeriodicUpdates() {
        setInterval(() => {
            this.updateDuration();
        }, 1000);

        // Initial display update
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.elements.sessionId) {
            this.elements.sessionId.textContent = this.state.session.id.split('_').pop();
        }
        this.updateDuration();
        this.updateZPTDisplay(this.state.session.zpt);
        this.updateCacheDisplay(this.state.session.cache);
        this.updatePerformanceDisplay(this.state.session.performance);
    }

    updateDuration() {
        if (this.elements.sessionDuration) {
            const duration = Math.floor((Date.now() - this.state.session.startTime) / 60000);
            this.elements.sessionDuration.textContent = `(${duration}m)`;
        }
    }

    updateZPTDisplay(zpt) {
        if (this.elements.zoomDisplay) {
            this.elements.zoomDisplay.textContent = zpt.zoom;
        }
        if (this.elements.panDisplay) {
            const panItems = [
                ...zpt.pan.domains,
                ...zpt.pan.keywords
            ].slice(0, 2);
            this.elements.panDisplay.textContent = panItems.length > 0 ? panItems.join('+') : 'all';
        }
        if (this.elements.tiltDisplay) {
            this.elements.tiltDisplay.textContent = zpt.tilt;
        }
    }

    updateCacheDisplay(cache) {
        if (this.elements.cacheInteractions) {
            this.elements.cacheInteractions.textContent = cache.interactions || 0;
        }
        if (this.elements.cacheConcepts) {
            this.elements.cacheConcepts.textContent = cache.concepts || 0;
        }
    }

    updatePerformanceDisplay(performance) {
        if (this.elements.lastOperationTime) {
            this.elements.lastOperationTime.textContent = 
                performance.lastOperationTime ? `${performance.lastOperationTime}ms` : '-';
        }
        if (this.elements.cacheHitRate) {
            this.elements.cacheHitRate.textContent = 
                performance.cacheHitRate ? `${performance.cacheHitRate}%` : '-';
        }
    }

    exportSession() {
        const sessionData = {
            ...this.state.session,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `semem-session-${this.state.session.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Session exported successfully', 'success');
    }

    clearSession() {
        if (confirm('Clear current session? This will reset all session data.')) {
            this.state.session = {
                ...this.state.session,
                cache: { interactions: 0, embeddings: 0, concepts: 0, lastUpdate: Date.now() },
                performance: { lastOperationTime: null, cacheHitRate: 0, operationHistory: [] }
            };
            this.state.saveToStorage();
            this.updateDisplay();
            showToast('Session cleared', 'success');
        }
    }

    showSettings() {
        // Switch to settings tab
        switchTab('settings');
    }
}

class TellController {
    constructor(state, apiService) {
        this.state = state;
        this.apiService = apiService;
        this.elements = this.initElements();
        this.initEventListeners();
        this.conceptExtractionTimeout = null;
    }

    initElements() {
        return {
            contentInput: document.getElementById('tell-content'),
            typeSelect: document.getElementById('tell-type'),
            tagsInput: document.getElementById('tell-tags'),
            conceptPreview: document.getElementById('concept-preview'),
            conceptList: document.getElementById('concept-list'),
            conceptCount: document.getElementById('concept-count'),
            submitBtn: document.getElementById('tell-submit'),
            timing: document.getElementById('tell-timing')
        };
    }

    initEventListeners() {
        this.elements.contentInput?.addEventListener('input', (e) => {
            this.debouncedConceptExtraction(e.target.value);
        });

        this.elements.submitBtn?.addEventListener('click', () => {
            this.handleSubmit();
        });

        // Enter with Ctrl/Cmd to submit
        this.elements.contentInput?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    }

    debouncedConceptExtraction(text) {
        clearTimeout(this.conceptExtractionTimeout);
        
        if (!text.trim()) {
            this.clearConceptPreview();
            return;
        }

        this.conceptExtractionTimeout = setTimeout(() => {
            this.extractConcepts(text);
        }, CONFIG.CONCEPT_EXTRACTION_DEBOUNCE);
    }

    async extractConcepts(text) {
        try {
            const result = await this.apiService.augment(text, 'extract_concepts');
            
            if (result.success && result.result?.concepts) {
                this.displayConcepts(result.result.concepts);
            }
        } catch (error) {
            console.warn('Concept extraction failed:', error);
        }
    }

    displayConcepts(concepts) {
        if (this.elements.conceptList && this.elements.conceptCount) {
            this.elements.conceptCount.textContent = `${concepts.length} concepts`;
            
            this.elements.conceptList.innerHTML = concepts.map(concept => 
                `<span class="concept-tag">${escapeHtml(concept)}</span>`
            ).join('');
        }
    }

    clearConceptPreview() {
        if (this.elements.conceptList && this.elements.conceptCount) {
            this.elements.conceptCount.textContent = '0 concepts';
            this.elements.conceptList.innerHTML = 
                '<div class="preview-placeholder">Start typing to see extracted concepts...</div>';
        }
    }

    async handleSubmit() {
        const content = this.elements.contentInput?.value?.trim();
        const type = this.elements.typeSelect?.value || 'concept';
        const tags = this.elements.tagsInput?.value?.trim();

        if (!content) {
            showToast('Please enter content to store', 'error');
            return;
        }

        const metadata = tags ? { tags: tags.split(',').map(t => t.trim()) } : {};

        this.setLoading(true);
        const startTime = Date.now();

        try {
            const result = await this.apiService.tell(content, type, metadata);
            const duration = Date.now() - startTime;

            if (result.success) {
                this.state.updateCache(result);
                this.state.addPerformanceData('tell', duration, result);
                
                showToast('Content stored successfully', 'success');
                this.clearForm();
                
                // Update timing display
                if (this.elements.timing) {
                    this.elements.timing.textContent = `${duration}ms`;
                    setTimeout(() => {
                        this.elements.timing.textContent = '';
                    }, 3000);
                }
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.state.addPerformanceData('tell', duration, { error: true });
            
            showToast(`Error storing content: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
            if (loading) {
                this.elements.submitBtn.innerHTML = 
                    '<span class="btn-icon">⏳</span><span class="btn-text">Storing...</span>';
            } else {
                this.elements.submitBtn.innerHTML = 
                    '<span class="btn-icon">💾</span><span class="btn-text">Store in Memory</span>';
            }
        }
    }

    clearForm() {
        if (this.elements.contentInput) this.elements.contentInput.value = '';
        if (this.elements.tagsInput) this.elements.tagsInput.value = '';
        this.clearConceptPreview();
    }
}

class AskController {
    constructor(state, apiService) {
        this.state = state;
        this.apiService = apiService;
        this.elements = this.initElements();
        this.initEventListeners();
    }

    initElements() {
        return {
            queryInput: document.getElementById('ask-query'),
            suggestions: document.getElementById('query-suggestions'),
            submitBtn: document.getElementById('ask-submit'),
            results: document.getElementById('ask-results'),
            timing: document.getElementById('ask-timing')
        };
    }

    initEventListeners() {
        this.elements.queryInput?.addEventListener('input', (e) => {
            this.showSuggestions(e.target.value);
        });

        this.elements.queryInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });

        this.elements.submitBtn?.addEventListener('click', () => {
            this.handleSubmit();
        });
    }

    showSuggestions(query) {
        // Generate smart suggestions based on session concepts and recent queries
        // This is a simplified version - in production, this would be more sophisticated
        if (!query.trim() || query.length < 2) {
            this.elements.suggestions.style.display = 'none';
            return;
        }

        const suggestions = this.generateSuggestions(query);
        if (suggestions.length > 0) {
            this.elements.suggestions.innerHTML = suggestions.map(suggestion => 
                `<div class="suggestion-item" data-suggestion="${escapeHtml(suggestion)}">${escapeHtml(suggestion)}</div>`
            ).join('');
            
            this.elements.suggestions.style.display = 'block';
            
            // Add click handlers
            this.elements.suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.elements.queryInput.value = item.dataset.suggestion;
                    this.elements.suggestions.style.display = 'none';
                });
            });
        } else {
            this.elements.suggestions.style.display = 'none';
        }
    }

    generateSuggestions(query) {
        const suggestions = [];
        const lowerQuery = query.toLowerCase();

        // Add concept-based suggestions
        const recentConcepts = ['neural networks', 'machine learning', 'pattern recognition', 
                               'JavaScript functions', 'semantic memory', 'knowledge graphs'];
        
        recentConcepts.forEach(concept => {
            if (concept.toLowerCase().includes(lowerQuery)) {
                suggestions.push(`What is ${concept}?`);
                suggestions.push(`How does ${concept} work?`);
                suggestions.push(`Tell me about ${concept}`);
            }
        });

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    async handleSubmit() {
        const question = this.elements.queryInput?.value?.trim();

        if (!question) {
            showToast('Please enter a question', 'error');
            return;
        }

        this.setLoading(true);
        const startTime = Date.now();

        try {
            const result = await this.apiService.ask(question);
            const duration = Date.now() - startTime;

            if (result.success) {
                this.state.updateCache(result);
                this.state.addPerformanceData('ask', duration, result);
                
                this.displayResults(result);
                
                // Update timing display
                if (this.elements.timing) {
                    this.elements.timing.textContent = `${duration}ms`;
                    setTimeout(() => {
                        this.elements.timing.textContent = '';
                    }, 3000);
                }
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.state.addPerformanceData('ask', duration, { error: true });
            
            showToast(`Error searching memory: ${error.message}`, 'error');
            this.displayError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    displayResults(result) {
        if (!this.elements.results) return;

        const { answer, contextItems, sessionResults, persistentResults, searchMethod } = result;

        const html = `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-source">
                        ${searchMethod || 'hybrid_search'} • 
                        ${sessionResults || 0} session + ${persistentResults || 0} persistent
                    </div>
                    <div class="result-relevance">
                        ${contextItems || 0} relevant items
                    </div>
                </div>
                <div class="result-content">
                    ${escapeHtml(answer || 'No answer provided')}
                </div>
            </div>
        `;

        this.elements.results.innerHTML = html;
    }

    displayError(message) {
        if (!this.elements.results) return;

        this.elements.results.innerHTML = `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-source error">Error</div>
                </div>
                <div class="result-content">
                    ${escapeHtml(message)}
                </div>
            </div>
        `;
    }

    setLoading(loading) {
        if (this.elements.submitBtn) {
            this.elements.submitBtn.disabled = loading;
            if (loading) {
                this.elements.submitBtn.innerHTML = 
                    '<span class="btn-icon">🔄</span><span class="btn-text">Searching...</span>';
            } else {
                this.elements.submitBtn.innerHTML = 
                    '<span class="btn-icon">🔍</span><span class="btn-text">Search Memory</span>';
            }
        }
    }
}

class NavigateController {
    constructor(state, apiService) {
        this.state = state;
        this.apiService = apiService;
        this.elements = this.initElements();
        this.initEventListeners();
        this.loadCurrentState();
    }

    initElements() {
        return {
            zoomBtns: document.querySelectorAll('.zoom-btn'),
            tiltBtns: document.querySelectorAll('.tilt-btn'),
            domainsInput: document.getElementById('pan-domains'),
            keywordsInput: document.getElementById('pan-keywords'),
            activeFilters: document.getElementById('active-filters')
        };
    }

    initEventListeners() {
        // Zoom controls
        this.elements.zoomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.zoom;
                this.handleZoomChange(level);
            });
        });

        // Tilt controls
        this.elements.tiltBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.dataset.tilt;
                this.handleTiltChange(style);
            });
        });

        // Pan controls
        this.elements.domainsInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addDomainFilter(e.target.value.trim());
                e.target.value = '';
            }
        });

        this.elements.keywordsInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addKeywordFilter(e.target.value.trim());
                e.target.value = '';
            }
        });
    }

    async loadCurrentState() {
        try {
            const state = await this.apiService.getState();
            if (state.success) {
                this.updateUIFromState(state.state);
                this.state.updateZPT(state.state);
            }
        } catch (error) {
            console.warn('Failed to load current state:', error);
        }
    }

    async handleZoomChange(level) {
        try {
            const result = await this.apiService.zoom(level);
            if (result.success) {
                this.updateZoomUI(level);
                this.state.updateZPT({ zoom: level });
                showToast(`Zoom level set to ${level}`, 'success');
            }
        } catch (error) {
            showToast(`Error setting zoom: ${error.message}`, 'error');
        }
    }

    async handleTiltChange(style) {
        try {
            const result = await this.apiService.tilt(style);
            if (result.success) {
                this.updateTiltUI(style);
                this.state.updateZPT({ tilt: style });
                showToast(`View style set to ${style}`, 'success');
            }
        } catch (error) {
            showToast(`Error setting tilt: ${error.message}`, 'error');
        }
    }

    async addDomainFilter(domain) {
        if (!domain) return;

        const currentPan = this.state.session.zpt.pan;
        const domains = [...currentPan.domains, domain];
        
        try {
            const result = await this.apiService.pan(
                domains, 
                currentPan.keywords, 
                currentPan.temporal, 
                currentPan.entities
            );
            
            if (result.success) {
                const newPan = { ...currentPan, domains };
                this.state.updateZPT({ pan: newPan });
                this.updateActiveFilters();
                showToast(`Added domain filter: ${domain}`, 'success');
            }
        } catch (error) {
            showToast(`Error adding domain filter: ${error.message}`, 'error');
        }
    }

    async addKeywordFilter(keyword) {
        if (!keyword) return;

        const currentPan = this.state.session.zpt.pan;
        const keywords = [...currentPan.keywords, keyword];
        
        try {
            const result = await this.apiService.pan(
                currentPan.domains, 
                keywords, 
                currentPan.temporal, 
                currentPan.entities
            );
            
            if (result.success) {
                const newPan = { ...currentPan, keywords };
                this.state.updateZPT({ pan: newPan });
                this.updateActiveFilters();
                showToast(`Added keyword filter: ${keyword}`, 'success');
            }
        } catch (error) {
            showToast(`Error adding keyword filter: ${error.message}`, 'error');
        }
    }

    updateUIFromState(state) {
        this.updateZoomUI(state.zoom);
        this.updateTiltUI(state.tilt);
        this.updateActiveFilters();
    }

    updateZoomUI(activeLevel) {
        this.elements.zoomBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === activeLevel);
        });
    }

    updateTiltUI(activeStyle) {
        this.elements.tiltBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tilt === activeStyle);
        });
    }

    updateActiveFilters() {
        if (!this.elements.activeFilters) return;

        const pan = this.state.session.zpt.pan;
        const allFilters = [
            ...pan.domains.map(d => ({ type: 'domain', value: d })),
            ...pan.keywords.map(k => ({ type: 'keyword', value: k }))
        ];

        this.elements.activeFilters.innerHTML = allFilters.map(filter => 
            `<div class="filter-tag">
                ${escapeHtml(filter.value)}
                <span class="filter-remove" data-type="${filter.type}" data-value="${escapeHtml(filter.value)}">×</span>
            </div>`
        ).join('');

        // Add remove handlers
        this.elements.activeFilters.querySelectorAll('.filter-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeFilter(btn.dataset.type, btn.dataset.value);
            });
        });
    }

    async removeFilter(type, value) {
        const currentPan = this.state.session.zpt.pan;
        
        let newPan = { ...currentPan };
        if (type === 'domain') {
            newPan.domains = currentPan.domains.filter(d => d !== value);
        } else if (type === 'keyword') {
            newPan.keywords = currentPan.keywords.filter(k => k !== value);
        }

        try {
            const result = await this.apiService.pan(
                newPan.domains, 
                newPan.keywords, 
                newPan.temporal, 
                newPan.entities
            );
            
            if (result.success) {
                this.state.updateZPT({ pan: newPan });
                this.updateActiveFilters();
                showToast(`Removed ${type} filter: ${value}`, 'success');
            }
        } catch (error) {
            showToast(`Error removing filter: ${error.message}`, 'error');
        }
    }
}

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // Remove active state from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active');
    }

    // Set active state on nav button
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
}

// Initialize the workbench
let workbenchState, apiService, sessionDashboard, tellController, askController, navigateController;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semantic Memory Workbench...');

    // Initialize core services
    workbenchState = new WorkbenchState();
    apiService = new APIService();

    // Initialize UI controllers
    sessionDashboard = new SessionDashboard(workbenchState, apiService);
    tellController = new TellController(workbenchState, apiService);
    askController = new AskController(workbenchState, apiService);
    navigateController = new NavigateController(workbenchState, apiService);

    // Initialize navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Initialize panel toggles
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const panel = toggle.dataset.panel;
            const content = document.querySelector(`#${panel}-panel .panel-content`);
            if (content) {
                const isExpanded = content.style.display !== 'none';
                content.style.display = isExpanded ? 'none' : 'block';
                toggle.setAttribute('aria-expanded', !isExpanded);
            }
        });
    });

    console.log('Semantic Memory Workbench initialized successfully');

    // Show welcome toast
    setTimeout(() => {
        showToast('Welcome to Semantic Memory Workbench! Ready for 7 Simple Verbs operations.', 'success');
    }, 1000);
});

// Export for debugging
window.semem = {
    state: () => workbenchState,
    api: () => apiService,
    switchTab,
    showToast
};