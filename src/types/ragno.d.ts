/**
 * TypeScript definitions for Ragno knowledge graph components
 * 
 * This file provides comprehensive type definitions for the Ragno system,
 * which handles RDF-based knowledge graph creation, entity extraction,
 * and semantic relationship management.
 */

import { Dataset, Quad, NamedNode, Literal, Term } from 'rdf-ext';
import { LLMHandler } from './core.js';

// ======================
// CORE RDF DEFINITIONS
// ======================

/**
 * Base RDF element configuration
 */
export interface RDFElementConfig {
  /** Unique identifier for the element */
  id?: string;
  /** Human-readable label */
  label?: string;
  /** RDF type */
  type?: string;
  /** Additional properties */
  [key: string]: any;
}

/**
 * Base RDF element class
 */
export declare abstract class RDFElement {
  readonly id: string;
  readonly uri: NamedNode;
  readonly type: string;
  readonly dataset: Dataset;
  readonly ns: NamespaceManager;

  constructor(config: RDFElementConfig);

  /**
   * Add RDF type to this element
   */
  addType(typeUri: NamedNode | string): void;

  /**
   * Set property value
   */
  setProperty(property: NamedNode | string, value: Term | string | number): void;

  /**
   * Get property value
   */
  getProperty(property: NamedNode | string): Term | undefined;

  /**
   * Export to RDF dataset
   */
  exportToDataset(dataset?: Dataset): Dataset;

  /**
   * Convert to SPARQL triples
   */
  toSPARQL(): string;
}

/**
 * Namespace management for RDF operations
 */
export declare class NamespaceManager {
  readonly prefixes: Record<string, string>;
  readonly classes: Record<string, NamedNode>;
  readonly properties: Record<string, NamedNode>;

  constructor();

  /**
   * Get namespace URI
   */
  ns(prefix: string): (localName: string) => NamedNode;

  /**
   * Create named node
   */
  namedNode(uri: string): NamedNode;

  /**
   * Create literal
   */
  literal(value: string | number, datatype?: NamedNode): Literal;
}

/**
 * RDF Graph management
 */
export declare class RDFGraphManager {
  readonly dataset: Dataset;
  readonly namespaces: NamespaceManager;

  constructor();

  /**
   * Add RDF element to graph
   */
  addElement(element: RDFElement): void;

  /**
   * Export graph as SPARQL
   */
  exportToSPARQL(): string;

  /**
   * Query graph with SPARQL
   */
  query(sparql: string): Promise<any[]>;

  /**
   * Clear graph
   */
  clear(): void;
}

// ======================
// ENTITY DEFINITIONS
// ======================

/**
 * Entity configuration options
 */
export interface EntityConfig extends RDFElementConfig {
  /** Display name */
  name?: string;
  /** Whether this is an entry point entity */
  isEntryPoint?: boolean;
  /** Entity subtype */
  subType?: string;
  /** Relevance score (0-1) */
  relevance?: number;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Frequency count */
  frequency?: number;
  /** Source information */
  provenance?: string[];
}

/**
 * Entity class for knowledge graph nodes
 */
export declare class Entity extends RDFElement {
  constructor(config: EntityConfig);

  /**
   * Get preferred label
   */
  getPrefLabel(): string;

  /**
   * Check if entity is entry point
   */
  isEntryPoint(): boolean;

  /**
   * Get entity subtype
   */
  getSubType(): string;

  /**
   * Get relevance score
   */
  getRelevance(): number;

  /**
   * Get confidence score
   */
  getConfidence(): number;

  /**
   * Get frequency count
   */
  getFrequency(): number;

  /**
   * Add provenance information
   */
  addProvenance(source: string): void;

  /**
   * Get provenance sources
   */
  getProvenance(): string[];

  /**
   * Connect to another entity via relationship
   */
  connectTo(target: Entity, relationshipType: string, metadata?: Record<string, any>): Relationship;
}

// ======================
// SEMANTIC UNIT DEFINITIONS
// ======================

/**
 * Semantic unit configuration
 */
export interface SemanticUnitConfig extends RDFElementConfig {
  /** Original text content */
  content?: string;
  /** Summary of the unit */
  summary?: string;
  /** Associated entities */
  entities?: Entity[];
  /** Source document */
  source?: string;
  /** Position in source */
  position?: number;
  /** Token count */
  tokenCount?: number;
}

/**
 * Semantic unit representing independent meaning chunks
 */
export declare class SemanticUnit extends RDFElement {
  constructor(config: SemanticUnitConfig);

  /**
   * Get content text
   */
  getContent(): string;

  /**
   * Get summary
   */
  getSummary(): string;

