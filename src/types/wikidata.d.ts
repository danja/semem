/**
 * Type definitions for Wikidata integration components
 * 
 * These types provide documentation and IDE support for Wikidata research and navigation.
 * All Wikidata components follow the standard API pattern:
 * operation(input, resources, options) -> Promise<WikidataResult>
 */

export interface WikidataInput {
  /** Research question or text to analyze */
  question: string;
  /** Pre-extracted concepts (optional) */
  concepts?: string[];
  /** Additional input parameters */
  [key: string]: any;
}

export interface WikidataResources {
  /** LLM handler for concept extraction and analysis */
  llmHandler: LLMHandler;
  /** SPARQL helper for storage operations */
  sparqlHelper: SPARQLHelper;
  /** Configuration with graph URIs */
  config: WikidataConfig;
  /** Optional embedding handler for similarity operations */
  embeddingHandler?: EmbeddingHandler;
}

export interface WikidataConfig {
  /** Wikidata storage graph URI */
  wikidataGraphURI: string;
  /** BeerQA graph URI for cross-referencing */
  beerqaGraphURI: string;
  /** Wikipedia graph URI for enhanced context */
  wikipediaGraphURI: string;
  /** Additional configuration */
  [key: string]: any;
}

export interface WikidataOptions {
  /** Maximum entities to research per concept */
  maxEntitiesPerConcept?: number;
  /** Maximum total search results */
  maxWikidataSearchResults?: number;
  /** Minimum entity confidence threshold */
  minEntityConfidence?: number;
  /** Enable hierarchy exploration */
  enableHierarchySearch?: boolean;
  /** Store results in knowledge graph */
  storeResults?: boolean;
  /** Target storage graph */
  storageGraph?: string;
  /** Additional options */
  [key: string]: any;
}

export interface WikidataResult<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The operation result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Operation metadata */
  metadata?: WikidataMetadata;
}

export interface WikidataMetadata {
  /** Operation duration in milliseconds */
  researchDuration: number;
  /** Number of concepts used */
  conceptsUsed: number;
  /** Number of entities found */
  entitiesFound: number;
  /** Number of entities converted */
  entitiesConverted: number;
  /** Whether results were stored */
  stored: boolean;
  /** Operation timestamp */
  timestamp: string;
  /** Configuration used */
  config: WikidataOptions;
}

// Wikidata Research Types

export interface WikidataResearchResult {
  /** Research question */
  question: string;
  /** Concepts used for research */
  concepts: string[];
  /** Raw Wikidata entities found */
  wikidataEntities: WikidataEntity[];
  /** Converted Ragno entities */
  ragnoEntities: RagnoEntity[];
  /** Storage operation result */
  storageResult: StorageResult | null;
  /** Research metadata */
  metadata: WikidataResearchMetadata;
}

export interface WikidataResearchMetadata extends WikidataMetadata {
  /** Method used for concept extraction */
  conceptExtractionMethod?: string;
  /** Number of search queries executed */
  searchQueriesExecuted: number;
  /** Conversion success rate */
  conversionSuccessRate: number;
}

export interface WikidataEntity {
  /** Wikidata entity ID (e.g., Q123) */
  id: string;
  /** Entity label */
  label: string;
  /** Entity description */
  description: string;
  /** Entity aliases */
  aliases: string[];
  /** Entity claims/properties */
  claims: WikidataClaim[];
  /** Entity URL */
  url: string;
  /** Search confidence score */
  confidence: number;
}

export interface WikidataClaim {
  /** Property ID (e.g., P31 for "instance of") */
  property: string;
  /** Property label */
  propertyLabel: string;
  /** Claim value */
  value: WikidataValue;
  /** Value type */
  valueType: 'item' | 'string' | 'time' | 'quantity' | 'coordinate';
}

export interface WikidataValue {
  /** Raw value */
  value: any;
  /** Display value */
  displayValue: string;
  /** Value unit (for quantities) */
  unit?: string;
  /** Value precision (for times/quantities) */
  precision?: number;
}

export interface RagnoEntity {
  /** Ragno entity URI */
  uri: string;
  /** Entity label */
  label: string;
  /** Entity description */
  description?: string;
  /** Entity type */
  type: string;
  /** Text content */
  content?: string;
  /** Entity attributes */
  attributes: RagnoAttribute[];
  /** Source Wikidata ID */
  wikidataId: string;
  /** Conversion metadata */
  conversionMetadata: {
    /** When entity was converted */
    convertedAt: string;
    /** Source question that triggered research */
    sourceQuestion: string;
    /** Conversion method */
    conversionMethod: string;
  };
}

export interface RagnoAttribute {
  /** Attribute type */
  type: string;
  /** Attribute value */
  value: any;
  /** Attribute confidence */
  confidence?: number;
  /** Source property ID */
  sourceProperty?: string;
}

export interface StorageResult {
  /** Whether storage succeeded */
  success: boolean;
  /** Number of triples stored */
  triplesStored: number;
  /** Research session URI */
  sessionURI?: string;
  /** Target graph */
  graph: string;
  /** Error message if failed */
  error?: string;
}

// Wikidata Navigation Types

export interface NavigationInput {
  /** Question for navigation context */
  question: QuestionObject;
  /** Local entities from BeerQA */
  localEntities?: LocalEntity[];
  /** Existing navigation context */
  navigationContext?: NavigationContext;
}

export interface QuestionObject {
  /** Question text */
  text: string;
  /** Question URI */
  uri?: string;
  /** Question metadata */
  metadata?: Record<string, any>;
}

