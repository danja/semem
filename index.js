/**
 * Semem - Semantic Memory System
 * Main entry point for the npm package
 * 
 * This file exports all public APIs and components for external use.
 */

// Core Components
export { default as MemoryManager } from './src/MemoryManager.js';
export { default as Config } from './src/Config.js';
export { default as ContextManager } from './src/ContextManager.js';
export { default as ContextWindowManager } from './src/ContextWindowManager.js';
export { default as PromptTemplates } from './src/PromptTemplates.js';

// Handlers
export { default as LLMHandler } from './src/handlers/LLMHandler.js';
export { default as EmbeddingHandler } from './src/handlers/EmbeddingHandler.js';
export { default as CacheManager } from './src/handlers/CacheManager.js';

// Storage Providers - Enhanced SPARQLStore is the preferred implementation
export { default as BaseStore } from './src/stores/BaseStore.js';
export { default as SPARQLStore } from './src/stores/SPARQLStore.js';
export { default as CachedSPARQLStore } from './src/stores/CachedSPARQLStore.js';
// Legacy stores removed: InMemoryStore, JSONStore, MemoryStore - use SPARQLStore instead

// LLM Connectors
export { default as ClientConnector } from './src/connectors/ClientConnector.js';
export { default as OllamaConnector } from './src/connectors/OllamaConnector.js';
export { default as ClaudeConnector } from './src/connectors/ClaudeConnector.js';
export { default as MistralConnector } from './src/connectors/MistralConnector.js';

// Additional components are available via barrel imports:
// import { Entity, decomposeCorpus } from 'semem/ragno';
// import { CorpuscleSelector } from 'semem/zpt';

// Utilities
export * as Utils from './src/Utils.js';

// API Components available via separate imports when needed

// MCP (Model Context Protocol) Integration
export * as MCP from './src/mcp/index.js';

// Note: Type definitions are available in ./dist/types/index.d.ts for TypeScript users
