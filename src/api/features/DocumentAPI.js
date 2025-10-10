import BaseAPI from '../common/BaseAPI.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import PDFConverter from '../../services/document/PDFConverter.js';
import HTMLConverter from '../../services/document/HTMLConverter.js';
import Chunker from '../../services/document/Chunker.js';
import Ingester from '../../services/document/Ingester.js';

/**
 * Document API handler for document processing operations
 * Exposes PDF/HTML conversion, chunking, and SPARQL ingestion over HTTP
 */
export default class DocumentAPI extends BaseAPI {
    constructor(config = {}) {
        super(config);

        // Override logger if provided in config
        if (config.logger) {
            this.logger = config.logger;
        }

        this.tempDir = config.tempDir || '/tmp/semem-documents';
        this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
        this.allowedMimeTypes = config.allowedMimeTypes || [
            'application/pdf',
            'text/html',
            'text/plain',
            'application/octet-stream' // For some PDF uploads
        ];
        this.documentStore = new Map(); // In-memory document tracking
        this.processingJobs = new Map(); // Track async processing jobs
        this.memoryManager = null;
    }

    async initialize() {
        await super.initialize();

        // Ensure temp directory exists
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            this.logger.info(`DocumentAPI initialized with temp dir: ${this.tempDir}`);
        } catch (error) {
            this.logger.error('Failed to create temp directory:', error);
            throw error;
        }

        // Get dependencies from registry if available
        const registry = this.config.registry;
        if (!registry) {
            throw new Error('DocumentAPI requires registry access to shared services');
        }

