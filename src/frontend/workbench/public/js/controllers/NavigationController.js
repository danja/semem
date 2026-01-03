import { apiService } from '../services/ApiService.js';
import { stateManager } from '../services/StateManager.js';
import { consoleService } from '../services/ConsoleService.js';
import { lensState } from '../services/LensState.js';
import DomUtils from '../utils/DomUtils.js';

export default class NavigationController {
  constructor() {
    this.lastNavigationQuery = 'Navigate knowledge space';
    this.navigationRequestId = 0;
    this.elements = {};

    this.handleZoomChange = this.handleZoomChange.bind(this);
    this.handlePanChange = this.handlePanChange.bind(this);
    this.handleTiltChange = this.handleTiltChange.bind(this);
    this.handleThresholdChange = this.handleThresholdChange.bind(this);
    this.handleNavigationExecute = this.handleNavigationExecute.bind(this);
    this.handleNavigationHistoryRefresh = this.handleNavigationHistoryRefresh.bind(this);
    this.handleLensPreset = this.handleLensPreset.bind(this);
    this.handleLensRun = this.handleLensRun.bind(this);
    this.handleLensChatToggle = this.handleLensChatToggle.bind(this);
    this.handleLensChipRemove = this.handleLensChipRemove.bind(this);
    this.updateZptDisplay = this.updateZptDisplay.bind(this);
    this.handleZptStateChange = this.handleZptStateChange.bind(this);
  }

  init() {
    this.cacheElements();
    this.setupControls();
    this.updateNavigationDisplay();
    this.updateZptDisplay();
  }

  subscribeToState() {
    stateManager.subscribe('zoomChange', this.handleZptStateChange);
    stateManager.subscribe('panChange', this.handleZptStateChange);
    stateManager.subscribe('tiltChange', this.handleZptStateChange);
  }

  handleZptStateChange() {
    this.updateZptDisplay();
    this.updateNavigationDisplay();
  }

  cacheElements() {
    this.elements = {
      zoomState: DomUtils.$('#zoom-state'),
      panState: DomUtils.$('#pan-state'),
      tiltState: DomUtils.$('#tilt-state'),
      focusZoom: DomUtils.$('#zpt-focus-zoom'),
      focusPan: DomUtils.$('#zpt-focus-pan'),
      focusTilt: DomUtils.$('#zpt-focus-tilt'),
      lensZoom: DomUtils.$('#zpt-lens-zoom'),
      lensPan: DomUtils.$('#zpt-lens-pan'),
      lensTilt: DomUtils.$('#zpt-lens-tilt'),
      lensChips: DomUtils.$('#zpt-lens-chips'),
      lensChatToggle: DomUtils.$('#zpt-lens-chat-toggle'),
      currentZoom: DomUtils.$('#current-zoom'),
      zoomDescription: DomUtils.$('#zoom-description'),
      currentPan: DomUtils.$('#current-pan'),
      panDescription: DomUtils.$('#pan-description'),
      currentTilt: DomUtils.$('#current-tilt'),
      tiltDescription: DomUtils.$('#tilt-description'),
      thresholdValue: DomUtils.$('#threshold-value'),
      resultsContainer: DomUtils.$('#nav-results-content'),
      sessionsContainer: DomUtils.$('#nav-sessions-list'),
      viewsContainer: DomUtils.$('#nav-views-list'),
      panDomainsInput: DomUtils.$('#pan-domains'),
      panKeywordsInput: DomUtils.$('#pan-keywords'),
      lensRunButton: DomUtils.$('#zpt-lens-run'),
      lensPresetButtons: DomUtils.$$('.zpt-preset')
    };
  }

  setupControls() {
    DomUtils.$$('.zoom-button').forEach(button => {
      button.addEventListener('click', this.handleZoomChange);
    });

    DomUtils.$$('.tilt-button').forEach(button => {
      button.addEventListener('click', this.handleTiltChange);
    });

    const thresholdSlider = DomUtils.$('#similarity-threshold');
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', this.handleThresholdChange);
    }

    if (this.elements.panDomainsInput) {
      this.elements.panDomainsInput.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }

    if (this.elements.panKeywordsInput) {
      this.elements.panKeywordsInput.addEventListener('input', DomUtils.debounce(this.handlePanChange, 500));
    }

