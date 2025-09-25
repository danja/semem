/**
 * Unified prompt system interfaces
 * 
 * This module defines the core interfaces for the unified prompt management system.
 * These interfaces are designed to be compatible with existing systems while providing
 * a consistent foundation for all prompt operations.
 */

/**
 * Standard prompt context interface
 * Unifies context handling across all prompt systems
 */
export class PromptContext {
    constructor(options = {}) {
        this.id = options.id || this.generateId();
        this.timestamp = options.timestamp || new Date().toISOString();
        this.session = options.session || null;
        this.user = options.user || null;

        // Core content
        this.query = options.query || '';
        this.systemPrompt = options.systemPrompt || '';
        this.context = options.context || '';
        this.memory = options.memory || null;

        // Model and generation settings
        this.model = options.model;
        this.temperature = options.temperature;
        this.maxTokens = options.maxTokens || null;

        // Metadata and tracking
        this.metadata = options.metadata || {};
        this.execution = options.execution || {};

        // Format and output preferences
        this.format = options.format || 'structured';
        this.instructions = options.instructions || null;
        this.includeMetadata = options.includeMetadata !== false;

        // Workflow context (for MCP compatibility)
        this.workflow = options.workflow || null;
        this.stepResults = options.stepResults || {};
        this.arguments = options.arguments || {};
    }

    generateId() {
        return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clone context with modifications
     */
    clone(modifications = {}) {
        return new PromptContext({
            ...this,
            ...modifications,
            metadata: { ...this.metadata, ...modifications.metadata },
            execution: { ...this.execution, ...modifications.execution },
            stepResults: { ...this.stepResults, ...modifications.stepResults },
            arguments: { ...this.arguments, ...modifications.arguments }
        });
    }

    /**
     * Add memory context
     */
    addMemory(memoryContext) {
        this.memory = memoryContext;
        return this;
    }

    /**
     * Add step result (for workflow compatibility)
     */
    addStepResult(stepName, result) {
        this.stepResults[stepName] = result;
        return this;
    }

    /**
     * Set workflow context
     */
    setWorkflow(workflowName, args = {}) {
        this.workflow = workflowName;
        this.arguments = { ...this.arguments, ...args };
        return this;
    }

    /**
     * Convert to legacy PromptTemplates format
     */
    toLegacyFormat() {
        return {
            system: this.systemPrompt,
            context: this.context,
            query: this.query,
            model: this.model,
            temperature: this.temperature
        };
    }

    /**
     * Convert to MCP workflow format
     */
    toMCPFormat() {
        return {
            promptName: this.workflow || 'custom',
            arguments: this.arguments,
            stepResults: this.stepResults,
            executionId: this.id,
            metadata: this.metadata
        };
    }
}

/**
 * Unified prompt template interface
 * Supports both static templates and dynamic workflows
 */
export class PromptTemplate {
    constructor(options = {}) {
        this.name = options.name || 'unnamed';
        this.description = options.description || '';
        this.version = options.version || '1.0';
        this.category = options.category || 'general';

        // Template content
        this.content = options.content || '';
        this.systemPrompt = options.systemPrompt || '';
        this.format = options.format || 'chat';

        // Arguments and validation
        this.arguments = options.arguments || [];
        this.required = options.required || [];
        this.defaults = options.defaults || {};

        // Model compatibility
        this.modelVariants = options.modelVariants || {};
        this.supportedModels = options.supportedModels || ['*'];

        // Workflow support
        this.workflow = options.workflow || null;
        this.isWorkflow = Boolean(options.workflow);

        // Metadata
        this.metadata = options.metadata || {};
        this.tags = options.tags || [];

        // Validation
        this.validate();
    }

    /**
     * Validate template structure
     */
    validate() {
        if (!this.name || this.name.trim() === '') {
            throw new Error('Template name is required');
        }

        if (this.isWorkflow && !this.workflow) {
            throw new Error('Workflow templates must have workflow definition');
        }

        // Validate arguments
        for (const arg of this.arguments) {
            if (!arg.name || !arg.type) {
                throw new Error(`Invalid argument definition: ${JSON.stringify(arg)}`);
            }
        }

        return true;
    }

