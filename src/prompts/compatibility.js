/**
 * Compatibility layer for existing prompt systems
 * 
 * This module provides adapters and wrappers to ensure existing code
 * continues to work while gradually migrating to the unified system.
 */

import PromptManager from './PromptManager.js';
import { createPromptContext, createPromptOptions } from './interfaces.js';
import logger from 'loglevel';

// Global prompt manager instance
let globalPromptManager = null;

/**
 * Get or create global prompt manager
 */
function getPromptManager() {
    if (!globalPromptManager) {
        globalPromptManager = new PromptManager({
            enableLegacySupport: true,
            cacheTemplates: true
        });
    }
    return globalPromptManager;
}

/**
 * PromptTemplates compatibility wrapper
 * Maintains the exact same API as the original PromptTemplates class
 */
export class PromptTemplatesCompat {
    static templates = {
        // Legacy templates maintained for compatibility
        'llama2': {
            chat: (system, context, query) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatChatPrompt('llama2', system, context, query);
            },
            completion: (context, query) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatCompletionPrompt('llama2', context, query);
            },
            extractConcepts: (text) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatConceptPrompt('llama2', text);
            }
        },
        'mistral': {
            chat: (system, context, query) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatChatPrompt('mistral', system, context, query);
            },
            completion: (context, query) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatCompletionPrompt('mistral', context, query);
            },
            extractConcepts: (text) => {
                const manager = getPromptManager();
                const adapter = manager.getLegacyAdapter('PromptTemplates');
                return adapter.formatConceptPrompt('mistral', text);
            }
        }
    };

    static getTemplateForModel(modelName) {
        const manager = getPromptManager();
        const adapter = manager.getLegacyAdapter('PromptTemplates');
        return adapter.getTemplateForModel(modelName);
    }

    static formatChatPrompt(modelName, system, context, query) {
        const manager = getPromptManager();
        const adapter = manager.getLegacyAdapter('PromptTemplates');
        return adapter.formatChatPrompt(modelName, system, context, query);
    }

    static formatCompletionPrompt(modelName, context, query) {
        const manager = getPromptManager();
        const adapter = manager.getLegacyAdapter('PromptTemplates');
        return adapter.formatCompletionPrompt(modelName, context, query);
    }

    static formatConceptPrompt(modelName, text) {
        const manager = getPromptManager();
        const adapter = manager.getLegacyAdapter('PromptTemplates');
        return adapter.formatConceptPrompt(modelName, text);
    }

    static registerTemplate(modelName, template) {
        const manager = getPromptManager();
        
        // Convert legacy template to unified format
        const unifiedTemplate = {
            name: modelName,
            description: `Template for ${modelName}`,
            content: template.chat ? '${query}' : template,
            format: 'chat',
            supportedModels: [modelName]
        };
        
        manager.registerTemplate(unifiedTemplate);
        
        // Update legacy templates
        this.templates[modelName.toLowerCase()] = template;
    }
}

/**
 * PromptFormatter compatibility wrapper
 */
export class PromptFormatterCompat {
    constructor(options = {}) {
        this.config = options;
        this.manager = getPromptManager();
    }

    async format(projectedContent, navigationContext, options = {}) {
        const adapter = this.manager.getLegacyAdapter('PromptFormatter');
        return await adapter.format(projectedContent, navigationContext, options);
    }

    async formatAsStructured(context, options) {
        return await this.manager.formatStructured(context, {}, options);
    }

    async formatAsConversational(context, options) {
        return await this.manager.formatConversational(context, {}, options);
    }

    async formatAsJSON(context, options) {
        return await this.manager.formatJSON(context, {}, options);
    }

    async formatAsMarkdown(context, options) {
        return await this.manager.formatMarkdown(context, {}, options);
    }

    async formatAsAnalytical(context, options) {
        // Map to structured format for now
        return await this.manager.formatStructured(context, {}, options);
    }

    getAvailableFormats() {
        return ['structured', 'conversational', 'json', 'markdown', 'analytical'];
    }
}

/**
 * MCP prompts compatibility wrapper
 */
export class MCPPromptsCompat {
    constructor() {
        this.manager = getPromptManager();
    }

    async executePromptWorkflow(prompt, args, toolExecutor) {
        const adapter = this.manager.getLegacyAdapter('MCP');
        return await adapter.executePromptWorkflow(prompt, args, toolExecutor);
    }

    validatePromptArguments(prompt, providedArgs) {
        const adapter = this.manager.getLegacyAdapter('MCP');
        return adapter.validatePromptArguments(prompt, providedArgs);
    }

    listPrompts() {
        return this.manager.listTemplates().filter(t => t.isWorkflow);
    }

    getPrompt(name) {
        return this.manager.getTemplate(name);
    }
}

