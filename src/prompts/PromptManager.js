/**
 * Unified Prompt Management System
 * 
 * This class serves as the central coordinator for all prompt operations in Semem.
 * It provides a unified interface while maintaining backward compatibility with
 * existing systems (PromptTemplates, PromptFormatter, MCP workflows).
 */

import logger from 'loglevel';
import { 
    PromptContext, 
    PromptTemplate, 
    PromptOptions, 
    PromptResult,
    PromptValidation 
} from './interfaces.js';

export default class PromptManager {
    constructor(options = {}) {
        this.options = {
            enableLegacySupport: options.enableLegacySupport !== false,
            cacheTemplates: options.cacheTemplates !== false,
            validateTemplates: options.validateTemplates !== false,
            logLevel: options.logLevel || 'info',
            ...options
        };
        
        // Template storage
        this.templates = new Map();
        this.templateCache = new Map();
        
        // Format handlers
        this.formatters = new Map();
        this.initializeFormatters();
        
        // Model-specific handlers
        this.modelHandlers = new Map();
        
        // Legacy compatibility
        this.legacyAdapters = new Map();
        this.initializeLegacyAdapters();
        
        // Statistics
        this.stats = {
            templatesLoaded: 0,
            promptsGenerated: 0,
            cacheHits: 0,
            errors: 0
        };
        
        logger.info('PromptManager initialized with options:', this.options);
    }
    
    /**
     * Initialize format handlers
     */
    initializeFormatters() {
        this.formatters.set('structured', this.formatStructured.bind(this));
        this.formatters.set('conversational', this.formatConversational.bind(this));
        this.formatters.set('json', this.formatJSON.bind(this));
        this.formatters.set('markdown', this.formatMarkdown.bind(this));
        this.formatters.set('chat', this.formatChat.bind(this));
        this.formatters.set('completion', this.formatCompletion.bind(this));
    }
    
    /**
     * Initialize legacy adapters for backward compatibility
     */
    initializeLegacyAdapters() {
        // PromptTemplates adapter
        this.legacyAdapters.set('PromptTemplates', {
            formatChatPrompt: this.legacyFormatChatPrompt.bind(this),
            formatCompletionPrompt: this.legacyFormatCompletionPrompt.bind(this),
            formatConceptPrompt: this.legacyFormatConceptPrompt.bind(this),
            getTemplateForModel: this.legacyGetTemplateForModel.bind(this)
        });
        
        // PromptFormatter adapter
        this.legacyAdapters.set('PromptFormatter', {
            format: this.legacyFormat.bind(this),
            formatAsStructured: this.formatStructured.bind(this),
            formatAsConversational: this.formatConversational.bind(this),
            formatAsJSON: this.formatJSON.bind(this)
        });
        
        // MCP adapter
        this.legacyAdapters.set('MCP', {
            executePromptWorkflow: this.legacyExecuteWorkflow.bind(this),
            validatePromptArguments: this.legacyValidateArguments.bind(this)
        });
    }
    
    /**
     * Register a template
     */
    registerTemplate(template, options = {}) {
        try {
            // Convert from various formats to PromptTemplate
            const promptTemplate = this.normalizeTemplate(template);
            
            // Validate if requested
            if (this.options.validateTemplates) {
                PromptValidation.validateTemplate(promptTemplate);
            }
            
            // Store template
            this.templates.set(promptTemplate.name, promptTemplate);
            this.stats.templatesLoaded++;
            
            logger.debug(`Template registered: ${promptTemplate.name}`);
            
            return promptTemplate;
            
        } catch (error) {
            logger.error(`Failed to register template: ${error.message}`);
            this.stats.errors++;
            throw error;
        }
    }
    
    /**
     * Get a template by name
     */
    getTemplate(name) {
        return this.templates.get(name);
    }
    
    /**
     * List all templates
     */
    listTemplates() {
        return Array.from(this.templates.values());
    }
    
