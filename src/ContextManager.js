import ContextWindowManager from './ContextWindowManager.js'
import { logger } from './Utils.js';

export default class ContextManager {
    constructor(options = {}) {
        this.maxTokens = options.maxTokens || 8192;
        this.maxTimeWindow = options.maxTimeWindow || 24 * 60 * 60 * 1000; // 24 hours
        this.relevanceThreshold = options.relevanceThreshold || 0.7;
        this.maxContextSize = options.maxContextSize || 5;
        this.contextBuffer = [];

        this.windowManager = new ContextWindowManager({
            maxWindowSize: this.maxTokens,
            minWindowSize: Math.floor(this.maxTokens / 4),
            overlapRatio: options.overlapRatio || 0.1
        });
    }

    addToContext(interaction, similarity = 1.0) {
        this.contextBuffer.push({
            ...interaction,
            similarity,
            addedAt: Date.now()
        });

        // Keep buffer size manageable
        if (this.contextBuffer.length > this.maxContextSize * 2) {
            this.pruneContext();
        }
    }

    pruneContext() {
        const now = Date.now();
        this.contextBuffer = this.contextBuffer
            .filter(item => {
                const age = now - item.addedAt;
                return age < this.maxTimeWindow && item.similarity >= this.relevanceThreshold;
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.maxContextSize);
    }

    summarizeContext(interactions) {
        // Group interactions by topic/concept
        const groupedInteractions = {};

        for (const interaction of interactions) {
            const mainConcept = interaction.concepts?.[0] || 'general';
            if (!groupedInteractions[mainConcept]) {
                groupedInteractions[mainConcept] = [];
            }
            groupedInteractions[mainConcept].push(interaction);
        }

        // Create summaries for each group
        const summaries = [];
        for (const [concept, group] of Object.entries(groupedInteractions)) {
            if (group.length === 1) {
                summaries.push(this.formatSingleInteraction(group[0]));
            } else {
                summaries.push(this.formatGroupSummary(concept, group));
            }
        }

        return summaries.join('\n\n');
    }

    formatSingleInteraction(interaction) {
        return `Q: ${interaction.prompt}\nA: ${interaction.output}`;
    }

    formatGroupSummary(concept, interactions) {
        const summary = `Topic: ${concept}\n` +
            interactions
                .slice(0, 3) // Limit number of examples per group
                .map(i => `- ${i.prompt} → ${i.output.substring(0, 50)}...`)
                .join('\n');
        return summary;
    }

    buildContext(currentPrompt, retrievals = [], recentInteractions = [], options = {}) {
        this.pruneContext();

        // Add new relevant interactions to context
        retrievals.forEach(retrieval => {
            this.addToContext(retrieval.interaction, retrieval.similarity);
        });

        // Add recent interactions with high relevance
        recentInteractions.forEach(interaction => {
            this.addToContext(interaction, 0.9); // High base relevance for recent interactions
        });

        const contextParts = [];

        // Add system context if provided
        if (options.systemContext) {
            contextParts.push(`System Context: ${options.systemContext}`);
        }

        // Add summarized historical context
        const historicalContext = this.summarizeContext(
            this.contextBuffer.slice(0, this.maxContextSize)
        );

        if (historicalContext) {
            contextParts.push('Relevant Context:', historicalContext);
        }

        const fullContext = contextParts.join('\n\n');

        // Process context through window manager if it might exceed limits
        if (this.windowManager.estimateTokens(fullContext) > this.maxTokens) {
            const windows = this.windowManager.processContext(fullContext);
            return this.windowManager.mergeOverlappingContent(windows);
        }

        return fullContext;
    }
}
