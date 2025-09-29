/**
 * RecallCommand - Retrieve from specific memory domains
 *
 * Handles targeted memory retrieval from specific domains.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { RecallSchema } from '../../VerbSchemas.js';
import { SPARQL_CONFIG } from '../../../../../config/preferences.js';

export class RecallCommand extends BaseVerbCommand {
  constructor() {
    super('recall');
    this.schema = RecallSchema;
  }

  /**
   * Execute recall command
   * @param {Object} params - Command parameters
   * @param {string} params.query - Search query
   * @param {Array} params.domains - Domains to search in
   * @param {string} params.timeRange - Time range filter
   * @param {number} params.relevanceThreshold - Relevance threshold
   * @param {number} params.maxResults - Maximum results to return
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const {
      query,
      domains,
      timeRange,
      relevanceThreshold = 0.1,
      maxResults = 10
    } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: recall', {
        queryLength: query?.length,
        domains,
        timeRange,
        relevanceThreshold,
        maxResults
      });

      // Create ZPT state for memory retrieval
      const zptState = {
        ...this.stateManager.getState(),
        focusQuery: query,
        panDomains: domains || [],
        relevanceThreshold: relevanceThreshold || SPARQL_CONFIG.SIMILARITY.DEFAULT_THRESHOLD,
        maxMemories: maxResults,
        timeRange
      };

      // Generate embedding for semantic similarity if query provided
      if (query) {
        try {
          const questionEmbedding = await this.embeddingHandler.generateEmbedding(query);
          zptState.focusEmbedding = questionEmbedding;
        } catch (error) {
          this.logOperation('warn', 'Failed to generate query embedding', { error: error.message });
          // Continue without embedding - will fallback to text similarity
        }
      }

      // Use memory domain manager for targeted retrieval
      const memories = await this.memoryDomainManager.getVisibleMemories(query || '', zptState);

      // Filter by domains if specified
      let filteredMemories = memories;
      if (domains && domains.length > 0) {
        filteredMemories = memories.filter(memory =>
          domains.some(domain => memory.metadata?.domain === domain || memory.domain === domain)
        );
      }

      // Apply time range filtering if specified
      if (timeRange) {
        const timeFilter = this.parseTimeRange(timeRange);
        if (timeFilter) {
          filteredMemories = filteredMemories.filter(memory => {
            const memoryTime = new Date(memory.timestamp || memory.metadata?.timestamp || Date.now());
            return memoryTime >= timeFilter.start && memoryTime <= timeFilter.end;
          });
        }
      }

      // Limit results
      const finalResults = filteredMemories.slice(0, maxResults);

      return this.createSuccessResponse({
        query,
        domains,
        timeRange,
        memories: finalResults,
        totalFound: memories.length,
        filteredCount: filteredMemories.length,
        returnedCount: finalResults.length,
        relevanceThreshold,
        zptState: this.stateManager.getState()
      });

    } catch (error) {
      return this.handleError(error, 'recall operation', {
        query,
        domains,
        timeRange,
        relevanceThreshold,
        maxResults
      });
    }
  }

  /**
   * Parse time range string into start and end dates
   * @param {string} timeRange - Time range string
   * @returns {Object|null} Parsed time range or null
   * @private
   */
  parseTimeRange(timeRange) {
    try {
      // Simple time range parsing - could be enhanced
      if (timeRange.includes('last')) {
        const now = new Date();
        if (timeRange.includes('hour')) {
          return {
            start: new Date(now.getTime() - 60 * 60 * 1000),
            end: now
          };
        } else if (timeRange.includes('day')) {
          return {
            start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            end: now
          };
        } else if (timeRange.includes('week')) {
          return {
            start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            end: now
          };
        }
      }
      return null;
    } catch (error) {
      this.logOperation('warn', 'Failed to parse time range', { timeRange, error: error.message });
      return null;
    }
  }
}

export default RecallCommand;