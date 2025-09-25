/**
 * Memory Component for Project Memory Management
 * Implements ChatGPT-style memory features using the new memory verbs
 */

import { apiService } from '../services/ApiService.js';
import { stateManager } from '../services/StateManager.js';
import { consoleService } from '../services/ConsoleService.js';
import DomUtils from '../utils/DomUtils.js';

export default class MemoryComponent {
  constructor() {
    this.memories = new Map();
    this.currentDomain = 'user';
    this.activeProject = null;
    this.memoryFilter = {
      domains: [],
      relevanceThreshold: 0.1,
      timeRange: null
    };

    // Bind methods
    this.handleRemember = this.handleRemember.bind(this);
    this.handleForget = this.handleForget.bind(this);
    this.handleRecall = this.handleRecall.bind(this);
    this.handleProjectContext = this.handleProjectContext.bind(this);
    this.handleFadeMemory = this.handleFadeMemory.bind(this);
    this.handleDomainSwitch = this.handleDomainSwitch.bind(this);
    this.handleMemoryFilter = this.handleMemoryFilter.bind(this);
  }

  /**
   * Initialize the memory component
   */
  async init() {
    consoleService.info('Initializing Memory Component');

    try {
      // Setup event listeners
      this.setupEventListeners();

      // Initialize UI state
      this.updateUI();

      // Load current memory state
      await this.loadMemoryState();

      consoleService.success('Memory Component initialized');

    } catch (error) {
      consoleService.error('Failed to initialize Memory Component', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for memory controls
   */
  setupEventListeners() {
    // Remember form
    const rememberForm = DomUtils.$('#remember-form');
    if (rememberForm) {
      rememberForm.addEventListener('submit', this.handleRemember);
    }

    // Forget form
    const forgetForm = DomUtils.$('#forget-form');
    if (forgetForm) {
      forgetForm.addEventListener('submit', this.handleForget);
    }

    // Recall form
    const recallForm = DomUtils.$('#recall-form');
    if (recallForm) {
      recallForm.addEventListener('submit', this.handleRecall);
    }

    // Project context form
    const projectForm = DomUtils.$('#project-context-form');
    if (projectForm) {
      projectForm.addEventListener('submit', this.handleProjectContext);
    }

    // Fade memory form
    const fadeForm = DomUtils.$('#fade-memory-form');
    if (fadeForm) {
      fadeForm.addEventListener('submit', this.handleFadeMemory);
    }

    // Domain switcher
    const domainSelect = DomUtils.$('#memory-domain-select');
    if (domainSelect) {
      domainSelect.addEventListener('change', this.handleDomainSwitch);
    }

    // Memory filter controls
    const filterButton = DomUtils.$('#memory-filter-apply');
    if (filterButton) {
      filterButton.addEventListener('click', this.handleMemoryFilter);
    }

    // Quick action buttons
    this.setupQuickActions();
  }

  /**
   * Setup quick action buttons for common memory operations
   */
  setupQuickActions() {
    // Quick recall buttons
    const quickRecallButtons = DomUtils.$$('.quick-recall-button');
    quickRecallButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const query = e.target.dataset.query;
        const domain = e.target.dataset.domain;
        this.performQuickRecall(query, domain);
      });
    });

