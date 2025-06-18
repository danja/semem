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
    console.log('[Console] Creating new Console instance', new Error().stack);
    
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
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.init();
    
    // Add instance to window for debugging
    if (!window.consoleInstances) {
      window.consoleInstances = [];
    }
    window.consoleInstances.push(this);
    console.log(`[Console] Total instances: ${window.consoleInstances.length}`);
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
    
    // Set container styles
    Object.assign(this.container.style, {
      position: 'fixed',
      right: '0',
      top: '0',
      height: '100vh',
      width: '30%',
      minWidth: '300px',
      maxWidth: '600px',
      backgroundColor: '#1e1e1e',
      color: '#e0e0e0',
      boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.3)',
      transform: 'translateX(calc(100% - 40px))',
      transition: 'transform 0.3s ease-in-out',
      zIndex: '1000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Fira Code, monospace',
      fontSize: '13px',
      lineHeight: '1.5',
      overflow: 'hidden'
    });

    // Set up the HTML structure
    this.container.innerHTML = `
      <button class="console-toggle" aria-label="Toggle console" style="
        position: absolute;
        left: -40px;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 80px;
        background: #2a2a2a;
        border: none;
        color: #e0e0e0;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 4px 0 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        padding: 12px 0;
        transition: all 0.2s ease;
        user-select: none;
        letter-spacing: 0.5px;
      ">Console</button>
      
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
    
    // Add to body
    document.body.appendChild(this.container);
    
    // Cache DOM elements
    this.contentEl = this.container.querySelector('.console-content');
    this.searchInput = this.container.querySelector('.search-input');
    this.logLevelSelect = this.container.querySelector('.log-level-filter');
    this.toggleButton = this.container.querySelector('.console-toggle');
    
    // Ensure body has proper styles
    Object.assign(document.body.style, {
      margin: '0',
      padding: '0',
      overflowX: 'hidden',
      minHeight: '100vh',
      position: 'relative'
    });
  }
  
  bindEvents() {
    // Toggle console
    this.toggleButton.addEventListener('click', () => this.toggle());
    
    // Listen for toggle events from AppMenu
    this.handleToggleEvent = () => this.toggle();
    document.addEventListener('toggleConsole', this.handleToggleEvent);
    
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
    
    // Add keyboard event listener
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  // Handle keyboard events
  handleKeyDown(e) {
    // Close console with Escape key when open
    if (e.key === 'Escape' && this.isOpen) {
      this.toggle(false);
    }
    // Toggle console with backtick (`) key
    else if (e.key === '`' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      this.toggle();
    }
  }
  
  // Toggle console visibility
  toggle(forceState) {
    // If forceState is provided, use it, otherwise toggle
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    
    // Update transform based on state
    if (this.isOpen) {
      this.container.style.transform = 'translateX(0)';
      this.container.classList.add('open');
      document.body.classList.add('console-open');
      document.body.style.overflow = 'hidden';
    } else {
      this.container.style.transform = 'translateX(calc(100% - 40px))';
      this.container.classList.remove('open');
      document.body.classList.remove('console-open');
      document.body.style.overflow = '';
    }
    
    // Update toggle button text and title
    if (this.toggleButton) {
      this.toggleButton.textContent = this.isOpen ? '×' : 'Console';
      this.toggleButton.title = this.isOpen ? 'Close Console (Esc)' : 'Open Console (`` ` ``)';
      this.toggleButton.setAttribute('aria-expanded', this.isOpen);
    }
    
    // Auto-scroll if opening
    if (this.isOpen && this.autoScroll) {
      this.scrollToBottom();
    }
    
    return this.isOpen;
  }
  
  // Toggle pause state
  togglePause() {
    this.isPaused = !this.isPaused;
    const pauseBtn = this.container.querySelector('.pause-logs');
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
      pauseBtn.title = this.isPaused ? 'Resume' : 'Pause';
    }
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
      this.log(`Failed to copy logs: ${err}`, 'error');
    });
  }
  
  // Check if log should be shown based on current filters
  shouldShowLog(log) {
    const levelIndex = LOG_LEVELS.findIndex(l => l.value === this.logLevel);
    const logLevelIndex = LOG_LEVELS.findIndex(l => l.value === log.level);
    
    // Check log level
    if (logLevelIndex < levelIndex) {
      return false;
    }
    
    // Check search term
    if (this.searchTerm) {
      const searchIn = `${log.message} ${JSON.stringify(log.data || '')}`.toLowerCase();
      if (!searchIn.includes(this.searchTerm)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Helper function to safely stringify objects with circular references
  safeStringify(obj, space = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    }, space);
  }

  // Render logs to the console
  renderLogs() {
    if (this.isPaused) return;
    
    const visibleLogs = this.logs.filter(log => this.shouldShowLog(log));
    
    this.contentEl.innerHTML = visibleLogs.map(log => {
      let dataString = '';
      if (log.data) {
        try {
          dataString = `<pre class="log-data">${this.safeStringify(log.data)}</pre>`;
        } catch (error) {
          dataString = `<pre class="log-data error">[Error stringifying data: ${error.message}]</pre>`;
        }
      }
      
      return `
        <div class="log-entry log-${log.level}">
          <span class="log-timestamp">[${log.timestamp}]</span>
          <span class="log-level">[${log.level.toUpperCase()}]</span>
          <span class="log-message">${log.message}</span>
          ${dataString}
        </div>
      `;
    }).join('');
    
    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }
  
  // Scroll to bottom of console
  scrollToBottom() {
    if (this.contentEl) {
      this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
  }
  
  // Add a log entry
  log(message, level = 'info', data = null) {
    const timestamp = new Date().toISOString().substr(11, 12);
    const logEntry = { message, level, timestamp, data };
    
    this.logs.push(logEntry);
    
    // Limit number of logs
    if (this.logs.length > this.options.maxLogs) {
      this.logs.shift();
    }
    
    // Render if not paused
    if (!this.isPaused) {
      this.renderLogs();
    }
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
        
        // Format message and data
        let message = '';
        const data = [];
        
        args.forEach(arg => {
          if (typeof arg === 'object' && arg !== null && !(arg instanceof Error)) {
            data.push(arg);
          } else if (arg instanceof Error) {
            message += `${arg.message}\n${arg.stack || ''}`;
          } else {
            message += String(arg) + ' ';
          }
        });
        
        // Add to our console
        this.log(message.trim(), level, data.length ? data : null);
      };
    });
  }
  
  // Clean up event listeners
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('toggleConsole', this.handleToggleEvent);
    
    // Clean up DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Restore original console methods if they were overridden
    if (this.originalConsole) {
      Object.assign(console, this.originalConsole);
    }
  }
}

export default Console;