  /**
   * Get associated entities
   */
  getEntities(): Entity[];

  /**
   * Add entity to this unit
   */
  addEntity(entity: Entity): void;

  /**
   * Get source document
   */
  getSource(): string;

  /**
   * Get position in source
   */
  getPosition(): number;

  /**
   * Get token count
   */
  getTokenCount(): number;
}

// ======================
// RELATIONSHIP DEFINITIONS
// ======================

/**
 * Relationship configuration
 */
export interface RelationshipConfig extends RDFElementConfig {
  /** Source entity */
  source?: Entity;
  /** Target entity */
  target?: Entity;
  /** Relationship type */
  relationshipType?: string;
  /** Confidence score */
  confidence?: number;
  /** Weight/strength */
  weight?: number;
  /** Context where relationship was found */
  context?: string;
}

/**
 * Relationship between entities
 */
export declare class Relationship extends RDFElement {
  constructor(config: RelationshipConfig);

  /**
   * Get source entity
   */
  getSource(): Entity;

  /**
   * Get target entity
   */
  getTarget(): Entity;

  /**
   * Get relationship type
   */
  getRelationshipType(): string;

  /**
   * Get confidence score
   */
  getConfidence(): number;

  /**
   * Get weight
   */
  getWeight(): number;

  /**
   * Get context
   */
  getContext(): string;

  /**
   * Check if relationship is bidirectional
   */
  isBidirectional(): boolean;
}

// ======================
// CORPUS DECOMPOSITION
// ======================

/**
 * Text chunk input for decomposition
 */
export interface TextChunk {
  /** Text content */
  content: string;
  /** Source identifier */
  source: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Decomposition options
 */
export interface DecompositionOptions {
  /** Whether to extract relationships */
  extractRelationships?: boolean;
  /** Maximum entities per chunk */
  maxEntitiesPerChunk?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Whether to deduplicate entities */
  deduplicateEntities?: boolean;
  /** Custom entity types to extract */
  entityTypes?: string[];
  /** Relationship types to extract */
  relationshipTypes?: string[];
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  /** Extracted semantic units */
  units: SemanticUnit[];
  /** Extracted entities */
  entities: Entity[];
  /** Extracted relationships */
  relationships: Relationship[];
  /** Complete RDF dataset */
  dataset: Dataset;
  /** Processing metadata */
  metadata: {
    /** Processing time in ms */
    processingTime: number;
    /** Number of chunks processed */
    chunksProcessed: number;
    /** Total entities found */
    totalEntities: number;
    /** Total relationships found */
    totalRelationships: number;
    /** Error count */
    errors: number;
  };
}

/**
 * Main corpus decomposition function
 */
export declare function decomposeCorpus(
  textChunks: TextChunk[],
  llmHandler: LLMHandler,
  options?: DecompositionOptions
): Promise<DecompositionResult>;

// ======================
// GRAPH ANALYTICS
// ======================

/**
 * Community detection result
 */
export interface Community {
  /** Community ID */
  id: string;
  /** Member entities */
  members: Entity[];
  /** Community score */
  score: number;
  /** Descriptive label */
  label?: string;
  /** Community metadata */
  metadata?: Record<string, any>;
}

/**
 * PageRank result
 */
export interface PageRankResult {
  /** Entity URI */
  entity: string;
  /** PageRank score */
  score: number;
  /** Rank position */
  rank: number;
}

/**
 * Graph analytics utilities
 */
export declare class GraphAnalytics {
  /**
   * Detect communities in the graph
   */
  static detectCommunities(
    entities: Entity[],
    relationships: Relationship[],
    options?: {
      algorithm?: 'louvain' | 'leiden';
      resolution?: number;
      iterations?: number;
    }
  ): Promise<Community[]>;

  /**
   * Calculate PageRank scores
   */
  static calculatePageRank(
    entities: Entity[],
    relationships: Relationship[],
    options?: {
      damping?: number;
      iterations?: number;
      tolerance?: number;
    }
  ): Promise<PageRankResult[]>;

  /**
   * Find shortest path between entities
   */
  static findShortestPath(
    source: Entity,
    target: Entity,
    relationships: Relationship[]
  ): Promise<Entity[]>;

  /**
   * Calculate graph metrics
   */
  static calculateMetrics(
    entities: Entity[],
    relationships: Relationship[]
  ): Promise<{
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
    maxDegree: number;
    components: number;
  }>;
}

// ======================
// SPARQL OPERATIONS
// ======================

/**
 * SPARQL query builder
 */
export declare class SPARQLBuilder {
  private query: string;

  constructor();

  /**
   * Add SELECT clause
   */
  select(variables: string[]): SPARQLBuilder;

