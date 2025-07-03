import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DocumentAPI from '../../../../src/api/features/DocumentAPI.js';
import { PDFConverter } from '../../../../src/services/document/PDFConverter.js';
import { HTMLConverter } from '../../../../src/services/document/HTMLConverter.js';
import { Chunker } from '../../../../src/services/document/Chunker.js';
import { Ingester } from '../../../../src/services/document/Ingester.js';
import fs from 'fs/promises';

// Mock all document services
vi.mock('../../../../src/services/document/PDFConverter.js', () => ({
    PDFConverter: {
        convert: vi.fn()
    }
}));
vi.mock('../../../../src/services/document/HTMLConverter.js', () => ({
    HTMLConverter: {
        convert: vi.fn()
    }
}));
vi.mock('../../../../src/services/document/Chunker.js', () => ({
    Chunker: {
        chunk: vi.fn()
    }
}));
vi.mock('../../../../src/services/document/Ingester.js', () => ({
    Ingester: {
        ingest: vi.fn()
    }
}));
vi.mock('fs/promises');

describe('DocumentAPI', () => {
    let documentAPI;
    let mockLogger;
    let mockRegistry;

    beforeEach(() => {
        // Mock logger
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        // Mock registry
        mockRegistry = {
            get: vi.fn(),
            set: vi.fn()
        };

        // Create DocumentAPI instance
        documentAPI = new DocumentAPI({
            registry: mockRegistry,
            logger: mockLogger,
            tempDir: '/tmp/test-documents',
            maxFileSize: 5 * 1024 * 1024, // 5MB for testing
            allowedMimeTypes: ['application/pdf', 'text/html', 'text/plain']
        });

        // Mock fs.mkdir to succeed
        fs.mkdir.mockResolvedValue();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await documentAPI.initialize();
            
            expect(documentAPI.initialized).toBe(true);
            expect(fs.mkdir).toHaveBeenCalledWith('/tmp/test-documents', { recursive: true });
            expect(mockLogger.info).toHaveBeenCalledWith(
                'DocumentAPI initialized with temp dir: /tmp/test-documents'
            );
        });

        it('should throw error if temp directory creation fails', async () => {
            const error = new Error('Permission denied');
            fs.mkdir.mockRejectedValue(error);

            await expect(documentAPI.initialize()).rejects.toThrow('Permission denied');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to create temp directory:', error);
        });

        it('should use default configuration values', () => {
            const defaultAPI = new DocumentAPI();
            
            expect(defaultAPI.tempDir).toBe('/tmp/semem-documents');
            expect(defaultAPI.maxFileSize).toBe(10 * 1024 * 1024);
            expect(defaultAPI.allowedMimeTypes).toEqual([
                'application/pdf',
                'text/html',
                'text/plain',
                'application/octet-stream'
            ]);
        });
    });

    describe('executeOperation', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should execute valid operations', async () => {
            const params = { test: 'param' };
            const result = { success: true, data: 'test' };

            // Mock the listDocuments method
            vi.spyOn(documentAPI, 'listDocuments').mockResolvedValue(result);

            const response = await documentAPI.executeOperation('list', params);

            expect(response.success).toBe(true);
            expect(response.operation).toBe('list');
            expect(response.data).toBe('test');
            expect(response.duration).toBeTypeOf('number');
            expect(documentAPI.listDocuments).toHaveBeenCalledWith(params);
        });

        it('should throw error for unknown operations', async () => {
            const params = {};

            const error = await documentAPI.executeOperation('unknown', params).catch(e => e);

            expect(error.success).toBe(false);
            expect(error.operation).toBe('unknown');
            expect(error.error).toBe('Unknown operation: unknown');
            expect(error.code).toBe('DOCUMENT_OPERATION_ERROR');
        });

        it('should validate parameters', async () => {
            await expect(documentAPI.executeOperation('list', null))
                .rejects.toThrow('Invalid parameters provided');
        });
    });

    describe('uploadDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        const mockFile = {
            originalname: 'test.pdf',
            size: 1024,
            mimetype: 'application/pdf',
            buffer: Buffer.from('test content')
        };

        it('should upload and process document with all options', async () => {
            const params = {
                options: {
                    convert: true,
                    chunk: true,
                    ingest: true,
                    namespace: 'http://test.org/'
                }
            };
            const files = { file: mockFile };
            const operationId = 'test-op-id';

            // Mock all the dependent operations
            const convertResult = { content: 'converted content', metadata: { pages: 1 } };
            const chunkResult = { chunks: [{ id: 1, content: 'chunk1' }] };
            const ingestResult = { triplesCreated: 10, graphUri: 'http://test.org/graph' };

            vi.spyOn(documentAPI, 'convertDocument').mockResolvedValue(convertResult);
            vi.spyOn(documentAPI, 'chunkDocument').mockResolvedValue(chunkResult);
            vi.spyOn(documentAPI, 'ingestDocument').mockResolvedValue(ingestResult);

            const result = await documentAPI.uploadDocument(params, files, operationId);

            expect(result.filename).toBe('test.pdf');
            expect(result.size).toBe(1024);
            expect(result.mimeType).toBe('application/pdf');
            expect(result.status).toBe('uploaded');
            expect(result.conversion).toEqual(convertResult);
            expect(result.chunking).toEqual(chunkResult);
            expect(result.ingestion).toEqual(ingestResult);

            // Check that document is stored in documentStore
            expect(documentAPI.documentStore.size).toBe(1);
            const storedDoc = Array.from(documentAPI.documentStore.values())[0];
            expect(storedDoc.filename).toBe('test.pdf');
            expect(storedDoc.status).toBe('ingested');
            expect(storedDoc.operations).toEqual(['convert', 'chunk', 'ingest']);
        });

        it('should upload without processing when options disabled', async () => {
            const params = {
                options: { convert: false }
            };
            const files = { file: mockFile };
            const operationId = 'test-op-id';

            const result = await documentAPI.uploadDocument(params, files, operationId);

            expect(result.filename).toBe('test.pdf');
            expect(result.conversion).toBeUndefined();
            expect(result.chunking).toBeUndefined();
            expect(result.ingestion).toBeUndefined();
        });

        it('should handle conversion errors', async () => {
            const params = { options: {} };
            const files = { file: mockFile };
            const operationId = 'test-op-id';

            vi.spyOn(documentAPI, 'convertDocument').mockRejectedValue(new Error('Conversion failed'));

            await expect(documentAPI.uploadDocument(params, files, operationId))
                .rejects.toThrow('Conversion failed');

            // Check document status is set to error
            const storedDoc = Array.from(documentAPI.documentStore.values())[0];
            expect(storedDoc.status).toBe('error');
            expect(storedDoc.error).toBe('Conversion failed');
        });

        it('should throw error when no file provided', async () => {
            const params = {};
            const files = {};
            const operationId = 'test-op-id';

            await expect(documentAPI.uploadDocument(params, files, operationId))
                .rejects.toThrow('No file provided for upload');
        });
    });

    describe('convertDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should convert PDF document', async () => {
            const params = {
                file: Buffer.from('pdf content'),
                mimeType: 'application/pdf',
                filename: 'test.pdf'
            };

            const mockResult = {
                content: 'converted markdown',
                metadata: { pages: 2, title: 'Test PDF' }
            };

            PDFConverter.convert.mockResolvedValue(mockResult);

            const result = await documentAPI.convertDocument(params, 'op-id');

            expect(PDFConverter.convert).toHaveBeenCalledWith(params.file, {
                filename: 'test.pdf',
                extractMetadata: true
            });
            expect(result.content).toBe('converted markdown');
            expect(result.metadata).toEqual(mockResult.metadata);
            expect(result.format).toBe('markdown');
        });

        it('should convert HTML document', async () => {
            const params = {
                file: Buffer.from('<html><body>test</body></html>'),
                mimeType: 'text/html',
                filename: 'test.html'
            };

            const mockResult = {
                content: 'converted markdown',
                metadata: { title: 'Test HTML' }
            };

            HTMLConverter.convert.mockResolvedValue(mockResult);

            const result = await documentAPI.convertDocument(params, 'op-id');

            expect(HTMLConverter.convert).toHaveBeenCalledWith(params.file, {
                filename: 'test.html',
                extractMetadata: true,
                cleanOutput: true
            });
            expect(result.content).toBe('converted markdown');
        });

        it('should handle plain text documents', async () => {
            const params = {
                file: Buffer.from('plain text content'),
                mimeType: 'text/plain',
                filename: 'test.txt'
            };

            const result = await documentAPI.convertDocument(params, 'op-id');

            expect(result.content).toBe('plain text content');
            expect(result.metadata.contentType).toBe('text/plain');
            expect(result.format).toBe('markdown');
        });

        it('should throw error for unsupported file types', async () => {
            const params = {
                file: Buffer.from('binary content'),
                mimeType: 'application/unknown',
                filename: 'test.bin'
            };

            await expect(documentAPI.convertDocument(params, 'op-id'))
                .rejects.toThrow('Unsupported file type: application/unknown');
        });

        it('should handle document by ID', async () => {
            const documentId = 'test-doc-id';
            
            // First add a document to the store
            documentAPI.documentStore.set(documentId, {
                id: documentId,
                filename: 'test.pdf',
                status: 'uploaded'
            });
            
            await expect(documentAPI.convertDocument({ documentId }, 'op-id'))
                .rejects.toThrow('Document content loading not implemented - provide file directly');
        });

        it('should throw error when no content provided', async () => {
            await expect(documentAPI.convertDocument({}, 'op-id'))
                .rejects.toThrow('No content provided for conversion');
        });
    });

    describe('chunkDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should chunk document content', async () => {
            const params = {
                content: 'This is a long document that needs to be chunked into smaller pieces.',
                metadata: { title: 'Test Document' },
                options: { namespace: 'http://test.org/' }
            };

            const mockResult = {
                chunks: [
                    { id: 1, content: 'chunk 1' },
                    { id: 2, content: 'chunk 2' }
                ],
                metadata: { totalChunks: 2 }
            };

            Chunker.chunk.mockResolvedValue(mockResult);

            const result = await documentAPI.chunkDocument(params, 'op-id');

            expect(Chunker.chunk).toHaveBeenCalledWith(params.content, {
                namespace: 'http://test.org/',
                provenance: {
                    operation: 'document-api-chunk',
                    operationId: 'op-id',
                    timestamp: expect.any(String)
                }
            });
            expect(result.chunkCount).toBe(2);
            expect(result.chunks).toEqual(mockResult.chunks);
        });

        it('should use default namespace when not provided', async () => {
            const params = {
                content: 'test content'
            };

            const mockResult = { chunks: [], metadata: {} };
            Chunker.chunk.mockResolvedValue(mockResult);

            await documentAPI.chunkDocument(params, 'op-id');

            expect(Chunker.chunk).toHaveBeenCalledWith(
                params.content,
                expect.objectContaining({
                    namespace: 'http://example.org/documents/'
                })
            );
        });

        it('should throw error when no content provided', async () => {
            await expect(documentAPI.chunkDocument({}, 'op-id'))
                .rejects.toThrow('No content provided for chunking');
        });
    });

    describe('ingestDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should ingest chunks into SPARQL store', async () => {
            const params = {
                chunks: [
                    { id: 1, content: 'chunk 1' },
                    { id: 2, content: 'chunk 2' }
                ],
                namespace: 'http://test.org/',
                options: { graphUri: 'http://test.org/graph' }
            };

            const mockResult = {
                triplesCreated: 50,
                graphUri: 'http://test.org/graph'
            };

            Ingester.ingest.mockResolvedValue(mockResult);

            const result = await documentAPI.ingestDocument(params, 'op-id');

            expect(Ingester.ingest).toHaveBeenCalledWith(params.chunks, {
                namespace: 'http://test.org/',
                graphUri: 'http://test.org/graph',
                provenance: {
                    operation: 'document-api-ingest',
                    operationId: 'op-id',
                    timestamp: expect.any(String)
                }
            });
            expect(result.triplesCreated).toBe(50);
            expect(result.chunksIngested).toBe(2);
        });

        it('should throw error when no chunks provided', async () => {
            await expect(documentAPI.ingestDocument({}, 'op-id'))
                .rejects.toThrow('No chunks provided for ingestion');
        });

        it('should throw error when chunks is not an array', async () => {
            const params = { chunks: 'not an array' };

            await expect(documentAPI.ingestDocument(params, 'op-id'))
                .rejects.toThrow('No chunks provided for ingestion');
        });
    });

    describe('listDocuments', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
            
            // Add some test documents
            documentAPI.documentStore.set('doc1', {
                id: 'doc1',
                filename: 'test1.pdf',
                status: 'uploaded',
                uploadedAt: '2023-01-01T00:00:00.000Z'
            });
            documentAPI.documentStore.set('doc2', {
                id: 'doc2',
                filename: 'test2.pdf',
                status: 'processed',
                uploadedAt: '2023-01-02T00:00:00.000Z'
            });
            documentAPI.documentStore.set('doc3', {
                id: 'doc3',
                filename: 'test3.pdf',
                status: 'uploaded',
                uploadedAt: '2023-01-03T00:00:00.000Z'
            });
        });

        it('should list all documents with pagination', async () => {
            const params = { limit: 2, offset: 0 };

            const result = await documentAPI.listDocuments(params);

            expect(result.documents).toHaveLength(2);
            expect(result.pagination.total).toBe(3);
            expect(result.pagination.limit).toBe(2);
            expect(result.pagination.offset).toBe(0);
            expect(result.pagination.hasMore).toBe(true);
            
            // Should be sorted by upload date (newest first)
            expect(result.documents[0].id).toBe('doc3');
            expect(result.documents[1].id).toBe('doc2');
        });

        it('should filter by status', async () => {
            const params = { status: 'uploaded' };

            const result = await documentAPI.listDocuments(params);

            expect(result.documents).toHaveLength(2);
            expect(result.documents.every(doc => doc.status === 'uploaded')).toBe(true);
        });

        it('should use default pagination values', async () => {
            const result = await documentAPI.listDocuments({});

            expect(result.pagination.limit).toBe(50);
            expect(result.pagination.offset).toBe(0);
        });
    });

    describe('getDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
            
            documentAPI.documentStore.set('test-doc', {
                id: 'test-doc',
                filename: 'test.pdf',
                status: 'processed'
            });
        });

        it('should get document by ID', async () => {
            const params = { documentId: 'test-doc' };

            const result = await documentAPI.getDocument(params);

            expect(result.document.id).toBe('test-doc');
            expect(result.document.filename).toBe('test.pdf');
        });

        it('should throw error when document ID not provided', async () => {
            await expect(documentAPI.getDocument({}))
                .rejects.toThrow('Document ID is required');
        });

        it('should throw error when document not found', async () => {
            const params = { documentId: 'non-existent' };

            await expect(documentAPI.getDocument(params))
                .rejects.toThrow('Document not found: non-existent');
        });
    });

    describe('deleteDocument', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
            
            documentAPI.documentStore.set('test-doc', {
                id: 'test-doc',
                filename: 'test.pdf',
                status: 'processed'
            });
        });

        it('should delete document by ID', async () => {
            const params = { documentId: 'test-doc' };

            const result = await documentAPI.deleteDocument(params);

            expect(result.documentId).toBe('test-doc');
            expect(result.deleted).toBe(true);
            expect(documentAPI.documentStore.has('test-doc')).toBe(false);
        });

        it('should throw error when document ID not provided', async () => {
            await expect(documentAPI.deleteDocument({}))
                .rejects.toThrow('Document ID is required');
        });

        it('should throw error when document not found', async () => {
            const params = { documentId: 'non-existent' };

            await expect(documentAPI.deleteDocument(params))
                .rejects.toThrow('Document not found: non-existent');
        });
    });

    describe('file validation', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should validate file size', () => {
            const largeFile = {
                size: 10 * 1024 * 1024, // 10MB, larger than 5MB limit
                mimetype: 'application/pdf'
            };

            expect(() => documentAPI._validateFile(largeFile))
                .toThrow('File too large: 10485760 bytes (max: 5242880)');
        });

        it('should validate file type', () => {
            const invalidFile = {
                size: 1024,
                mimetype: 'application/exe'
            };

            expect(() => documentAPI._validateFile(invalidFile))
                .toThrow('Unsupported file type: application/exe');
        });

        it('should validate file exists', () => {
            expect(() => documentAPI._validateFile(null))
                .toThrow('No file provided');
        });

        it('should pass validation for valid files', () => {
            const validFile = {
                size: 1024,
                mimetype: 'application/pdf'
            };

            expect(() => documentAPI._validateFile(validFile)).not.toThrow();
        });
    });

    describe('parameter validation', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should validate parameters exist', () => {
            expect(() => documentAPI._validateParams(null))
                .toThrow('Invalid parameters provided');
            
            expect(() => documentAPI._validateParams('string'))
                .toThrow('Invalid parameters provided');
        });

        it('should pass validation for valid parameters', () => {
            expect(() => documentAPI._validateParams({})).not.toThrow();
            expect(() => documentAPI._validateParams({ key: 'value' })).not.toThrow();
        });
    });

    describe('dispose', () => {
        beforeEach(async () => {
            await documentAPI.initialize();
        });

        it('should clean up temp files on dispose', async () => {
            fs.readdir.mockResolvedValue(['file1.tmp', 'file2.tmp']);
            fs.unlink.mockResolvedValue();

            await documentAPI.dispose();

            expect(fs.readdir).toHaveBeenCalledWith('/tmp/test-documents');
            expect(fs.unlink).toHaveBeenCalledWith('/tmp/test-documents/file1.tmp');
            expect(fs.unlink).toHaveBeenCalledWith('/tmp/test-documents/file2.tmp');
        });

        it('should handle cleanup errors gracefully', async () => {
            fs.readdir.mockRejectedValue(new Error('Directory not found'));

            await expect(documentAPI.dispose()).resolves.not.toThrow();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Error cleaning up temp files:',
                expect.any(Error)
            );
        });
    });
});