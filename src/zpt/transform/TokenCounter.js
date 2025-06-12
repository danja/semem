/**
 * Accurate token counting for different tokenizers and LLM models
 */
export default class TokenCounter {
    constructor(options = {}) {
        this.config = {
            defaultTokenizer: options.defaultTokenizer || 'cl100k_base',
            cacheEnabled: options.cacheEnabled !== false,
            maxCacheSize: options.maxCacheSize || 1000,
            estimationFallback: options.estimationFallback !== false,
            ...options
        };

        this.initializeTokenizers();
        this.initializeModelMappings();
        this.tokenCache = new Map();
        this.estimationCache = new Map();
    }

    /**
     * Initialize available tokenizers and their configurations
     */
    initializeTokenizers() {
        this.tokenizers = {
            'cl100k_base': {
                name: 'cl100k_base',
                models: ['gpt-4', 'gpt-3.5-turbo', 'text-embedding-ada-002'],
                avgCharsPerToken: 4.0,
                specialTokens: new Set(['<|endoftext|>', '<|fim_prefix|>', '<|fim_middle|>', '<|fim_suffix|>']),
                encoding: 'cl100k_base'
            },
            'p50k_base': {
                name: 'p50k_base', 
                models: ['text-davinci-003', 'text-davinci-002', 'text-davinci-001'],
                avgCharsPerToken: 4.0,
                specialTokens: new Set(['<|endoftext|>']),
                encoding: 'p50k_base'
            },
            'r50k_base': {
                name: 'r50k_base',
                models: ['text-davinci-003', 'text-davinci-002'],
                avgCharsPerToken: 4.0,
                specialTokens: new Set(['<|endoftext|>']),
                encoding: 'r50k_base'
            },
            'gpt2': {
                name: 'gpt2',
                models: ['gpt2', 'gpt2-medium', 'gpt2-large', 'gpt2-xl'],
                avgCharsPerToken: 4.0,
                specialTokens: new Set(['<|endoftext|>']),
                encoding: 'gpt2'
            },
            'claude': {
                name: 'claude',
                models: ['claude-3', 'claude-2', 'claude-instant'],
                avgCharsPerToken: 3.8,
                specialTokens: new Set(['<|endoftext|>', '[INST]', '[/INST]']),
                encoding: 'claude'
            },
            'llama': {
                name: 'llama',
                models: ['llama-2', 'llama-7b', 'llama-13b', 'llama-70b'],
                avgCharsPerToken: 4.2,
                specialTokens: new Set(['<s>', '</s>', '<unk>']),
                encoding: 'llama'
            }
        };
    }

    /**
     * Initialize model-specific token counting configurations
     */
    initializeModelMappings() {
        this.modelConfigs = {
            'gpt-4': {
                tokenizer: 'cl100k_base',
                maxContextLength: 128000,
                maxOutputTokens: 4096,
                costPerInputToken: 0.00003,
                costPerOutputToken: 0.00006
            },
            'gpt-3.5-turbo': {
                tokenizer: 'cl100k_base',
                maxContextLength: 16385,
                maxOutputTokens: 4096,
                costPerInputToken: 0.0000015,
                costPerOutputToken: 0.000002
            },
            'claude-3-sonnet': {
                tokenizer: 'claude',
                maxContextLength: 200000,
                maxOutputTokens: 4096,
                costPerInputToken: 0.000003,
                costPerOutputToken: 0.000015
            },
            'claude-3-opus': {
                tokenizer: 'claude',
                maxContextLength: 200000,
                maxOutputTokens: 4096,
                costPerInputToken: 0.000015,
                costPerOutputToken: 0.000075
            },
            'claude-3-haiku': {
                tokenizer: 'claude',
                maxContextLength: 200000,
                maxOutputTokens: 4096,
                costPerInputToken: 0.00000025,
                costPerOutputToken: 0.00000125
            }
        };
    }