  /**
   * Add WHERE clause
   */
  where(patterns: string[]): SPARQLBuilder;

  /**
   * Add OPTIONAL clause
   */
  optional(patterns: string[]): SPARQLBuilder;

  /**
   * Add FILTER clause
   */
  filter(condition: string): SPARQLBuilder;

  /**
   * Add ORDER BY clause
   */
  orderBy(variable: string, direction?: 'ASC' | 'DESC'): SPARQLBuilder;

  /**
   * Add LIMIT clause
   */
  limit(count: number): SPARQLBuilder;

  /**
   * Build final query
   */
  build(): string;
}

/**
 * SPARQL helpers for Ragno operations
 */
export declare class SPARQLHelpers {
  /**
   * Export entities to SPARQL INSERT
   */
  static exportEntitiesToSPARQL(entities: Entity[]): string;

  /**
   * Export relationships to SPARQL INSERT
   */
  static exportRelationshipsToSPARQL(relationships: Relationship[]): string;

  /**
   * Export semantic units to SPARQL INSERT
   */
  static exportSemanticUnitsToSPARQL(units: SemanticUnit[]): string;

  /**
   * Generate entity search query
   */
  static generateEntitySearchQuery(searchTerm: string, limit?: number): string;

  /**
   * Generate relationship query
   */
  static generateRelationshipQuery(sourceEntity: string, targetEntity?: string): string;

  /**
   * Generate graph traversal query
   */
  static generateTraversalQuery(startEntity: string, depth: number): string;
}

// ======================
// ENRICHMENT OPERATIONS
// ======================

/**
 * Embedding enrichment options
 */
export interface EnrichmentOptions {
  /** Embedding model to use */
  embeddingModel?: string;
  /** Batch size for processing */
  batchSize?: number;
  /** Whether to overwrite existing embeddings */
  overwrite?: boolean;
}

/**
 * Enrichment utilities
 */
export declare class RagnoEnrichment {
  /**
   * Enrich entities with embeddings
   */
  static enrichWithEmbeddings(
    entities: Entity[],
    embeddingHandler: any,
    options?: EnrichmentOptions
  ): Promise<void>;

  /**
   * Augment entities with attributes
   */
  static augmentWithAttributes(
    entities: Entity[],
    llmHandler: LLMHandler,
    options?: {
      attributes?: string[];
      batchSize?: number;
    }
  ): Promise<void>;

  /**
   * Calculate similarity links between entities
   */
  static calculateSimilarityLinks(
    entities: Entity[],
    threshold?: number
  ): Promise<Relationship[]>;
}

// ======================
// SEARCH OPERATIONS
// ======================

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Similarity threshold */
  threshold?: number;
  /** Maximum results */
  limit?: number;
  /** Entity types to include */
  entityTypes?: string[];
}

/**
 * Graph search options
 */
export interface GraphSearchOptions {
  /** Search depth */
  depth?: number;
  /** Relationship types to follow */
  relationshipTypes?: string[];
  /** Maximum results */
  limit?: number;
}

/**
 * Hybrid search result
 */
export interface HybridSearchResult {
  /** Found entity */
  entity: Entity;
  /** Vector similarity score */
  vectorScore?: number;
  /** Graph relevance score */
  graphScore?: number;
  /** Combined score */
  combinedScore: number;
  /** Search metadata */
  metadata?: Record<string, any>;
}

/**
 * Advanced search capabilities
 */
export declare class RagnoSearch {
  /**
   * Vector-based entity search
   */
  static vectorSearch(
    query: string,
    entities: Entity[],
    embeddingHandler: any,
    options?: VectorSearchOptions
  ): Promise<HybridSearchResult[]>;

  /**
   * Graph-based entity search
   */
  static graphSearch(
    startEntities: Entity[],
    relationships: Relationship[],
    options?: GraphSearchOptions
  ): Promise<Entity[]>;

  /**
   * Hybrid vector + graph search
   */
  static hybridSearch(
    query: string,
    entities: Entity[],
    relationships: Relationship[],
    embeddingHandler: any,
    options?: VectorSearchOptions & GraphSearchOptions
  ): Promise<HybridSearchResult[]>;
}

// ======================
// MODULE EXPORTS
// ======================

export {
  // Core RDF
  RDFElement,
  NamespaceManager,
  RDFGraphManager,
  
  // Knowledge graph elements
  Entity,
  SemanticUnit,
  Relationship,
  
  // Decomposition
  decomposeCorpus,
  
  // Analytics
  GraphAnalytics,
  
  // SPARQL
  SPARQLBuilder,
  SPARQLHelpers,
  
  // Enrichment
  RagnoEnrichment,
  
  // Search
  RagnoSearch
};