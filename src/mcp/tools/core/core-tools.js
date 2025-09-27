/**
 * Core MCP Tools Service
 * Implements the 7 essential tools: tell, ask, augment, zoom, pan, tilt, inspect
 * Consolidates functionality from deprecated and specialized tools
 */

import { CoreService } from './core-service.js';
import { mcpDebugger } from '../../lib/debug-utils.js';

export class CoreToolsService {
  constructor() {
    this.coreToolNames = ['tell', 'ask', 'augment', 'zoom', 'pan', 'tilt', 'inspect'];
  }

  /**
   * Check if this service handles the given tool name
   */
  handles(toolName) {
    return this.coreToolNames.includes(toolName);
  }

  /**
   * Execute a core tool
   */
  async execute(toolName, args) {
    try {
      CoreService.validateArgs(args);

      switch (toolName) {
        case 'tell':
          return await this.tell(args);
        case 'ask':
          return await this.ask(args);
        case 'augment':
          return await this.augment(args);
        case 'zoom':
          return await this.zoom(args);
        case 'pan':
          return await this.pan(args);
        case 'tilt':
          return await this.tilt(args);
        case 'inspect':
          return await this.inspect(args);
        default:
          throw new Error(`Unknown core tool: ${toolName}`);
      }
    } catch (error) {
      CoreService.logToolExecution(toolName, args, null, error);
      return CoreService.formatResponse({ error: error.message }, false);
    }
  }