    // Project quick switch buttons
    const projectSwitchButtons = DomUtils.$$('.project-switch-button');
    projectSwitchButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const projectId = e.target.dataset.projectId;
        this.switchToProject(projectId);
      });
    });
  }

  /**
   * Handle remember form submission
   */
  async handleRemember(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const content = formData.get('content');
    const domain = formData.get('domain') || this.currentDomain;
    const domainId = formData.get('domainId') || this.activeProject;
    const importance = parseFloat(formData.get('importance'));
    const tags = formData.get('tags')?.split(',').map(t => t.trim()).filter(t => t) || [];
    const category = formData.get('category') || '';

    if (!content?.trim()) {
      DomUtils.showToast('Content is required', 'error');
      return;
    }

    consoleService.info('Storing memory in domain: ' + domain, { domain, domainId, importance });

    try {
      DomUtils.showLoader('#remember-submit');

      const result = await apiService.remember({
        content: content.trim(),
        domain: domain,
        domainId: domainId,
        importance: importance,
        metadata: {
          tags: tags,
          category: category,
          source: 'workbench',
          timestamp: new Date().toISOString()
        }
      });

      if (result.success) {
        // Update local memories
        this.memories.set(result.domainId || domain, {
          content: content,
          domain: domain,
          domainId: domainId,
          importance: importance,
          timestamp: new Date(),
          metadata: { tags, category }
        });

        // Update UI
        this.updateMemoryDisplay();
        this.updateMemoryStats();

        // Clear form
        event.target.reset();

        // Show success
        DomUtils.showToast(`Memory stored in ${domain} domain`, 'success');
        consoleService.success('Memory stored successfully', result);

      } else {
        throw new Error(result.error || 'Failed to store memory');
      }

    } catch (error) {
      consoleService.error('Failed to store memory', error);
      DomUtils.showToast('Failed to store memory: ' + error.message, 'error');

    } finally {
      DomUtils.hideLoader('#remember-submit');
    }
  }

  /**
   * Handle forget form submission
   */
  async handleForget(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const target = formData.get('target');
    const strategy = formData.get('strategy') || 'fade';
    const fadeFactor = parseFloat(formData.get('fadeFactor'));

    if (!target?.trim()) {
      DomUtils.showToast('Target is required', 'error');
      return;
    }

    consoleService.info('Forgetting memory', { target, strategy, fadeFactor });

    try {
      DomUtils.showLoader('#forget-submit');

      const result = await apiService.forget({
        target: target.trim(),
        strategy: strategy,
        fadeFactor: fadeFactor
      });

      if (result.success) {
        // Update UI to reflect faded memory
        this.updateMemoryDisplay();
        this.updateMemoryStats();

        // Clear form
        event.target.reset();

        // Show success
        DomUtils.showToast(`Memory ${strategy} applied to ${target}`, 'success');
        consoleService.success('Memory forgotten successfully', result);

      } else {
        throw new Error(result.error || 'Failed to forget memory');
      }

    } catch (error) {
      consoleService.error('Failed to forget memory', error);
      DomUtils.showToast('Failed to forget memory: ' + error.message, 'error');

    } finally {
      DomUtils.hideLoader('#forget-submit');
    }
  }

  /**
   * Handle recall form submission
   */
  async handleRecall(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const query = formData.get('query');
    const domains = formData.get('domains')?.split(',').map(d => d.trim()).filter(d => d) || [];
    const relevanceThreshold = parseFloat(formData.get('relevanceThreshold'));
    const maxResults = parseInt(formData.get('maxResults')) || 10;

    // Time range
    const timeRangeStart = formData.get('timeRangeStart');
    const timeRangeEnd = formData.get('timeRangeEnd');
    const timeRange = (timeRangeStart || timeRangeEnd) ? {
      start: timeRangeStart || undefined,
      end: timeRangeEnd || undefined
    } : undefined;

    if (!query?.trim()) {
      DomUtils.showToast('Query is required', 'error');
      return;
    }

    consoleService.info('Recalling memories', { query, domains, relevanceThreshold, maxResults });

    try {
      DomUtils.showLoader('#recall-submit');

      const result = await apiService.recall({
        query: query.trim(),
        domains: domains.length > 0 ? domains : undefined,
        timeRange: timeRange,
        relevanceThreshold: relevanceThreshold,
        maxResults: maxResults
      });

      if (result.success) {
        // Display recall results
        this.displayRecallResults(result.memories, query);

        // Update memory stats
        this.updateMemoryStats();

        // Show success
        const memoriesFound = result.memoriesFound || 0;
        DomUtils.showToast(`Found ${memoriesFound} memories`, 'info');
        consoleService.success(`Recalled ${memoriesFound} memories`, result);

      } else {
        throw new Error(result.error || 'Failed to recall memories');
      }

    } catch (error) {
      consoleService.error('Failed to recall memories', error);
      DomUtils.showToast('Failed to recall memories: ' + error.message, 'error');

    } finally {
      DomUtils.hideLoader('#recall-submit');
    }
  }

  /**
   * Handle project context form submission
   */
  async handleProjectContext(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const projectId = formData.get('projectId');
    const action = formData.get('action') || 'switch';
    const name = formData.get('name') || '';
    const description = formData.get('description') || '';
    const technologies = formData.get('technologies')?.split(',').map(t => t.trim()).filter(t => t) || [];
    const parentProject = formData.get('parentProject') || '';

    if (!projectId?.trim()) {
      DomUtils.showToast('Project ID is required', 'error');
      return;
    }

    consoleService.info('Managing project context', { projectId, action });

    try {
      DomUtils.showLoader('#project-context-submit');

      const result = await apiService.project_context({
        projectId: projectId.trim(),
        action: action,
        metadata: {
          name: name,
          description: description,
          technologies: technologies,
          parentProject: parentProject || undefined
        }
      });

      if (result.success) {
        // Update active project
        if (action === 'switch' || action === 'create') {
          this.activeProject = projectId;
          this.updateProjectDisplay();
        }

        // Update UI
        this.updateMemoryDisplay();
        this.updateMemoryStats();

        // Show success
        let message = `Project ${projectId} ${action}ed successfully`;
        if (action === 'create') message = `Project ${projectId} created`;
        else if (action === 'switch') message = `Switched to project ${projectId}`;
        else if (action === 'archive') message = `Project ${projectId} archived`;

        DomUtils.showToast(message, 'success');
        consoleService.success('Project context updated', result);

      } else {
        throw new Error(result.error || 'Failed to manage project context');
      }

    } catch (error) {
      consoleService.error('Failed to manage project context', error);
      DomUtils.showToast('Failed to manage project: ' + error.message, 'error');

    } finally {
      DomUtils.hideLoader('#project-context-submit');
    }
  }

  /**
   * Handle fade memory form submission
   */
  async handleFadeMemory(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const domain = formData.get('domain');
    const fadeFactor = parseFloat(formData.get('fadeFactor'));
    const transition = formData.get('transition') || 'smooth';
    const preserveInstructions = formData.has('preserveInstructions');

    if (!domain?.trim()) {
      DomUtils.showToast('Domain is required', 'error');
      return;
    }

    consoleService.info('Fading memory domain', { domain, fadeFactor, transition });

    try {
      DomUtils.showLoader('#fade-memory-submit');

      const result = await apiService.fade_memory({
        domain: domain.trim(),
        fadeFactor: fadeFactor,
        transition: transition,
        preserveInstructions: preserveInstructions
      });

      if (result.success) {
        // Update UI to reflect faded domain
        this.updateMemoryDisplay();
        this.updateMemoryStats();

        // Clear form
        event.target.reset();

        // Show success
        DomUtils.showToast(`Domain ${domain} faded (${Math.round(fadeFactor * 100)}%)`, 'success');
        consoleService.success('Memory domain faded', result);

      } else {
        throw new Error(result.error || 'Failed to fade memory');
      }

    } catch (error) {
      consoleService.error('Failed to fade memory', error);
      DomUtils.showToast('Failed to fade memory: ' + error.message, 'error');

    } finally {
      DomUtils.hideLoader('#fade-memory-submit');
    }
  }

  /**
   * Handle domain switch
   */
  async handleDomainSwitch(event) {
    const newDomain = event.target.value;

    if (newDomain !== this.currentDomain) {
      this.currentDomain = newDomain;

      // Update UI to reflect new domain
      this.updateMemoryDisplay();
      this.updateDomainDisplay();

      consoleService.info('Switched to domain: ' + newDomain);
    }
  }

  /**
   * Handle memory filter changes
   */
  async handleMemoryFilter(event) {
    const domainsInput = DomUtils.$('#memory-filter-domains');
    const thresholdInput = DomUtils.$('#memory-filter-threshold');
    const startDateInput = DomUtils.$('#memory-filter-start');
    const endDateInput = DomUtils.$('#memory-filter-end');

    this.memoryFilter = {
      domains: domainsInput?.value.split(',').map(d => d.trim()).filter(d => d) || [],
      relevanceThreshold: parseFloat(thresholdInput?.value),
      timeRange: (startDateInput?.value || endDateInput?.value) ? {
        start: startDateInput?.value || undefined,
        end: endDateInput?.value || undefined
      } : null
    };

    // Apply filter and update display
    await this.applyMemoryFilter();

    consoleService.info('Memory filter applied', this.memoryFilter);
  }

  /**
   * Perform quick recall with predefined query and domain
   */
  async performQuickRecall(query, domain) {
    consoleService.info('Quick recall', { query, domain });

    try {
      const result = await apiService.recall({
        query: query,
        domains: domain ? [domain] : undefined,
        relevanceThreshold: 0.1,
        maxResults: 5
      });

      if (result.success) {
        this.displayRecallResults(result.memories, query, true);
        DomUtils.showToast(`Quick recall: ${result.memoriesFound} memories found`, 'info');
      }

    } catch (error) {
      consoleService.error('Quick recall failed', error);
      DomUtils.showToast('Quick recall failed: ' + error.message, 'error');
    }
  }

  /**
   * Switch to a specific project
   */
  async switchToProject(projectId) {
    try {
      const result = await apiService.project_context({
        projectId: projectId,
        action: 'switch'
      });

      if (result.success) {
        this.activeProject = projectId;
        this.updateProjectDisplay();
        this.updateMemoryDisplay();

        DomUtils.showToast(`Switched to project: ${projectId}`, 'success');
        consoleService.info('Switched to project: ' + projectId);
      }

    } catch (error) {
      consoleService.error('Failed to switch project', error);
      DomUtils.showToast('Failed to switch project: ' + error.message, 'error');
    }
  }

  /**
   * Load current memory state
   */
  async loadMemoryState() {
    try {
      // Load session info to get current state
      const sessionResult = await apiService.inspect({ what: 'session' });

      if (sessionResult.success && sessionResult.zptState) {
        const zptState = sessionResult.zptState;

        // Update current domain if available in state
        if (zptState.pan?.domains?.length > 0) {
          const projectDomains = zptState.pan.domains.filter(d => d.startsWith('project:'));
          if (projectDomains.length > 0) {
            this.activeProject = projectDomains[0].replace('project:', '');
          }
        }
      }

      // Update UI with loaded state
      this.updateUI();

    } catch (error) {
      consoleService.warning('Could not load memory state', error);
    }
  }

  /**
   * Apply memory filter
   */
  async applyMemoryFilter() {
    // This would trigger a filtered recall if needed
    this.updateMemoryDisplay();
  }

  /**
   * Display recall results in the UI
   */
  displayRecallResults(memories, query, isQuick = false) {
    const resultsContainer = DomUtils.$('#recall-results');
    if (!resultsContainer) return;

    if (!memories || memories.length === 0) {
      resultsContainer.innerHTML = `
        <div class="recall-no-results">
          <div class="no-results-icon">🔍</div>
          <p class="no-results-text">No memories found for "${query}"</p>
          <p class="no-results-hint">Try adjusting your search terms or relevance threshold</p>
        </div>
      `;
      return;
    }

    const memoriesHtml = memories.map((memory, index) => {
      const relevancePercent = Math.round((memory.relevance || 0) * 100);
      const timeAgo = this.formatTimeAgo(memory.timestamp);

      return `
        <div class="memory-result" data-memory-id="${memory.id}">
          <div class="memory-header">
            <div class="memory-meta">
              <span class="memory-domain">${memory.domain || 'unknown'}</span>
              <span class="memory-relevance">${relevancePercent}% relevant</span>
              <span class="memory-time">${timeAgo}</span>
            </div>
          </div>
          <div class="memory-content">
            ${this.highlightQuery(memory.content, query)}
          </div>
          ${memory.metadata ? `
            <div class="memory-metadata">
              ${memory.metadata.isInstruction ? '<span class="memory-tag instruction">instruction</span>' : ''}
              ${memory.metadata.recencyBias ? '<span class="memory-tag recent">recent</span>' : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    resultsContainer.innerHTML = `
      <div class="recall-results-header">
        <h4 class="results-title">
          ${isQuick ? '⚡ Quick Recall' : '🔍 Recall Results'} 
          <span class="results-count">(${memories.length} memories)</span>
        </h4>
        <div class="results-query">Query: "${query}"</div>
      </div>
      <div class="recall-results-list">
        ${memoriesHtml}
      </div>
    `;
  }

  /**
   * Update memory display
   */
  updateMemoryDisplay() {
    this.updateMemoryStats();
    this.updateDomainDisplay();
    this.updateProjectDisplay();
  }

  /**
   * Update memory statistics
   */
  updateMemoryStats() {
    const memoryCountElement = DomUtils.$('#memory-count');
    if (memoryCountElement) {
      memoryCountElement.textContent = this.memories.size;
    }

    const domainCountElement = DomUtils.$('#domain-count');
    if (domainCountElement) {
      const domains = new Set();
      this.memories.forEach(memory => domains.add(memory.domain));
      domainCountElement.textContent = domains.size;
    }
  }

  /**
   * Update domain display
   */
  updateDomainDisplay() {
    const domainElement = DomUtils.$('#current-memory-domain');
    if (domainElement) {
      domainElement.textContent = this.currentDomain;
    }
  }

  /**
   * Update project display
   */
  updateProjectDisplay() {
    const projectElement = DomUtils.$('#current-project');
    if (projectElement) {
      projectElement.textContent = this.activeProject || 'None';
    }
  }

  /**
   * Update UI components
   */
  updateUI() {
    this.updateMemoryDisplay();

    // Update form defaults
    const domainSelect = DomUtils.$('#memory-domain-select');
    if (domainSelect) {
      domainSelect.value = this.currentDomain;
    }
  }

  /**
   * Highlight search query in text
   */
  highlightQuery(text, query) {
    if (!query || !text) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="query-highlight">$1</mark>');
  }

  /**
   * Format timestamp as "time ago"
   */
  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;

    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }
}