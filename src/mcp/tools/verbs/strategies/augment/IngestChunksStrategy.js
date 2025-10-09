import { BaseStrategy } from '../BaseStrategy.js';
import Ingester from '../../../../../services/document/Ingester.js';

function resolveGraphName(options = {}, contextConfig = null, memoryManager = null) {
  if (options.graphName) {
    return options.graphName;
  }

  if (contextConfig?.get) {
    const configuredGraph = contextConfig.get('graphName');
    if (configuredGraph) {
      return configuredGraph;
    }
  }

  if (memoryManager?.config?.get) {
    const configuredGraph = memoryManager.config.get('graphName');
    if (configuredGraph) {
      return configuredGraph;
    }
  }

  throw new Error('Graph name not configured. Provide options.graphName or ensure config.json defines graphName.');
}

export class IngestChunksStrategy extends BaseStrategy {
  constructor() {
    super('ingest_chunks');
    this.description = 'Persist chunked document data into the configured SPARQL store with provenance';
    this.supportedParameters = ['chunkData', 'options'];
  }

  async execute(params, context = {}) {
    try {
      const { chunkData, options = {} } = params;
      const { storage, memoryManager, config } = context;

      if (!chunkData) {
        throw new Error('ingest_chunks strategy requires chunkData from a previous chunk_markdown step');
      }

      const chunkingResult = chunkData.chunkingResult || chunkData;
      if (!chunkingResult?.chunks || chunkingResult.chunks.length === 0) {
        throw new Error('ingest_chunks strategy received chunkData without chunks to ingest');
      }

      const store = storage || memoryManager?.store;
      if (!store || typeof store.executeUpdate !== 'function') {
        throw new Error('SPARQL store is not available - ensure ServiceManager initialized storage correctly');
      }

      const graphName = resolveGraphName(options, config, memoryManager);
      const ingestionConfig = config?.get?.('sparqlIngestion.processing') || {};

      const ingesterOptions = {
        graphName,
        ...ingestionConfig,
        ...options
      };

      const ingester = new Ingester(store, ingesterOptions);
      const ingestionResult = await ingester.ingest(chunkingResult, ingesterOptions);

      return this.createSuccessResponse({
        ingestionResult,
        graphName: ingestionResult.graphName || graphName,
        chunkCount: ingestionResult.chunkCount,
        processingTime: ingestionResult.processingTime
      });

    } catch (error) {
      return this.handleError(error, 'ingest chunks', {
        hasChunkData: !!params?.chunkData,
        chunkCount: params?.chunkData?.chunkingResult?.chunks?.length || params?.chunkData?.chunks?.length || 0
      });
    }
  }
}

export default IngestChunksStrategy;
