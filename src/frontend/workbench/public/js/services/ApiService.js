/**
 * API Service for Semantic Memory Workbench
 * Handles communication with MCP HTTP server endpoints
 */

export class ApiService {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
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
   * @returns {Promise<Object>} Ask result with answer and related content
   */
  async ask({ question, mode = 'standard', useContext = true }) {
    return this.makeRequest('/ask', {
      method: 'POST',
      body: JSON.stringify({ question, mode, useContext })
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