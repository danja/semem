/**
 * Configuration management for MCP server
 */
import path from 'path';
import dotenv from 'dotenv';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';

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