import log from 'loglevel';

/**
 * Service for interacting with the VSOM API
 * Handles all VSOM-related API calls and data transformation
 */
export class VSOMService {
  constructor(options = {}) {
    this.logger = log.getLogger('vsom:service');
    this.defaultOptions = {
      baseUrl: '/api/vsom',
      logLevel: 'debug',
      ...options
    };
    
    this.logger.setLevel(this.defaultOptions.logLevel);
    this.logger.debug('Initializing VSOM service', { options: this.defaultOptions });
    
    // Initialize default headers
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Make an API request
   * @private
   */
  async _request(method, endpoint, data = null) {
    const url = `${this.defaultOptions.baseUrl}${endpoint}`;
    const startTime = performance.now();
    
    const config = {
      method,
      headers: this.headers,
      credentials: 'same-origin',
      ...(data && { body: JSON.stringify(data) })
    };
    
    this.logger.debug(`API ${method} ${endpoint}`, { data });
    
    try {
      const response = await fetch(url, config);
      const responseTime = performance.now() - startTime;
      
      if (!response.ok) {
        const errorData = await this._parseResponse(response);
        const error = new Error(errorData.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        this.logger.error(`API error ${response.status} ${method} ${endpoint}`, {
          status: response.status,
          statusText: response.statusText,
          response: errorData,
          duration: responseTime
        });
        throw error;
      }
      
      const result = await this._parseResponse(response);
      this.logger.debug(`API success ${method} ${endpoint}`, {
        status: response.status,
        duration: responseTime,
        data: result
      });
      
      return result;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.logger.error(`API request failed: ${method} ${endpoint}`, {
        error,
        duration: responseTime
      });
      throw error;
    }
  }

  /**
   * Parse API response
   * @private
   */
  async _parseResponse(response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  // VSOM API Methods

  /**
   * Create a new SOM instance
   * @param {Object} config - SOM configuration
   */
  async createSOM(config) {
    this.logger.debug('Creating new SOM instance', { config });
    return this._request('POST', '/create', config);
  }

  /**
   * Train the SOM with data
   * @param {Array} data - Training data
   * @param {Object} options - Training options
   */
  async train(data, options = {}) {
    this.logger.debug('Training SOM', { dataLength: data.length, options });
    return this._request('POST', '/train', { data, ...options });
  }

  /**
   * Get the current SOM grid state
   * @param {Object} options - Query options
   */
  async getGridState(options = {}) {
    this.logger.debug('Fetching SOM grid state', { options });
    const query = new URLSearchParams(options).toString();
    return this._request('GET', `/grid${query ? `?${query}` : ''}`);
  }

  /**
   * Get feature maps
   * @param {Object} options - Query options
   */
  async getFeatureMaps(options = {}) {
    this.logger.debug('Fetching feature maps', { options });
    const query = new URLSearchParams(options).toString();
    return this._request('GET', `/features${query ? `?${query}` : ''}`);
  }

  /**
   * Perform clustering on the SOM
   * @param {Object} options - Clustering options
   */
  async cluster(options = {}) {
    this.logger.debug('Performing clustering', { options });
    return this._request('POST', '/cluster', options);
  }

  /**
   * Get training status
   */
  async getTrainingStatus() {
    this.logger.debug('Fetching training status');
    return this._request('GET', '/training-status');
  }

  /**
   * Stop ongoing training
   */
  async stopTraining() {
    this.logger.debug('Stopping training');
    return this._request('POST', '/stop-training');
  }
}

// Export a singleton instance
export const vsomService = new VSOMService();