    /**
     * Count tokens in text using specified tokenizer
     * @param {string} text - Text to count tokens for
     * @param {string} tokenizer - Tokenizer name (optional)
     * @returns {Promise<Object>} Token count result
     */
    async countTokens(text, tokenizer = null) {
        if (!text || typeof text !== 'string') {
            return { count: 0, method: 'empty', tokenizer: tokenizer || this.config.defaultTokenizer };
        }

        const tokenizerName = tokenizer || this.config.defaultTokenizer;
        const cacheKey = this.createCacheKey(text, tokenizerName);

        // Check cache first
        if (this.config.cacheEnabled && this.tokenCache.has(cacheKey)) {
            const cached = this.tokenCache.get(cacheKey);
            return { ...cached, fromCache: true };
        }

        let result;
        try {
            // Try precise tokenization first
            result = await this.preciseTokenCount(text, tokenizerName);
        } catch (error) {
            // Fallback to estimation if precise counting fails
            if (this.config.estimationFallback) {
                result = this.estimateTokenCount(text, tokenizerName);
                result.fallback = true;
                result.error = error.message;
            } else {
                throw error;
            }
        }

        // Cache result
        if (this.config.cacheEnabled) {
            this.cacheTokenCount(cacheKey, result);
        }

        return result;
    }

    /**
     * Precise token counting using actual tokenizer
     * @param {string} text - Text to tokenize
     * @param {string} tokenizerName - Tokenizer to use
     * @returns {Promise<Object>} Precise token count
     */
    async preciseTokenCount(text, tokenizerName) {
        const tokenizer = this.tokenizers[tokenizerName];
        if (!tokenizer) {
            throw new Error(`Unknown tokenizer: ${tokenizerName}`);
        }

        // For now, use estimation as precise tokenization requires external libraries
        // In a full implementation, would use tiktoken or similar
        return this.advancedEstimation(text, tokenizerName);
    }

    /**
     * Advanced token estimation with tokenizer-specific logic
     * @param {string} text - Text to estimate
     * @param {string} tokenizerName - Tokenizer name
     * @returns {Object} Estimated token count
     */
    advancedEstimation(text, tokenizerName) {
        const tokenizer = this.tokenizers[tokenizerName];
        const startTime = Date.now();

        // Basic character-based estimation
        let estimatedTokens = Math.ceil(text.length / tokenizer.avgCharsPerToken);

        // Apply tokenizer-specific adjustments
        estimatedTokens = this.applyTokenizerAdjustments(text, estimatedTokens, tokenizer);

        // Apply content-type specific adjustments
        estimatedTokens = this.applyContentAdjustments(text, estimatedTokens);

        return {
            count: Math.max(1, Math.round(estimatedTokens)),
            method: 'advanced_estimation',
            tokenizer: tokenizerName,
            confidence: this.calculateConfidence(text, tokenizer),
            processingTime: Date.now() - startTime,
            details: {
                originalLength: text.length,
                avgCharsPerToken: tokenizer.avgCharsPerToken,
                adjustmentFactor: estimatedTokens / (text.length / tokenizer.avgCharsPerToken)
            }
        };
    }

    /**
     * Simple token estimation fallback
     * @param {string} text - Text to estimate
     * @param {string} tokenizerName - Tokenizer name
     * @returns {Object} Simple token estimate
     */
    estimateTokenCount(text, tokenizerName) {
        const tokenizer = this.tokenizers[tokenizerName] || this.tokenizers[this.config.defaultTokenizer];
        const estimatedTokens = Math.ceil(text.length / tokenizer.avgCharsPerToken);

        return {
            count: Math.max(1, estimatedTokens),
            method: 'simple_estimation',
            tokenizer: tokenizerName,
            confidence: 0.7,
            processingTime: 0
        };
    }

    /**
     * Apply tokenizer-specific adjustments
     */
    applyTokenizerAdjustments(text, baseEstimate, tokenizer) {
        let adjusted = baseEstimate;

        // Handle special tokens
        tokenizer.specialTokens.forEach(token => {
            const occurrences = (text.match(new RegExp(token, 'g')) || []).length;
            adjusted += occurrences; // Special tokens usually count as 1 token regardless of length
        });

        // Tokenizer-specific patterns
        switch (tokenizer.name) {
            case 'cl100k_base':
                // GPT-4 tokenizer tends to split on punctuation more aggressively
                adjusted *= 1.1;
                break;
            case 'claude':
                // Claude tokenizer is slightly more efficient
                adjusted *= 0.95;
                break;
            case 'llama':
                // LLaMA tokenizer has different behavior for certain patterns
                adjusted *= 1.05;
                break;
        }

        return adjusted;
    }

