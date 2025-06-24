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
 * Create LLM connector based on configuration priority from config.json
 */
export async function createLLMConnector(configPath = null) {
  try {
    // Load system configuration to get provider priorities
    const config = new Config(configPath);
    await config.init();
    
    // Get llmProviders with priority ordering
    const llmProviders = config.get('llmProviders') || [];
    
    // Sort by priority (lower number = higher priority)
    const sortedProviders = llmProviders
      .filter(p => p.capabilities?.includes('chat'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    console.log('Available chat providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
    
    // Try providers in priority order
    for (const provider of sortedProviders) {
      console.log(`Trying LLM provider: ${provider.type} (priority: ${provider.priority})`);
      
      if (provider.type === 'mistral' && provider.apiKey) {
        console.log('✅ Creating Mistral connector (highest priority)...');
        return new MistralConnector();
      } else if (provider.type === 'claude' && provider.apiKey) {
        console.log('✅ Creating Claude connector...');
        return new ClaudeConnector();
      } else if (provider.type === 'ollama') {
        console.log('✅ Creating Ollama connector (fallback)...');
        return new OllamaConnector();
      } else {
        console.log(`❌ Provider ${provider.type} not available (missing API key or implementation)`);
      }
    }
    
    console.log('⚠️ No configured providers available, defaulting to Ollama');
    return new OllamaConnector();
    
  } catch (error) {
    console.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
    return new OllamaConnector();
  }
}

/**
 * Create embedding connector using configuration-driven factory pattern
 */
export async function createEmbeddingConnector(configPath = null) {
  try {
    // Load system configuration
    const config = new Config(configPath);
    await config.init();
    
    // Get llmProviders with priority ordering for embeddings
    const llmProviders = config.get('llmProviders') || [];
    
    // Sort by priority (lower number = higher priority)
    const sortedProviders = llmProviders
      .filter(p => p.capabilities?.includes('embedding'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    console.log('Available embedding providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
    
    // Try providers in priority order
    for (const provider of sortedProviders) {
      console.log(`Trying embedding provider: ${provider.type} (priority: ${provider.priority})`);
      
      if (provider.type === 'nomic' && provider.apiKey) {
        console.log('✅ Creating Nomic embedding connector (highest priority)...');
        return EmbeddingConnectorFactory.createConnector({
          provider: 'nomic',
          apiKey: provider.apiKey,
          model: provider.embeddingModel || 'nomic-embed-text-v1.5'
        });
      } else if (provider.type === 'ollama') {
        console.log('✅ Creating Ollama embedding connector (fallback)...');
        const ollamaBaseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
        return EmbeddingConnectorFactory.createConnector({
          provider: 'ollama',
          baseUrl: ollamaBaseUrl,
          model: provider.embeddingModel || 'nomic-embed-text'
        });
      } else {
        console.log(`❌ Embedding provider ${provider.type} not available (missing API key or implementation)`);
      }
    }
    
    console.log('⚠️ No configured embedding providers available, defaulting to Ollama');
    return EmbeddingConnectorFactory.createConnector({
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: 'nomic-embed-text'
    });
    
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
 * Get working model names from configuration
 */
export async function getModelConfig(configPath = null) {
  try {
    const config = new Config(configPath);
    await config.init();
    
    // Get highest priority providers
    const llmProviders = config.get('llmProviders') || [];
    const chatProvider = llmProviders
      .filter(p => p.capabilities?.includes('chat'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
    const embeddingProvider = llmProviders
      .filter(p => p.capabilities?.includes('embedding'))
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
    
    return {
      chatModel: chatProvider?.chatModel || 'qwen2:1.5b',
      embeddingModel: embeddingProvider?.embeddingModel || 'nomic-embed-text'
    };
  } catch (error) {
    console.warn('Failed to get model config from configuration, using defaults:', error.message);
    return {
      chatModel: 'qwen2:1.5b',
      embeddingModel: 'nomic-embed-text'
    };
  }
}

// Maintain backward compatibility - but this will need to be awaited now
export const modelConfig = {
  chatModel: 'qwen2:1.5b',
  embeddingModel: 'nomic-embed-text'
};