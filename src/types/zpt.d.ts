/**
 * TypeScript definitions for ZPT (Zero-Point Traversal) components
 * 
 * This file provides comprehensive type definitions for the ZPT system,
 * which handles parameter-based content navigation and transformation.
 */

import { Entity, SemanticUnit, Relationship } from './ragno.js';

// ======================
// CORE ZPT PARAMETERS
// ======================

/**
 * Zoom level parameters - define granularity of content selection
 */
export type ZoomLevel = 'entity' | 'unit' | 'text' | 'community' | 'corpus';

/**
 * Tilt representation parameters - define output format
 */
export type TiltRepresentation = 'keywords' | 'embedding' | 'graph' | 'temporal';

/**
 * Transform format parameters - define final output structure
 */
export type TransformFormat = 'json' | 'markdown' | 'structured' | 'conversational';

/**
 * Chunk strategy for content transformation
 */
export type ChunkStrategy = 'semantic' | 'adaptive' | 'fixed' | 'sliding';

/**
 * Tokenizer types for content processing
 */
export type TokenizerType = 'cl100k_base' | 'gpt2' | 'custom';

/**
 * Zoom parameter configuration
 */
export interface ZoomConfig {
  /** Zoom level */
  level: ZoomLevel;
  /** Processing granularity (1-5) */
  granularity: number;
  /** Target RDF types for selection */
  targetTypes: string[];
}

/**
 * Pan parameter configuration for content filtering
 */
export interface PanConfig {
  /** Topic filter */
  topic?: string;
  /** Entity filters */
  entity?: string[];
  /** Temporal filters */
  temporal?: {
    start?: Date;
    end?: Date;
    period?: string;
  };
  /** Spatial filters */
  spatial?: {
    region?: string;
    coordinates?: [number, number];
    radius?: number;
  };
  /** Custom filters */
  custom?: Record<string, any>;
}

/**
 * Tilt parameter configuration for representation
 */
export interface TiltConfig {
  /** Representation type */
  representation: TiltRepresentation;
  /** Output format */
  outputFormat: string;
  /** Processing type */
  processingType: string;
  /** Additional options */
  options?: Record<string, any>;
}

/**
 * Transform parameter configuration
 */
export interface TransformConfig {
  /** Maximum tokens */
  maxTokens: number;
  /** Output format */
  format: TransformFormat;
  /** Tokenizer to use */
  tokenizer: TokenizerType;
  /** Include metadata */
  includeMetadata: boolean;
  /** Chunk strategy */
  chunkStrategy: ChunkStrategy;
  /** Token budget allocation */
  tokenBudget: {
    content: number;
    metadata: number;
    overhead: number;
  };
  /** Chunk size configuration */
  chunkSize: {
    target: number;
    overlap: number;
  };
}

/**
 * Complete ZPT navigation parameters
 */
export interface ZPTParameters {
  /** Zoom configuration */
  zoom: ZoomConfig;
  /** Pan configuration */
  pan?: PanConfig;
  /** Tilt configuration */
  tilt: TiltConfig;
  /** Transform configuration */
  transform: TransformConfig;
  /** Normalized timestamp */
  normalizedAt?: string;
}

// ======================
// PARAMETER PROCESSING
// ======================

/**
 * Parameter validation result
 */
export interface ValidationResult {
  /** Whether parameters are valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Parameter validation schemas
 */
export interface ValidationSchemas {
  zoom: {
    type: 'enum';
    values: ZoomLevel[];
    required: true;
  };
  pan: {
    type: 'object';
    required: false;
    properties: Record<string, any>;
  };
  tilt: {
    type: 'enum';
    values: TiltRepresentation[];
    required: true;
  };
  transform: {
    type: 'object';
    required: false;
    properties: Record<string, any>;
  };
}

/**
 * Parameter validator
 */
export declare class ParameterValidator {
  readonly schemas: ValidationSchemas;

  constructor();

  /**
   * Validate ZPT parameters
   */
  validate(parameters: Partial<ZPTParameters>): ValidationResult;

  /**
   * Validate individual parameter
   */
  validateParameter(name: string, value: any): ValidationResult;

  /**
   * Initialize validation schemas
   */
  private initializeSchemas(): ValidationSchemas;
}

/**
 * Parameter normalizer
 */
export declare class ParameterNormalizer {
  constructor();