    /**
     * Generate a prompt using a template
     */
    async generatePrompt(templateName, context, options = {}) {
        const startTime = Date.now();
        
        try {
            // Get template
            const template = this.getTemplate(templateName);
            if (!template) {
                throw new Error(`Template not found: ${templateName}`);
            }
            
            // Normalize context
            const promptContext = this.normalizeContext(context);
            
            // Normalize options
            const promptOptions = this.normalizeOptions(options);
            
            // Generate prompt
            const result = await this.executeTemplate(template, promptContext, promptOptions);
            
            // Create result object
            const promptResult = new PromptResult({
                id: promptContext.id,
                content: result.content,
                format: result.format,
                metadata: result.metadata,
                executionTime: Date.now() - startTime,
                model: promptContext.model,
                temperature: promptContext.temperature,
                originalContext: promptContext,
                template: template
            });
            
            this.stats.promptsGenerated++;
            
            return promptResult;
            
        } catch (error) {
            logger.error(`Failed to generate prompt: ${error.message}`);
            this.stats.errors++;
            
            return new PromptResult({
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            });
        }
    }
    
    /**
     * Execute a template with context and options
     */
    async executeTemplate(template, context, options) {
        // Check cache first
        const cacheKey = this.getCacheKey(template.name, context, options);
        if (this.options.cacheTemplates && this.templateCache.has(cacheKey)) {
            this.stats.cacheHits++;
            return this.templateCache.get(cacheKey);
        }
        
        // Render template
        const rendered = template.render(context);
        
        // Apply formatting
        const formatted = await this.applyFormatting(rendered, context, options);
        
        // Cache result
        if (this.options.cacheTemplates) {
            this.templateCache.set(cacheKey, formatted);
        }
        
        return formatted;
    }
    
    /**
     * Apply formatting to rendered content
     */
    async applyFormatting(rendered, context, options) {
        const formatter = this.formatters.get(options.format);
        if (!formatter) {
            throw new Error(`Unknown format: ${options.format}`);
        }
        
        return await formatter(rendered, context, options);
    }
    
    /**
     * Format handlers
     */
    async formatStructured(rendered, context, options) {
        let content = '';
        
        // Header
        if (rendered.metadata?.title) {
            content += `# ${rendered.metadata.title}\n\n`;
        }
        
        // System prompt
        if (rendered.systemPrompt) {
            content += `## System Instructions\n${rendered.systemPrompt}\n\n`;
        }
        
        // Context
        if (context.context) {
            content += `## Context\n${context.context}\n\n`;
        }
        
        // Main content
        content += `## Query\n${rendered.content}\n\n`;
        
        // Metadata
        if (options.includeMetadata && rendered.metadata) {
            content += `## Metadata\n\`\`\`json\n${JSON.stringify(rendered.metadata, null, 2)}\n\`\`\`\n`;
        }
        
        return {
            content,
            format: 'structured',
            metadata: rendered.metadata
        };
    }
    
    async formatConversational(rendered, context, options) {
        let content = '';
        
        if (context.context) {
            content += `Based on the following context: ${context.context}\n\n`;
        }
        
        content += rendered.content;
        
        return {
            content,
            format: 'conversational',
            metadata: rendered.metadata
        };
    }
    
    async formatJSON(rendered, context, options) {
        const jsonContent = {
            query: rendered.content,
            context: context.context || null,
            systemPrompt: rendered.systemPrompt || null,
            metadata: options.includeMetadata ? rendered.metadata : null
        };
        
        return {
            content: JSON.stringify(jsonContent, null, 2),
            format: 'json',
            metadata: rendered.metadata
        };
    }
    
    async formatMarkdown(rendered, context, options) {
        let content = '# Prompt\n\n';
        
        if (rendered.systemPrompt) {
            content += `## System\n${rendered.systemPrompt}\n\n`;
        }
        
        if (context.context) {
            content += `## Context\n${context.context}\n\n`;
        }
        
        content += `## Query\n${rendered.content}\n\n`;
        
        return {
            content,
            format: 'markdown',
            metadata: rendered.metadata
        };
    }
    
