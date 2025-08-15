import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DocumentProcessor } from '../../../mcp/tools/document-tools.js';
import Config from '../../../src/Config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Document Upload Integration Tests', () => {
  let processor;
  let config;
  let mockSparqlHelper;
  
  beforeEach(async () => {
    // Use test configuration
    config = new Config(join(process.cwd(), 'config', 'config.json'));
    await config.init();
    
    // Mock SPARQL helper for integration tests
    mockSparqlHelper = {
      executeUpdate: async (query) => {
        // Validate SPARQL query structure
        expect(query).toContain('INSERT DATA');
        expect(query).toContain('ragno:Unit');
        expect(query).toContain('ragno:TextElement');
        return true;
      }
    };
    
    processor = new DocumentProcessor(config, mockSparqlHelper);
  });

  describe('End-to-End Document Processing', () => {
    it('should process a complete text document upload workflow', async () => {
      const testContent = 'This is a test document for integration testing.';
      const dataUrl = `data:text/plain;base64,${Buffer.from(testContent).toString('base64')}`;
      
      const params = {
        fileUrl: dataUrl,
        filename: 'integration-test.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {
          title: 'Integration Test Document',
          tags: ['test', 'integration'],
          uploadedAt: new Date().toISOString(),
          size: testContent.length
        }
      };
      
      const result = await processor.processUploadedDocument(params);
      
      // Verify successful processing
      expect(result.success).toBe(true);
      expect(result.verb).toBe('uploadDocument');
      expect(result.filename).toBe('integration-test.txt');
      expect(result.documentType).toBe('text');
      expect(result.stored).toBe(true);
      expect(result.contentLength).toBe(testContent.length);
      expect(result.unitURI).toMatch(/^http:\/\/purl\.org\/stuff\/instance\//);
      expect(result.textURI).toMatch(/^http:\/\/purl\.org\/stuff\/instance\//);
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThan(0);
    });
    
    it('should process a markdown document with proper metadata', async () => {
      const markdownContent = `# Test Document

This is a **test** markdown document with:

- Lists
- **Bold text**
- *Italic text*

## Section 2

Some more content here.`;
      
      const dataUrl = `data:text/markdown;base64,${Buffer.from(markdownContent).toString('base64')}`;
      
      const params = {
        fileUrl: dataUrl,
        filename: 'test-markdown.md',
        mediaType: 'text/markdown',
        documentType: 'markdown',
        metadata: {
          title: 'Test Markdown Document',
          tags: ['markdown', 'test'],
          uploadedAt: new Date().toISOString()
        }
      };
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(true);
      expect(result.documentType).toBe('markdown');
      expect(result.contentLength).toBe(markdownContent.length);
      expect(result.stored).toBe(true);
    });
    
    it('should handle large text documents', async () => {
      // Create a larger test document (1MB)
      const largeContent = 'A'.repeat(1024 * 1024);
      const dataUrl = `data:text/plain;base64,${Buffer.from(largeContent).toString('base64')}`;
      
      const params = {
        fileUrl: dataUrl,
        filename: 'large-document.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {
          title: 'Large Test Document',
          size: largeContent.length
        }
      };
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(true);
      expect(result.contentLength).toBe(1024 * 1024);
      expect(result.processingTime).toBeGreaterThan(0);
    });
    
    it('should validate file type consistency', async () => {
      const testContent = 'Plain text content';
      const dataUrl = `data:text/plain;base64,${Buffer.from(testContent).toString('base64')}`;
      
      // Test with mismatched file extension and document type
      const params = {
        fileUrl: dataUrl,
        filename: 'document.pdf', // PDF extension
        mediaType: 'text/plain',   // Plain text media type
        documentType: 'text',      // Text document type
        metadata: {}
      };
      
      const result = await processor.processUploadedDocument(params);
      
      // Should still succeed as we trust the explicitly provided documentType
      expect(result.success).toBe(true);
      expect(result.documentType).toBe('text');
    });
    
    it('should handle processing errors gracefully', async () => {
      const params = {
        fileUrl: 'invalid-data-url-format',
        filename: 'invalid.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {}
      };
      
      const result = await processor.processUploadedDocument(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid data URL format');
      expect(result.verb).toBe('uploadDocument');
      expect(result.filename).toBe('invalid.txt');
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('SPARQL Integration', () => {
    it('should generate valid SPARQL update queries', async () => {
      const content = 'Test content for SPARQL';
      const filename = 'sparql-test.txt';
      const metadata = { title: 'SPARQL Test Document' };
      const documentType = 'text';
      
      let capturedQuery = '';
      const testSparqlHelper = {
        executeUpdate: async (query) => {
          capturedQuery = query;
          return true;
        }
      };
      
      const testProcessor = new DocumentProcessor(config, testSparqlHelper);
      
      const result = await testProcessor.storeDocumentInSPARQL(
        content, 
        filename, 
        metadata, 
        documentType
      );
      
      // Verify query structure
      expect(capturedQuery).toContain('PREFIX ragno: <http://purl.org/stuff/ragno/>');
      expect(capturedQuery).toContain('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>');
      expect(capturedQuery).toContain('INSERT DATA');
      expect(capturedQuery).toContain('ragno:Unit');
      expect(capturedQuery).toContain('ragno:TextElement');
      expect(capturedQuery).toContain('semem:sourceFile');
      expect(capturedQuery).toContain('semem:documentType');
      expect(capturedQuery).toContain(filename);
      expect(capturedQuery).toContain(documentType);
      
      // Verify result
      expect(result.stored).toBe(true);
      expect(result.unitURI).toBeDefined();
      expect(result.textURI).toBeDefined();
    });
    
    it('should use correct graph URIs', async () => {
      const testConfig = {
        get: (key) => {
          if (key === 'storage.options.graphName') return 'http://custom.graph.uri/test';
          if (key === 'graphName') return 'http://fallback.graph.uri/test';
          return null;
        }
      };
      
      let capturedQuery = '';
      const testSparqlHelper = {
        executeUpdate: async (query) => {
          capturedQuery = query;
          return true;
        }
      };
      
      const testProcessor = new DocumentProcessor(testConfig, testSparqlHelper);
      
      await testProcessor.storeDocumentInSPARQL(
        'test content',
        'test.txt',
        { title: 'Test' },
        'text'
      );
      
      expect(capturedQuery).toContain('GRAPH <http://custom.graph.uri/test>');
    });
  });

  describe('File Type Detection', () => {
    const fileTypeTests = [
      { filename: 'document.pdf', expected: 'pdf' },
      { filename: 'Document.PDF', expected: 'pdf' },
      { filename: 'text.txt', expected: 'text' },
      { filename: 'TEXT.TXT', expected: 'text' },
      { filename: 'readme.md', expected: 'markdown' },
      { filename: 'README.MD', expected: 'markdown' },
      { filename: 'unknown.doc', expected: null },
      { filename: 'noextension', expected: null }
    ];
    
    fileTypeTests.forEach(({ filename, expected }) => {
      it(`should detect ${expected || 'null'} for ${filename}`, () => {
        // Access the method through the prototype since it's not a static method
        const fileType = processor.constructor.prototype.getFileTypeFromExtension?.call(
          processor, 
          filename
        ) || processor.getFileTypeFromExtension(filename);
        
        expect(fileType).toBe(expected);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle SPARQL connection failures', async () => {
      const failingSparqlHelper = {
        executeUpdate: async () => {
          throw new Error('SPARQL connection failed');
        }
      };
      
      const testProcessor = new DocumentProcessor(config, failingSparqlHelper);
      
      const params = {
        fileUrl: 'data:text/plain;base64,dGVzdA==',
        filename: 'failing-test.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {}
      };
      
      const result = await testProcessor.processUploadedDocument(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('SPARQL connection failed');
    });
    
    it('should handle invalid base64 data', async () => {
      const params = {
        fileUrl: 'data:text/plain;base64,invalid-base64-data!@#',
        filename: 'invalid-base64.txt',
        mediaType: 'text/plain',
        documentType: 'text',
        metadata: {}
      };
      
      const result = await processor.processUploadedDocument(params);
      
      // Should handle base64 decoding gracefully
      expect(result.success).toBe(false);
    });
  });
});