    /**
     * Check if template supports a specific model
     */
    supportsModel(modelName) {
        if (this.supportedModels.includes('*')) return true;
        return this.supportedModels.some(model =>
            modelName.toLowerCase().includes(model.toLowerCase())
        );
    }

    /**
     * Get model-specific variant
     */
    getModelVariant(modelName) {
        const baseModel = modelName.split(':')[0].toLowerCase();
        return this.modelVariants[baseModel] || this.modelVariants.default || this;
    }

    /**
     * Render template with context
     */
    render(context) {
        if (this.isWorkflow) {
            return this.renderWorkflow(context);
        }
        return this.renderStatic(context);
    }

    /**
     * Render static template
     */
    renderStatic(context) {
        let rendered = this.content;

        // Replace variables
        rendered = rendered.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            if (context.arguments && varName in context.arguments) {
                return context.arguments[varName];
            }
            if (context[varName] !== undefined) {
                return context[varName];
            }
            return match;
        });

        return {
            content: rendered,
            systemPrompt: this.systemPrompt,
            format: this.format,
            metadata: this.metadata
        };
    }

    /**
     * Render workflow template
     */
    renderWorkflow(context) {
        return {
            workflow: this.workflow,
            arguments: this.extractArguments(context),
            metadata: this.metadata
        };
    }

    /**
     * Extract arguments from context
     */
    extractArguments(context) {
        const args = {};

        for (const argDef of this.arguments) {
            let value = context.arguments?.[argDef.name] || context[argDef.name];

            // Use default if not provided
            if (value === undefined && argDef.default !== undefined) {
                value = argDef.default;
            }

            // Apply defaults from template
            if (value === undefined && this.defaults[argDef.name] !== undefined) {
                value = this.defaults[argDef.name];
            }

            args[argDef.name] = value;
        }

        return args;
    }

    /**
     * Convert to legacy PromptTemplates format
     */
    toLegacyFormat() {
        return {
            chat: (system, context, query) => {
                const promptContext = new PromptContext({
                    systemPrompt: system,
                    context,
                    query,
                    arguments: { system, context, query }
                });

                const rendered = this.render(promptContext);
                return this.formatAsMessages(rendered, system, context, query);
            },
            completion: (context, query) => {
                return this.formatAsCompletion(context, query);
            },
            extractConcepts: (text) => {
                return this.formatConceptExtraction(text);
            }
        };
    }

    /**
     * Format as chat messages
     */
    formatAsMessages(rendered, system, context, query) {
        const messages = [];

        if (system) {
            messages.push({ role: 'system', content: system });
        }

        if (context) {
            messages.push({
                role: 'user',
                content: `Context: ${context}\n\nQuery: ${query}`
            });
        } else {
            messages.push({ role: 'user', content: query });
        }

        return messages;
    }

    /**
     * Format as completion prompt
     */
    formatAsCompletion(context, query) {
        return `${context ? `Context: ${context}\n\n` : ''}Query: ${query}`;
    }

    /**
     * Format for concept extraction
     */
    formatConceptExtraction(text) {
        return `Extract key concepts from the following text and return them as a JSON array: "${text}"`;
    }
}

/**
 * Unified prompt options interface
 */
