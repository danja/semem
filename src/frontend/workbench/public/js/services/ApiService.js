import { consoleService } from './ConsoleService.js';

/**
 * API Service for Semantic Memory Workbench
 * Handles communication with API server and MCP server endpoints
 */

export class ApiService {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.apiKey = null;

    // Session management for MCP server
    this.sessionId = null;

    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };

    // Initialize configuration
    this.initConfig();
  }

  /**
   * Initialize API configuration from server
   */
  async initConfig() {
    try {
      const response = await fetch('/config');
      if (response.ok) {
        const config = await response.json();
        this.baseUrl = config.apiUrl || this.baseUrl;
        this.apiKey = config.apiKey;

        // Add API key to default headers
        if (this.apiKey) {
          this.defaultHeaders['X-API-Key'] = this.apiKey;
        }
      }
    } catch (error) {
      console.warn('Failed to load API configuration:', error);
    }
  }

  /**
   * Make HTTP request with error handling and session management
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    // Include session ID in headers if available
    const headers = { ...this.defaultHeaders };
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const config = {
      headers: { ...headers, ...options.headers },
      ...options
    };

    consoleService.info(`🔍 [API REQUEST] Endpoint: ${url}`);
    consoleService.info(`🔍 [API REQUEST] Config:`, config);

    try {
      const response = await fetch(url, config);

      // Extract and store session ID from response for future requests
      const responseSessionId = response.headers.get('mcp-session-id');
      if (responseSessionId && responseSessionId !== this.sessionId) {
        consoleService.info(`🔗 [WORKBENCH] Session ID updated: ${this.sessionId} → ${responseSessionId}`);
        this.sessionId = responseSessionId;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        consoleService.error(`❌ [API ERROR] Endpoint: ${url}`, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      consoleService.success(`✅ [API RESPONSE] Endpoint: ${url}`, result);
      return result;
    } catch (error) {
      consoleService.error(`❌ [API ERROR] Endpoint: ${url}`, error);
      throw error;
    }
  }

  // ===== SIMPLE VERBS API METHODS =====

  /**
   * TELL - Store knowledge and concepts
   * @param {Object} params - Tell parameters
   * @param {string} params.content - Content to store
   * @param {string} params.type - Type: 'concept' | 'interaction' | 'document'
   * @param {boolean} params.lazy - Whether to store without immediate processing
   * @param {Object} params.metadata - Optional metadata
   * @returns {Promise<Object>} Tell result
   */
  async tell({ content, type = 'interaction', lazy = false, metadata = {} }) {
    return this.makeRequest('/tell', {
      method: 'POST',
      body: JSON.stringify({ content, type, lazy, metadata })
    });
  }

  /**
   * UPLOAD DOCUMENT - Upload and process document file
   * @param {Object} params - Upload parameters
   * @param {string} params.fileUrl - Data URL of the file
   * @param {string} params.filename - Original filename
   * @param {string} params.mediaType - MIME type of the file
   * @param {string} params.documentType - Document type (pdf, text, markdown)
   * @param {Object} params.metadata - Additional metadata
   */
  async uploadDocument({ fileUrl, filename, mediaType, documentType, metadata = {} }) {
    return this.makeRequest('/upload-document', {
      method: 'POST',
      body: JSON.stringify({
        fileUrl,
        filename,
        mediaType,
        documentType,
        metadata
      })
    });
  }

  /**
   * ASK - Query stored knowledge
   * @param {Object} params - Ask parameters
   * @param {string} params.question - Question to ask
   * @param {string} params.mode - Mode: 'basic' | 'standard' | 'comprehensive'
   * @param {boolean} params.useContext - Whether to use context
   * @param {boolean} params.useHyDE - Whether to use HyDE enhancement
   * @param {boolean} params.useWikipedia - Whether to use Wikipedia enhancement
   * @param {boolean} params.useWikidata - Whether to use Wikidata enhancement
   * @param {boolean} params.useWebSearch - Whether to use Web Search enhancement
   * @returns {Promise<Object>} Ask result with answer and related content
   */
  async ask({ question, mode = 'standard', useContext = true, useHyDE = false, useWikipedia = false, useWikidata = false, useWebSearch = false, threshold }) {
    return this.makeRequest('/ask', {
      method: 'POST',
      body: JSON.stringify({ 
        question, 
        mode, 
        useContext,
        useHyDE,
        useWikipedia,
        useWikidata,
        useWebSearch,
        threshold
      })
    });
  }

  /**
   * CHAT - Interactive chat with slash command support and LLM inference
   * @param {Object} params - Chat parameters
   * @param {string} params.message - User message or command
   * @param {Object} params.context - Optional conversation context
   * @returns {Promise<Object>} Chat result with response content and routing information
   */
  async chat({ message, context = {} }) {
    return this.makeRequest('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context })
    });
  }

  /**
   * ENHANCED CHAT - Enhanced query with HyDE, Wikipedia, and Wikidata
   * @param {Object} params - Enhanced chat parameters
   * @param {string} params.query - Query to search with enhancements
   * @param {boolean} params.useHyDE - Whether to use HyDE enhancement
   * @param {boolean} params.useWikipedia - Whether to use Wikipedia enhancement
   * @param {boolean} params.useWikidata - Whether to use Wikidata enhancement
   * @returns {Promise<Object>} Enhanced chat result
   */
  async enhancedChat({ query, useHyDE = false, useWikipedia = false, useWikidata = false }) {
    return this.makeRequest('/chat/enhanced', {
      method: 'POST',
      body: JSON.stringify({ query, useHyDE, useWikipedia, useWikidata })
    });
  }

  /**
   * AUGMENT - Run operations on content
   * @param {Object} params - Augment parameters
   * @param {string} params.target - Target content to analyze
   * @param {string} params.operation - Operation: 'auto' | 'concepts' | 'attributes' | 'relationships'
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Augment result with extracted concepts/attributes
   */
  async augment({ target, operation = 'auto', options = {} }) {
    return this.makeRequest('/augment', {
      method: 'POST',
      body: JSON.stringify({ target, operation, options })
    });
  }

  /**
   * ZOOM - Set abstraction level for navigation
   * @param {Object} params - Zoom parameters
   * @param {string} params.level - Abstraction level: 'entity' | 'unit' | 'text' | 'community' | 'corpus'
   * @param {string} params.query - Optional query to update
   * @returns {Promise<Object>} Zoom result with updated state
   */
  async zoom({ level = 'entity', query }) {
    return this.makeRequest('/zoom', {
      method: 'POST',
      body: JSON.stringify({ level, query })
    });
  }

  /**
   * PAN - Set domain filters for navigation
   * @param {Object} params - Pan parameters
   * @param {string[]} params.domains - Subject domains to filter by
   * @param {string[]} params.keywords - Keywords to filter by
   * @param {string[]} params.entities - Entity names to filter by
   * @param {Object} params.temporal - Temporal filtering parameters
   * @param {string} params.query - Optional query to update
   * @returns {Promise<Object>} Pan result with updated filters
   */
  async pan({ domains, keywords, entities, temporal, query }) {
    const panParams = {};
    if (domains) panParams.domains = Array.isArray(domains) ? domains : domains.split(',').map(s => s.trim());
    if (keywords) panParams.keywords = Array.isArray(keywords) ? keywords : keywords.split(',').map(s => s.trim());
    if (entities) panParams.entities = Array.isArray(entities) ? entities : entities.split(',').map(s => s.trim());
    if (temporal) panParams.temporal = temporal;
    if (query) panParams.query = query;
    
    return this.makeRequest('/pan', {
      method: 'POST',
      body: JSON.stringify(panParams)
    });
  }

  /**
   * TILT - Set view filter/representation style
   * @param {Object} params - Tilt parameters
   * @param {string} params.style - Representation style: 'keywords' | 'embedding' | 'graph' | 'temporal'
   * @param {string} params.query - Optional query to update
   * @returns {Promise<Object>} Tilt result with updated view
   */
  async tilt({ style = 'keywords', query }) {
    return this.makeRequest('/tilt', {
      method: 'POST',
      body: JSON.stringify({ style, query })
    });
  }

  // ===== STATE AND STATUS METHODS =====

  /**
   * Get current ZPT navigation state
   * @returns {Promise<Object>} Current state object
   */
  async getState() {
    return this.makeRequest('/state', {
      method: 'GET'
    });
  }

  /**
   * Check server health status
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    return this.makeRequest('/health', {
      method: 'GET'
    });
  }

  // ===== INSPECT METHODS =====

  /**
   * INSPECT SESSION - Get session state and cache information
   * @param {boolean} details - Include detailed information
   * @returns {Promise<Object>} Session inspection data
   */
  async inspectSession(details = true) {
    return this.makeRequest('/inspect', {
      method: 'POST',
      body: JSON.stringify({ what: 'session', details })
    });
  }

  /**
   * INSPECT CONCEPTS - Get concepts and embeddings information
   * @param {boolean} details - Include detailed information
   * @returns {Promise<Object>} Concepts inspection data
   */
  async inspectConcepts(details = true) {
    return this.makeRequest('/inspect', {
      method: 'POST',
      body: JSON.stringify({ what: 'concepts', details })
    });
  }

  /**
   * INSPECT ALL DATA - Get complete system state information
   * @param {boolean} details - Include detailed information
   * @returns {Promise<Object>} Complete inspection data
   */
  async inspectAllData(details = true) {
    return this.makeRequest('/inspect', {
      method: 'POST',
      body: JSON.stringify({ what: 'all', details })
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Test connection to API server
   * @returns {Promise<boolean>} True if connected
   */
  async testConnection() {
    try {
      await this.getHealth();
      return true;
    } catch (error) {
      console.warn('API connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get formatted error message from API response
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  getErrorMessage(error) {
    if (error.message) {
      // Extract meaningful error from common patterns
      if (error.message.includes('fetch')) {
        return 'Unable to connect to server. Please check if the service is running.';
      }
      if (error.message.includes('404')) {
        return 'API endpoint not found. Please check server configuration.';
      }
      if (error.message.includes('500')) {
        return 'Server error occurred. Please try again or check server logs.';
      }
      return error.message;
    }
    return 'Unknown error occurred';
  }

  /**
   * Create request options with timeout
   * @param {Object} options - Base options
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Object} Options with timeout
   */
  withTimeout(options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    return {
      ...options,
      signal: controller.signal,
      // Clean up timeout if request completes
      finally: () => clearTimeout(timeoutId)
    };
  }

  // ===== MEMORY MANAGEMENT METHODS =====

  /**
   * REMEMBER - Store content in specific memory domain with importance weighting
   * @param {Object} params - Remember parameters
   * @param {string} params.content - Content to remember
   * @param {string} params.domain - Memory domain: 'user' | 'project' | 'session' | 'instruction'
   * @param {string} params.domainId - Domain identifier (optional)
   * @param {number} params.importance - Importance weighting (0-1)
   * @param {Object} params.metadata - Additional metadata including tags and category
   * @returns {Promise<Object>} Remember result
   */
  async remember({ content, domain = 'user', domainId, importance = 0.5, metadata = {} }) {
    return this.makeRequest('/remember', {
      method: 'POST',
      body: JSON.stringify({ content, domain, domainId, importance, metadata })
    });
  }

  /**
   * FORGET - Fade memory visibility using navigation rather than deletion
   * @param {Object} params - Forget parameters
   * @param {string} params.target - Target memory identifier or domain
   * @param {string} params.strategy - Forgetting strategy: 'fade' | 'context_switch' | 'temporal_decay'
   * @param {number} params.fadeFactor - Fade factor for visibility reduction (0-1)
   * @returns {Promise<Object>} Forget result
   */
  async forget({ target, strategy = 'fade', fadeFactor = 0.1 }) {
    return this.makeRequest('/forget', {
      method: 'POST',
      body: JSON.stringify({ target, strategy, fadeFactor })
    });
  }

  /**
   * RECALL - Retrieve memories based on query and domain filters with relevance scoring
   * @param {Object} params - Recall parameters
   * @param {string} params.query - Search query for memories
   * @param {Array<string>} params.domains - Domain filters
   * @param {Object} params.timeRange - Temporal filters {start, end}
   * @param {number} params.relevanceThreshold - Minimum relevance score (0-1)
   * @param {number} params.maxResults - Maximum results to return (1-100)
   * @returns {Promise<Object>} Recall result with memories
   */
  async recall({ query, domains, timeRange, relevanceThreshold = 0.1, maxResults = 10 }) {
    return this.makeRequest('/recall', {
      method: 'POST',
      body: JSON.stringify({ query, domains, timeRange, relevanceThreshold, maxResults })
    });
  }

  /**
   * PROJECT_CONTEXT - Manage project-specific memory domains
   * @param {Object} params - Project context parameters
   * @param {string} params.projectId - Project identifier
   * @param {string} params.action - Project action: 'create' | 'switch' | 'list' | 'archive'
   * @param {Object} params.metadata - Project metadata including name, description, and technologies
   * @returns {Promise<Object>} Project context result
   */
  async project_context({ projectId, action = 'switch', metadata = {} }) {
    return this.makeRequest('/project_context', {
      method: 'POST',
      body: JSON.stringify({ projectId, action, metadata })
    });
  }

  /**
   * FADE_MEMORY - Gradually reduce memory visibility for smooth context transitions
   * @param {Object} params - Fade memory parameters
   * @param {string} params.domain - Domain to fade
   * @param {number} params.fadeFactor - Fade factor (0-1)
   * @param {string} params.transition - Transition type: 'smooth' | 'immediate'
   * @param {boolean} params.preserveInstructions - Whether to preserve instruction memories
   * @returns {Promise<Object>} Fade memory result
   */
  async fade_memory({ domain, fadeFactor = 0.1, transition = 'smooth', preserveInstructions = true }) {
    return this.makeRequest('/fade_memory', {
      method: 'POST',
      body: JSON.stringify({ domain, fadeFactor, transition, preserveInstructions })
    });
  }

  // ===== ZPT NAVIGATION METHODS =====
  
  /**
   * ZPT NAVIGATE - Execute navigation with zoom/pan/tilt parameters
   * @param {Object} params - Navigation parameters
   * @param {string} params.query - Navigation query
   * @param {string} params.zoom - Zoom level (entity, unit, text, community, corpus)
   * @param {Object} params.pan - Pan filters {domains, keywords}
   * @param {string} params.tilt - Tilt style (keywords, embedding, graph, temporal)
   * @returns {Promise<Object>} Navigation results
   */
  async zptNavigate({ query, zoom = 'entity', pan = {}, tilt = 'keywords' }) {
    return this.makeRequest('/zpt/navigate', {
      method: 'POST',
      body: JSON.stringify({
        query,
        zoom,
        pan,
        tilt
      })
    });
  }

  /**
   * Batch multiple API calls
   * @param {Array} requests - Array of {method, params} objects
   * @returns {Promise<Array>} Array of results
   */
  async batch(requests) {
    const promises = requests.map(({ method, params }) => {
      if (typeof this[method] === 'function') {
        return this[method](params).catch(error => ({ error: error.message }));
      }
      return Promise.resolve({ error: `Unknown method: ${method}` });
    });
    
    return Promise.all(promises);
  }
}

// Create and export singleton instance
export const apiService = new ApiService();

// Export class for testing or custom instances
export default ApiService;