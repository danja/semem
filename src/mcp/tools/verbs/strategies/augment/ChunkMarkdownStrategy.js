import Chunker from '../../../../../services/document/Chunker.js';

import { BaseStrategy } from '../BaseStrategy.js';

export class ChunkMarkdownStrategy extends BaseStrategy {
  constructor() {
    super('chunk_markdown');
    this.description = 'Chunk markdown content into Ragno-compliant corpus structures';
    this.supportedParameters = ['markdown', 'metadata', 'options'];
  }

  async execute(params, context = {}) {
    try {
      const { markdown, metadata = {}, options = {} } = params;

      if (!markdown || typeof markdown !== 'string') {
        throw new Error('chunk_markdown strategy requires markdown content as a non-empty string');
      }

      const config = context.config;
      const ingestionDefaults = config?.get?.('sparqlIngestion.chunking') || {};
      const chunkerOptions = {
        ...ingestionDefaults,
        ...options
      };

      const chunker = new Chunker(chunkerOptions);
      const chunkingResult = await chunker.chunk(markdown, metadata, chunkerOptions);

      return this.createSuccessResponse({
        chunkingResult,
        chunks: chunkingResult.chunks,
        corpus: chunkingResult.corpus,
        community: chunkingResult.community,
        sourceUri: chunkingResult.sourceUri,
        metadata: chunkingResult.metadata,
        chunkCount: chunkingResult.chunks.length
      });

    } catch (error) {
      return this.handleError(error, 'chunk markdown', {
        hasMarkdown: typeof params?.markdown === 'string',
        markdownLength: params?.markdown?.length,
        options: Object.keys(params?.options || {})
      });
    }
  }
}

export default ChunkMarkdownStrategy;
