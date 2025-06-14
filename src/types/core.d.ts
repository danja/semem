/**
 * TypeScript definitions for Semem core components
 * 
 * This file provides comprehensive type definitions for the main classes
 * and interfaces used throughout the Semem semantic memory system.
 */

import { EventEmitter } from 'events';

// ======================
// CORE CLASS DEFINITIONS
// ======================

/**
 * Configuration options for MemoryManager constructor
 */
export interface MemoryManagerConfig {
  /** LLM provider for chat and embeddings */
  llmProvider: LLMProvider;
  /** Optional separate embedding provider */
  embeddingProvider?: LLMProvider;
  /** Chat model name */
  chatModel?: string;
  /** Embedding model name */
  embeddingModel?: string;
  /** Storage backend */
  storage?: StorageProvider;
  /** Embedding vector dimension */
  dimension?: number;
  /** Context window options */
  contextOptions?: ContextOptions;
  /** Cache configuration */
  cacheOptions?: CacheOptions;
}

/**
 * Main memory management class
 */
export declare class MemoryManager extends EventEmitter {
  /** Chat model name */
  readonly chatModel: string;
  /** Embedding model name */
  readonly embeddingModel: string;
  /** Initialization state */
  readonly initialized: boolean;
  
  /** Core handlers */
  readonly cacheManager: CacheManager;
  readonly embeddingHandler: EmbeddingHandler;
  readonly llmHandler: LLMHandler;
  readonly contextManager: ContextManager;
  readonly memStore: MemoryStore;

  constructor(config: MemoryManagerConfig);

  /**
   * Initialize the memory manager and load history
   */
  init(): Promise<void>;

  /**
   * Add a new interaction to memory
   */
  addInteraction(
    prompt: string,
    response: string,
    embedding?: Vector,
    concepts?: string[]
  ): Promise<void>;

  /**
   * Retrieve semantically similar interactions
   */
  retrieveRelevantInteractions(
    query: string,
    similarityThreshold?: number,
    excludeLastN?: number
  ): Promise<RetrievalResult[]>;

  /**
   * Generate response using LLM with optional memory context
   */
  generateResponse(
    prompt: string,
    contextInteractions?: Interaction[],
    memoryContext?: RetrievalResult[],
    contextWindowSize?: number,
    options?: LLMOptions
  ): Promise<string>;

  /**
   * Generate embedding for text
   */
  generateEmbedding(text: string): Promise<Vector>;

  /**
   * Extract concepts from text using LLM
   */
  extractConcepts(text: string): Promise<string[]>;

  /**
   * Build context from interactions
   */
  buildContext(
    interactions: Interaction[],
    currentPrompt?: string,
    maxTokens?: number
  ): Promise<string>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

/**
 * LLM interaction handler
 */
export declare class LLMHandler {
  readonly llmProvider: LLMProvider;
  readonly chatModel: string;
  readonly temperature: number;

  constructor(llmProvider: LLMProvider, chatModel: string, temperature?: number);

  /**
   * Generate chat response
   */
  generateResponse(
    prompt: string,
    context: string,
    options?: {
      systemPrompt?: string;
      model?: string;
      temperature?: number;
    }
  ): Promise<string>;

  /**
   * Extract semantic concepts from text
   */
  extractConcepts(text: string): Promise<string[]>;

  /**
   * Validate model name
   */
  validateModel(model: string): boolean;
}

/**
 * Embedding generation handler
 */
export declare class EmbeddingHandler {
  readonly llmProvider: LLMProvider;
  readonly model: string;
  readonly dimension: number;
  readonly cacheManager?: CacheManager;

  constructor(
    llmProvider: LLMProvider,
    model: string,
    dimension: number,
    cacheManager?: CacheManager
  );

  /**
   * Generate embedding vector for text
   */
  generateEmbedding(text: string): Promise<Vector>;

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: Vector): boolean;

  /**
   * Calculate cosine similarity between embeddings
   */
  calculateSimilarity(embedding1: Vector, embedding2: Vector): number;
}

/**
 * Context management for conversations
 */
export declare class ContextManager {
  readonly maxTokens: number;
  readonly overlapRatio: number;

  constructor(options: ContextOptions);

  /**
   * Build context string from interactions
   */
  buildContext(
    interactions: Interaction[],
    currentPrompt?: string,
    maxTokens?: number
  ): Promise<string>;

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number;

  /**
   * Create context windows from text
   */
  createWindows(text: string, windowSize: number): ContextWindow[];
}

/**
 * Context window definition
 */
export interface ContextWindow {
  text: string;
  start: number;
  end: number;
  tokenEstimate?: number;
}

/**
 * Cache configuration
 */
export interface CacheOptions {
  maxSize: number;
  ttl: number;
}

/**
 * Cache manager implementation
 */
export declare class CacheManager {
  readonly maxSize: number;
  readonly ttl: number;

  constructor(options: CacheOptions);

  /**
   * Get cached value
   */
  get(key: string): any;

  /**
   * Set cached value
   */
  set(key: string, value: any): void;

  /**
   * Clear cache
   */
  clear(): void;

  /**
   * Clean up cache
   */
  dispose(): void;
}

// ======================
// STORE DEFINITIONS
// ======================

/**
 * Base storage interface
 */
export declare abstract class BaseStore implements StorageProvider {
  abstract loadHistory(): Promise<[Interaction[], Interaction[]]>;
  abstract saveMemoryToHistory(memoryStore: MemoryStore): Promise<void>;
  abstract beginTransaction(): Promise<void>;
  abstract commitTransaction(): Promise<void>;
  abstract rollbackTransaction(): Promise<void>;
  abstract verify(): Promise<boolean>;
  abstract close(): Promise<void>;
}