    const navExecuteButton = DomUtils.$('#nav-execute');
    if (navExecuteButton) {
      navExecuteButton.addEventListener('click', this.handleNavigationExecute);
    }

    const navHistoryButton = DomUtils.$('#nav-history-refresh');
    if (navHistoryButton) {
      navHistoryButton.addEventListener('click', this.handleNavigationHistoryRefresh);
    }

    if (this.elements.lensRunButton) {
      this.elements.lensRunButton.addEventListener('click', this.handleLensRun);
    }

    if (this.elements.lensPresetButtons?.length) {
      this.elements.lensPresetButtons.forEach(button => {
        button.addEventListener('click', this.handleLensPreset);
      });
    }

    if (this.elements.lensChatToggle) {
      this.elements.lensChatToggle.addEventListener('change', this.handleLensChatToggle);
    }
  }

  updateZptDisplay() {
    const state = stateManager.getState();
    const panDisplay = stateManager.getPanDisplayString();
    const lensPrefs = lensState.get();

    if (this.elements.zoomState) {
      this.elements.zoomState.textContent = state.zoom;
      this.elements.zoomState.title = `Zoom: ${state.zoom}`;
    }

    if (this.elements.panState) {
      this.elements.panState.textContent = panDisplay;
      this.elements.panState.title = `Pan: ${panDisplay}`;
    }

    if (this.elements.tiltState) {
      this.elements.tiltState.textContent = state.tilt;
      this.elements.tiltState.title = `Tilt: ${state.tilt}`;
    }

    if (this.elements.focusZoom) {
      this.elements.focusZoom.textContent = this.formatZoomLevel(state.zoom);
      this.elements.focusZoom.title = `Zoom: ${state.zoom}`;
    }

    if (this.elements.focusPan) {
      this.elements.focusPan.textContent = panDisplay;
      this.elements.focusPan.title = `Pan: ${panDisplay}`;
    }

    if (this.elements.focusTilt) {
      this.elements.focusTilt.textContent = this.formatTiltStyle(state.tilt);
      this.elements.focusTilt.title = `Tilt: ${state.tilt}`;
    }

    if (this.elements.lensZoom) {
      this.elements.lensZoom.textContent = this.formatZoomLevel(state.zoom);
      this.elements.lensZoom.title = `Zoom: ${state.zoom}`;
    }

    if (this.elements.lensPan) {
      this.elements.lensPan.textContent = panDisplay;
      this.elements.lensPan.title = `Pan: ${panDisplay}`;
    }

    if (this.elements.lensTilt) {
      this.elements.lensTilt.textContent = this.formatTiltStyle(state.tilt);
      this.elements.lensTilt.title = `Tilt: ${state.tilt}`;
    }

    if (this.elements.lensChatToggle) {
      const stored = lensPrefs.useLensOnAsk;
      this.elements.lensChatToggle.checked = typeof stored === 'boolean'
        ? stored
        : !!state.ui?.useLensOnAsk;
    }

    this.renderPanChips(state.pan);
  }

  handleLensChatToggle(event) {
    const checked = event.target.checked;
    lensState.set({ ...lensState.get(), useLensOnAsk: checked });
    stateManager.setState({
      ui: {
        ...stateManager.getState().ui,
        useLensOnAsk: checked
      }
    }, false);
  }

  handleLensChipRemove(event) {
    const button = event.currentTarget;
    const type = button.dataset.type;
    const value = button.dataset.value;
    const state = stateManager.getState();
    const pan = { ...state.pan };

    if (type === 'domains') {
      pan.domains = pan.domains.filter(item => item !== value);
    }
    if (type === 'keywords') {
      pan.keywords = pan.keywords.filter(item => item !== value);
    }
    if (type === 'entities') {
      pan.entities = pan.entities.filter(item => item !== value);
    }

    stateManager.setPan(pan);
  }

  renderPanChips(pan) {
    if (!this.elements.lensChips) {
      return;
    }

    const chips = [];
    const addChip = (type, value) => {
      chips.push({ type, value });
    };

    const domains = Array.isArray(pan?.domains) ? pan.domains : (pan?.domains ? [pan.domains] : []);
    const keywords = Array.isArray(pan?.keywords) ? pan.keywords : (pan?.keywords ? [pan.keywords] : []);
    const entities = Array.isArray(pan?.entities) ? pan.entities : (pan?.entities ? [pan.entities] : []);

    domains.forEach(value => addChip('domains', value));
    keywords.forEach(value => addChip('keywords', value));
    entities.forEach(value => addChip('entities', value));

    if (!chips.length) {
      this.elements.lensChips.innerHTML = '<span class="zpt-lens-chip" title="No active pan filters">No pan filters</span>';
      return;
    }

    this.elements.lensChips.innerHTML = chips.map(chip => (
      `<span class="zpt-lens-chip" title="Pan filter: ${chip.type} = ${chip.value}">${chip.type}: ${chip.value}` +
      `<button type="button" data-type="${chip.type}" data-value="${chip.value}" aria-label="Remove ${chip.type} filter">×</button>` +
      `</span>`
    )).join('');

    this.elements.lensChips.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', this.handleLensChipRemove);
    });
  }

  async handleLensPreset(event) {
    const button = event.currentTarget;
    const zoom = button.dataset.zoom;
    const tilt = button.dataset.tilt;
    const domains = button.dataset.domains;
    const keywords = button.dataset.keywords;

    if (!zoom || !tilt) {
      return;
    }

    const panParams = {
      domains: domains ? domains.split(',').map(item => item.trim()).filter(Boolean) : [],
      keywords: keywords ? keywords.split(',').map(item => item.trim()).filter(Boolean) : []
    };

    try {
      await stateManager.setZoom(zoom);
      await stateManager.setTilt(tilt);
      await stateManager.setPan(panParams);

      if (this.elements.panDomainsInput) {
        this.elements.panDomainsInput.value = panParams.domains.join(', ');
      }
      if (this.elements.panKeywordsInput) {
        this.elements.panKeywordsInput.value = panParams.keywords.join(', ');
      }

      this.setActiveZoomButton(zoom);
      this.setActiveTiltButton(tilt);

      consoleService.info(`🧭 ZPT preset applied: ${zoom}/${panParams.domains.length ? 'domains' : 'all'}/${tilt}`);
    } catch (error) {
      consoleService.error(`❌ Failed to apply ZPT preset: ${error.message}`);
      DomUtils.showToast('Failed to apply preset', 'error');
    }
  }

  async handleLensRun() {
    await this.executeNavigationFromState({ source: 'lens' });
  }

  setActiveZoomButton(level) {
    DomUtils.$$('.zoom-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
    });
    const active = DomUtils.$(`.zoom-button[data-level="${level}"]`);
    if (active) {
      DomUtils.addClass(active, 'active');
    }
  }

  setActiveTiltButton(style) {
    DomUtils.$$('.tilt-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
    });
    const active = DomUtils.$(`.tilt-button[data-style="${style}"]`);
    if (active) {
      DomUtils.addClass(active, 'active');
    }
  }

  updateNavigationDisplay() {
    const state = stateManager.getState();

    if (this.elements.currentZoom && this.elements.zoomDescription) {
      this.elements.currentZoom.textContent = this.formatZoomLevel(state.zoom);
      this.elements.currentZoom.title = `Zoom: ${state.zoom}`;
      this.elements.zoomDescription.textContent = this.getZoomDescription(state.zoom);
    }

    if (this.elements.currentTilt && this.elements.tiltDescription) {
      this.elements.currentTilt.textContent = this.formatTiltStyle(state.tilt);
      this.elements.currentTilt.title = `Tilt: ${state.tilt}`;
      this.elements.tiltDescription.textContent = this.getTiltDescription(state.tilt);
    }

    if (this.elements.currentPan && this.elements.panDescription) {
      const panText = this.formatPanFilters(state.pan);
      this.elements.currentPan.textContent = panText;
      this.elements.currentPan.title = `Pan: ${panText}`;
      this.elements.panDescription.textContent = this.getPanDescription(state.pan);
    }
  }

  formatZoomLevel(zoom) {
    const levels = {
      micro: 'Micro',
      entity: 'Entity',
      text: 'Text',
      unit: 'Unit',
      community: 'Community',
      corpus: 'Corpus'
    };
    if (!levels[zoom]) {
      throw new Error(`Unsupported zoom level: ${zoom}`);
    }
    return levels[zoom];
  }

  getZoomDescription(zoom) {
    const descriptions = {
      micro: 'Sub-entity attributes and fine-grained components',
      entity: 'Named entities and concrete elements',
      text: 'Full documents and source fragments',
      unit: 'Semantic units and local summaries',
      community: 'Groups of related units and themes',
      corpus: 'Entire knowledge collection'
    };
    if (!descriptions[zoom]) {
      throw new Error(`Unsupported zoom level: ${zoom}`);
    }
    return descriptions[zoom];
  }

  formatTiltStyle(tilt) {
    const styles = {
      keywords: 'Keywords',
      embedding: 'Embedding',
      graph: 'Graph',
      temporal: 'Temporal',
      concept: 'Concept'
    };
    if (!styles[tilt]) {
      throw new Error(`Unsupported tilt style: ${tilt}`);
    }
    return styles[tilt];
  }

  getTiltDescription(tilt) {
    const descriptions = {
      keywords: 'Keyword-based view of content',
      embedding: 'Vector similarity view',
      graph: 'Relationship network view',
      temporal: 'Time-based organization',
      concept: 'Concept extraction and relationship view'
    };
    if (!descriptions[tilt]) {
      throw new Error(`Unsupported tilt style: ${tilt}`);
    }
    return descriptions[tilt];
  }

  formatPanFilters(pan) {
    const parts = [];
    const domains = Array.isArray(pan?.domains) ? pan.domains : (pan?.domains ? [pan.domains] : []);
    const keywords = Array.isArray(pan?.keywords) ? pan.keywords : (pan?.keywords ? [pan.keywords] : []);
    if (domains.length) parts.push(`Domains: ${domains.join(', ')}`);
    if (keywords.length) parts.push(`Keywords: ${keywords.join(', ')}`);
    return parts.length > 0 ? parts.join(', ') : 'All domains';
  }

  getPanDescription(pan) {
    if (pan?.domains || pan?.keywords) {
      return 'Filtered by specified criteria';
    }
    return 'No domain filters applied';
  }

  async handleZoomChange(event) {
    const button = event.target;
    const level = button.dataset.level;

    if (!level) return;

    try {
      DomUtils.$$('.zoom-button').forEach(btn => {
        DomUtils.removeClass(btn, 'active');
      });
      DomUtils.addClass(button, 'active');

      await stateManager.setZoom(level);

      consoleService.info(`🔍 Zoom level changed to "${level}" - adjusting abstraction level for search results`);

      this.updateNavigationDisplay();
      await this.executeNavigationFromState({ source: 'zoom' });
    } catch (error) {
      consoleService.error(`❌ Failed to change zoom level to "${level}": ${error.message}`);
      DomUtils.showToast('Failed to change zoom level', 'error');
    }
  }

  async handleTiltChange(event) {
    const button = event.target;
    const style = button.dataset.style;

    if (!style) return;

    try {
      DomUtils.$$('.tilt-button').forEach(btn => {
        DomUtils.removeClass(btn, 'active');
      });
      DomUtils.addClass(button, 'active');

      await stateManager.setTilt(style);

      consoleService.info(`🎯 Tilt view changed to "${style}" - adjusting content perspective and filtering`);

      this.updateNavigationDisplay();
      await this.executeNavigationFromState({ source: 'tilt' });
    } catch (error) {
      consoleService.error(`❌ Failed to change view style to "${style}": ${error.message}`);
      DomUtils.showToast('Failed to change view style', 'error');
    }
  }

  async handleThresholdChange(event) {
    const slider = event.target;
    const threshold = parseFloat(slider.value);

    if (isNaN(threshold)) return;

    try {
      if (this.elements.thresholdValue) {
        this.elements.thresholdValue.textContent = threshold.toFixed(2);
      }

      stateManager.setSimilarityThreshold(threshold);

      const sensitivity = threshold < 0.3 ? 'more sensitive' : threshold > 0.7 ? 'less sensitive' : 'balanced';
      consoleService.info(`⚖️ Similarity threshold set to ${(threshold * 100).toFixed(0)}% (${sensitivity} search)`);
    } catch (error) {
      consoleService.error(`❌ Failed to change similarity threshold to ${(threshold * 100).toFixed(0)}%: ${error.message}`);
      DomUtils.showToast('Failed to change threshold', 'error');
    }
  }

  async handlePanChange() {
    const domainsInput = DomUtils.$('#pan-domains');
    const keywordsInput = DomUtils.$('#pan-keywords');

    const parseList = (value) => value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);

    const domains = parseList(domainsInput?.value || '');
    const keywords = parseList(keywordsInput?.value || '');

    try {
      await stateManager.setPan({ domains, keywords });

      const filterDesc = domains.length > 0 || keywords.length > 0
        ? `filtering by ${domains.length} domains and ${keywords.length} keywords`
        : 'removing all filters';
      consoleService.info(`🔄 Pan filters updated - ${filterDesc}`);

      this.updateNavigationDisplay();
      await this.executeNavigationFromState({ source: 'pan' });
    } catch (error) {
      consoleService.error(`❌ Failed to update pan filters: ${error.message}`);
      DomUtils.showToast('Failed to update filters', 'error');
    }
  }

  async handleNavigationExecute(event) {
    event.preventDefault();

    const button = event.target.closest('button');
    const buttonText = button.querySelector('.button-text');
    const buttonLoader = button.querySelector('.button-loader');

    try {
      button.disabled = true;
      DomUtils.hide(buttonText);
      DomUtils.show(buttonLoader);

      const query = this.lastNavigationQuery || 'Navigate knowledge space';
      const result = await this.executeNavigationFromState({
        query,
        source: 'manual',
        showToast: true
      });
      const resultCount = result?.results?.length || result?.items?.length || 0;
      consoleService.success(`✅ Navigation completed - found ${resultCount} relevant items`);
    } catch (error) {
      consoleService.error(`❌ ZPT navigation failed: ${error.message}`);
      DomUtils.showToast('Navigation execution failed', 'error');
    } finally {
      button.disabled = false;
      DomUtils.show(buttonText);
      DomUtils.hide(buttonLoader);
    }
  }

  async executeNavigationFromState({ query, source = 'navigation', showToast = false } = {}) {
    const state = stateManager.getState();
    const requestId = ++this.navigationRequestId;
    const resolvedQuery = query || this.lastNavigationQuery || 'Navigate knowledge space';
    const navigationParams = {
      zoom: state.zoom || 'entity',
      pan: state.pan || {},
      tilt: state.tilt || 'keywords'
    };

    this.lastNavigationQuery = resolvedQuery;
    consoleService.info(`🗺️ Executing ZPT navigation (${source}) with zoom:"${state.zoom}", pan filters, and tilt:"${state.tilt}"`);

    try {
      const result = await apiService.zptNavigate({
        query: resolvedQuery,
        ...navigationParams
      });

      if (requestId !== this.navigationRequestId) {
        return null;
      }

      this.displayNavigationResults(result);
      if (showToast) {
        DomUtils.showToast('Navigation executed successfully', 'success');
      }
      return result;
    } catch (error) {
      consoleService.error(`❌ ZPT navigation (${source}) failed: ${error.message}`);
      if (showToast) {
        DomUtils.showToast('Navigation execution failed', 'error');
      }
      throw error;
    }
  }

  async handleNavigationHistoryRefresh(event) {
    event.preventDefault();

    const button = event.target.closest('button');
    const buttonText = button.querySelector('.button-text');

    try {
      button.disabled = true;
      DomUtils.hide(buttonText);
      button.setAttribute('data-loading', 'true');

      const [sessionsResult, viewsResult] = await Promise.all([
        apiService.zptGetSessions(10),
        apiService.zptGetViews(10)
      ]);

      this.displayNavigationHistory(sessionsResult, viewsResult);
      consoleService.success('✅ Navigation history refreshed');
    } catch (error) {
      consoleService.error(`❌ Navigation history refresh failed: ${error.message}`);
      DomUtils.showToast('Navigation history refresh failed', 'error');
    } finally {
      button.disabled = false;
      DomUtils.show(buttonText);
      button.removeAttribute('data-loading');
    }
  }

  displayNavigationHistory(sessionsResult, viewsResult) {
    const sessionsContainer = this.elements.sessionsContainer;
    const viewsContainer = this.elements.viewsContainer;

    if (!sessionsContainer || !viewsContainer) return;

    const sessions = sessionsResult?.sessions || [];
    const views = viewsResult?.views || [];

    if (sessions.length === 0) {
      sessionsContainer.innerHTML = '<p class="history-placeholder">No sessions recorded yet.</p>';
    } else {
      sessionsContainer.innerHTML = sessions.map(session => `
        <div class="history-item">
          <div class="history-title">${DomUtils.escapeHtml(session.purpose || 'Navigation session')}</div>
          <div class="history-meta">Started: ${DomUtils.escapeHtml(session.startTime || 'unknown')}</div>
          <div class="history-meta">Agent: ${DomUtils.escapeHtml(session.agentURI || 'unknown')}</div>
        </div>
      `).join('');
    }

    if (views.length === 0) {
      viewsContainer.innerHTML = '<p class="history-placeholder">No views recorded yet.</p>';
    } else {
      viewsContainer.innerHTML = views.map(view => `
        <div class="history-item">
          <div class="history-title">${DomUtils.escapeHtml(view.query || 'Navigation view')}</div>
          <div class="history-meta">Timestamp: ${DomUtils.escapeHtml(view.timestamp || 'unknown')}</div>
          <div class="history-meta">Session: ${DomUtils.escapeHtml(view.sessionURI || 'unknown')}</div>
        </div>
      `).join('');
    }
  }

  displayNavigationResults(result) {
    const resultsContainer = this.elements.resultsContainer;
    if (!resultsContainer) return;

    DomUtils.show(resultsContainer);

    let html = '<div class="navigation-results">';
    const contentData = result?.content?.data || result?.data;

    if (result.success && contentData) {
      const activeTilt = result?.navigation?.tilt || result?.content?.projection?.representation;
      html += '<div class="nav-results-header">';
      html += '<h4 title="Results returned by the current ZPT lens">Navigation Results</h4>';
      if (activeTilt === 'concept') {
        html += '<span class="nav-badge nav-badge-concept">Concept tilt active</span>';
      }
      html += '</div>';

      if (contentData.entities && contentData.entities.length > 0) {
        html += '<div class="result-section">';
        html += '<h5 title="Entities matched by the current lens">📍 Found Entities</h5>';
        html += '<ul class="entity-list">';
        contentData.entities.slice(0, 10).forEach(entity => {
          const label = DomUtils.escapeHtml(entity.name || entity.id);
          html += `<li class="entity-item">
            <strong title="${label}">${label}</strong>
            ${entity.content ? `<p>${DomUtils.escapeHtml(entity.content.substring(0, 100))}...</p>` : ''}
          </li>`;
        });
        html += '</ul>';
        html += '</div>';
      }

      if (contentData.stats) {
        html += '<div class="result-section">';
        html += '<h5 title="Summary statistics for the navigation result">📊 Statistics</h5>';
        html += '<div class="stats-grid">';
        Object.entries(contentData.stats).forEach(([key, value]) => {
          html += `<div class="stat-item">
            <span class="stat-label" title="Stat: ${DomUtils.escapeHtml(key)}">${key}:</span>
            <span class="stat-value">${value}</span>
          </div>`;
        });
        html += '</div>';
        html += '</div>';
      }

      if (Array.isArray(contentData) && contentData.length > 0) {
        html += '<div class="result-section">';
        html += '<h5 title="Selected corpuscles for the current lens">📌 Navigation Items</h5>';
        html += '<ul class="entity-list">';
        contentData.slice(0, 10).forEach(item => {
          const label = item.label || item.id || 'Item';
          const preview = item.content?.substring?.(0, 100) || '';
          const escapedLabel = DomUtils.escapeHtml(label);
          html += `<li class="entity-item">
            <strong title="${escapedLabel}">${escapedLabel}</strong>
            ${preview ? `<p>${DomUtils.escapeHtml(preview)}...</p>` : ''}
          </li>`;
        });
        html += '</ul>';
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
