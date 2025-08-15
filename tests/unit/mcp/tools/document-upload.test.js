import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DocumentProcessor } from '../../../../mcp/tools/document-tools.js';

// Mock dependencies
vi.mock('fs');
vi.mock('../../../../src/services/document/PDFConverter.js');
vi.mock('../../../../src/utils/URIMinter.js');

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('DocumentProcessor', () => {
  let processor;
  let mockConfig;
  let mockSparqlHelper;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock config
    mockConfig = {
      get: vi.fn((key) => {
        if (key === 'storage.options.graphName') return 'http://test.org/documents';
        if (key === 'storage.options') return {
          user: 'testuser',
          password: 'testpass',
          query: 'http://localhost:3030/test/query',
          update: 'http://localhost:3030/test/update'
        };
        return null;
      })
    };
    
    // Mock SPARQL helper
    mockSparqlHelper = {
      executeUpdate: vi.fn().mockResolvedValue(true)
    };
    
    // Mock file system
    existsSync.mockReturnValue(true);
    mkdirSync.mockReturnValue(true);
    
    processor = new DocumentProcessor(mockConfig, mockSparqlHelper);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFileTypeFromExtension', () => {
    it('should correctly identify PDF files', () => {
      expect(processor.getFileTypeFromExtension('document.pdf')).toBe('pdf');
      expect(processor.getFileTypeFromExtension('Document.PDF')).toBe('pdf');
    });
    
    it('should correctly identify text files', () => {
      expect(processor.getFileTypeFromExtension('document.txt')).toBe('text');
      expect(processor.getFileTypeFromExtension('Document.TXT')).toBe('text');
    });
    
    it('should correctly identify markdown files', () => {
      expect(processor.getFileTypeFromExtension('document.md')).toBe('markdown');
      expect(processor.getFileTypeFromExtension('Document.MD')).toBe('markdown');
    });
    
    it('should return null for unsupported file types', () => {
      expect(processor.getFileTypeFromExtension('document.doc')).toBeNull();
      expect(processor.getFileTypeFromExtension('document.xlsx')).toBeNull();
      expect(processor.getFileTypeFromExtension('document')).toBeNull();
    });
  });

  describe('saveDataUrlToFile', () => {
    it('should save data URL to temp file', async () => {
      const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // "Hello World"
      const filename = 'test.txt';
      const uploadId = '12345';
      
      writeFileSync.mockReturnValue(true);
      
      const result = await processor.saveDataUrlToFile(dataUrl, filename, uploadId);
      
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('12345_test.txt'),
        expect.any(Buffer)
      );
      expect(result).toMatch(/12345_test\.txt$/);
    });
    
    it('should throw error for invalid data URL', async () => {
      const invalidDataUrl = 'invalid-data-url';
      const filename = 'test.txt';
      const uploadId = '12345';
      
      await expect(
        processor.saveDataUrlToFile(invalidDataUrl, filename, uploadId)
      ).rejects.toThrow('Invalid data URL format');
    });
  });

  describe('processTextFile', () => {
    it('should process plain text file', async () => {
      const testContent = 'This is a test document';
      const filename = 'test.txt';
      const metadata = { title: 'Test Document' };
      
      readFileSync.mockReturnValue(testContent);
      
      const result = await processor.processTextFile('/tmp/test.txt', filename, metadata);
      
      expect(result.content).toBe(testContent);
      expect(result.processedMetadata).toMatchObject({
        title: 'Test Document',
        type: 'ragno:Unit',
        format: 'text',
        sourceFile: filename,
        size: testContent.length
      });
    });
  });

  describe('processMarkdownFile', () => {
    it('should process markdown file', async () => {
      const testContent = '# Test Document\n\nThis is a test.';
      const filename = 'test.md';
      const metadata = { title: 'Test Markdown' };
      
      readFileSync.mockReturnValue(testContent);
      
      const result = await processor.processMarkdownFile('/tmp/test.md', filename, metadata);
      
      expect(result.content).toBe(testContent);
      expect(result.processedMetadata).toMatchObject({
        title: 'Test Markdown',
        type: 'ragno:Unit',
        format: 'markdown',
        sourceFile: filename,
        size: testContent.length
      });
    });
  });

  describe('storeDocumentInSPARQL', () => {
    it('should store document in SPARQL with correct format', async () => {
      const content = 'Test document content';
      const filename = 'test.txt';
      const metadata = { title: 'Test Document' };
      const documentType = 'text';
      
      const result = await processor.storeDocumentInSPARQL(content, filename, metadata, documentType);
      
      expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
        expect.stringContaining('INSERT DATA')
      );
      expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
        expect.stringContaining('ragno:Unit')
      );
      expect(mockSparqlHelper.executeUpdate).toHaveBeenCalledWith(
        expect.stringContaining('ragno:TextElement')
      );
      
      expect(result).toMatchObject({
        stored: true,
        unitURI: expect.stringContaining('http://purl.org/stuff/instance/'),
        textURI: expect.stringContaining('http://purl.org/stuff/instance/'),
        targetGraph: 'http://test.org/documents'
      });
    });
  });

  describe('processUploadedDocument', () => {
    it('should process text document successfully', async () => {
      const params = {
        fileUrl: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
        filename: 'test.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: { title: 'Test Document' }
      };
      
      writeFileSync.mockReturnValue(true);
      readFileSync.mockReturnValue('Hello World');
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(true);
      expect(result.verb).toBe('uploadDocument');
      expect(result.filename).toBe('test.txt');
      expect(result.documentType).toBe('text');
      expect(result.stored).toBe(true);
      expect(result.contentLength).toBe(11); // "Hello World" length
    });
    
    it('should handle processing errors gracefully', async () => {
      const params = {
        fileUrl: 'invalid-data-url',
        filename: 'test.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {}
      };
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data URL format');
      expect(result.verb).toBe('uploadDocument');
    });
    
    it('should handle unsupported document types', async () => {
      const params = {
        fileUrl: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
        filename: 'test.doc',
        mediaType: 'application/msword',
        documentType: 'doc',
        metadata: {}
      };
      
      writeFileSync.mockReturnValue(true);
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported document type: doc');
    });
  });

  describe('checkDocumentExists', () => {
    it('should check if document exists in SPARQL store', async () => {
      const filename = 'test.txt';
      const targetGraph = 'http://test.org/documents';
      
      // Mock successful fetch response
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ boolean: true })
      });
      
      const exists = await processor.checkDocumentExists(filename, targetGraph);
      
      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3030/test/query',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/sparql-query'
          })
        })
      );
    });
    
    it('should handle network errors gracefully', async () => {
      const filename = 'test.txt';
      const targetGraph = 'http://test.org/documents';
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const exists = await processor.checkDocumentExists(filename, targetGraph);
      
      expect(exists).toBe(false);
    });
  });
});