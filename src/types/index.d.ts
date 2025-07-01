/**
 * Main type definitions index for Semem Flow Components
 * 
 * This file provides a central export point for all type definitions
 * used throughout the Flow Requirements refactoring components.
 */

// Re-export all workflow types
export * from './workflow.js';

// Re-export all feedback types  
export * from './feedback.js';

// Re-export all wikidata types
export * from './wikidata.js';

// Common utility types used across components

/**
 * Standard API result pattern used by all components
 */
export interface StandardResult<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The operation result data */
  data?: T;
  /** Error message if operation failed */
  error?: string;
  /** Operation metadata */
  metadata?: StandardMetadata;
}

/**
 * Standard metadata pattern used by all components
 */
export interface StandardMetadata {
  /** Operation duration in milliseconds */
  duration: number;
  /** Operation start timestamp */
  startTime: string;
  /** Operation end timestamp */
  endTime: string;
  /** Component type that performed the operation */
  componentType: string;
  /** Additional metadata */
  [key: string]: any;
}

/**
 * Configuration object used across all components
 */
export interface FlowConfig {
  /** BeerQA knowledge graph URI */
  beerqaGraphURI: string;
  /** Wikipedia knowledge graph URI */
  wikipediaGraphURI: string;
  /** Wikidata knowledge graph URI */
  wikidataGraphURI: string;
  /** SPARQL endpoint configuration */
  sparqlEndpoint?: string;
  /** SPARQL update endpoint configuration */
  sparqlUpdateEndpoint?: string;
  /** SPARQL authentication */
  sparqlAuth?: {
    user: string;
    password: string;
  };
  /** Additional configuration options */
  [key: string]: any;
}

/**
 * Question object used throughout the system
 */
export interface FlowQuestion {
  /** The question text */
  text: string;
  /** Optional URI identifier for the question */
  uri?: string;
  /** Optional question metadata */
  metadata?: Record<string, any>;
}

/**
 * Standard resource dependencies for components
 */
export interface FlowResources {
  /** LLM handler for text generation and analysis */
  llmHandler: FlowLLMHandler;
  /** SPARQL helper for database operations */
  sparqlHelper: FlowSPARQLHelper;
  /** Configuration object */
  config: FlowConfig;
  /** Optional embedding handler */
  embeddingHandler?: FlowEmbeddingHandler;
  /** Additional resources */
  [key: string]: any;
}

/**
 * Simplified LLM handler interface
 */
export interface FlowLLMHandler {
  /** Generate a response to a prompt */
  generateResponse(prompt: string, context?: string, options?: any): Promise<string>;
  /** Extract concepts from text */
  extractConcepts(text: string): Promise<string[]>;
  /** Additional LLM operations */
  [key: string]: any;
}

/**
 * Simplified SPARQL helper interface
 */
export interface FlowSPARQLHelper {
  /** Execute a SPARQL SELECT query */
  executeSelect(query: string): Promise<{ success: boolean; data?: any; error?: string }>;
  /** Execute a SPARQL UPDATE query */
  executeUpdate(query: string): Promise<{ success: boolean; error?: string }>;
  /** Additional SPARQL operations */
  [key: string]: any;
}

/**
 * Simplified embedding handler interface
 */
export interface FlowEmbeddingHandler {
  /** Generate embedding vector for text */
  generateEmbedding(text: string): Promise<number[]>;
  /** Calculate similarity between embeddings */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
  /** Additional embedding operations */
  [key: string]: any;
}

/**
 * Entity representation used across components
 */
export interface FlowEntity {
  /** Entity URI */
  uri: string;
  /** Entity label */
  label: string;
  /** Entity description */
  description?: string;
  /** Entity type */
  type?: string;
  /** Entity content */
  content?: string;
  /** Entity metadata */
  metadata?: Record<string, any>;
  /** Additional entity properties */
  [key: string]: any;
}

/**
 * Relationship representation used across components
 */
export interface FlowRelationship {
  /** Relationship URI */
  uri: string;
  /** Source entity URI */
  sourceEntity: string;
  /** Target entity URI */
  targetEntity: string;
  /** Relationship type */
  relationshipType: string;
  /** Relationship weight or strength */
  weight: number;
  /** Relationship metadata */
  metadata?: Record<string, any>;
}

/**
 * Performance metrics used for tracking component performance
 */
export interface FlowPerformanceMetrics {
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** Number of API calls made */
  apiCalls?: number;
  /** Number of database operations */
  databaseOperations?: number;
  /** Cache hit rate */
  cacheHitRate?: number;
  /** Additional performance data */
  [key: string]: any;
}

/**
 * Error information used across components
 */
export interface FlowError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: any;
  /** Error stack trace */
  stack?: string;
  /** Component that generated the error */
  component?: string;
  /** Error timestamp */
  timestamp: string;
}