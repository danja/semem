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
      const baseState = this.stateManager.getState();
      const zptState = {
        ...baseState,
        focusQuery: query,
        pan: {
          ...baseState.pan,
          domains: Array.isArray(domains) ? domains : (baseState.pan?.domains || [])
        },
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

      if (!this.zptService) {
        throw new Error('ZPT service unavailable for recall');
      }

      const timeFilter = timeRange ? this.parseTimeRange(timeRange) : null;

      const navResult = await this.zptService.navigate({
        query: query || '',
        zoom: zptState.zoom,
        pan: {
          ...zptState.pan,
          domains: Array.isArray(domains) ? domains : zptState.pan?.domains || [],
          temporal: timeFilter ? {
            start: timeFilter.start.toISOString(),
            end: timeFilter.end.toISOString()
          } : zptState.pan?.temporal || {}
        },
        tilt: zptState.tilt
      });

      if (!navResult?.success || !Array.isArray(navResult.content?.data)) {
        throw new Error('ZPT navigation failed to return recall data');
      }

      const memories = navResult.content.data
        .map(item => ({
          ...item,
          content: item.content || item.label || item.description || item.text || ''
        }))
        .filter(item => item.content);

      // Limit results
      const finalResults = memories.slice(0, maxResults);

      return this.createSuccessResponse({
        query,
        domains,
        timeRange,
        memories: finalResults,
        totalFound: memories.length,
        filteredCount: memories.length,
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
