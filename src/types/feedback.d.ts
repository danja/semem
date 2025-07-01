/**
 * Type definitions for feedback system components
 * 
 * These types provide documentation and IDE support for the iterative feedback system.
 * All feedback components follow the standard API pattern:
 * operation(input, resources, options) -> Promise<FeedbackResult>
 */

export interface FeedbackInput {
  /** Original question that started the process */
  originalQuestion: QuestionObject;
  /** Initial response to analyze and improve */
  initialResponse: string;
  /** Additional context from previous processing */
  context?: string;
  /** Additional feedback-specific parameters */
  [key: string]: any;
}

export interface QuestionObject {
  /** The question text */
  text: string;
  /** Optional URI identifier */
  uri?: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

export interface FeedbackResources {
  /** LLM handler for analysis and generation */
  llmHandler: LLMHandler;
  /** SPARQL helper for database operations */
  sparqlHelper: SPARQLHelper;
  /** Configuration object */
  config: FeedbackConfig;
  /** Optional Wikidata research component */
  wikidataResearch?: WikidataResearcher;
}

export interface FeedbackConfig {
  /** Graph URIs for different knowledge sources */
  beerqaGraphURI: string;
  wikipediaGraphURI: string;
  wikidataGraphURI: string;
  /** Additional configuration */
  [key: string]: any;
}

export interface FeedbackOptions {
  /** Maximum number of feedback iterations */
  maxIterations?: number;
  /** Completeness threshold to reach */
  completenessThreshold?: number;
  /** Maximum follow-up questions per iteration */
  maxFollowUpQuestions?: number;
  /** Research options for each iteration */
  researchOptions?: ResearchOptions;
  /** Additional options */
  [key: string]: any;
}

export interface ResearchOptions {
  /** Maximum Wikidata entities to research per question */
  maxWikidataEntities?: number;
  /** Enable hierarchy exploration */
  enableHierarchySearch?: boolean;
  /** Store research results */
  storeResults?: boolean;
}

export interface FeedbackResult<T = any> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Operation metadata */
  metadata?: FeedbackMetadata;
}

export interface FeedbackMetadata {
  /** Operation duration in milliseconds */
  duration: number;
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Operation type */
  operationType: string;
  /** Additional metadata */
  [key: string]: any;
}

// Response Analysis Types

export interface CompletenessAnalysis {
  /** Overall completeness score (0-1) */
  score: number;
  /** Analysis method used */
  method: 'pattern-matching' | 'llm-based' | 'hybrid';
  /** Detailed analysis breakdown */
  analysis: {
    /** Coverage of key aspects */
    coverage: number;
    /** Depth of information */
    depth: number;
    /** Accuracy assessment */
    accuracy: number;
  };
  /** Identified gaps in the response */
  gaps: string[];
  /** Suggested improvements */
  improvements: string[];
  /** Confidence in the analysis */
  confidence: number;
}

export interface AnalysisInput {
  /** Original question */
  originalQuestion: string;
  /** Response to analyze */
  response: string;
  /** Additional context */
  context?: string;
}

export interface AnalysisOptions {
  /** Analysis method to use */
  method?: 'pattern-matching' | 'llm-based' | 'hybrid';
  /** Completeness threshold */
  threshold?: number;
  /** Include detailed breakdown */
  includeDetails?: boolean;
}

// Follow-up Question Generation Types

export interface QuestionGenerationInput {
  /** Original question */
  originalQuestion: string;
  /** Current response */
  currentResponse: string;
  /** Identified completeness gaps */
  gaps: string[];
  /** Additional context */
  context?: string;
}

export interface QuestionGenerationOptions {
  /** Maximum questions to generate */
  maxQuestions?: number;
  /** Question complexity level */
  complexityLevel?: 'simple' | 'moderate' | 'complex';
  /** Focus areas for questions */
  focusAreas?: string[];
}

export interface GeneratedQuestion {
  /** Question text */
  text: string;
  /** Question URI (generated) */
  uri: string;
  /** Question priority (1-10) */
  priority: number;
  /** Target research area */
  researchArea: string;
  /** Expected improvement contribution */
  expectedContribution: number;
  /** Question metadata */
  metadata: {
    /** When question was generated */
    generatedAt: string;
    /** Generation method */
    method: string;
    /** Source gap that motivated this question */
    sourceGap: string;
  };
}

export interface QuestionResearchStatus {
  /** Question URI */
  questionURI: string;
  /** Whether research has been completed */
  researched: boolean;
  /** Research results if completed */
  researchResults?: ResearchResults;
  /** When research was completed */
  researchedAt?: string;
}

export interface ResearchResults {
  /** Number of entities discovered */
  entitiesFound: number;
  /** Research duration */
  duration: number;
  /** Quality of research results */
  quality: number;
  /** Summary of findings */
  summary: string;
}

// Iteration Management Types

export interface IterationInput {
  /** Original question that started the process */
  originalQuestion: QuestionObject;
  /** Initial response to improve */
  initialResponse: string;
  /** Context from previous processing */
  context: string;
}

export interface IterationOptions extends FeedbackOptions {
  /** Enable progressive improvement tracking */
  trackProgress?: boolean;
  /** Save intermediate results */
  saveIntermediateResults?: boolean;
}

export interface IterationResult {
  /** All iteration details */
  iterations: IterationDetail[];
  /** Final improved answer */
  finalAnswer: string;
  /** Overall improvement metrics */
  overallImprovement: ImprovementMetrics;
  /** Execution metadata */
  metadata: IterationMetadata;
}

export interface IterationDetail {
  /** Iteration number (1-based) */
  iterationNumber: number;
  /** Completeness analysis for this iteration */
  completenessAnalysis: CompletenessAnalysis;
  /** Generated follow-up questions */
  followUpQuestions: GeneratedQuestion[];
  /** Research results for questions */
  researchResults: ResearchSummary;
  /** Updated answer after research */
  updatedAnswer: string;
  /** Improvement metrics for this iteration */
  improvement: IterationImprovement;
  /** Iteration duration */
  duration: number;
}

export interface ResearchSummary {
  /** Total questions researched */
  questionsResearched: number;
  /** Total entities discovered */
  totalEntities: number;
  /** Research duration */
  totalDuration: number;
  /** Average research quality */
  averageQuality: number;
}

export interface IterationImprovement {
  /** Completeness improvement this iteration */
  completenessGain: number;
  /** Information density improvement */
  densityGain: number;
  /** Overall quality improvement */
  qualityGain: number;
}

export interface ImprovementMetrics {
  /** Initial completeness score */
  initialCompleteness: number;
  /** Final completeness score */
  finalCompleteness: number;
  /** Total completeness improvement */
  totalImprovement: number;
  /** Number of iterations performed */
  iterationsPerformed: number;
  /** Average improvement per iteration */
  averageImprovementPerIteration: number;
}

export interface IterationMetadata extends FeedbackMetadata {
  /** Total duration for all iterations */
  totalDuration: number;
  /** Final completeness reached */
  finalCompleteness: number;
  /** Whether target threshold was reached */
  thresholdReached: boolean;
  /** Reason for stopping iterations */
  stoppingReason: 'threshold-reached' | 'max-iterations' | 'minimal-improvement' | 'error';
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

export interface WikidataResearcher {
  executeResearch(input: any, resources: any, options?: any): Promise<any>;
}