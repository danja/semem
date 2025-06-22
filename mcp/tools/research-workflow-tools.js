/**
 * Research Workflow Tools - Standalone MCP tool implementations
 * 
 * These tools expose the workflow orchestrator functions as individual MCP tools
 * that work directly with the SPARQL store for semantic memory and knowledge graphs.
 */

import { z } from 'zod';
import { mcpDebugger } from '../lib/debug-utils.js';
import { workflowOrchestrator } from '../lib/workflow-orchestrator.js';

// Input schemas for research workflow tools
const ResearchIngestDocumentsSchema = z.object({
  documents: z.array(z.union([
    z.string(),
    z.object({
      content: z.string(),
      source: z.string().optional(),
      metadata: z.object({}).optional()
    })
  ])).min(1).max(50),
  domain: z.string().optional().default('general'),
  options: z.object({
    extractRelationships: z.boolean().optional().default(true),
    generateSummaries: z.boolean().optional().default(true),
    minEntityConfidence: z.number().min(0).max(1).optional().default(0.7)
  }).optional().default({})
});

const ResearchGenerateInsightsSchema = z.object({
  concepts: z.array(z.string()).optional().default([]),
  entities: z.array(z.union([z.string(), z.object({}).passthrough()])).optional().default([]),
  relationships: z.array(z.object({}).passthrough()).optional().default([]),
  goals: z.array(z.enum(['concept_extraction', 'relationship_mapping', 'insight_generation', 'trend_analysis'])).optional().default(['concept_extraction', 'relationship_mapping'])
});

const AdaptiveQueryProcessingSchema = z.object({
  query: z.string().min(1),
  userContext: z.object({
    userId: z.string().optional(),
    preferences: z.object({}).optional(),
    sessionId: z.string().optional(),
    domain: z.string().optional()
  }).optional().default({})
});

const HybridSearchSchema = z.object({
  query: z.string().min(1),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  limit: z.number().min(1).max(100).optional().default(10),
  preferenceWeight: z.number().min(0).max(1).optional().default(0.5),
  options: z.object({
    includeGraph: z.boolean().optional().default(true),
    includeMemory: z.boolean().optional().default(true),
    rankingMethod: z.enum(['semantic', 'hybrid', 'graph_enhanced']).optional().default('hybrid')
  }).optional().default({})
});

const CaptureUserFeedbackSchema = z.object({
  query: z.string(),
  response: z.string(),
  feedback: z.object({
    rating: z.number().min(1).max(5).optional(),
    helpful: z.boolean().optional(),
    relevance: z.number().min(0).max(1).optional(),
    comments: z.string().optional(),
    correctedAnswer: z.string().optional()
  }),
  userContext: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }).optional().default({})
});

const IncrementalLearningSchema = z.object({
  learningData: z.array(z.object({
    query: z.string(),
    expectedResponse: z.string(),
    actualResponse: z.string().optional(),
    feedback: z.object({}).optional(),
    context: z.object({}).optional()
  })).min(1),
  options: z.object({
    updateMemory: z.boolean().optional().default(true),
    strengthenConnections: z.boolean().optional().default(true),
    adjustThresholds: z.boolean().optional().default(false)
  }).optional().default({})
});

/**
 * Register research workflow tools with MCP server
 */