  /**
   * Normalize parameters to standard format
   */
  normalize(parameters: Partial<ZPTParameters>): ZPTParameters;

  /**
   * Normalize zoom parameters
   */
  normalizeZoom(zoom: string | ZoomConfig): ZoomConfig;

  /**
   * Normalize pan parameters
   */
  normalizePan(pan?: Partial<PanConfig>): PanConfig;

  /**
   * Normalize tilt parameters
   */
  normalizeTilt(tilt: string | TiltConfig): TiltConfig;

  /**
   * Normalize transform parameters
   */
  normalizeTransform(transform?: Partial<TransformConfig>): TransformConfig;
}

// ======================
// CORPUSCLE SELECTION
// ======================

/**
 * Corpuscle represents a selectable content unit
 */
export interface Corpuscle {
  /** Unique identifier */
  id: string;
  /** Corpuscle type */
  type: 'entity' | 'unit' | 'text' | 'community' | 'corpus';
  /** Content or reference */
  content?: string;
  /** Selection score */
  score: number;
  /** Associated metadata */
  metadata?: Record<string, any>;
  /** Source entity (if applicable) */
  entity?: Entity;
  /** Source unit (if applicable) */
  unit?: SemanticUnit;
}

/**
 * Selection criteria for corpuscle filtering
 */
export interface SelectionCriteria {
  /** Type filters */
  types?: string[];
  /** Score threshold */
  minScore?: number;
  /** Entity filters */
  entityFilters?: {
    names?: string[];
    types?: string[];
    relevanceMin?: number;
  };
  /** Temporal filters */
  temporalFilters?: {
    start?: Date;
    end?: Date;
  };
  /** Custom filters */
  customFilters?: Array<(corpuscle: Corpuscle) => boolean>;
}

/**
 * Filter builder for selection criteria
 */
export declare class FilterBuilder {
  constructor(options?: Record<string, any>);

  /**
   * Build filters from pan parameters
   */
  buildFromPan(pan: PanConfig): SelectionCriteria;

  /**
   * Build entity filters
   */
  buildEntityFilters(entityConfig: string[]): SelectionCriteria['entityFilters'];

  /**
   * Build temporal filters
   */
  buildTemporalFilters(temporalConfig: PanConfig['temporal']): SelectionCriteria['temporalFilters'];

  /**
   * Build spatial filters
   */
  buildSpatialFilters(spatialConfig: PanConfig['spatial']): Array<(corpuscle: Corpuscle) => boolean>;
}

/**
 * Selection criteria builder
 */
export declare class SelectionCriteria {
  constructor(options?: Record<string, any>);

  /**
   * Build selection criteria from parameters
   */
  build(parameters: ZPTParameters): SelectionCriteria;

  /**
   * Apply criteria to corpuscles
   */
  apply(corpuscles: Corpuscle[], criteria: SelectionCriteria): Corpuscle[];
}

/**
 * Main corpuscle selector
 */
export declare class CorpuscleSelector {
  readonly corpus: any; // Ragno corpus
  readonly sparqlStore?: any;
  readonly embeddingHandler?: any;
  readonly config: {
    maxResults: number;
    timeoutMs: number;
    enableCaching: boolean;
    debugMode: boolean;
  };

  constructor(ragnoCorpus: any, options?: {
    sparqlStore?: any;
    embeddingHandler?: any;
    maxResults?: number;
    timeoutMs?: number;
    enableCaching?: boolean;
    debugMode?: boolean;
  });

  /**
   * Select corpuscles based on parameters
   */
  select(parameters: ZPTParameters): Promise<{
    corpuscles: Corpuscle[];
    metadata: {
      selectionTime: number;
      fromCache: boolean;
      complexity: number;
      resultCount: number;
    };
  }>;

  /**
   * Apply zoom-level filtering
   */
  applyZoomFilter(corpuscles: Corpuscle[], zoom: ZoomConfig): Corpuscle[];