    async formatChat(rendered, context, options) {
        const messages = [];
        
        if (rendered.systemPrompt) {
            messages.push({
                role: 'system',
                content: rendered.systemPrompt
            });
        }
        
        let userContent = rendered.content;
        if (context.context) {
            userContent = `Context: ${context.context}\n\nQuery: ${userContent}`;
        }
        
        messages.push({
            role: 'user',
            content: userContent
        });
        
        return {
            content: messages,
            format: 'chat',
            metadata: rendered.metadata
        };
    }
    
    async formatCompletion(rendered, context, options) {
        let content = '';
        
        if (context.context) {
            content += `Context: ${context.context}\n\n`;
        }
        
        content += `Query: ${rendered.content}`;
        
        return {
            content,
            format: 'completion',
            metadata: rendered.metadata
        };
    }
    
    /**
     * Normalize various input formats to standard interfaces
     */
    normalizeTemplate(template) {
        if (template instanceof PromptTemplate) {
            return template;
        }
        
        // Convert from various formats
        if (typeof template === 'string') {
            return new PromptTemplate({
                name: 'inline',
                content: template
            });
        }
        
        if (typeof template === 'object') {
            return new PromptTemplate(template);
        }
        
        throw new Error(`Cannot normalize template: ${typeof template}`);
    }
    
    normalizeContext(context) {
        if (context instanceof PromptContext) {
            return context;
        }
        
        if (typeof context === 'object') {
            return new PromptContext(context);
        }
        
        if (typeof context === 'string') {
            return new PromptContext({ query: context });
        }
        
        throw new Error(`Cannot normalize context: ${typeof context}`);
    }
    
    normalizeOptions(options) {
        if (options instanceof PromptOptions) {
            return options;
        }
        
        return new PromptOptions(options);
    }
    
    /**
     * Legacy compatibility methods
     */
    legacyFormatChatPrompt(modelName, system, context, query) {
        const template = new PromptTemplate({
            name: 'legacy-chat',
            content: query,
            systemPrompt: system,
            format: 'chat'
        });
        
        const promptContext = new PromptContext({
            query,
            systemPrompt: system,
            context,
            model: modelName
        });
        
        const options = new PromptOptions({ format: 'chat' });
        
        return this.executeTemplate(template, promptContext, options)
            .then(result => result.content);
    }
    
    legacyFormatCompletionPrompt(modelName, context, query) {
        const template = new PromptTemplate({
            name: 'legacy-completion',
            content: query,
            format: 'completion'
        });
        
        const promptContext = new PromptContext({
            query,
            context,
            model: modelName
        });
        
        const options = new PromptOptions({ format: 'completion' });
        
        return this.executeTemplate(template, promptContext, options)
            .then(result => result.content);
    }
    
    legacyFormatConceptPrompt(modelName, text) {
        const template = new PromptTemplate({
            name: 'legacy-concept',
            content: `Extract key concepts from the following text and return them as a JSON array: "${text}"`,
            format: 'completion'
        });
        
        const promptContext = new PromptContext({
            query: text,
            model: modelName
        });
        
        const options = new PromptOptions({ format: 'completion' });
        
        return this.executeTemplate(template, promptContext, options)
            .then(result => result.content);
    }
    
    legacyGetTemplateForModel(modelName) {
        // Return a legacy-compatible template object
        return {
            chat: (system, context, query) => this.legacyFormatChatPrompt(modelName, system, context, query),
            completion: (context, query) => this.legacyFormatCompletionPrompt(modelName, context, query),
            extractConcepts: (text) => this.legacyFormatConceptPrompt(modelName, text)
        };
    }
    
