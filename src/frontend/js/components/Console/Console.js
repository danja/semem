import log from 'loglevel';
import './styles/console.css';

// Log levels for the dropdown
const LOG_LEVELS = [
  { value: 'trace', label: 'Trace' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'silent', label: 'Silent' },
];

class Console {
  constructor(options = {}) {
    this.options = {
      initialLogLevel: 'debug',
      maxLogs: 1000,
      ...options
    };
    
    this.logs = [];
    this.isOpen = false;
    this.searchTerm = '';
    this.logLevel = this.options.initialLogLevel;
    this.isPaused = false;
    this.autoScroll = true;
    
    this.init();
  }
  
  init() {
    this.createDOM();
    this.bindEvents();
    this.overrideConsoleMethods();
    this.log('Console initialized', 'info');
  }
  
  createDOM() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'console-container';
    this.container.innerHTML = `
      <button class="console-toggle" title="Toggle Console">Console</button>
      <div class="console-header">
        <div class="console-title">Developer Console</div>
        <div class="console-controls">
          <select class="log-level-filter">
            ${LOG_LEVELS.map(level => 
              `<option value="${level.value}" ${level.value === this.logLevel ? 'selected' : ''}>
                ${level.label}
              </option>`
            ).join('')}
          </select>
          <button class="pause-logs" title="Pause/Resume">⏸️</button>
          <button class="clear-logs" title="Clear">🗑️</button>
          <button class="copy-logs" title="Copy to Clipboard">⎘</button>
        </div>
      </div>
      <div class="console-search">
        <input type="text" placeholder="Filter logs..." class="search-input">
      </div>
      <div class="console-content"></div>
    `;
    
    document.body.appendChild(this.container);
    
    // Cache DOM elements
    this.contentEl = this.container.querySelector('.console-content');
    this.searchInput = this.container.querySelector('.search-input');
    this.logLevelSelect = this.container.querySelector('.log-level-filter');
    this.toggleButton = this.container.querySelector('.console-toggle');
  }
  
  bindEvents() {
    // Toggle console
    this.toggleButton.addEventListener('click', () => this.toggle());
    
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderLogs();
    });
    
    // Log level filter
    this.logLevelSelect.addEventListener('change', (e) => {
      this.logLevel = e.target.value;
      this.renderLogs();
    });
    
    // Control buttons
    this.container.querySelector('.pause-logs').addEventListener('click', () => this.togglePause());
    this.container.querySelector('.clear-logs').addEventListener('click', () => this.clearLogs());
    this.container.querySelector('.copy-logs').addEventListener('click', () => this.copyLogs());
    
    // Auto-scroll
    this.contentEl.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.contentEl;
      this.autoScroll = scrollTop + clientHeight >= scrollHeight - 10;
    });
  }
  
  // Toggle console visibility
  toggle() {
    this.isOpen = !this.isOpen;
    this.container.classList.toggle('open');
  }
  
  // Toggle pause state
  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = this.container.querySelector('.pause-logs');
    pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
    pauseBtn.title = this.isPaused ? 'Resume' : 'Pause';
  }
  
  // Clear all logs
  clearLogs() {
    this.logs = [];
    this.renderLogs();
  }
  
  // Copy logs to clipboard
  copyLogs() {
    const text = this.logs
      .filter(log => this.shouldShowLog(log))
      .map(log => `[${log.timestamp}] [${log.level}] ${log.message}`)
      .join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      this.log('Logs copied to clipboard', 'info');
    }).catch(err => {
      this.log(`Failed to copy logs: ${err.message}`, 'error');
    });
  }
  
  // Add a log entry
  log(message, level = 'info', data = null) {
    if (this.isPaused) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = { message, level, timestamp, data };
    
    this.logs.push(logEntry);
    
    // Keep logs within max limit
    if (this.logs.length > this.options.maxLogs) {
      this.logs.shift();
    }
    
    this.renderLogs();
  }
  
  // Render logs to the DOM
  renderLogs() {
    if (!this.contentEl) return;
    
    const filteredLogs = this.logs.filter(log => this.shouldShowLog(log));
    
    this.contentEl.innerHTML = filteredLogs
      .map(log => this.createLogElement(log))
      .join('');
    
    // Auto-scroll to bottom if enabled
    if (this.autoScroll) {
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }
  
  // Create a log entry element
  createLogElement(log) {
    const time = new Date(log.timestamp).toLocaleTimeString();
    return `
      <div class="log-entry ${log.level}">
        <span class="log-timestamp">[${time}]</span>
        <span class="log-level-badge log-level-${log.level}">${log.level.toUpperCase()}</span>
        <span class="log-message">${this.highlightSearchTerm(log.message)}</span>
        ${log.data ? `<pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
      </div>
    `;
  }
  
  // Check if a log should be shown based on filters
  shouldShowLog(log) {
    // Check log level
    const levelIndex = LOG_LEVELS.findIndex(l => l.value === log.level);
    const minLevelIndex = LOG_LEVELS.findIndex(l => l.value === this.logLevel);
    if (levelIndex < minLevelIndex) return false;
    
    // Check search term
    if (this.searchTerm) {
      const searchIn = `${log.message} ${JSON.stringify(log.data || '')}`.toLowerCase();
      if (!searchIn.includes(this.searchTerm)) return false;
    }
    
    return true;
  }
  
  // Highlight search term in log messages
  highlightSearchTerm(text) {
    if (!this.searchTerm) return this.escapeHtml(text);
    
    const escapedTerm = this.escapeRegex(this.searchTerm);
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark>$1</mark>');
  }
  
  // Escape HTML special characters
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // Escape regex special characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Override console methods
  overrideConsoleMethods() {
    const originalConsole = { ...console };
    
    const logMethods = {
      log: 'info',
      info: 'info',
      warn: 'warn',
      error: 'error',
      debug: 'debug',
      trace: 'trace'
    };
    
    Object.entries(logMethods).forEach(([method, level]) => {
      console[method] = (...args) => {
        // Call original console method
        originalConsole[method](...args);
        
        // Add to our console
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        this.log(message, level, args.length > 1 ? args : null);
      };
    });
  }
}

export default Console;
