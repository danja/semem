import './styles/help.css';

class Help {
  constructor(options = {}) {
    console.log('[Help] Creating new Help instance');
    
    this.options = {
      ...options
    };
    
    this.isOpen = false;
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.init();
  }
  
  init() {
    this.createDOM();
    this.bindEvents();
    console.log('[Help] Help panel initialized');
  }
  
  createDOM() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'help-container';
    
    // Set container styles
    Object.assign(this.container.style, {
      position: 'fixed',
      right: '0',
      top: '0',
      height: '100vh',
      width: '40%',
      minWidth: '400px',
      maxWidth: '800px',
      transform: 'translateX(calc(100% - 40px))',
      transition: 'transform 0.3s ease-in-out',
      zIndex: '1000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    });

    // Set up the HTML structure
    this.container.innerHTML = `
      <button class="help-toggle" aria-label="Toggle help">Help</button>
      
      <div class="help-header">
        <div class="help-title">Semem Help</div>
        <div class="help-controls">
          <button class="close-help" title="Close">✕</button>
        </div>
      </div>
      
      <div class="help-content">
        <div class="help-section">
          <h2>🔍 Search Tab</h2>
          <p><strong>Semantic Search</strong> - Find semantically similar content using AI embeddings</p>
          <ul>
            <li><strong>Search Query:</strong> Enter natural language queries to find related content</li>
            <li><strong>Results:</strong> Adjust the number of results returned (5-20)</li>
            <li><strong>Threshold:</strong> Control similarity sensitivity (0.0-1.0, higher = more strict)</li>
            <li><strong>Content Types:</strong> Filter by content type (article, document, etc.)</li>
            <li><strong>Graph Selector:</strong> Choose which RDF graph to search in</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>🧠 Memory Tab</h2>
          <p><strong>Semantic Memory Management</strong> - Store and search conversational interactions</p>
          <div class="help-subsection">
            <h3>Store Memory</h3>
            <ul>
              <li>Store prompt-response pairs with metadata</li>
              <li>Automatically generates embeddings and extracts concepts</li>
              <li>Useful for building a knowledge base of conversations</li>
            </ul>
          </div>
          <div class="help-subsection">
            <h3>Search Memory</h3>
            <ul>
              <li>Find semantically similar past conversations</li>
              <li>Adjustable similarity threshold and result limits</li>
              <li>Search by natural language queries</li>
            </ul>
          </div>
        </div>

        <div class="help-section">
          <h2>📊 Memory Visualization Tab</h2>
          <p><strong>Visual Memory Analysis</strong> - Explore memory relationships through interactive graphs</p>
          <ul>
            <li><strong>Memory Graph:</strong> Interactive network visualization of memory connections</li>
            <li><strong>Timeline:</strong> View memory creation and access patterns over time</li>
            <li><strong>Clusters:</strong> Discover semantic clusters in your memory data</li>
            <li><strong>Advanced Search:</strong> Complex filtering and search capabilities</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>🗺️ VSOM Tab</h2>
          <p><strong>Vector Self-Organizing Map</strong> - Visualize data topology and clustering</p>
          <ul>
            <li><strong>SOM Grid:</strong> 2D map showing data distribution and clustering</li>
            <li><strong>Training:</strong> Train the SOM with your data and monitor progress</li>
            <li><strong>Feature Maps:</strong> Visualize individual feature dimensions</li>
            <li><strong>Clustering:</strong> Analyze entity clustering results</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>💬 Chat Tab</h2>
          <p><strong>AI Conversation</strong> - Interactive chat with various LLM providers</p>
          <ul>
            <li><strong>Provider Selection:</strong> Choose from available LLM providers (Claude, Ollama, etc.)</li>
            <li><strong>Temperature:</strong> Control randomness of responses (0.0-2.0)</li>
            <li><strong>Memory Integration:</strong> Toggle to use stored memories for context</li>
            <li><strong>Streaming:</strong> Real-time response streaming for faster interaction</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>🔧 Other Tabs</h2>
          <div class="help-subsection">
            <h3>Embeddings</h3>
            <p>Generate vector embeddings for any text using the configured embedding model</p>
          </div>
          <div class="help-subsection">
            <h3>Concepts</h3>
            <p>Extract key concepts from text using LLM analysis</p>
          </div>
          <div class="help-subsection">
            <h3>Index</h3>
            <p>Index new content with metadata for semantic search</p>
          </div>
          <div class="help-subsection">
            <h3>Settings</h3>
            <p>Configure storage backends, LLM providers, and system settings</p>
          </div>
          <div class="help-subsection">
            <h3>SPARQL Browser</h3>
            <p>Query and explore RDF data with visual graph interface</p>
          </div>
          <div class="help-subsection">
            <h3>MCP Client</h3>
            <p>Connect to Model Context Protocol servers for extended functionality</p>
          </div>
        </div>

        <div class="help-section">
          <h2>⌨️ Keyboard Shortcuts</h2>
          <ul>
            <li><strong>\` (backtick):</strong> Toggle Developer Console</li>
            <li><strong>? or F1:</strong> Toggle this Help panel</li>
            <li><strong>Esc:</strong> Close open panels</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>💡 Tips</h2>
          <ul>
            <li>Use <strong>semantic search</strong> instead of keyword matching for better results</li>
            <li>Store important conversations in <strong>Memory</strong> for future reference</li>
            <li>Adjust <strong>similarity thresholds</strong> to fine-tune search results</li>
            <li>Use the <strong>graph selector</strong> to search different data sources</li>
            <li>Explore <strong>Memory Visualization</strong> to understand your data patterns</li>
            <li>Try different <strong>LLM providers</strong> for varied conversation styles</li>
          </ul>
        </div>

        <div class="help-section">
          <h2>🚀 Getting Started</h2>
          <ol>
            <li>Configure your <strong>Settings</strong> (storage backend, LLM providers)</li>
            <li>Try a <strong>Search</strong> to see what data is available</li>
            <li>Have a <strong>Chat</strong> conversation and store it in <strong>Memory</strong></li>
            <li>Explore <strong>Memory Visualization</strong> to see relationships</li>
            <li>Use <strong>SPARQL Browser</strong> to query raw RDF data</li>
          </ol>
        </div>

        <div class="help-footer">
          <p><strong>Semem</strong> - Semantic Memory for Intelligent Agents</p>
          <p>Version: Latest | <a href="https://github.com/hyperdata/semem" target="_blank">GitHub</a></p>
        </div>
      </div>
    `;
    
    // Add to document root or body
    const root = document.getElementById('console-root') || document.body;
    root.appendChild(this.container);
  }
  
  bindEvents() {
    // Toggle button
    const toggleBtn = this.container.querySelector('.help-toggle');
    toggleBtn.addEventListener('click', () => this.toggle());
    
    // Close button
    const closeBtn = this.container.querySelector('.close-help');
    closeBtn.addEventListener('click', () => this.close());
    
    // Global keyboard shortcut
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Listen for custom toggle event
    document.addEventListener('toggleHelp', () => this.toggle());
  }
  
  handleKeyDown(e) {
    // F1 or ? key to toggle help
    if (e.key === 'F1' || (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey)) {
      // Only if not typing in an input field
      if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        this.toggle();
      }
    }
    
    // Escape to close
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }
  
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  
  open() {
    if (this.isOpen) return;
    
    this.isOpen = true;
    this.container.style.transform = 'translateX(0)';
    this.container.classList.add('open');
    
    console.log('[Help] Opened');
  }
  
  close() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.container.style.transform = 'translateX(calc(100% - 40px))';
    this.container.classList.remove('open');
    
    console.log('[Help] Closed');
  }
  
  destroy() {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('toggleHelp', this.toggle);
    
    // Remove DOM element
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    console.log('[Help] Destroyed');
  }
}

export default Help;