  /**
   * Apply pan-level filtering
   */
  applyPanFilter(corpuscles: Corpuscle[], pan: PanConfig): Corpuscle[];
}

// ======================
// CONTENT PROJECTION
// ======================

/**
 * Tilt projection result
 */
export interface ProjectionResult {
  /** Representation type */
  representation: TiltRepresentation;
  /** Projected data */
  projectedData: {
    format: string;
    size: number;
    quality: number;
    data?: any;
  };
  /** Processing metadata */
  metadata: {
    processingTime: number;
    algorithm: string;
    corpuscleCount: number;
  };
}

/**
 * Tilt projector for content representation
 */
export declare class TiltProjector {
  constructor(options?: Record<string, any>);

  /**
   * Project corpuscles to specified representation
   */
  project(corpuscles: Corpuscle[], tilt: TiltConfig): Promise<ProjectionResult>;

  /**
   * Keywords projection
   */
  projectToKeywords(corpuscles: Corpuscle[]): Promise<string[]>;

  /**
   * Embedding projection
   */
  projectToEmbedding(corpuscles: Corpuscle[]): Promise<number[][]>;

  /**
   * Graph projection
   */
  projectToGraph(corpuscles: Corpuscle[]): Promise<{
    nodes: any[];
    edges: any[];
  }>;

  /**
   * Temporal projection
   */
  projectToTemporal(corpuscles: Corpuscle[]): Promise<Array<{
    timestamp: Date;
    event: string;
    entities: string[];
  }>>;
}

/**
 * Domain filter for pan operations
 */
export declare class PanDomainFilter {
  constructor(options?: Record<string, any>);

  /**
   * Apply domain-specific filtering
   */
  filter(corpuscles: Corpuscle[], domain: string): Corpuscle[];

  /**
   * Get available domains
   */
  getAvailableDomains(): string[];
}

/**
 * Zoom level mapper
 */
export declare class ZoomLevelMapper {
  constructor();

  /**
   * Map zoom level to target types
   */
  mapToTargetTypes(zoom: ZoomLevel): string[];

  /**
   * Get granularity for zoom level
   */
  getGranularity(zoom: ZoomLevel): number;

  /**
   * Get processing complexity
   */
  getComplexity(zoom: ZoomLevel): number;
}

// ======================
// CONTENT TRANSFORMATION
// ======================

/**
 * Content chunk
 */
export interface ContentChunk {
  /** Chunk content */
  content: string;
  /** Token count */
  tokenCount: number;
  /** Chunk index */
  index: number;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Transformation result
 */
export interface TransformationResult {
  /** Transformed content */
  content: {
    format: TransformFormat;
    chunks: number;
    totalTokens: number;
    hasMetadata: boolean;
    data?: any;
  };
  /** Processing metadata */
  metadata: {
    output: {
      format: TransformFormat;
      chunked: boolean;
      hasMetadata: boolean;
    };
    processingTime: number;
    tokenizer: TokenizerType;
    chunkStrategy: ChunkStrategy;
  };
}

/**
 * Content chunker for token management
 */
export declare class ContentChunker {
  constructor(options?: {
    tokenizer?: TokenizerType;
    maxTokens?: number;
    overlapRatio?: number;
  });

  /**
   * Chunk content into manageable pieces
   */
  chunk(content: string, strategy: ChunkStrategy): ContentChunk[];

  /**
   * Estimate token count for content
   */
  estimateTokens(content: string): number;

  /**
   * Apply semantic chunking
   */
  semanticChunk(content: string, maxTokens: number): ContentChunk[];

  /**
   * Apply adaptive chunking
   */
  adaptiveChunk(content: string, maxTokens: number): ContentChunk[];

  /**
   * Apply fixed chunking
   */
  fixedChunk(content: string, chunkSize: number): ContentChunk[];
}

/**
 * Corpuscle transformer for output formatting
 */
export declare class CorpuscleTransformer {
  constructor(options?: Record<string, any>);

  /**
   * Transform corpuscles to specified format
   */
  transform(
    corpuscles: Corpuscle[],
    projectionResult: ProjectionResult,
    transform: TransformConfig
  ): Promise<TransformationResult>;

  /**
   * Transform to JSON format
   */
  toJSON(data: any, config: TransformConfig): string;

  /**
   * Transform to Markdown format
   */
  toMarkdown(data: any, config: TransformConfig): string;

  /**
   * Transform to structured format
   */
  toStructured(data: any, config: TransformConfig): any;

  /**
   * Transform to conversational format
   */
  toConversational(data: any, config: TransformConfig): string;
}

/**
 * Token counter utility
 */
export declare class TokenCounter {
  constructor(tokenizer: TokenizerType);