/**
 * Migration helpers
 */
export class MigrationHelper {
    static async migratePromptTemplates(originalPromptTemplates) {
        const manager = getPromptManager();
        await manager.loadTemplatesFromPromptTemplates(originalPromptTemplates);
        logger.info('Migrated PromptTemplates to unified system');
    }

    static async migrateMCPRegistry(mcpRegistry) {
        const manager = getPromptManager();
        await manager.loadTemplatesFromMCP(mcpRegistry);
        logger.info('Migrated MCP registry to unified system');
    }

    static createContextFromLegacy(system, context, query, model) {
        return createPromptContext({
            systemPrompt: system,
            context: context,
            query: query,
            model: model
        });
    }

    static createOptionsFromLegacy(options) {
        return createPromptOptions({
            format: options.format || 'structured',
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            includeMetadata: options.includeMetadata,
            includeInstructions: options.includeInstructions
        });
    }
}

/**
 * Gradual migration utilities
 */
export class GradualMigration {
    static wrapLLMHandler(originalHandler) {
        return new Proxy(originalHandler, {
            get(target, prop) {
                if (prop === 'generateResponse') {
                    return async function(prompt, context, options = {}) {
                        // Check if unified system should be used
                        if (options.useUnifiedSystem) {
                            const manager = getPromptManager();
                            const promptContext = createPromptContext({
                                query: prompt,
                                context: context,
                                model: this.chatModel,
                                temperature: options.temperature || this.temperature
                            });
                            
                            const promptOptions = createPromptOptions({
                                format: 'chat',
                                ...options
                            });
                            
                            const result = await manager.generatePrompt('default-chat', promptContext, promptOptions);
                            return result.content;
                        }
                        
                        // Fall back to original implementation
                        return await target[prop].call(this, prompt, context, options);
                    };
                }
                
                return target[prop];
            }
        });
    }

    static wrapContextManager(originalManager) {
        return new Proxy(originalManager, {
            get(target, prop) {
                if (prop === 'formatContext') {
                    return function(context, options = {}) {
                        // Check if unified system should be used
                        if (options.useUnifiedSystem) {
                            const manager = getPromptManager();
                            const promptContext = createPromptContext({
                                context: context,
                                ...options
                            });
                            
                            return manager.formatStructured({ content: context }, promptContext, options);
                        }
                        
                        // Fall back to original implementation
                        return target[prop].call(this, context, options);
                    };
                }
                
                return target[prop];
            }
        });
    }
}

/**
 * Feature flags for gradual rollout
 */
export class FeatureFlags {
    static flags = {
        useUnifiedPromptSystem: false,
        enablePromptCaching: true,
        validateTemplates: true,
        logPromptMetrics: false
    };

    static isEnabled(flagName) {
        return this.flags[flagName] === true;
    }

    static enable(flagName) {
        this.flags[flagName] = true;
        logger.info(`Feature flag enabled: ${flagName}`);
    }

    static disable(flagName) {
        this.flags[flagName] = false;
        logger.info(`Feature flag disabled: ${flagName}`);
    }

    static configure(flags) {
        this.flags = { ...this.flags, ...flags };
        logger.info('Feature flags configured:', this.flags);
    }
}

/**
 * Monitoring and metrics
 */
export class PromptMetrics {
    static metrics = {
        legacyCallsTotal: 0,
        unifiedCallsTotal: 0,
        migrationProgress: 0,
        errorRate: 0,
        performanceGain: 0
    };

    static recordLegacyCall(method) {
        this.metrics.legacyCallsTotal++;
        logger.debug(`Legacy call: ${method}`);
    }

    static recordUnifiedCall(method) {
        this.metrics.unifiedCallsTotal++;
        logger.debug(`Unified call: ${method}`);
    }

    static calculateMigrationProgress() {
        const total = this.metrics.legacyCallsTotal + this.metrics.unifiedCallsTotal;
        if (total === 0) return 0;
        return (this.metrics.unifiedCallsTotal / total) * 100;
    }

    static getReport() {
        return {
            ...this.metrics,
            migrationProgress: this.calculateMigrationProgress()
        };
    }
}

/**
 * Export compatibility instances
 */
export const PromptTemplates = PromptTemplatesCompat;
export const PromptFormatter = PromptFormatterCompat;
export const MCPPrompts = MCPPromptsCompat;

// Export manager for direct access
export { getPromptManager };

// Default export for easy importing
export default {
    PromptTemplates: PromptTemplatesCompat,
    PromptFormatter: PromptFormatterCompat,
    MCPPrompts: MCPPromptsCompat,
    MigrationHelper,
    GradualMigration,
    FeatureFlags,
    PromptMetrics,
    getPromptManager
};