export function registerResearchWorkflowTools(server) {
  mcpDebugger.info('Registering research workflow tools...');

  // 1. Research Document Ingestion Tool
  server.tool(
    "research_ingest_documents",
    "Ingest research documents into semantic memory and knowledge graph with SPARQL persistence",
    ResearchIngestDocumentsSchema,
    async ({ documents, domain = 'general', options = {} }) => {
      try {
        mcpDebugger.info('Starting research document ingestion', { 
          documentCount: documents.length, 
          domain 
        });

        // Initialize workflow orchestrator if needed
        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        // Execute through workflow orchestrator
        const result = await workflowOrchestrator.researchIngestDocuments(
          { documents, domain, ...options },
          { tool: 'research_ingest_documents' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success,
              summary: result.summary,
              results: result.results,
              processingMetrics: result.processingMetrics,
              sparqlPersistence: true,
              tool: 'research_ingest_documents'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Research document ingestion failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'research_ingest_documents'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 2. Research Insights Generation Tool
  server.tool(
    "research_generate_insights",
    "Generate research insights from concepts, entities, and knowledge graph analysis",
    ResearchGenerateInsightsSchema,
    async ({ concepts = [], entities = [], relationships = [], goals = ['concept_extraction', 'relationship_mapping'] }) => {
      try {
        mcpDebugger.info('Generating research insights', { 
          conceptCount: concepts.length,
          entityCount: entities.length,
          goals 
        });

        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        const result = await workflowOrchestrator.researchGenerateInsights(
          { concepts, entities, relationships, goals },
          { tool: 'research_generate_insights' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success,
              insights: result.insights,
              keyFindings: result.keyFindings,
              recommendations: result.recommendations,
              supportingEvidence: result.supportingEvidence,
              analysisMetadata: result.analysisMetadata,
              tool: 'research_generate_insights'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Research insight generation failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'research_generate_insights'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 3. Adaptive Query Processing Tool
  server.tool(
    "adaptive_query_processing",
    "Process queries adaptively based on user context and interaction history",
    AdaptiveQueryProcessingSchema,
    async ({ query, userContext = {} }) => {
      try {
        mcpDebugger.info('Processing adaptive query', { 
          query: query.substring(0, 100) + '...',
          userId: userContext.userId 
        });

        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        const result = await workflowOrchestrator.adaptiveQueryProcessing(
          { query, userContext },
          { tool: 'adaptive_query_processing' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success,
              query: result.query,
              queryAnalysis: result.queryAnalysis,
              searchStrategy: result.searchStrategy,
              results: result.results,
              userContext: result.userContext,
              tool: 'adaptive_query_processing'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Adaptive query processing failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'adaptive_query_processing'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 4. Hybrid Search Tool
  server.tool(
    "hybrid_search",
    "Execute hybrid search combining semantic memory, knowledge graph, and adaptive ranking",
    HybridSearchSchema,
    async ({ query, threshold = 0.7, limit = 10, preferenceWeight = 0.5, options = {} }) => {
      try {
        mcpDebugger.info('Executing hybrid search', { 
          query: query.substring(0, 100) + '...',
          threshold, 
          limit 
        });

        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        const result = await workflowOrchestrator.hybridSearch(
          { query, threshold, limit, preferenceWeight, ...options },
          { tool: 'hybrid_search' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success || true,
              query,
              searchParameters: { threshold, limit, preferenceWeight },
              results: result.results || result,
              searchMetrics: result.searchMetrics || {},
              options,
              tool: 'hybrid_search'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Hybrid search failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'hybrid_search'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 5. User Feedback Capture Tool
  server.tool(
    "capture_user_feedback",
    "Capture and process user feedback for system improvement and learning",
    CaptureUserFeedbackSchema,
    async ({ query, response, feedback, userContext = {} }) => {
      try {
        mcpDebugger.info('Capturing user feedback', { 
          hasRating: !!feedback.rating,
          helpful: feedback.helpful,
          userId: userContext.userId 
        });

        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        const result = await workflowOrchestrator.captureUserFeedback(
          { query, response, feedback, userContext },
          { tool: 'capture_user_feedback' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success || true,
              feedbackId: result.feedbackId || `feedback_${Date.now()}`,
              processingStatus: result.processingStatus || 'stored',
              recommendations: result.recommendations || [],
              userContext,
              tool: 'capture_user_feedback'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('User feedback capture failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'capture_user_feedback'
            }, null, 2)
          }]
        };
      }
    }
  );

  // 6. Incremental Learning Tool
  server.tool(
    "incremental_learning",
    "Perform incremental learning from user interactions and feedback",
    IncrementalLearningSchema,
    async ({ learningData, options = {} }) => {
      try {
        mcpDebugger.info('Starting incremental learning', { 
          dataPoints: learningData.length,
          options 
        });

        if (!workflowOrchestrator.isInitialized) {
          await workflowOrchestrator.initialize(server);
        }

        const result = await workflowOrchestrator.incrementalLearning(
          { learningData, options },
          { tool: 'incremental_learning' }
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: result.success || true,
              learningResults: result.learningResults || {},
              improvementMetrics: result.improvementMetrics || {},
              updatedConnections: result.updatedConnections || 0,
              memoryUpdates: result.memoryUpdates || 0,
              options,
              tool: 'incremental_learning'
            }, null, 2)
          }]
        };

      } catch (error) {
        mcpDebugger.error('Incremental learning failed', error);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              tool: 'incremental_learning'
            }, null, 2)
          }]
        };
      }
    }
  );

  mcpDebugger.info('Research workflow tools registered successfully');
}

// Export schemas for use in other modules
export {
  ResearchIngestDocumentsSchema,
  ResearchGenerateInsightsSchema,
  AdaptiveQueryProcessingSchema,
  HybridSearchSchema,
  CaptureUserFeedbackSchema,
  IncrementalLearningSchema
};