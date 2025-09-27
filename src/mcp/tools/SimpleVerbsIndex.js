/**
 * Simple Verbs Index - Main Entry Point
 * Re-exports all Simple Verbs components for easy importing
 */

// Export all schemas and tool names
export {
  SimpleVerbToolNames,
  TellSchema,
  AskSchema,
  AugmentSchema,
  ZoomSchema,
  PanSchema,
  TiltSchema,
  InspectSchema,
  RememberSchema,
  ForgetSchema,
  RecallSchema,
  ProjectContextSchema,
  FadeMemorySchema
} from './VerbSchemas.js';

// Export logging utilities
export {
  verbsLogger,
  logPerformance,
  logOperation
} from './VerbsLogger.js';

// Export state manager
export { ZPTStateManager } from './ZptStateManager.js';

// Export main service
export { SimpleVerbsService } from './SimpleVerbsService.js';

// Export registration functions
export {
  registerSimpleVerbs,
  getSimpleVerbsService,
  getSimpleVerbsToolDefinitions
} from './VerbRegistration.js';