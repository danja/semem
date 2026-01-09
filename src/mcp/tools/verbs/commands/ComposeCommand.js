/**
 * ComposeCommand - Assemble a focused context response from memory and ZPT lens state.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { ComposeSchema } from '../../VerbSchemas.js';
import { CONTEXT_CONFIG } from '../../../../../config/preferences.js';

export class ComposeCommand extends BaseVerbCommand {
  constructor() {
    super('compose');
    this.schema = ComposeSchema;
  }

  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const {
      query,
      context,
      maxResults,
      threshold,
      maxTokens,
      includeSession,
      includeMemory
    } = validatedParams;

    try {
      if (!this.llmHandler) {
        throw new Error('LLM handler is required for compose');
      }

      if (!this.safeOps) {
        throw new Error('Safe operations are required for compose');
      }

      if (!this.stateManager) {
        throw new Error('ZPT state manager is required for compose');
      }

      const zptState = this.stateManager.getState();
      const sessionItems = includeSession
        ? this.stateManager.getRecentInteractions(CONTEXT_CONFIG.COMPOSE.MAX_SESSION_ITEMS)
        : [];
      const memoryItems = includeMemory
        ? await this.safeOps.searchSimilar(query, maxResults, threshold)
        : [];

      const combinedItems = this.dedupeItems([
        ...sessionItems.map(item => ({ ...item, source: 'session' })),
        ...memoryItems.slice(0, CONTEXT_CONFIG.COMPOSE.MAX_MEMORY_ITEMS).map(item => ({ ...item, source: 'memory' }))
      ]);

      const memoryText = this.formatMemoryItems(combinedItems);
      const prompt = await this.templateLoader.loadAndInterpolate('mcp', 'compose-context', {
        query,
        context: (context || '').trim(),
        memory: memoryText,
        zoom: zptState.zoom,
        pan: this.formatPan(zptState.pan),
        tilt: zptState.tilt,
        maxTokens
      });

      if (!prompt) {
        throw new Error('Compose prompt template not found: prompts/templates/mcp/compose-context.md');
      }

      const response = await this.safeOps.generateResponse(prompt, [], { maxTokens });

      return this.createSuccessResponse({
        content: response,
        zptState,
        sources: combinedItems.map(item => ({
          source: item.source,
          prompt: item.prompt || item.content || '',
          similarity: item.similarity
        }))
      });
    } catch (error) {
      return this.handleError(error, 'compose operation', {
        query,
        maxResults,
        threshold
      });
    }
  }

  formatPan(pan = {}) {
    const parts = [];
    if (Array.isArray(pan.domains) && pan.domains.length) {
      parts.push(`domains: ${pan.domains.join(', ')}`);
    }
    if (Array.isArray(pan.keywords) && pan.keywords.length) {
      parts.push(`keywords: ${pan.keywords.join(', ')}`);
    }
    if (Array.isArray(pan.entities) && pan.entities.length) {
      parts.push(`entities: ${pan.entities.join(', ')}`);
    }
    if (Array.isArray(pan.corpuscle) && pan.corpuscle.length) {
      parts.push(`corpuscle: ${pan.corpuscle.join(', ')}`);
    }
    if (pan.temporal) {
      const temporal = [];
      if (pan.temporal.start) temporal.push(`start=${pan.temporal.start}`);
      if (pan.temporal.end) temporal.push(`end=${pan.temporal.end}`);
      if (temporal.length) parts.push(`temporal: ${temporal.join(', ')}`);
    }
    return parts.length ? parts.join(' | ') : 'none';
  }

  formatMemoryItems(items) {
    if (!items.length) {
      return '';
    }

    return items
      .map((item, index) => {
        const promptText = item.prompt || item.content || '';
        const responseText = item.response || '';
        const similarity = typeof item.similarity === 'number' ? ` (similarity: ${item.similarity.toFixed(2)})` : '';
        return `[${index + 1}] ${promptText}${similarity}\n${responseText}`.trim();
      })
      .join('\n\n');
  }

  dedupeItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.prompt || ''}::${item.response || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export default ComposeCommand;