/**
 * In-memory storage implementation
 */
export declare class InMemoryStore extends BaseStore {
  constructor();
  
  loadHistory(): Promise<[Interaction[], Interaction[]]>;
  saveMemoryToHistory(memoryStore: MemoryStore): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  verify(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * JSON file storage implementation
 */
export declare class JSONStore extends BaseStore {
  readonly filePath: string;

  constructor(filePath: string);
  
  loadHistory(): Promise<[Interaction[], Interaction[]]>;
  saveMemoryToHistory(memoryStore: MemoryStore): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  verify(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * SPARQL endpoint storage implementation
 */
export declare class SPARQLStore extends BaseStore {
  readonly endpoint: string;
  readonly graphName: string;
  readonly username?: string;
  readonly password?: string;

  constructor(config: SPARQLStoreConfig);
  
  loadHistory(): Promise<[Interaction[], Interaction[]]>;
  saveMemoryToHistory(memoryStore: MemoryStore): Promise<void>;
  store(data: StorageData): Promise<void>;
  search(queryEmbedding: Vector, limit?: number, threshold?: number): Promise<SearchResult[]>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  verify(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * SPARQL store configuration
 */
export interface SPARQLStoreConfig {
  endpoint: string;
  graphName: string;
  username?: string;
  password?: string;
  timeout?: number;
}

/**
 * Data structure for SPARQL storage
 */
export interface StorageData {
  id: string;
  prompt: string;
  response: string;
  embedding: Vector;
  concepts: string[];
  metadata?: Record<string, any>;
}

/**
 * Search result from storage
 */
export interface SearchResult {
  id: string;
  prompt: string;
  response: string;
  similarity: number;
  concepts: string[];
  timestamp: number;
  metadata?: Record<string, any>;
}

// ======================
// CONNECTOR DEFINITIONS
// ======================

/**
 * Base client connector
 */
export declare abstract class ClientConnector implements LLMProvider {
  abstract generateEmbedding(model: string, input: string): Promise<Vector>;
  abstract generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  abstract generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
  abstract initialize?(): Promise<void>;
  abstract dispose?(): Promise<void>;
}

/**
 * Ollama connector configuration
 */
export interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Ollama LLM connector
 */
export declare class OllamaConnector extends ClientConnector {
  readonly baseUrl: string;
  readonly timeout: number;

  constructor(config?: OllamaConfig);
  
  generateEmbedding(model: string, input: string): Promise<Vector>;
  generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Claude connector configuration
 */
export interface ClaudeConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Claude LLM connector
 */
export declare class ClaudeConnector extends ClientConnector {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeout: number;

  constructor(config: ClaudeConfig);
  
  generateEmbedding(model: string, input: string): Promise<Vector>;
  generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Mistral connector configuration
 */
export interface MistralConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Mistral LLM connector
 */
export declare class MistralConnector extends ClientConnector {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeout: number;

  constructor(config: MistralConfig);
  
  generateEmbedding(model: string, input: string): Promise<Vector>;
  generateChat(model: string, messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  generateCompletion(model: string, prompt: string, options?: LLMOptions): Promise<string>;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}

// ======================
// CONFIG DEFINITIONS
// ======================

/**
 * Configuration manager
 */
export declare class Config {
  readonly configPath: string;
  readonly initialized: boolean;

  constructor(configPath?: string);

  /**
   * Initialize configuration
   */
  init(): Promise<void>;

  /**
   * Get configuration value
   */
  get(key: string): any;

  /**
   * Set configuration value
   */
  set(key: string, value: any): void;

  /**
   * Get full configuration object
   */
  getConfig(): Record<string, any>;

  /**
   * Validate configuration
   */
  validate(): boolean;
}

// ======================
// UTILITY DEFINITIONS
// ======================

/**
 * Prompt template functions
 */
export declare class PromptTemplates {
  static formatChatPrompt(
    model: string,
    systemPrompt: string,
    context: string,
    query: string
  ): ChatMessage[];

  static formatCompletionPrompt(context: string, query: string): string;

  static formatConceptPrompt(model: string, text: string): string;
}

/**
 * Utility functions
 */
export declare class Utils {
  static generateId(): string;
  static normalizeText(text: string): string;
  static calculateCosineSimilarity(a: Vector, b: Vector): number;
  static estimateTokens(text: string): number;
}

// ======================
// EVENT DEFINITIONS
// ======================

/**
 * Events emitted by MemoryManager
 */
export interface MemoryManagerEvents {
  'initialized': () => void;
  'interaction-added': (interaction: Interaction) => void;
  'memories-retrieved': (results: RetrievalResult[]) => void;
  'response-generated': (response: string) => void;
  'error': (error: Error) => void;
  'disposed': () => void;
}

declare interface MemoryManager {
  on<K extends keyof MemoryManagerEvents>(event: K, listener: MemoryManagerEvents[K]): this;
  emit<K extends keyof MemoryManagerEvents>(event: K, ...args: Parameters<MemoryManagerEvents[K]>): boolean;
}

// ======================
// MODULE EXPORTS
// ======================

export {
  MemoryManager,
  LLMHandler,
  EmbeddingHandler,
  ContextManager,
  CacheManager,
  BaseStore,
  InMemoryStore,
  JSONStore,
  SPARQLStore,
  ClientConnector,
  OllamaConnector,
  ClaudeConnector,
  MistralConnector,
  Config,
  PromptTemplates,
  Utils
};