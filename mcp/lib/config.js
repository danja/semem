/**
 * Configuration management for MCP server
 */
import path from 'path';
import dotenv from 'dotenv';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import EmbeddingConnectorFactory from '../../src/connectors/EmbeddingConnectorFactory.js';
import Config from '../../src/Config.js';

// Load environment variables
dotenv.config();

/**
 * Create LLM connector based on available configuration
 * Priority: Ollama (no API key needed) > Claude > Mistral
 */
export function createLLMConnector() {
  if (process.env.OLLAMA_HOST || !process.env.CLAUDE_API_KEY) {
    console.log('Creating Ollama connector (preferred for local development)...');
    return new OllamaConnector();
  } else if (process.env.CLAUDE_API_KEY) {
    console.log('Creating Claude connector...');
    return new ClaudeConnector();
  } else if (process.env.MISTRAL_API_KEY) {
    console.log('Creating Mistral connector...');
    return new MistralConnector();
  } else {
    console.log('Defaulting to Ollama connector...');
    return new OllamaConnector();
  }
}

/**
 * Create embedding connector using configuration-driven factory pattern
 */
export async function createEmbeddingConnector() {
  try {
    // Load system configuration
    const config = new Config();
    await config.init();
    
    // Get embedding provider configuration
    const embeddingProvider = config.get('embeddingProvider') || 'ollama';
    const embeddingModel = config.get('embeddingModel') || 'nomic-embed-text';
    
    console.log(`Creating embedding connector: ${embeddingProvider} (${embeddingModel})`);
    
    // Create embedding connector using factory
    let providerConfig = {};
    if (embeddingProvider === 'nomic') {
      providerConfig = {
        provider: 'nomic',
        apiKey: process.env.NOMIC_API_KEY,
        model: embeddingModel
      };
    } else if (embeddingProvider === 'ollama') {
      const ollamaBaseUrl = config.get('ollama.baseUrl') || process.env.OLLAMA_HOST || 'http://localhost:11434';
      providerConfig = {
        provider: 'ollama',
        baseUrl: ollamaBaseUrl,
        model: embeddingModel
      };
    }
    
    return EmbeddingConnectorFactory.createConnector(providerConfig);
    
  } catch (error) {
    console.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
    // Fallback to Ollama for embeddings
    return EmbeddingConnectorFactory.createConnector({
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: 'nomic-embed-text'
    });
  }
}

/**
 * Get MCP server configuration
 */
export const mcpConfig = {
  name: "Semem Integration Server",
  version: "1.0.0",
  instructions: "Provides access to Semem core, Ragno knowledge graph, and ZPT APIs for semantic memory management and knowledge processing"
};

/**
 * Get working model names
 */
export const modelConfig = {
  chatModel: 'qwen2:1.5b',
  embeddingModel: 'nomic-embed-text'
};