/**
 * Unified Prompt System - Main Export
 * 
 * This is the main entry point for the unified prompt management system.
 * It provides both the new unified interfaces and backward compatibility.
 */

// Core unified system
import PromptManagerClass from './PromptManager.js';
import {
    PromptContext,
    PromptTemplate,
    PromptOptions,
    PromptResult,
    PromptValidation,
    createPromptContext,
    createPromptTemplate,
    createPromptOptions,
    createPromptResult
} from './interfaces.js';

// Compatibility layer
import {
    PromptTemplates,
    PromptFormatter,
    MCPPrompts,
    MigrationHelper,
    GradualMigration,
    FeatureFlags,
    PromptMetrics,
    getPromptManager
} from './compatibility.js';

// Export everything
export { PromptManagerClass as PromptManager };
export {
    PromptContext,
    PromptTemplate,
    PromptOptions,
    PromptResult,
    PromptValidation,
    createPromptContext,
    createPromptTemplate,
    createPromptOptions,
    createPromptResult,
    PromptTemplates,
    PromptFormatter,
    MCPPrompts,
    MigrationHelper,
    GradualMigration,
    FeatureFlags,
    PromptMetrics,
    getPromptManager
};

// Convenience exports
export { PromptTemplates as PromptTemplatesCompat } from './compatibility.js';
export { PromptFormatter as PromptFormatterCompat } from './compatibility.js';
export { MCPPrompts as MCPPromptsCompat } from './compatibility.js';

/**
 * Initialize the unified prompt system
 * This function sets up the global prompt manager and loads existing templates
 */
export async function initializePromptSystem(options = {}) {
    const { getPromptManager } = await import('./compatibility.js');
    const manager = getPromptManager();
    
    // Configure manager
    if (options.enableLegacySupport !== undefined) {
        manager.options.enableLegacySupport = options.enableLegacySupport;
    }
    
    // Load existing templates if requested
    if (options.loadExistingTemplates !== false) {
        try {
            // Load from PromptTemplates if available
            if (options.promptTemplates) {
                await manager.loadTemplatesFromPromptTemplates(options.promptTemplates);
            }
            
            // Load from MCP registry if available
            if (options.mcpRegistry) {
                await manager.loadTemplatesFromMCP(options.mcpRegistry);
            }
        } catch (error) {
            console.warn('Failed to load existing templates:', error.message);
        }
    }
    
    return manager;
}

/**
 * Factory function for creating a configured prompt manager
 */
export function createPromptManager(options = {}) {
    return new PromptManagerClass(options);
}

/**
 * Quick start function for common use cases
 */
export async function quickStart(config = {}) {
    const manager = await initializePromptSystem(config);
    
    // Load existing templates through migration (quietly)
    const { runFullMigration } = await import('./migrate-existing.js');
    await runFullMigration(true); // quiet mode
    
    // Register common templates
    const commonTemplates = [
        {
            name: 'chat-basic',
            description: 'Basic chat template',
            content: '${query}',
            format: 'chat',
            systemPrompt: 'You are a helpful assistant.'
        },
        {
            name: 'completion-basic',
            description: 'Basic completion template',
            content: '${query}',
            format: 'completion'
        },
        {
            name: 'concept-extraction',
            description: 'Extract concepts from text',
            content: 'Extract key concepts from: ${text}',
            format: 'json'
        },
        {
            name: 'summarization',
            description: 'Summarize text content',
            content: 'Summarize the following text: ${text}',
            format: 'structured'
        }
    ];
    
    for (const template of commonTemplates) {
        manager.registerTemplate(template);
    }
    
    return manager;
}

/**
 * Utility to check system health
 */
export async function checkSystemHealth() {
    const { getPromptManager } = await import('./compatibility.js');
    const manager = getPromptManager();
    return manager.healthCheck();
}

/**
 * Migration utilities
 */
export async function migrateExistingSystem(options = {}) {
    const { MigrationHelper } = await import('./compatibility.js');
    const results = {
        promptTemplates: false,
        mcpRegistry: false,
        errors: []
    };
    
    try {
        if (options.promptTemplates) {
            await MigrationHelper.migratePromptTemplates(options.promptTemplates);
            results.promptTemplates = true;
        }
        
        if (options.mcpRegistry) {
            await MigrationHelper.migrateMCPRegistry(options.mcpRegistry);
            results.mcpRegistry = true;
        }
    } catch (error) {
        results.errors.push(error.message);
    }
    
    return results;
}

/**
 * Default export for convenience
 */
const UnifiedPromptSystem = {
    PromptManager: PromptManagerClass,
    PromptContext,
    PromptTemplate,
    PromptOptions,
    PromptResult,
    PromptValidation,
    createPromptContext,
    createPromptTemplate,
    createPromptOptions,
    createPromptResult,
    initializePromptSystem,
    createPromptManager,
    quickStart,
    checkSystemHealth,
    migrateExistingSystem,
    // Compatibility exports
    PromptTemplates,
    PromptFormatter,
    MCPPrompts,
    MigrationHelper,
    GradualMigration,
    FeatureFlags,
    PromptMetrics,
    getPromptManager
};

export default UnifiedPromptSystem;