  /**
   * Count tokens in text
   */
  count(text: string): number;

  /**
   * Encode text to tokens
   */
  encode(text: string): number[];

  /**
   * Decode tokens to text
   */
  decode(tokens: number[]): string;

  /**
   * Truncate text to token limit
   */
  truncate(text: string, maxTokens: number): string;
}

/**
 * Metadata encoder for enriched output
 */
export declare class MetadataEncoder {
  constructor(options?: Record<string, any>);

  /**
   * Encode metadata into content
   */
  encode(content: any, metadata: Record<string, any>): any;

  /**
   * Extract metadata from content
   */
  extract(content: any): Record<string, any>;

  /**
   * Merge metadata objects
   */
  merge(...metadatas: Record<string, any>[]): Record<string, any>;
}

/**
 * Prompt formatter for LLM consumption
 */
export declare class PromptFormatter {
  constructor(options?: Record<string, any>);

  /**
   * Format content for LLM prompts
   */
  format(content: any, format: TransformFormat): string;

  /**
   * Add system context
   */
  addSystemContext(content: string, context: Record<string, any>): string;

  /**
   * Add user instructions
   */
  addUserInstructions(content: string, instructions: string): string;
}

// ======================
// API COMPONENTS
// ======================

/**
 * Navigation request
 */
export interface NavigationRequest {
  /** ZPT parameters */
  parameters: Partial<ZPTParameters>;
  /** Request metadata */
  metadata?: {
    requestId?: string;
    timestamp?: Date;
    source?: string;
  };
}

/**
 * Navigation response
 */
export interface NavigationResponse {
  /** Success status */
  success: boolean;
  /** Transformed content */
  content?: any;
  /** Processing metadata */
  metadata: {
    processingTime: number;
    corpuscleCount: number;
    tokenCount: number;
    errors?: string[];
  };
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Navigation endpoint handler
 */
export declare class NavigationEndpoint {
  constructor(
    corpuscleSelector: CorpuscleSelector,
    tiltProjector: TiltProjector,
    corpuscleTransformer: CorpuscleTransformer,
    options?: Record<string, any>
  );

  /**
   * Handle navigation request
   */
  handle(request: NavigationRequest): Promise<NavigationResponse>;

  /**
   * Validate request
   */
  validateRequest(request: NavigationRequest): ValidationResult;
}

/**
 * Request parser for HTTP/API requests
 */
export declare class RequestParser {
  constructor(options?: Record<string, any>);

  /**
   * Parse HTTP request to navigation request
   */
  parse(httpRequest: any): NavigationRequest;

  /**
   * Parse query parameters
   */
  parseQueryParams(params: Record<string, string>): Partial<ZPTParameters>;

  /**
   * Parse request body
   */
  parseBody(body: any): Partial<ZPTParameters>;
}

/**
 * Response formatter for API responses
 */
export declare class ResponseFormatter {
  constructor(options?: Record<string, any>);

  /**
   * Format navigation response
   */
  format(response: NavigationResponse, format: string): any;

  /**
   * Format error response
   */
  formatError(error: Error, requestId?: string): NavigationResponse;
}

/**
 * Error handler for ZPT operations
 */
export declare class ErrorHandler {
  constructor(options?: Record<string, any>);

  /**
   * Handle processing errors
   */
  handle(error: Error, context?: Record<string, any>): NavigationResponse;

  /**
   * Classify error type
   */
  classify(error: Error): 'validation' | 'processing' | 'timeout' | 'system';

  /**
   * Log error with context
   */
  log(error: Error, context?: Record<string, any>): void;
}

// ======================
// MODULE EXPORTS
// ======================

export {
  // Parameters
  ParameterValidator,
  ParameterNormalizer,
  
  // Selection
  CorpuscleSelector,
  FilterBuilder,
  SelectionCriteria,
  
  // Projection
  TiltProjector,
  PanDomainFilter,
  ZoomLevelMapper,
  
  // Transformation
  CorpuscleTransformer,
  ContentChunker,
  TokenCounter,
  MetadataEncoder,
  PromptFormatter,
  
  // API
  NavigationEndpoint,
  RequestParser,
  ResponseFormatter,
  ErrorHandler
};