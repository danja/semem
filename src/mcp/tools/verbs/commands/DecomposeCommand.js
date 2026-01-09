/**
 * DecomposeCommand - Decompose text into Ragno units, entities, and relationships.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { DecomposeSchema } from '../../VerbSchemas.js';
import { CONTEXT_CONFIG } from '../../../../../config/preferences.js';
import { decomposeCorpus } from '../../../../ragno/decomposeCorpus.js';

export class DecomposeCommand extends BaseVerbCommand {
  constructor() {
    super('decompose');
    this.schema = DecomposeSchema;
  }

  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { content, source, chunks, options, store } = validatedParams;

    try {
      if (!this.llmHandler) {
        throw new Error('LLM handler is required for decompose');
      }

      const textChunks = this.buildChunks(content, source, chunks);

      if (content && content.length > CONTEXT_CONFIG.DECOMPOSE.MAX_TEXT_LENGTH) {
        throw new Error(`Content length exceeds ${CONTEXT_CONFIG.DECOMPOSE.MAX_TEXT_LENGTH} characters`);
      }

      if (textChunks.length > CONTEXT_CONFIG.DECOMPOSE.MAX_CHUNKS) {
        throw new Error(`Chunk count exceeds ${CONTEXT_CONFIG.DECOMPOSE.MAX_CHUNKS}`);
      }

      const result = await decomposeCorpus(textChunks, this.llmHandler, {
        ...options
      });

      if (store) {
        if (!this.storage || typeof this.storage.storeDataset !== 'function') {
          throw new Error('SPARQL storage does not support dataset storage');
        }
        await this.storage.storeDataset(result.dataset);
      }

      return this.createSuccessResponse({
        units: result.units.map(unit => ({
          uri: unit.getURI(),
          text: unit.getText(),
          summary: unit.getSummary(),
          source: unit.getSourceDocument()?.value || null
        })),
        entities: result.entities.map(entity => ({
          uri: entity.getURI(),
          name: entity.getPrefLabel(),
          subType: entity.getSubType(),
          entryPoint: entity.isEntryPoint()
        })),
        relationships: result.relationships.map(rel => ({
          uri: rel.getURI(),
          source: rel.getSourceEntity()?.value || null,
          target: rel.getTargetEntity()?.value || null,
          relationshipType: rel.getRelationshipType(),
          content: rel.getContent(),
          weight: rel.getWeight()
        })),
        statistics: result.statistics,
        stored: store
      });
    } catch (error) {
      return this.handleError(error, 'decompose operation', {
        chunkCount: chunks?.length || 0
      });
    }
  }

  buildChunks(content, source, chunks) {
    if (Array.isArray(chunks) && chunks.length) {
      return chunks.map(chunk => ({
        content: chunk.content,
        source: chunk.source || source || 'decompose'
      }));
    }

    return [{
      content,
      source: source || 'decompose'
    }];
  }
}

export default DecomposeCommand;