    async legacyFormat(projectedContent, navigationContext, options = {}) {
        const template = new PromptTemplate({
            name: 'legacy-format',
            content: JSON.stringify(projectedContent),
            format: options.format || 'structured'
        });
        
        const promptContext = new PromptContext({
            query: JSON.stringify(projectedContent),
            context: JSON.stringify(navigationContext),
            arguments: options
        });
        
        const promptOptions = new PromptOptions(options);
        
        const result = await this.executeTemplate(template, promptContext, promptOptions);
        
        return {
            content: result.content,
            format: result.format,
            metadata: result.metadata
        };
    }
    
    async legacyExecuteWorkflow(prompt, args, toolExecutor) {
        // Convert MCP workflow to unified format
        const template = new PromptTemplate({
            name: prompt.name,
            description: prompt.description,
            workflow: prompt.workflow,
            arguments: prompt.arguments,
            isWorkflow: true
        });
        
        const context = new PromptContext({
            workflow: prompt.name,
            arguments: args
        });
        
        const options = new PromptOptions({
            workflow: prompt.name,
            stepByStep: true
        });
        
        return await this.executeTemplate(template, context, options);
    }
    
    legacyValidateArguments(prompt, providedArgs) {
        const template = new PromptTemplate({
            name: prompt.name,
            arguments: prompt.arguments
        });
        
        try {
            template.validate();
            return { valid: true, errors: [], processedArgs: providedArgs };
        } catch (error) {
            return { valid: false, errors: [error.message], processedArgs: {} };
        }
    }
    
    /**
     * Utility methods
     */
    getCacheKey(templateName, context, options) {
        return `${templateName}:${context.id}:${options.format}`;
    }
    
    clearCache() {
        this.templateCache.clear();
        logger.info('Template cache cleared');
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Load templates from various sources
     */
    async loadTemplatesFromPromptTemplates(promptTemplates) {
        // Load from existing PromptTemplates.js
        const models = ['llama2', 'mistral'];
        
        for (const model of models) {
            const template = promptTemplates.getTemplateForModel(model);
            
            // Convert to unified format
            const chatTemplate = new PromptTemplate({
                name: `${model}-chat`,
                description: `Chat template for ${model}`,
                content: '${query}',
                systemPrompt: '${system}',
                format: 'chat',
                supportedModels: [model]
            });
            
            const completionTemplate = new PromptTemplate({
                name: `${model}-completion`,
                description: `Completion template for ${model}`,
                content: '${query}',
                format: 'completion',
                supportedModels: [model]
            });
            
            const conceptTemplate = new PromptTemplate({
                name: `${model}-concept`,
                description: `Concept extraction template for ${model}`,
                content: 'Extract key concepts from: ${text}',
                format: 'completion',
                supportedModels: [model]
            });
            
            this.registerTemplate(chatTemplate);
            this.registerTemplate(completionTemplate);
            this.registerTemplate(conceptTemplate);
        }
        
        logger.info('Loaded templates from PromptTemplates');
    }
    
    async loadTemplatesFromMCP(mcpRegistry) {
        // Load from MCP prompt registry
        const prompts = mcpRegistry.listPrompts();
        
        for (const prompt of prompts) {
            const template = new PromptTemplate({
                name: prompt.name,
                description: prompt.description,
                workflow: prompt.workflow,
                arguments: prompt.arguments,
                isWorkflow: true,
                category: 'mcp'
            });
            
            this.registerTemplate(template);
        }
        
        logger.info(`Loaded ${prompts.length} templates from MCP registry`);
    }
    
    /**
     * Get legacy adapter for backward compatibility
     */
    getLegacyAdapter(adapterName) {
        return this.legacyAdapters.get(adapterName);
    }
    
    /**
     * Health check
     */
    healthCheck() {
        return {
            status: 'healthy',
            templates: this.templates.size,
            formatters: this.formatters.size,
            stats: this.stats,
            cacheSize: this.templateCache.size
        };
    }
}