        try {
            this.memoryManager = registry.get('memory');
            if (!this.memoryManager) {
                throw new Error('Memory manager not available via registry');
            }
            this.logger.info('DocumentAPI initialized successfully with memory integration');
        } catch (error) {
            this.logger.error('Failed to initialize DocumentAPI dependencies:', error.message);
            throw error;
        }
    }

    /**
     * Execute a document operation
     */
    async executeOperation(operation, params = {}, files = null) {
        this._validateParams(params);

        const start = Date.now();
        const operationId = uuidv4();

        try {
            let result;

            switch (operation) {
                case 'upload':
                    result = await this.uploadDocument(params, files, operationId);
                    break;
                case 'convert':
                    result = await this.convertDocument(params, operationId);
                    break;
                case 'chunk':
                    result = await this.chunkDocument(params, operationId);
                    break;
                case 'ingest':
                    result = await this.ingestDocument(params, operationId);
                    break;
                case 'list':
                    result = await this.listDocuments(params);
                    break;
                case 'get':
                    result = await this.getDocument(params);
                    break;
                case 'delete':
                    result = await this.deleteDocument(params);
                    break;
                case 'status':
                    result = await this.getProcessingStatus(params);
                    break;
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }

            const duration = Date.now() - start;
            this.logger.info(`Document operation ${operation} completed in ${duration}ms`);

            return {
                success: true,
                operation,
                operationId,
                duration,
                ...result
            };

        } catch (error) {
            const duration = Date.now() - start;
            this.logger.error(`Document operation ${operation} failed after ${duration}ms:`, error);

            throw {
                success: false,
                operation,
                operationId,
                duration,
                error: error.message,
                code: error.code || 'DOCUMENT_OPERATION_ERROR'
            };
        }
    }

    /**
     * Upload and process a document file
     */
    async uploadDocument(params, files, operationId) {
        if (!files || !files.file) {
            throw new Error('No file provided for upload');
        }

        const file = files.file;
        const options = params.options || {};
        const resolvedNamespace = this._resolveGraphName(options.namespace || params.namespace);
        const mergedOptions = {
            ...options,
            convert: options.convert !== false,
            chunk: options.chunk !== false,
            ingest: options.ingest !== false,
            namespace: options.namespace || params.namespace || resolvedNamespace,
            graphName: options.graphName || resolvedNamespace
        };

        if (!mergedOptions.namespace) {
            throw new Error('Failed to resolve namespace for document ingestion');
        }

        const uploadMetadata = this._normalizeMetadata(params.metadata);
        const documentType = params.documentType || uploadMetadata.documentType || this._inferDocumentType(file.mimetype, file.originalname);

        // Validate file
        this._validateFile(file);

        // Generate document ID and store metadata
        const documentId = uuidv4();
        const timestamp = new Date().toISOString();
        const filename = file.originalname || file.name || 'unknown';
        const extension = path.extname(filename).toLowerCase();

        const documentMeta = {
            id: documentId,
            filename,
            originalSize: file.size,
            mimeType: file.mimetype,
            extension,
            uploadedAt: timestamp,
            status: 'uploaded',
            operations: [],
            documentType,
            metadata: uploadMetadata
        };

        this.documentStore.set(documentId, documentMeta);

        let result = {
            documentId,
            filename,
            size: file.size,
            mimeType: file.mimetype,
            status: 'uploaded',
            documentType,
            metadata: uploadMetadata
        };

        // Auto-convert if requested
        if (mergedOptions.convert !== false) {
            try {
                const convertResult = await this.convertDocument({
                    documentId,
                    file: file.buffer || file.data,
                    mimeType: file.mimetype,
                    filename
                }, operationId);

                const combinedMetadata = {
                    ...convertResult.metadata,
                    ...uploadMetadata,
                    documentType,
                    filename,
                    uploadedAt: timestamp
                };

                result.conversion = convertResult;
                documentMeta.status = 'converted';
                documentMeta.operations.push('convert');

                // Auto-chunk if requested
                if (mergedOptions.chunk !== false) {
                    const chunkResult = await this.chunkDocument({
                        documentId,
                        content: convertResult.content,
                        metadata: combinedMetadata,
                        options: mergedOptions
                    }, operationId);

                    result.chunking = chunkResult;
                    documentMeta.status = 'chunked';
                    documentMeta.operations.push('chunk');

                    // Auto-ingest if requested
                    if (mergedOptions.ingest !== false) {
                        const ingestResult = await this.ingestDocument({
                            documentId,
                            chunkingResult: chunkResult.fullResult,
                            namespace: mergedOptions.namespace,
                            options: mergedOptions
                        }, operationId);

                        result.ingestion = ingestResult;
                        documentMeta.status = 'ingested';
                        documentMeta.operations.push('ingest');
                    }
                }

                result.metadata = combinedMetadata;
            } catch (error) {
                documentMeta.status = 'error';
                documentMeta.error = error.message;
                throw error;
            }
        }

        return result;
    }

    /**
     * Convert document to markdown
     */
    async convertDocument(params, operationId) {
        const { documentId, file, mimeType, filename, content } = params;

        let inputContent = content || file;
        let inputMimeType = mimeType;
        let inputFilename = filename;

        // If documentId provided, get from store
        if (documentId && !inputContent) {
            const doc = this.documentStore.get(documentId);
            if (!doc) {
                throw new Error(`Document not found: ${documentId}`);
            }
            // Note: In a real implementation, you'd load the file content
            throw new Error('Document content loading not implemented - provide file directly');
        }

        if (!inputContent) {
            throw new Error('No content provided for conversion');
        }

        let result;

        if (inputMimeType === 'application/pdf' || inputFilename?.endsWith('.pdf')) {
            // Convert PDF using buffer method
            const buffer = Buffer.isBuffer(inputContent) ? inputContent : Buffer.from(inputContent);
            result = await PDFConverter.convertBuffer(buffer, {
                filename: inputFilename,
                extractMetadata: true
            });
            // PDFConverter returns { markdown, metadata, success }
            result = { content: result.markdown, metadata: result.metadata };
        } else if (inputMimeType === 'text/html' || inputFilename?.endsWith('.html')) {
            // Convert HTML using string method
            const htmlString = Buffer.isBuffer(inputContent) ? inputContent.toString('utf8') : inputContent;
            result = await HTMLConverter.convertString(htmlString, {
                filename: inputFilename,
                extractMetadata: true,
                cleanOutput: true
            });
            // HTMLConverter returns { markdown, metadata, success }
            result = { content: result.markdown, metadata: result.metadata };
        } else if (inputMimeType === 'text/plain' || inputFilename?.endsWith('.txt')) {
            // Text files need no conversion
            result = {
                content: typeof inputContent === 'string' ? inputContent : inputContent.toString('utf8'),
                metadata: {
                    filename: inputFilename,
                    size: Buffer.isBuffer(inputContent) ? inputContent.length : inputContent.length,
                    contentType: 'text/plain'
                }
            };
        } else {
            throw new Error(`Unsupported file type: ${inputMimeType}`);
        }

        // Update document store if documentId provided
        if (documentId) {
            const doc = this.documentStore.get(documentId);
            if (doc) {
                doc.conversion = {
                    contentLength: result.content.length,
                    metadata: result.metadata,
                    convertedAt: new Date().toISOString()
                };
            }
        }

        return {
            contentLength: result.content.length,
            content: result.content,
            metadata: result.metadata,
            format: 'markdown'
        };
    }

    /**
     * Chunk document into semantic units
     */
    async chunkDocument(params, operationId) {
        const { documentId, content, metadata, options } = params;

        if (!content) {
            throw new Error('No content provided for chunking');
        }

        const chunkOptionsInput = options || {};
        const namespace = this._resolveGraphName(chunkOptionsInput.namespace);
        if (!namespace) {
            throw new Error('namespace undefined');
        }

        const chunkOptions = {
            ...chunkOptionsInput,
            namespace,
            baseNamespace: chunkOptionsInput.baseNamespace
                ? this._normalizeNamespace(chunkOptionsInput.baseNamespace)
                : this._normalizeNamespace(namespace),
            provenance: {
                ...(chunkOptionsInput.provenance || {}),
                operation: 'document-api-chunk',
                operationId,
                timestamp: new Date().toISOString()
            }
        };

        const chunker = new Chunker(chunkOptions);
        const result = await chunker.chunk(content, metadata || {}, chunkOptions);

        // Update document store if documentId provided
        if (documentId) {
            const doc = this.documentStore.get(documentId);
            if (doc) {
                doc.chunking = {
                    chunkCount: result.chunks.length,
                    chunkedAt: new Date().toISOString(),
                    options: chunkOptions
                };
            }
        }

        return {
            chunkCount: result.chunks.length,
            chunks: result.chunks,
            metadata: result.metadata,
            // Pass through full chunking result for ingestion
            fullResult: result
        };
    }

    /**
     * Ingest chunks into SPARQL store
     */
    async ingestDocument(params, operationId) {
        const { documentId, chunkingResult, chunks, namespace, options } = params;

        // Handle both old (chunks array) and new (chunkingResult object) formats
        let finalChunkingResult;
        if (chunkingResult) {
            finalChunkingResult = chunkingResult;
        } else if (chunks && Array.isArray(chunks)) {
            // Legacy format - wrap chunks in minimal chunking result
            finalChunkingResult = { chunks };
        } else {
            throw new Error('No chunks or chunkingResult provided for ingestion');
        }

        const normalizedOptions = options || {};
        const ingestNamespace = this._resolveGraphName(namespace || normalizedOptions.namespace);
        if (!ingestNamespace) throw Error('namespace undefined')
        const ingestOptions = {
            ...normalizedOptions,
            namespace: ingestNamespace,
            graphName: normalizedOptions.graphName || ingestNamespace,
            provenance: {
                ...(normalizedOptions.provenance || {}),
                operation: 'document-api-ingest',
                operationId,
                timestamp: new Date().toISOString(),
                chunkCount: finalChunkingResult.chunks?.length || 0,
                sourceUri: finalChunkingResult.sourceUri
            }
        };

        // Get SPARQL store from registry
        const store = this.config.registry?.get('sparqlStore');
        if (!store) {
            throw new Error('SPARQL store not available for ingestion');
        }

        const ingester = new Ingester(store, ingestOptions);
        const result = await ingester.ingest(finalChunkingResult, ingestOptions);

        const documentMeta = documentId ? this.documentStore.get(documentId) : null;
        const memoryResult = await this._storeChunksInMemory({
            documentMeta,
            documentId,
            chunkingResult: finalChunkingResult,
            ingestOptions,
            ingestionResult: result,
            operationId
        });

        // Update document store if documentId provided
        if (documentId) {
            const doc = this.documentStore.get(documentId);
            if (doc) {
                doc.ingestion = {
                    triplesCreated: result.triplesCreated,
                    ingestedAt: new Date().toISOString(),
                    graphUri: result.graphUri
                };
                doc.operations.push('memory');
                doc.memory = memoryResult;
            }
        }

        return {
            triplesCreated: result.triplesCreated,
            graphUri: result.graphUri,
            chunksIngested: finalChunkingResult.chunks?.length || 0,
            memory: memoryResult
        };
    }

    /**
     * List processed documents
     */
    async listDocuments(params) {
        const { limit = 50, offset = 0, status } = params;

        let documents = Array.from(this.documentStore.values());

        // Filter by status if provided
        if (status) {
            documents = documents.filter(doc => doc.status === status);
        }

        // Sort by upload date (newest first)
        documents.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        // Apply pagination
        const total = documents.length;
        const paginatedDocuments = documents.slice(offset, offset + limit);

        return {
            documents: paginatedDocuments,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        };
    }

    /**
     * Get document details
     */
    async getDocument(params) {
        const { documentId } = params;

        if (!documentId) {
            throw new Error('Document ID is required');
        }

        const document = this.documentStore.get(documentId);

        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }

        return { document };
    }

    /**
     * Delete document and associated data
     */
    async deleteDocument(params) {
        const { documentId } = params;

        if (!documentId) {
            throw new Error('Document ID is required');
        }

        const document = this.documentStore.get(documentId);

        if (!document) {
            throw new Error(`Document not found: ${documentId}`);
        }

        // Remove from store
        this.documentStore.delete(documentId);

        // TODO: Clean up SPARQL data if ingested
        // TODO: Clean up temporary files

        return {
            documentId,
            deleted: true
        };
    }

    /**
     * Get processing status for async operations
     */
    async getProcessingStatus(params) {
        const { operationId } = params;

        if (!operationId) {
            throw new Error('Operation ID is required');
        }

        const job = this.processingJobs.get(operationId);

        if (!job) {
            throw new Error(`Processing job not found: ${operationId}`);
        }

        return { job };
    }

    async _storeChunksInMemory({ documentMeta, documentId, chunkingResult, ingestOptions, ingestionResult, operationId }) {
        if (!this.memoryManager) {
            throw new Error('Memory manager not available for document chunk storage');
        }

        if (!chunkingResult?.chunks || chunkingResult.chunks.length === 0) {
            throw new Error('No chunks available to store in memory');
        }

        const storedInteractions = [];
        const docId = documentMeta?.id || documentMeta?.documentId || documentId;
        const docName = documentMeta?.filename;
        const docType = documentMeta?.documentType;
        const uploadTimestamp = documentMeta?.uploadedAt;

        for (const chunk of chunkingResult.chunks) {
            const chunkTitle = this._createChunkTitle(chunk, docName, chunkingResult.chunks.length);
            const chunkContent = chunk.content;

            if (!chunkContent || typeof chunkContent !== 'string') {
                throw new Error(`Chunk ${chunk.uri || chunk.index} is missing content for memory storage`);
            }

            const interactionId = chunk.uri || `doc:${docId || 'unknown'}:chunk:${chunk.index}`;
            const baseMetadata = {
                id: interactionId,
                memoryType: 'long-term',
                source: 'document-upload',
                documentId: docId,
                documentName: docName,
                documentType: docType,
                chunkUri: chunk.uri,
                chunkIndex: chunk.index,
                chunkHash: chunk.metadata?.hash,
                chunkTitle,
                chunkPreview: chunkContent.slice(0, 280),
                namespace: ingestOptions?.namespace,
                graph: ingestOptions?.graphName,
                ingestionOperationId: operationId,
                ingestionGraphUri: ingestionResult?.graphUri,
                ragnoSourceUri: chunk.partOf,
                ragnoCorpusUri: chunkingResult.corpus?.uri,
                ragnoCommunityUri: chunkingResult.community?.uri,
                uploadedAt: uploadTimestamp,
                ingestionTimestamp: ingestionResult?.metadata?.ingestionTimestamp || new Date().toISOString()
            };

            const metadata = Object.fromEntries(
                Object.entries(baseMetadata).filter(([, value]) => value !== undefined && value !== null)
            );

            const combinedText = `${chunkTitle}\n\n${chunkContent}`.trim();
            const embedding = await this.memoryManager.generateEmbedding(combinedText);
            const concepts = await this.memoryManager.extractConcepts(combinedText);

            await this.memoryManager.addInteraction(
                chunkTitle,
                chunkContent,
                embedding,
                concepts,
                {
                    ...metadata,
                    timestamp: Date.now()
                }
            );

            storedInteractions.push({
                interactionId: metadata.id || interactionId,
                chunkUri: chunk.uri,
                concepts: concepts.length
            });
        }

        this.logger.info(`Stored ${storedInteractions.length} document chunks in semantic memory`, {
            documentId: docId,
            interactionsStored: storedInteractions.length
        });

        return {
            stored: storedInteractions.length,
            interactions: storedInteractions
        };
    }

    _createChunkTitle(chunk, documentName, totalChunks) {
        const existingTitle = chunk.title?.trim();
        const isGeneric = existingTitle ? /^chunk\s+\d+/i.test(existingTitle) || existingTitle.toLowerCase() === 'unlabeled' : false;

        if (existingTitle && !isGeneric) {
            return existingTitle;
        }

        const content = chunk.content || '';
        const firstNonEmptyLine = content
            .split('\n')
            .map(line => line.trim())
            .find(line => line.length > 0);

        if (firstNonEmptyLine) {
            return firstNonEmptyLine.length > 120 ? `${firstNonEmptyLine.slice(0, 117)}...` : firstNonEmptyLine;
        }

        const defaultLabel = documentName ? `${documentName} chunk ${chunk.index + 1}` : `Document chunk ${chunk.index + 1}`;
        if (!content) {
            return defaultLabel;
        }

        const preview = content.slice(0, 120).trim();
        return preview.length > 0 ? `${preview}${preview.length === 120 ? '...' : ''}` : defaultLabel;
    }

    /**
     * Resolve namespace/graphName from provided value, registry config, or local config
     * @private
     */
    _resolveGraphName(candidate) {
        if (candidate && typeof candidate === 'string') {
            return candidate;
        }

        try {
            const registryConfig = this.config?.registry?.get?.('config');
            if (registryConfig?.get) {
                const value = registryConfig.get('graphName');
                if (value) {
                    return value;
                }
            }
        } catch (error) {
            this.logger?.warn?.(`DocumentAPI: failed to resolve graphName from registry config: ${error.message}`);
        }

        if (this.config?.get) {
            const value = this.config.get('graphName');
            if (value) {
                return value;
            }
        }

        return null;
    }

    /**
     * Normalize metadata input to a plain object
     * @private
     */
    _normalizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return {};
        }

        try {
            JSON.stringify(metadata);
            return metadata;
        } catch {
            const safeMetadata = {};
            for (const [key, value] of Object.entries(metadata)) {
                if (value === undefined) continue;
                if (typeof value === 'object') {
                    try {
                        JSON.stringify(value);
                        safeMetadata[key] = value;
                    } catch {
                        continue;
                    }
                } else if (typeof value !== 'function' && typeof value !== 'symbol') {
                    safeMetadata[key] = value;
                }
            }
            return safeMetadata;
        }
    }

    /**
     * Infer a document type from MIME type or filename
     * @private
     */
    _inferDocumentType(mimeType, filename) {
        if (mimeType === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf')) {
            return 'pdf';
        }
        if (mimeType === 'text/markdown' || filename?.toLowerCase().endsWith('.md') || filename?.toLowerCase().endsWith('.markdown')) {
            return 'markdown';
        }
        return 'text';
    }

    /**
     * Normalize namespace/base URI to ensure safe URI concatenation
     * @private
     */
    _normalizeNamespace(namespace) {
        if (!namespace || typeof namespace !== 'string') {
            throw new Error('Invalid namespace - expected non-empty string');
        }

        return namespace.endsWith('/') ? namespace : `${namespace}/`;
    }

    /**
     * Validate file upload
     */
    _validateFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`File too large: ${file.size} bytes (max: ${this.maxFileSize})`);
        }

        if (file.mimetype && !this.allowedMimeTypes.includes(file.mimetype)) {
            throw new Error(`Unsupported file type: ${file.mimetype}`);
        }
    }

    /**
     * Validate operation parameters
     */
    _validateParams(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid parameters provided');
        }
    }

    /**
     * Cleanup resources
     */
    async dispose() {
        // Clean up temp files
        try {
            const files = await fs.readdir(this.tempDir);
            await Promise.all(files.map(file =>
                fs.unlink(path.join(this.tempDir, file)).catch(() => { })
            ));
        } catch (error) {
            this.logger.warn('Error cleaning up temp files:', error);
        }

        await super.shutdown();
    }
}