export class PromptOptions {
    constructor(options = {}) {
        // Generation options
        this.temperature = options.temperature;
        this.maxTokens = options.maxTokens || null;
        this.topP = options.topP || null;
        this.topK = options.topK || null;
        this.frequencyPenalty = options.frequencyPenalty || null;
        this.presencePenalty = options.presencePenalty || null;

        // Format options
        this.format = options.format || 'structured';
        this.includeInstructions = options.includeInstructions !== false;
        this.includeMetadata = options.includeMetadata !== false;
        this.contextMarkers = options.contextMarkers || false;

        // Execution options
        this.retries = options.retries || 3;
        this.timeout = options.timeout || 60000;
        this.streaming = options.streaming || false;
        this.debug = options.debug || false;

        // Memory and context options
        this.useMemory = options.useMemory !== false;
        this.contextLimit = options.contextLimit || 10;
        this.memoryThreshold = options.memoryThreshold;

        // Workflow options
        this.workflow = options.workflow || null;
        this.stepByStep = options.stepByStep || false;
        this.validateSteps = options.validateSteps !== false;

        // Legacy compatibility
        this.legacyMode = options.legacyMode || false;
        this.adaptiveRetries = options.adaptiveRetries !== false;

        // Custom extensions
        this.extensions = options.extensions || {};
    }

    /**
     * Merge with other options
     */
    merge(other) {
        return new PromptOptions({
            ...this,
            ...other,
            extensions: { ...this.extensions, ...other.extensions }
        });
    }

    /**
     * Get options for specific format
     */
    getFormatOptions(format) {
        const formatDefaults = {
            structured: { includeInstructions: true, includeMetadata: true },
            conversational: { includeInstructions: false, includeMetadata: false },
            json: { includeInstructions: false, includeMetadata: false },
            analytical: { includeInstructions: true, includeMetadata: true },
            markdown: { includeInstructions: false, includeMetadata: true }
        };

        return this.merge(formatDefaults[format] || {});
    }

    /**
     * Convert to legacy format
     */
    toLegacyFormat() {
        return {
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            timeout: this.timeout,
            retries: this.retries,
            useMemory: this.useMemory,
            contextLimit: this.contextLimit
        };
    }

    /**
     * Convert to MCP format
     */
    toMCPFormat() {
        return {
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            structuredResponse: this.format === 'json',
            includeConfidence: this.includeMetadata,
            workflowValidation: this.validateSteps
        };
    }
}

/**
 * Prompt result interface
 */
export class PromptResult {
    constructor(options = {}) {
        this.id = options.id || null;
        this.timestamp = options.timestamp || new Date().toISOString();
        this.success = options.success !== false;

        // Content
        this.content = options.content || '';
        this.format = options.format || 'text';
        this.metadata = options.metadata || {};

        // Execution info
        this.executionTime = options.executionTime || 0;
        this.tokenCount = options.tokenCount || 0;
        this.model = options.model || null;
        this.temperature = options.temperature || null;

        // Error handling
        this.error = options.error || null;
        this.warnings = options.warnings || [];

        // Workflow results
        this.workflow = options.workflow || null;
        this.stepResults = options.stepResults || [];

        // Context preservation
        this.originalContext = options.originalContext || null;
        this.template = options.template || null;
    }

    /**
     * Check if result is successful
     */
    isSuccess() {
        return this.success && !this.error;
    }

    /**
     * Get content with metadata
     */
    getFullContent() {
        if (!this.metadata || Object.keys(this.metadata).length === 0) {
            return this.content;
        }

        return {
            content: this.content,
            metadata: this.metadata,
            format: this.format
        };
    }
}

/**
 * Validation utilities
 */
export class PromptValidation {
    static validateContext(context) {
        if (!(context instanceof PromptContext)) {
            throw new Error('Context must be a PromptContext instance');
        }
        return true;
    }

    static validateTemplate(template) {
        if (!(template instanceof PromptTemplate)) {
            throw new Error('Template must be a PromptTemplate instance');
        }
        return template.validate();
    }

    static validateOptions(options) {
        if (!(options instanceof PromptOptions)) {
            throw new Error('Options must be a PromptOptions instance');
        }
        return true;
    }
}

/**
 * Factory functions for easy creation
 */
export function createPromptContext(options) {
    return new PromptContext(options);
}

export function createPromptTemplate(options) {
    return new PromptTemplate(options);
}

export function createPromptOptions(options) {
    return new PromptOptions(options);
}

export function createPromptResult(options) {
    return new PromptResult(options);
}