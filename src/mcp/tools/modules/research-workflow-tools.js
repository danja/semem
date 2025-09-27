/**
 * Research Workflow Tools - Standalone MCP tool implementations
 * 
 * These tools expose the workflow orchestrator functions as individual MCP tools
 * that work directly with the SPARQL store for semantic memory and knowledge graphs.
 */

import { z } from 'zod';
import { mcpDebugger } from '../../lib/debug-utils.js';
import { workflowOrchestrator } from '../../lib/workflow-orchestrator.js';

// Input schemas for research workflow tools

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

  // 1. User Feedback Capture Tool
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
  CaptureUserFeedbackSchema,
  IncrementalLearningSchema
};