  /**
   * TELL - Store information (consolidates: semem_store_interaction, uploadDocument, sparql_ingest_documents)
   */
  async tell(args) {
    const { content, type = 'interaction', metadata = {}, lazy = false,
            fileUrl, filename, mediaType, documentType,
            endpoint, template, limit, dryRun, auth, variables, fieldMappings } = args;

    // Validate core content parameter
    CoreService.validateArgs(args, ['content']);

    const memoryManager = await CoreService.initializeServices();
    const safeOps = await CoreService.createSafeOperations(memoryManager);

    let result;

    // Handle document upload (from uploadDocument)
    if (fileUrl && filename) {
      mcpDebugger.info('Tell: Processing document upload', { filename, mediaType, documentType });

      // Process uploaded document
      const documentProcessor = (await import('../../lib/document-processor.js')).default;
      const processedDoc = await documentProcessor.processUpload({
        fileUrl, filename, mediaType, documentType, metadata
      });

      result = await safeOps.storeDocument(processedDoc, { lazy });

    }
    // Handle SPARQL ingestion (from sparql_ingest_documents)
    else if (endpoint && template) {
      mcpDebugger.info('Tell: Processing SPARQL ingestion', { endpoint, template, limit });

      const sparqlIngestor = (await import('../../lib/sparql-ingestor.js')).default;
      const documents = await sparqlIngestor.ingestDocuments({
        endpoint, template, limit, auth, variables, fieldMappings, dryRun
      });

      if (dryRun) {
        result = { preview: documents, count: documents.length };
      } else {
        result = await safeOps.storeDocuments(documents, { lazy });
      }

    }
    // Handle interaction storage (from semem_store_interaction)
    else if (args.prompt && args.response) {
      mcpDebugger.info('Tell: Processing interaction storage');

      const interactionId = await CoreService.generateUUID();
      const interactionData = {
        id: interactionId,
        prompt: args.prompt,
        response: args.response,
        metadata: { ...metadata, timestamp: new Date().toISOString() }
      };

      result = await safeOps.storeInteraction(args.prompt, args.response, {
        ...metadata,
        id: interactionId,
        timestamp: new Date().toISOString()
      });

    }
    // Handle basic content storage
    else {
      mcpDebugger.info('Tell: Processing basic content storage', { type, lazy });

      result = await safeOps.storeContent(content, { type, metadata, lazy });
    }

    CoreService.logToolExecution('tell', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * ASK - Query information (consolidates: semem_retrieve_memories, semem_answer, semem_ask, recall)
   */
  async ask(args) {
    const { question, mode = 'standard', useContext = true, useHyDE = false,
            useWikipedia = false, useWikidata = false, useWebSearch = false,
            query, domains, timeRange, relevanceThreshold = 0.1, maxResults = 10 } = args;

    // Validate core question parameter
    CoreService.validateArgs(args, ['question']);

    const memoryManager = await CoreService.initializeServices();
    const safeOps = await CoreService.createSafeOperations(memoryManager);

    let result;

    // Handle memory retrieval (from semem_retrieve_memories, recall)
    if (query || domains || timeRange) {
      mcpDebugger.info('Ask: Processing memory recall', { domains, timeRange, maxResults });

      result = await safeOps.recallMemories({
        query: question,
        domains,
        timeRange,
        relevanceThreshold,
        maxResults
      });

    }
    // Handle comprehensive answer generation (from semem_answer, semem_ask)
    else if (mode === 'comprehensive' || useHyDE || useWikipedia || useWikidata || useWebSearch) {
      mcpDebugger.info('Ask: Processing comprehensive answer', { mode, useHyDE, useWikipedia });

      const answerProcessor = (await import('../../lib/answer-processor.js')).default;
      result = await answerProcessor.generateAnswer(question, {
        mode,
        useContext,
        useHyDE,
        useWikipedia,
        useWikidata,
        useWebSearch
      });

    }
    // Handle basic question answering
    else {
      mcpDebugger.info('Ask: Processing basic question', { mode, useContext });

      result = await safeOps.askQuestion(question, { mode, useContext });
    }

    CoreService.logToolExecution('ask', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * AUGMENT - Process/enhance data (consolidates: semem_extract_concepts, semem_generate_embedding, remember, forget, fade_memory, project_context)
   */
  async augment(args) {
    const { operation = 'auto', target = 'all', options = {},
            text, content, domain, domainId, importance,
            projectId, action, fadeFactor, transition, preserveInstructions } = args;

    const memoryManager = await CoreService.initializeServices();
    const safeOps = await CoreService.createSafeOperations(memoryManager);

    let result;

    // Handle concept extraction (from semem_extract_concepts)
    if (operation === 'extract_concepts' || (operation === 'auto' && text)) {
      CoreService.validateArgs(args, ['text']);
      mcpDebugger.info('Augment: Extracting concepts', { textLength: text.length });

      result = await safeOps.extractConcepts(text);

    }
    // Handle embedding generation (from semem_generate_embedding)
    else if (operation === 'generate_embedding' || (operation === 'auto' && text && options.embedding)) {
      CoreService.validateArgs(args, ['text']);
      mcpDebugger.info('Augment: Generating embedding', { textLength: text.length });

      const embedding = await safeOps.generateEmbedding(text);
      result = {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        embeddingDimension: embedding.length,
        embeddingPreview: embedding.slice(0, 5).map(x => parseFloat(x.toFixed(4)))
      };

    }
    // Handle memory operations (from remember)
    else if (operation === 'remember' || content) {
      CoreService.validateArgs(args, ['content']);
      mcpDebugger.info('Augment: Storing memory', { domain, importance });

      result = await safeOps.rememberContent(content, {
        domain: domain || 'user',
        domainId,
        importance: importance || 0.5,
        metadata: options
      });

    }
    // Handle forgetting operations (from forget, fade_memory)
    else if (operation === 'forget' || operation === 'fade' || fadeFactor !== undefined) {
      mcpDebugger.info('Augment: Processing forget/fade operation', { operation, fadeFactor });

      result = await safeOps.fadeMemory({
        target,
        domain,
        fadeFactor: fadeFactor || 0.1,
        transition: transition || 'smooth',
        preserveInstructions: preserveInstructions !== false
      });

    }
    // Handle project context operations (from project_context)
    else if (operation === 'project_context' || projectId) {
      CoreService.validateArgs(args, ['projectId']);
      mcpDebugger.info('Augment: Managing project context', { projectId, action });

      result = await safeOps.manageProjectContext(projectId, {
        action: action || 'switch',
        metadata: options
      });

    }
    // Handle general augmentation operations
    else {
      mcpDebugger.info('Augment: Processing general augmentation', { operation, target });

      result = await safeOps.augmentTarget(target, { operation, options });
    }

    CoreService.logToolExecution('augment', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * ZOOM - Navigation granularity (ZPT metaphor)
   */
  async zoom(args) {
    const { level, query } = args;
    CoreService.validateArgs(args, ['level']);

    const { getSimpleVerbsService } = await import('../simple-verbs.js');
    const service = getSimpleVerbsService();
    const result = await service.zoom(args);

    CoreService.logToolExecution('zoom', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * PAN - Navigation filtering (ZPT metaphor)
   */
  async pan(args) {
    const { getSimpleVerbsService } = await import('../simple-verbs.js');
    const service = getSimpleVerbsService();
    const result = await service.pan(args);

    CoreService.logToolExecution('pan', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * TILT - Navigation perspective (ZPT metaphor)
   */
  async tilt(args) {
    const { style } = args;
    CoreService.validateArgs(args, ['style']);

    const { getSimpleVerbsService } = await import('../simple-verbs.js');
    const service = getSimpleVerbsService();
    const result = await service.tilt(args);

    CoreService.logToolExecution('tilt', args, result);
    return CoreService.formatResponse(result);
  }

  /**
   * INSPECT - System introspection
   */
  async inspect(args) {
    const { what = 'session', details = true } = args;

    const { getSimpleVerbsService } = await import('../simple-verbs.js');
    const service = getSimpleVerbsService();
    const result = await service.inspect(args);

    CoreService.logToolExecution('inspect', args, result);
    return CoreService.formatResponse(result);
  }
}