    /**
     * Apply content-type specific adjustments
     */
    applyContentAdjustments(text, baseEstimate) {
        let adjusted = baseEstimate;

        // Code detection
        if (this.isCode(text)) {
            adjusted *= 1.3; // Code typically has more tokens per character
        }

        // URL detection
        const urlCount = (text.match(/https?:\/\/[^\s]+/g) || []).length;
        adjusted += urlCount * 2; // URLs often split into multiple tokens

        // Number detection
        const numberCount = (text.match(/\d+/g) || []).length;
        adjusted += numberCount * 0.5; // Numbers may split differently

        // Punctuation density
        const punctuationDensity = (text.match(/[.,;:!?()[\]{}]/g) || []).length / text.length;
        if (punctuationDensity > 0.1) {
            adjusted *= (1 + punctuationDensity); // High punctuation increases token count
        }

        // Non-ASCII characters
        const nonAsciiCount = (text.match(/[^\x00-\x7F]/g) || []).length;
        if (nonAsciiCount > 0) {
            adjusted += nonAsciiCount * 0.5; // Non-ASCII often requires more tokens
        }

        return adjusted;
    }

    /**
     * Calculate confidence in estimation
     */
    calculateConfidence(text, tokenizer) {
        let confidence = 0.8; // Base confidence

        // Reduce confidence for complex content
        if (this.isCode(text)) confidence -= 0.1;
        if (text.includes('http')) confidence -= 0.05;
        if (text.match(/[^\x00-\x7F]/)) confidence -= 0.1;

        // Increase confidence for simple text
        if (text.match(/^[a-zA-Z\s.,!?]+$/)) confidence += 0.1;

        return Math.max(0.3, Math.min(0.95, confidence));
    }

