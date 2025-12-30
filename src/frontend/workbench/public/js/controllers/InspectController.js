import { apiService } from '../services/ApiService.js';
import { consoleService } from '../services/ConsoleService.js';
import DomUtils from '../utils/DomUtils.js';

export default class InspectController {
  constructor() {
    this.handleInspectAction = this.handleInspectAction.bind(this);
    this.closeInspectModal = this.closeInspectModal.bind(this);
  }

  init() {
    this.setupControls();
    this.setupModalControls();
  }

  setupControls() {
    DomUtils.$$('.inspect-button').forEach(button => {
      button.addEventListener('click', this.handleInspectAction);
    });
  }

  setupModalControls() {
    const closeButton = DomUtils.$('#close-inspect-results');
    const modal = DomUtils.$('#inspect-results-modal');
    const backdrop = modal?.querySelector('.modal-backdrop');

    if (closeButton) {
      closeButton.addEventListener('click', this.closeInspectModal);
    }

    if (backdrop) {
      backdrop.addEventListener('click', this.closeInspectModal);
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const activeModal = DomUtils.$('#inspect-results-modal');
        if (activeModal && activeModal.style.display !== 'none') {
          this.closeInspectModal();
        }
      }
    });
  }

  closeInspectModal() {
    const modal = DomUtils.$('#inspect-results-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.style.animation = '';
    }

    DomUtils.$$('.inspect-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
    });
  }

  async handleInspectAction(event) {
    const button = event.target.closest('button');
    const inspectType = button?.dataset?.inspect;

    if (!inspectType) return;

    DomUtils.$$('.inspect-button').forEach(btn => {
      DomUtils.removeClass(btn, 'active');
    });
    DomUtils.addClass(button, 'active');

    const startTime = Date.now();

    const inspectMessages = {
      memories: '🧠 Inspecting stored memories and concepts...',
      providers: '🔌 Checking available AI providers and models...',
      config: '⚙️ Reviewing system configuration settings...',
      stats: '📊 Gathering system performance statistics...',
      health: '🩺 Performing system health diagnostic...'
    };

    const message = inspectMessages[inspectType] || `🔍 Inspecting ${inspectType} data...`;
    consoleService.info(message);

    try {
      DomUtils.setButtonLoading(button, true);

      let result;
      switch (inspectType) {
        case 'session':
          result = await apiService.inspectSession();
          break;
        case 'concepts':
          result = await apiService.inspectConcepts();
          break;
        case 'all':
          result = await apiService.inspectAllData();
          break;
        default:
          throw new Error(`Unknown inspect type: ${inspectType}`);
      }

      const duration = Date.now() - startTime;
      const recordCount = this.getRecordCount(result);
      const resultSummary = recordCount > 0 ? `found ${recordCount} items` : 'completed successfully';

      consoleService.success(`✅ ${inspectType.charAt(0).toUpperCase() + inspectType.slice(1)} inspection ${resultSummary} (${duration}ms)`);

      this.displayInspectResults(inspectType, result);
    } catch (error) {
      const duration = Date.now() - startTime;
      consoleService.error(`❌ Failed to inspect ${inspectType}: ${error.message} (${duration}ms)`);
      DomUtils.showToast(`Failed to inspect ${inspectType}: ${apiService.getErrorMessage(error)}`, 'error');
    } finally {
      DomUtils.setButtonLoading(button, false);
    }
  }

  getRecordCount(result) {
    if (result.conceptCount) return result.conceptCount;
    if (result.concepts?.length) return result.concepts.length;
    if (result.sessionCache?.interactions) return result.sessionCache.interactions;
    if (Array.isArray(result)) return result.length;
    return Object.keys(result).length;
  }

  displayInspectResults(inspectType, result) {
    const resultsContainer = DomUtils.$('#inspect-results-modal');
    const titleElement = DomUtils.$('#inspect-results-title');
    const contentElement = DomUtils.$('#inspect-results-content');

    if (!resultsContainer || !titleElement || !contentElement) {
      const fallbackContainer = DomUtils.$('#inspect-results');
      if (fallbackContainer) {
        this.displayInspectResultsFallback(fallbackContainer, inspectType, result);
      }
      return;
    }

    const titles = {
      session: '📊 Session Analytics Dashboard',
      concepts: '🧩 Concept Network Analysis',
      all: '🔍 Comprehensive System Analytics'
    };

    titleElement.textContent = titles[inspectType]
      || `${inspectType.charAt(0).toUpperCase() + inspectType.slice(1)} Inspection`;

    let html = '';

    switch (inspectType) {
      case 'session':
        html = this.formatEnhancedSessionResults(result);
        break;
      case 'concepts':
        html = this.formatEnhancedConceptResults(result);
        break;
      case 'all':
        html = this.formatEnhancedSystemResults(result);
        break;
      default:
        html = this.formatGenericResults(result);
    }

    contentElement.innerHTML = html;
    DomUtils.show(resultsContainer);
  }

  displayInspectResultsFallback(container, inspectType, result) {
    container.innerHTML = '';
    DomUtils.show(container);

    const codeBlock = DomUtils.createElement('div', { className: 'code-block' });
    codeBlock.textContent = JSON.stringify(result, null, 2);

    const resultElement = DomUtils.createElement('div', { className: 'result-item' }, [
      DomUtils.createElement('div', { className: 'result-header' }, [
        DomUtils.createElement('h3', { className: 'result-title' }, `${inspectType} Inspection Data`)
      ]),
      DomUtils.createElement('div', { className: 'result-content' }, codeBlock)
    ]);

    container.appendChild(resultElement);
  }

  formatSessionResults(result) {
    const sessionInfo = result.zptState || result.sessionCache || result;

    return `
      <div class="session-info">
        <h5>Session State</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Session ID:</span>
            <span class="value">${sessionInfo.sessionId || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Zoom Level:</span>
            <span class="value">${sessionInfo.zoom || 'N/A'}</span>
          </div>
          <div class="info-item">
            <span class="label">Interactions:</span>
            <span class="value">${sessionInfo.interactions || 0}</span>
          </div>
          <div class="info-item">
            <span class="label">Concepts:</span>
            <span class="value">${sessionInfo.concepts || 0}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Raw Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatConceptsResults(result) {
    const conceptCount = result.conceptCount || result.concepts?.length || 0;

    return `
      <div class="concepts-summary">
        <h5>Concepts Overview</h5>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Total Concepts:</span>
            <span class="value">${conceptCount}</span>
          </div>
          <div class="info-item">
            <span class="label">Storage Type:</span>
            <span class="value">${result.storageType || 'Unknown'}</span>
          </div>
        </div>
      </div>
      <div class="raw-data">
        <h5>Full Data</h5>
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatAllDataResults(result) {
    return `
      <div class="all-data-summary">
        <h5>Complete System State</h5>
        <div class="data-sections">
          ${Object.keys(result).map(section => `
            <div class="data-section">
              <h6>${section}</h6>
              <pre class="json-data">${JSON.stringify(result[section], null, 2)}</pre>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatGenericResults(result) {
    return `
      <div class="generic-results">
        <pre class="json-data">${JSON.stringify(result, null, 2)}</pre>
      </div>
    `;
  }

  formatEnhancedSessionResults(result) {
    const analytics = result.sessionAnalytics || {};
    const interactions = analytics.totalInteractions || 0;
    const memoryEfficiency = Math.round((analytics.memoryEfficiency || 0) * 100);
    const avgResponseTime = analytics.averageResponseTime || 0;
    const recentActivity = analytics.recentActivityPattern || 'Normal';

    return `
      <div class="analytics-dashboard">
        <div class="dashboard-header">
          <h2>📊 Session Analytics Dashboard</h2>
          <div class="last-updated">Last updated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card primary">
            <div class="metric-icon">💬</div>
            <div class="metric-content">
              <div class="metric-value">${interactions}</div>
              <div class="metric-label">Total Interactions</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">⚡</div>
            <div class="metric-content">
              <div class="metric-value">${avgResponseTime}ms</div>
              <div class="metric-label">Avg Response Time</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🧠</div>
            <div class="metric-content">
              <div class="metric-value">${memoryEfficiency}%</div>
              <div class="metric-label">Memory Efficiency</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📈</div>
            <div class="metric-content">
              <div class="metric-value">${recentActivity}</div>
              <div class="metric-label">Activity Pattern</div>
            </div>
          </div>
        </div>

        <div class="analytics-sections">
          ${analytics.memoryBreakdown ? this.formatMemoryBreakdown(analytics.memoryBreakdown) : ''}
          ${analytics.interactionHistory ? this.formatInteractionHistory(analytics.interactionHistory) : ''}
          ${result.recommendations ? this.formatRecommendations(result.recommendations, 'session') : ''}
        </div>
      </div>
    `;
  }

  formatEnhancedConceptResults(result) {
    const concepts = result.concepts || {};
    const topConcepts = concepts.topConcepts || [];

    return `
      <div class="analytics-dashboard">
        <div class="dashboard-header">
          <h2>🧩 Concept Network Analysis</h2>
          <div class="last-updated">Last updated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="analytics-sections">
          ${this.formatTopConcepts(topConcepts)}
          ${concepts.relationshipMap ? this.formatRelationshipMap(concepts.relationshipMap) : ''}
          ${concepts.conceptClusters ? this.formatConceptClusters(concepts.conceptClusters) : ''}
          ${result.recommendations ? this.formatRecommendations(result.recommendations, 'concepts') : ''}
        </div>
      </div>
    `;
  }

  formatEnhancedSystemResults(result) {
    const system = result.systemStatus || {};
    const performance = result.performanceMetrics || {};

    return `
      <div class="analytics-dashboard">
        <div class="dashboard-header">
          <h2>🔍 Comprehensive System Analytics</h2>
          <div class="last-updated">Last updated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="analytics-sections">
          ${this.formatSystemComponents(system)}
          ${this.formatPerformanceCharts(performance)}
          ${result.recommendations ? this.formatRecommendations(result.recommendations, 'system') : ''}
          ${this.formatSystemActions()}
        </div>
      </div>
    `;
  }

  formatMemoryBreakdown(breakdown) {
    return `
      <div class="analytics-section">
        <h3>💾 Memory Breakdown</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-value">${breakdown.shortTerm || 0}</div>
            <div class="metric-label">Short Term</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${breakdown.longTerm || 0}</div>
            <div class="metric-label">Long Term</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${breakdown.cacheHits || 0}%</div>
            <div class="metric-label">Cache Hits</div>
          </div>
        </div>
      </div>
    `;
  }

  formatInteractionHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return '';
    }

    return `
      <div class="analytics-section">
        <h3>🕒 Recent Activity</h3>
        <div class="activity-list">
          ${history.map(entry => `
            <div class="activity-item">
              <div class="activity-time">${entry.timestamp || 'Unknown time'}</div>
              <div class="activity-detail">${entry.summary || 'Interaction recorded'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatRecommendations(recommendations, type) {
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return '';
    }

    const titleMap = {
      session: '🎯 Recommended Optimizations',
      concepts: '💡 Suggested Concept Actions',
      system: '🛠️ System Recommendations'
    };

    return `
      <div class="analytics-section">
        <h3>${titleMap[type] || 'Recommendations'}</h3>
        <ul class="recommendation-list">
          ${recommendations.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  formatTopConcepts(concepts) {
    if (!Array.isArray(concepts) || concepts.length === 0) {
      return '';
    }

    return `
      <div class="analytics-section">
        <h3>🔥 Top Concepts</h3>
        <div class="concept-chip-list">
          ${concepts.map(concept => `<span class="concept-chip">${concept.label || concept}</span>`).join('')}
        </div>
      </div>
    `;
  }

  formatRelationshipMap(relationships) {
    const total = relationships.total || 0;

    return `
      <div class="analytics-section">
        <h3>🔗 Relationship Map</h3>
        <div class="stat-item">
          <span class="stat-label">Total Relationships:</span>
          <span class="stat-value">${total}</span>
        </div>
      </div>
    `;
  }

  formatConceptClusters(clusters) {
    if (!Array.isArray(clusters) || clusters.length === 0) {
      return '';
    }

    return `
      <div class="analytics-section">
        <h3>🧬 Concept Clusters</h3>
        <div class="cluster-list">
          ${clusters.map(cluster => `
            <div class="cluster-item">
              <strong>${cluster.name || 'Cluster'}</strong>
              <span>${cluster.size || 0} items</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatSystemComponents(system) {
    return `
      <div class="analytics-section">
        <h3>⚙️ System Components</h3>
        <div class="system-grid">
          ${Object.entries(system).map(([key, value]) => `
            <div class="system-item">
              <span class="system-label">${key}:</span>
              <span class="system-value">${value}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatPerformanceCharts(performance) {
    const latencyData = performance.latency || {};

    return `
      <div class="analytics-section">
        <h3>📊 Performance Metrics</h3>
        <div class="performance-chart">
          <div class="chart-bar" style="--value: ${latencyData.p50 || 0}">
            <div class="bar-label">P50</div>
            <div class="bar-value">${latencyData.p50 || 0}ms</div>
          </div>
          <div class="chart-bar" style="--value: ${latencyData.p90 || 0}">
            <div class="bar-label">P90</div>
            <div class="bar-value">${latencyData.p90 || 0}ms</div>
          </div>
          <div class="chart-bar" style="--value: ${latencyData.p99 || 0}">
            <div class="bar-label">P99</div>
            <div class="bar-value">${latencyData.p99 || 0}ms</div>
          </div>
        </div>
      </div>
    `;
  }

  formatSystemActions() {
    return `
      <div class="system-actions">
        <h3>🛠️ System Actions</h3>
        <div class="action-buttons">
          <button class="action-btn primary" onclick="workbench.clearCache()">
            🗑️ Clear Cache
          </button>
          <button class="action-btn secondary" onclick="workbench.optimizeMemory()">
            🔧 Optimize Memory
          </button>
          <button class="action-btn info" onclick="workbench.exportDiagnostics()">
            📋 Export Diagnostics
          </button>
          <button class="action-btn warning" onclick="workbench.restartServices()">
            🔄 Restart Services
          </button>
        </div>
      </div>
    `;
  }
}
