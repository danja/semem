import ContextWindowManager from './ContextWindowManager.js'
import logger from 'loglevel'

/**
 * Manages context windows and summaries for LLM interactions
 */
export default class ContextManager {
    constructor(options = {}, config = null) {
        this.config = config;
        this.maxTokens = options.maxTokens || 8192
        this.maxTimeWindow = options.maxTimeWindow || 24 * 60 * 60 * 1000 // 24 hours
        this.relevanceThreshold = options.relevanceThreshold
        this.maxContextSize = options.maxContextSize || 5
        this.contextBuffer = []

        // Get context truncation limit from config, default to no truncation (null)
        this.contextTruncationLimit = this.getContextTruncationLimit()

        this.windowManager = new ContextWindowManager({
            maxWindowSize: this.maxTokens,
            minWindowSize: Math.floor(this.maxTokens / 4),
            overlapRatio: options.overlapRatio
        })
    }

    /**
     * Get context truncation limit from config
     */
    getContextTruncationLimit() {
        if (!this.config) {
            return null; // No truncation if no config
        }

        const contextConfig = this.config.get('context') || {};
        return contextConfig.truncationLimit || null; // Default to no truncation
    }

    /**
     * Add interaction to context buffer with similarity score
     */
    addToContext(interaction, similarity = 1.0) {
        if (!interaction || typeof interaction !== 'object') {
            logger.warn('Invalid interaction provided to context')
            return
        }

        this.contextBuffer.push({
            ...interaction,
            similarity,
            addedAt: Date.now()
        })

        if (this.contextBuffer.length > this.maxContextSize * 2) {
            this.pruneContext()
        }
    }

    /**
     * Remove old or low-relevance items from context
     */
    pruneContext() {
        const now = Date.now()
        this.contextBuffer = this.contextBuffer
            .filter(item => {
                const age = now - item.addedAt
                return age < this.maxTimeWindow && item.similarity >= this.relevanceThreshold
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.maxContextSize)
    }

    /**
     * Create a concise summary of interactions grouped by concept
     */
    summarizeContext(interactions) {
        if (!Array.isArray(interactions) || interactions.length === 0) {
            return ''
        }

        const groupedInteractions = {}

        for (const interaction of interactions) {
            if (!interaction) continue

            const mainConcept = interaction.concepts?.[0] || 'general'
            if (!groupedInteractions[mainConcept]) {
                groupedInteractions[mainConcept] = []
            }
            groupedInteractions[mainConcept].push(interaction)
        }

        const summaries = []
        for (const [concept, group] of Object.entries(groupedInteractions)) {
            if (group.length === 1) {
                summaries.push(this.formatSingleInteraction(group[0]))
            } else {
                summaries.push(this.formatGroupSummary(concept, group))
            }
        }

        return summaries.join('\n\n')
    }

    /**
     * Format a single interaction for display
     */
    formatSingleInteraction(interaction) {
        if (!interaction?.prompt || !interaction?.output) {
            return ''
        }

        return `Q: ${interaction.prompt}\nA: ${interaction.output}`
    }

    /**
     * Create summary for a group of related interactions
     */
    formatGroupSummary(concept, interactions) {
        if (!Array.isArray(interactions) || interactions.length === 0) {
            return ''
        }

        const summaryLines = interactions
            .slice(0, 5) // Increased from 3 to 5 examples per group
            .map(i => {
                if (!i?.prompt || !i?.output) return null
                // Use configurable truncation limit, default to no truncation
                const truncatedOutput = this.contextTruncationLimit
                    ? i.output.substring(0, this.contextTruncationLimit)
                    : i.output
                return `- ${i.prompt} → ${truncatedOutput}${this.contextTruncationLimit && truncatedOutput.length < i.output.length ? '...' : ''}`
            })
            .filter(Boolean)

        if (summaryLines.length === 0) return ''

        return `Topic: ${concept}\n${summaryLines.join('\n')}`
    }

    /**
     * Build complete context including history and current prompt
     */
    buildContext(currentPrompt, retrievals = [], recentInteractions = [], options = {}) {
        if (!currentPrompt) {
            logger.warn('No current prompt provided to buildContext')
            return ''
        }

        this.pruneContext()

        // Add new relevant interactions
        retrievals?.forEach(retrieval => {
            if (retrieval?.interaction) {
                this.addToContext(retrieval.interaction, retrieval.similarity)
            }
        })

        // Add recent interactions
        recentInteractions?.forEach(interaction => {
            if (interaction) {
                this.addToContext(interaction, 0.9)
            }
        })

        const contextParts = []

        // Add system context if provided
        if (options.systemContext) {
            contextParts.push(`System Context: ${options.systemContext}`)
        }

        // Add summarized historical context
        const historicalContext = this.summarizeContext(
            this.contextBuffer.slice(0, this.maxContextSize)
        )

        if (historicalContext) {
            contextParts.push('Relevant Context:', historicalContext)
        }

        const fullContext = contextParts.join('\n\n')

        // Process through window manager if needed
        if (this.windowManager.estimateTokens(fullContext) > this.maxTokens) {
            const windows = this.windowManager.processContext(fullContext)
            return this.windowManager.mergeOverlappingContent(windows)
        }

        return fullContext
    }
}