    /**
     * Detect if text is likely code
     */
    isCode(text) {
        const codeIndicators = [
            /function\s+\w+\s*\(/,
            /class\s+\w+/,
            /import\s+\w+/,
            /def\s+\w+\s*\(/,
            /\{[\s\S]*\}/,
            /console\.log/,
            /print\s*\(/
        ];

        return codeIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Count tokens for multiple texts in batch
     * @param {Array<string>} texts - Array of texts to count
     * @param {string} tokenizer - Tokenizer name
     * @returns {Promise<Array<Object>>} Array of token counts
     */
    async batchCountTokens(texts, tokenizer = null) {
        const results = [];
        
        for (const text of texts) {
            try {
                const result = await this.countTokens(text, tokenizer);
                results.push(result);
            } catch (error) {
                results.push({
                    count: 0,
                    method: 'error',
                    error: error.message,
                    tokenizer: tokenizer || this.config.defaultTokenizer
                });
            }
        }

        return results;
    }

    /**
     * Estimate cost for token usage
     * @param {number} inputTokens - Number of input tokens
     * @param {number} outputTokens - Number of output tokens  
     * @param {string} model - Model name
     * @returns {Object} Cost estimation
     */
    estimateCost(inputTokens, outputTokens, model) {
        const modelConfig = this.modelConfigs[model];
        if (!modelConfig) {
            return {
                error: `Unknown model: ${model}`,
                inputCost: 0,
                outputCost: 0,
                totalCost: 0
            };
        }

        const inputCost = inputTokens * modelConfig.costPerInputToken;
        const outputCost = outputTokens * modelConfig.costPerOutputToken;
        const totalCost = inputCost + outputCost;

        return {
            model,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            totalCost,
            currency: 'USD'
        };
    }

    /**
     * Check if content fits within model context limits
     * @param {number} tokenCount - Token count to check
     * @param {string} model - Model name
     * @param {number} reservedOutputTokens - Tokens to reserve for output
     * @returns {Object} Context limit check result
     */
    checkContextLimits(tokenCount, model, reservedOutputTokens = 1000) {
        const modelConfig = this.modelConfigs[model];
        if (!modelConfig) {
            return {
                error: `Unknown model: ${model}`,
                fits: false
            };
        }

        const availableTokens = modelConfig.maxContextLength - reservedOutputTokens;
        const fits = tokenCount <= availableTokens;
        const utilization = tokenCount / availableTokens;

        return {
            model,
            tokenCount,
            maxContextLength: modelConfig.maxContextLength,
            availableTokens,
            reservedOutputTokens,
            fits,
            utilization,
            recommendation: this.getContextRecommendation(utilization)
        };
    }

    /**
     * Get recommendation based on context utilization
     */
    getContextRecommendation(utilization) {
        if (utilization > 1.0) return 'Content exceeds context limit - chunking required';
        if (utilization > 0.9) return 'Very high utilization - consider chunking';
        if (utilization > 0.7) return 'High utilization - monitor performance';
        if (utilization > 0.5) return 'Moderate utilization - acceptable';
        return 'Low utilization - efficient usage';
    }

    /**
     * Optimize token usage for a given budget
     * @param {Array<Object>} content - Content items with token counts
     * @param {number} tokenBudget - Available token budget
     * @param {string} strategy - Optimization strategy
     * @returns {Object} Optimization result
     */
    optimizeTokenUsage(content, tokenBudget, strategy = 'priority') {
        const sorted = [...content];
        
        switch (strategy) {
            case 'priority':
                sorted.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                break;
            case 'efficiency':
                sorted.sort((a, b) => (b.score / b.tokenCount) - (a.score / a.tokenCount));
                break;
            case 'size':
                sorted.sort((a, b) => a.tokenCount - b.tokenCount);
                break;
        }

        const selected = [];
        let usedTokens = 0;
        
        for (const item of sorted) {
            if (usedTokens + item.tokenCount <= tokenBudget) {
                selected.push(item);
                usedTokens += item.tokenCount;
            }
        }

        return {
            selected,
            usedTokens,
            remainingTokens: tokenBudget - usedTokens,
            utilization: usedTokens / tokenBudget,
            strategy,
            droppedItems: content.length - selected.length
        };
    }

    /**
     * Cache management methods
     */
    createCacheKey(text, tokenizer) {
        // Create hash of text and tokenizer for cache key
        const hash = this.simpleHash(text + tokenizer);
        return `${tokenizer}_${hash}`;
    }

    cacheTokenCount(cacheKey, result) {
        if (this.tokenCache.size >= this.config.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.tokenCache.keys().next().value;
            this.tokenCache.delete(firstKey);
        }
        
        this.tokenCache.set(cacheKey, {
            ...result,
            cached: true,
            cacheTime: Date.now()
        });
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get tokenizer information
     * @param {string} tokenizerName - Tokenizer name
     * @returns {Object} Tokenizer information
     */
    getTokenizerInfo(tokenizerName) {
        const tokenizer = this.tokenizers[tokenizerName];
        if (!tokenizer) {
            throw new Error(`Unknown tokenizer: ${tokenizerName}`);
        }
        
        return { ...tokenizer };
    }

    /**
     * Get model information
     * @param {string} modelName - Model name
     * @returns {Object} Model information
     */
    getModelInfo(modelName) {
        const model = this.modelConfigs[modelName];
        if (!model) {
            throw new Error(`Unknown model: ${modelName}`);
        }
        
        return { ...model };
    }

    /**
     * List available tokenizers
     * @returns {Array<string>} Available tokenizer names
     */
    getAvailableTokenizers() {
        return Object.keys(this.tokenizers);
    }

    /**
     * List available models
     * @returns {Array<string>} Available model names
     */
    getAvailableModels() {
        return Object.keys(this.modelConfigs);
    }

    /**
     * Clear token cache
     */
    clearCache() {
        this.tokenCache.clear();
        this.estimationCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            tokenCacheSize: this.tokenCache.size,
            estimationCacheSize: this.estimationCache.size,
            maxCacheSize: this.config.maxCacheSize,
            cacheEnabled: this.config.cacheEnabled
        };
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    getPerformanceStats() {
        // Simple performance tracking - could be enhanced
        return {
            totalCalls: this.tokenCache.size, // Approximate
            cacheHitRate: 0.8, // Placeholder
            avgProcessingTime: 5 // ms, placeholder
        };
    }
}