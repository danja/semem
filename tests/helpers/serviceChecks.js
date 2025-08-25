/**
 * Service availability checks for external dependencies
 */
import Config from '../../src/Config.js';

export class ServiceChecker {
  static async checkSPARQLStore(config) {
    try {
      const sparqlEndpoints = config.get('sparqlEndpoints') || [];
      if (sparqlEndpoints.length === 0) {
        return { available: false, reason: 'No SPARQL endpoints configured' };
      }
      
      const endpoint = sparqlEndpoints[0];
      const queryUrl = `${endpoint.urlBase}${endpoint.query}`;
      
      const response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/json'
        },
        body: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1'
      });
      
      return { available: response.ok, reason: response.ok ? 'Available' : `HTTP ${response.status}` };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  static async checkLLMProvider(config) {
    try {
      const llmProviders = config.get('llmProviders') || [];
      const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));
      
      if (chatProviders.length === 0) {
        return { available: false, reason: 'No chat providers configured' };
      }
      
      // Check if any provider has required API keys
      const hasApiKey = chatProviders.some(provider => {
        const requiredKeys = {
          'mistral': 'MISTRAL_API_KEY',
          'claude': 'ANTHROPIC_API_KEY',
          'openai': 'OPENAI_API_KEY'
        };
        
        const keyName = requiredKeys[provider.type];
        return !keyName || process.env[keyName];
      });
      
      return { 
        available: hasApiKey, 
        reason: hasApiKey ? 'Provider with API key available' : 'No API keys available' 
      };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  static async checkEmbeddingProvider(config) {
    try {
      const llmProviders = config.get('llmProviders') || [];
      const embeddingProviders = llmProviders.filter(p => p.capabilities?.includes('embedding'));
      
      if (embeddingProviders.length === 0) {
        return { available: false, reason: 'No embedding providers configured' };
      }
      
      // Ollama is usually available locally, others need API keys
      const hasProvider = embeddingProviders.some(provider => {
        if (provider.type === 'ollama') return true;
        
        const requiredKeys = {
          'openai': 'OPENAI_API_KEY',
          'cohere': 'COHERE_API_KEY'
        };
        
        const keyName = requiredKeys[provider.type];
        return keyName && process.env[keyName];
      });
      
      return { 
        available: hasProvider, 
        reason: hasProvider ? 'Embedding provider available' : 'No embedding providers available' 
      };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  static async checkWikipedia() {
    try {
      const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Test', {
        method: 'GET',
        timeout: 5000
      });
      return { available: response.ok, reason: response.ok ? 'Available' : `HTTP ${response.status}` };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  static async checkWikidata() {
    try {
      const response = await fetch('https://query.wikidata.org/sparql?query=SELECT%20*%20WHERE%20%7B%7D%20LIMIT%201', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });
      return { available: response.ok, reason: response.ok ? 'Available' : `HTTP ${response.status}` };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  static async checkAllServices(configPath = 'config/config.json') {
    const config = new Config(configPath);
    await config.init();
    
    const results = {
      sparql: await this.checkSPARQLStore(config),
      llm: await this.checkLLMProvider(config),
      embedding: await this.checkEmbeddingProvider(config),
      wikipedia: await this.checkWikipedia(),
      wikidata: await this.checkWikidata()
    };
    
    return results;
  }
}

export default ServiceChecker;