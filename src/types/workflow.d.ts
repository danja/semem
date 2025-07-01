/**
 * Type definitions for workflow components
 * 
 * These types provide documentation and IDE support for the workflow system.
 * All workflow components follow the standard API pattern:
 * operation(input, resources, options) -> Promise<WorkflowResult>
 */

export interface WorkflowInput {
  /** The question object containing text and optional URI */
  question: QuestionObject;
  /** Additional workflow-specific input parameters */
  [key: string]: any;
}

export interface QuestionObject {
  /** The question text */
  text: string;
  /** Optional URI identifier for the question */
  uri?: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

export interface WorkflowResources {
  /** LLM handler for text generation and analysis */
  llmHandler: LLMHandler;
  /** SPARQL helper for database operations */
  sparqlHelper: SPARQLHelper;
  /** Configuration object with graph URIs and settings */
  config: WorkflowConfig;
  /** Optional embedding handler for vector operations */
  embeddingHandler?: EmbeddingHandler;
  /** Optional Wikidata research component */
  wikidataResearch?: WikidataResearcher;
}

export interface WorkflowConfig {
  /** BeerQA graph URI */
  beerqaGraphURI: string;
  /** Wikipedia graph URI */
  wikipediaGraphURI: string;
  /** Wikidata graph URI */
  wikidataGraphURI: string;
  /** Additional configuration options */
  [key: string]: any;
}

export interface WorkflowOptions {
  /** Maximum number of context tokens to use */
  maxContextTokens?: number;
  /** Answer generation style */
  answerStyle?: 'simple' | 'detailed' | 'comprehensive';
  /** Workflow execution mode */
  workflowMode?: 'fast' | 'standard' | 'comprehensive';
  /** Additional workflow-specific options */
  [key: string]: any;
}

export interface WorkflowResult<T = any> {
  /** Whether the workflow executed successfully */
  success: boolean;
  /** The workflow result data */
  data?: T;
  /** Error message if execution failed */
  error?: string;
  /** Execution metadata */
  metadata?: WorkflowMetadata;
}

export interface WorkflowMetadata {
  /** Total execution duration in milliseconds */
  duration: number;
  /** Execution start time */
  startTime: string;
  /** Execution end time */
  endTime: string;
  /** Workflow type identifier */
  workflowType: string;
  /** Number of processing steps */
  steps: number;
  /** Additional metadata */
  [key: string]: any;
}

// Specific workflow result types

export interface BeerQAWorkflowResult {
  /** The input question */
  question: QuestionObject;
  /** Generated answer */
  answer: string;
  /** Context used for answer generation */
  context: string;
  /** Number of corpuscles used */
  corpusclesUsed: number;
  /** Discovered relationships */
  relationships: Array<{
    uri: string;
    type: string;
    weight: number;
  }>;
}

export interface WikidataWorkflowResult extends BeerQAWorkflowResult {
  /** Standard BeerQA answer */
  standardAnswer: string;
  /** Wikidata-enhanced answer */
  enhancedAnswer: string;
  /** Wikidata research results */
  wikidataResults: WikidataResearchSummary | null;
  /** Number of Wikidata entities found */
  wikidataEntitiesFound: number;
}

export interface FeedbackWorkflowResult extends WikidataWorkflowResult {
  /** Initial answer before feedback iterations */
  initialAnswer: string;
  /** Final answer after all iterations */
  finalAnswer: string;
  /** Feedback iteration details */
  iterations: FeedbackIteration[];
  /** Total research questions generated */
  totalResearchQuestions: number;
  /** Total entities discovered across all research */
  totalEntitiesDiscovered: number;
  /** Completeness improvement metrics */
  completenessImprovement: CompletenessMetrics;
  /** Workflow execution details */
  workflow: {
    initialWorkflow: string;
    feedbackEnabled: boolean;
    iterationsPerformed: number;
  };
}

export interface WikidataResearchSummary {
  /** Number of entities found */
  entitiesFound: number;
  /** Research duration in milliseconds */
  researchDuration: number;
  /** Concepts used for research */
  conceptsUsed: string[];
  /** Discovered entities */
  entities: RagnoEntity[];
}

export interface FeedbackIteration {
  /** Iteration number */
  iteration: number;
  /** Completeness score for this iteration */
  completenessScore: number;
  /** Generated follow-up questions */
  followUpQuestions: string[];
  /** Research results for this iteration */
  researchResults: {
    totalEntities: number;
    researchDuration: number;
  };
  /** Updated answer after this iteration */
  updatedAnswer: string;
}

export interface CompletenessMetrics {
  /** Initial completeness score */
  initial: number;
  /** Final completeness score */
  final: number;
  /** Improvement amount */
  improvement: number;
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

export interface WikidataResearcher {
  executeResearch(input: any, resources: any, options?: any): Promise<any>;
  getStatistics(): { success: boolean; statistics: any };
}

export interface RagnoEntity {
  /** Entity URI */
  uri: string;
  /** Entity label */
  label: string;
  /** Entity description */
  description?: string;
  /** Entity type or category */
  type?: string;
  /** Additional entity data */
  [key: string]: any;
}

// Base workflow class interface

export interface BaseWorkflow {
  /** Execute the workflow */
  execute(input: WorkflowInput, resources: WorkflowResources, options?: WorkflowOptions): Promise<WorkflowResult>;
  
  /** Get workflow metadata */
  getMetadata(): {
    workflowType: string;
    version: string;
    description: string;
  };
}