/**
 * Zod Schemas for Simple Verbs
 * Defines input validation schemas for all verb operations
 */

import { z } from 'zod';

/**
 * Simple Verb Tool Names
 */
export const SimpleVerbToolNames = {
  tell: 'semem-tell',
  ask: 'semem-ask', 
  augment: 'semem-augment',
  zoom: 'semem-zoom',
  pan: 'semem-pan',
  tilt: 'semem-tilt',
  inspect: 'semem-inspect',
  remember: 'semem-remember',
  forget: 'semem-forget',
  recall: 'semem-recall',
  project_context: 'semem-project-context',
  fade_memory: 'semem-fade-memory'
};

// Basic verb schemas
export const TellSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  type: z.enum(['interaction', 'document', 'concept']).optional().default('interaction'),
  metadata: z.object({}).optional().default({}),
  lazy: z.boolean().optional().default(false)
});

export const AskSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  mode: z.enum(['basic', 'standard', 'comprehensive']).optional().default('standard'),
  useContext: z.boolean().optional().default(true),
  useHyDE: z.boolean().optional().default(false),
  useWikipedia: z.boolean().optional().default(false),
  useWikidata: z.boolean().optional().default(false),
  useWebSearch: z.boolean().optional().default(false)
});

export const AugmentSchema = z.object({
  target: z.string().optional().default('all'),
  operation: z.enum([
    'auto',
    'concepts',
    'attributes',
    'relationships',
    'process_lazy',
    'chunk_documents',
    'label',
    'extract_concepts',
    'generate_embedding',
    'analyze_text',
    'concept_embeddings',
    'load_document',
    'convert_pdf',
    'chunk_markdown',
    'ingest_chunks'
  ]).optional().default('auto'),
  options: z.object({
    // Chunking options
    maxChunkSize: z.number().optional().default(2000),
    minChunkSize: z.number().optional().default(100),
    overlapSize: z.number().optional().default(100),
    strategy: z.enum(['semantic', 'fixed']).optional().default('semantic'),
    minContentLength: z.number().optional().default(2000),
    graph: z.string().optional(),
    // Concept extraction options
    maxConcepts: z.number().optional().default(20),
    embeddingModel: z.string().optional().default('nomic-embed-text'),
    minConfidence: z.number().optional().default(0.0),
    // General augmentation options
    includeAttributes: z.boolean().optional().default(true),
    includeRelationships: z.boolean().optional().default(true),
    includeEmbeddings: z.boolean().optional().default(false),
    // Label generation options
    limit: z.number().optional().default(100),
    keywordCount: z.number().optional().default(5),
    dryRun: z.boolean().optional().default(false)
  }).optional().default({})
}).catchall(z.unknown());

// ZPT Navigation schemas  
export const ZoomSchema = z.object({
  level: z.enum(['entity', 'concept', 'document', 'community']).default('entity'),
  query: z.string().optional()
});

export const PanSchema = z.object({
  direction: z.enum(['semantic', 'temporal', 'conceptual']).optional(),
  domain: z.string().optional(),
  timeRange: z.string().optional(),
  conceptFilter: z.array(z.string()).optional(),
  semanticVector: z.array(z.number()).optional(),
  maxResults: z.number().optional().default(50),
  threshold: z.number().optional().default(0.5)
});

export const TiltSchema = z.object({
  style: z.enum(['keywords', 'summary', 'detailed']).default('keywords'),
  query: z.string().optional()
});

export const InspectSchema = z.object({
  what: z.enum(['session', 'concepts', 'all']).default('session'),
  details: z.boolean().optional().default(false)
});

export const TrainVSOMSchema = z.object({
  epochs: z.number().min(1).max(10000).optional().default(100),
  learningRate: z.number().min(0.001).max(1.0).optional().default(0.1),
  gridSize: z.number().min(5).max(50).optional().default(20)
});

// Memory management schemas
export const RememberSchema = z.object({
  content: z.string().min(1, "Content to remember cannot be empty"),
  importance: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  context: z.string().optional(),
  metadata: z.object({
    source: z.string().optional(),
    timestamp: z.string().optional(),
    category: z.string().optional()
  }).optional().default({})
});

export const ForgetSchema = z.object({
  target: z.string().min(1, "Target to forget cannot be empty"),
  method: z.enum(['fade', 'remove']).optional().default('fade'),
  intensity: z.number().min(0).max(1).optional().default(0.5)
});

export const RecallSchema = z.object({
  query: z.string().min(1, "Recall query cannot be empty"),
  domain: z.string().optional(),
  timeRange: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().positive().optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.5)
});

// Advanced operation schemas
export const ProjectContextSchema = z.object({
  query: z.string().min(1, "Context query cannot be empty"),
  projectionType: z.enum(['semantic', 'temporal', 'conceptual']).default('semantic'),
  dimensions: z.number().positive().optional().default(50),
  includeMetadata: z.boolean().optional().default(true),
  timeWindow: z.string().optional(),
  conceptFilters: z.array(z.string()).optional()
});

export const FadeMemorySchema = z.object({
  target: z.string().optional(),
  domain: z.string().optional(),
  fadeRate: z.number().min(0).max(1).optional().default(0.1),
  preserveImportant: z.boolean().optional().default(true),
  dryRun: z.boolean().optional().default(false)
});