export interface LocalEntity {
  /** Entity URI */
  uri: string;
  /** Entity label */
  label: string;
  /** Entity content */
  content?: string;
  /** Entity type */
  type?: string;
  /** Additional entity data */
  [key: string]: any;
}

export interface NavigationContext {
  /** Context description */
  description: string;
  /** Context entities */
  entities: any[];
  /** Context relationships */
  relationships: any[];
  /** Additional context data */
  [key: string]: any;
}

export interface NavigationOptions extends WikidataOptions {
  /** Enable Wikidata research for navigation */
  enableWikidataResearch?: boolean;
  /** Maximum Wikidata entities for navigation */
  maxWikidataEntities?: number;
  /** Create cross-references between local and Wikidata entities */
  createCrossReferences?: boolean;
  /** Similarity threshold for entity matching */
  similarityThreshold?: number;
  /** Enhancement level */
  enhancementLevel?: 'basic' | 'standard' | 'comprehensive';
}

export interface NavigationResult {
  /** Original local entities */
  originalEntities: LocalEntity[];
  /** Discovered Wikidata entities */
  wikidataEntities: RagnoEntity[];
  /** Cross-references between entities */
  crossReferences: CrossReference[];
  /** Enhanced navigation context */
  enhancedContext: EnhancedNavigationContext;
  /** Entity relationships */
  relationships: EntityRelationship[];
  /** Navigation metadata */
  metadata: NavigationMetadata;
}

export interface CrossReference {
  /** Local entity URI */
  localEntity: string;
  /** Wikidata entity URI */
  wikidataEntity: string;
  /** Similarity score */
  similarity: number;
  /** Cross-reference type */
  type: string;
  /** Confidence in the cross-reference */
  confidence: number;
}

export interface EnhancedNavigationContext extends NavigationContext {
  /** Question text */
  question: string;
  /** Local entities count */
  localEntitiesCount: number;
  /** Wikidata entities count */
  wikidataEntitiesCount: number;
  /** Cross-references count */
  crossReferencesCount: number;
  /** Enhancement level used */
  enhancementLevel: string;
  /** Context summary */
  contextSummary: string;
}

export interface EntityRelationship {
  /** Relationship URI */
  uri: string;
  /** Source entity URI */
  sourceEntity: string;
  /** Target entity URI */
  targetEntity: string;
  /** Relationship type */
  relationshipType: string;
  /** Relationship weight/strength */
  weight: number;
  /** Relationship source */
  source: string;
}

export interface NavigationMetadata extends WikidataMetadata {
  /** Total entities in enhanced context */
  entitiesTotal: number;
  /** Whether enhancement was successful */
  enhancementSuccessful: boolean;
  /** Wikidata research duration */
  wikidataResearchDuration?: number;
  /** Context enhancement metadata */
  contextEnhancement?: {
    /** Whether context was built successfully */
    contextBuilt: boolean;
    /** Total entities in context */
    totalEntities: number;
  };
}

// Entity Context Types

export interface EntityContextInput {
  /** Entity URIs to get context for */
  entityURIs: string[];
  /** Question for context */
  question: QuestionObject;
}

export interface EntityContextResult {
  /** Found entities with context */
  entities: EntityWithContext[];
  /** Context metadata */
  metadata: EntityContextMetadata;
}

export interface EntityWithContext extends RagnoEntity {
  /** Source graph */
  graph: string;
  /** Vector embedding */
  embedding?: number[];
  /** Extracted concepts */
  concepts: string[];
  /** Relationship weight to question */
  relationshipWeight: number;
}

export interface EntityContextMetadata {
  /** Number of entities found */
  entitiesFound: number;
  /** Number of graphs queried */
  graphsQueried: number;
  /** Context type */
  contextType: string;
  /** Error if occurred */
  errorOccurred?: boolean;
  /** Operation timestamp */
  timestamp: string;
}

// Statistics Types

export interface WikidataStatistics {
  /** Total research operations performed */
  totalResearches: number;
  /** Total concepts extracted */
  conceptsExtracted: number;
  /** Total entities found */
  entitiesFound: number;
  /** Total entities converted to Ragno format */
  entitiesConverted: number;
  /** Average entities per research */
  averageEntitiesPerResearch: number;
  /** Conversion success rate */
  conversionRate: number;
  /** Recent research sessions */
  recentSessions?: ResearchSession[];
}

export interface NavigationStatistics {
  /** Total navigation sessions */
  totalNavigationSessions: number;
  /** Average Wikidata entities per session */
  averageWikidataEntities: number;
  /** Average cross-references per session */
  averageCrossReferences: number;
  /** Average session duration */
  averageDuration: number;
  /** Enhancement levels used */
  enhancementLevels: Record<string, number>;
}

export interface ResearchSession {
  /** Research question */
  question: string;
  /** Concepts used */
  concepts: string[];
  /** Entities found */
  entitiesFound: number;
  /** Entities converted */
  entitiesConverted: number;
  /** Session duration */
  duration: number;
  /** Session timestamp */
  timestamp: string;
  /** Whether results were stored */
  stored: boolean;
}

// External component interfaces (simplified)

export interface LLMHandler {
  generateResponse(prompt: string, context?: string, options?: any): Promise<string>;
  extractConcepts(text: string): Promise<string[]>;
}

export interface SPARQLHelper {
  executeSelect(query: string): Promise<{ success: boolean; data?: any; error?: string }>;
  executeUpdate(query: string): Promise<{ success: boolean; error?: string }>;
}

export interface EmbeddingHandler {
  generateEmbedding(text: string): Promise<number[]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}