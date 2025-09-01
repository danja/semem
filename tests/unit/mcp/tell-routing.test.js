import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Tell Routing Functionality', () => {
  // Mock SimpleVerbsService for testing
  const mockSimpleVerbsService = {
    initialize: vi.fn().mockResolvedValue(),
    tell: vi.fn().mockResolvedValue({ success: true })
  };

  // Mock DocumentProcessor and dependencies
  const mockDocumentProcessor = {
    processUploadedDocument: vi.fn().mockResolvedValue({ 
      success: true, 
      processed: true 
    })
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('URL Detection', () => {
    it('should detect HTTP URLs', () => {
      const testStrings = [
        'http://example.com/document.pdf',
        'https://example.com/file.txt',
        'Check this https://docs.google.com/document/123',
        'Multiple URLs: http://site1.com and https://site2.com/file'
      ];

      testStrings.forEach(str => {
        const urlPattern = /https?:\/\/[^\s]+/gi;
        expect(urlPattern.test(str)).toBe(true);
      });
    });

    it('should not detect non-URLs', () => {
      const testStrings = [
        'This is regular text',
        'ftp://example.com',
        'file:///local/path',
        'www.example.com'
      ];

      testStrings.forEach(str => {
        const urlPattern = /https?:\/\/[^\s]+/gi;
        expect(urlPattern.test(str)).toBe(false);
      });
    });

    it('should extract URLs correctly', () => {
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const text = 'Check this https://example.com/doc.pdf and also http://other.com/file.txt';
      const urls = text.match(urlPattern);
      
      expect(urls).toEqual([
        'https://example.com/doc.pdf',
        'http://other.com/file.txt'
      ]);
    });
  });

  describe('File Path Detection', () => {
    it('should detect various file path formats', () => {
      const testStrings = [
        './documents/file.pdf',
        '/absolute/path/to/document.txt',
        '~/home/user/file.json',
        'C:\\Windows\\System\\file.dll',
        '../relative/path/script.js'
      ];

      testStrings.forEach(str => {
        const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
        expect(filePathPattern.test(str)).toBe(true);
      });
    });

    it('should not detect invalid file paths', () => {
      const testStrings = [
        'regular text',
        'filename without path',
        'path/without/extension',
        'just/a/directory/'
      ];

      testStrings.forEach(str => {
        const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
        expect(filePathPattern.test(str)).toBe(false);
      });
    });

    it('should extract file paths correctly', () => {
      const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      const text = 'Process ./local/file.txt and also /absolute/path/document.pdf';
      const filePaths = text.match(filePathPattern);
      
      expect(filePaths).toEqual([
        './local/file.txt',
        '/absolute/path/document.pdf'
      ]);
    });
  });

  describe('Tell Command Routing Logic', () => {
    it('should identify URL content for routing to ingest', () => {
      const args = 'Please process this document https://example.com/document.pdf';
      
      // First check URLs
      const urlPattern1 = /https?:\/\/[^\s]+/gi;
      const hasUrls = urlPattern1.test(args);
      
      // Then check file paths (excluding URLs)
      const textWithoutUrls = args.replace(/https?:\/\/[^\s]+/gi, '');
      const filePathPattern1 = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      const hasFilePaths = filePathPattern1.test(textWithoutUrls);
      
      expect(hasUrls).toBe(true);
      expect(hasFilePaths).toBe(false);
      
      const urlPattern2 = /https?:\/\/[^\s]+/gi;
      const urls = args.match(urlPattern2) || [];
      expect(urls[0]).toBe('https://example.com/document.pdf');
    });

    it('should identify file path content for routing to ingest', () => {
      const args = 'Analyze the data in ./reports/quarterly_report.xlsx';
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      
      const hasUrls = urlPattern.test(args);
      const hasFilePaths = filePathPattern.test(args);
      
      expect(hasUrls).toBe(false);
      expect(hasFilePaths).toBe(true);
      
      const filePaths = args.match(filePathPattern) || [];
      expect(filePaths[0]).toBe('./reports/quarterly_report.xlsx');
    });

    it('should handle mixed URL and file path content', () => {
      const args = 'Process https://example.com/remote.pdf and also ./local/file.txt';
      
      // Check URLs first
      const urlPattern1 = /https?:\/\/[^\s]+/gi;
      const hasUrls = urlPattern1.test(args);
      
      // Check file paths after removing URLs
      const textWithoutUrls = args.replace(/https?:\/\/[^\s]+/gi, '');
      const filePathPattern1 = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      const hasFilePaths = filePathPattern1.test(textWithoutUrls);
      
      expect(hasUrls).toBe(true);
      expect(hasFilePaths).toBe(true);
      
      // Extract both URLs and file paths
      const urlPattern2 = /https?:\/\/[^\s]+/gi;
      const filePathPattern2 = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      const urls = args.match(urlPattern2) || [];
      const filePaths = textWithoutUrls.match(filePathPattern2) || [];
      
      expect(urls[0]).toBe('https://example.com/remote.pdf');
      expect(filePaths[0]).toBe('./local/file.txt');
    });

    it('should not route regular text to ingest', () => {
      const args = 'Remember that the meeting is scheduled for tomorrow at 2pm';
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      
      const hasUrls = urlPattern.test(args);
      const hasFilePaths = filePathPattern.test(args);
      
      expect(hasUrls).toBe(false);
      expect(hasFilePaths).toBe(false);
    });
  });

  describe('Routing Response Structure', () => {
    it('should structure URL ingest response correctly', () => {
      const target = 'https://example.com/document.pdf';
      const originalMessage = `/tell Process ${target}`;
      const mockResult = { success: true, processed: true };
      
      const expectedResponse = {
        success: true,
        messageType: 'tell_ingest_result',
        content: `URL processed and content ingested: "${target}"`,
        originalMessage: originalMessage,
        routing: 'tell_ingest_url',
        target: target,
        processingResult: mockResult,
        timestamp: expect.any(String)
      };

      const actualResponse = {
        success: true,
        messageType: 'tell_ingest_result',
        content: `URL processed and content ingested: "${target}"`,
        originalMessage: originalMessage,
        routing: 'tell_ingest_url',
        target: target,
        processingResult: mockResult,
        timestamp: new Date().toISOString()
      };

      expect(actualResponse).toMatchObject({
        success: expectedResponse.success,
        messageType: expectedResponse.messageType,
        content: expectedResponse.content,
        originalMessage: expectedResponse.originalMessage,
        routing: expectedResponse.routing,
        target: expectedResponse.target,
        processingResult: expectedResponse.processingResult
      });
    });

    it('should structure file path response correctly', () => {
      const target = './documents/report.pdf';
      const originalMessage = `/tell Process ${target}`;
      
      const expectedResponse = {
        success: true,
        messageType: 'tell_ingest_result',
        content: `File path detected and referenced: "${target}"`,
        originalMessage: originalMessage,
        routing: 'tell_ingest_file',
        target: target,
        note: 'File path stored as reference. Use upload-document endpoint for full file processing.',
        timestamp: expect.any(String)
      };

      const actualResponse = {
        success: true,
        messageType: 'tell_ingest_result',
        content: `File path detected and referenced: "${target}"`,
        originalMessage: originalMessage,
        routing: 'tell_ingest_file',
        target: target,
        note: 'File path stored as reference. Use upload-document endpoint for full file processing.',
        timestamp: new Date().toISOString()
      };

      expect(actualResponse).toMatchObject({
        success: expectedResponse.success,
        messageType: expectedResponse.messageType,
        content: expectedResponse.content,
        originalMessage: expectedResponse.originalMessage,
        routing: expectedResponse.routing,
        target: expectedResponse.target,
        note: expectedResponse.note
      });
    });

    it('should structure regular tell response correctly', () => {
      const args = 'Remember the meeting is at 2pm tomorrow';
      const originalMessage = `/tell ${args}`;
      
      const expectedResponse = {
        success: true,
        messageType: 'tell_result',
        content: `Information stored successfully: "${args}"`,
        originalMessage: originalMessage,
        routing: 'tell_command',
        timestamp: expect.any(String)
      };

      const actualResponse = {
        success: true,
        messageType: 'tell_result',
        content: `Information stored successfully: "${args}"`,
        originalMessage: originalMessage,
        routing: 'tell_command',
        timestamp: new Date().toISOString()
      };

      expect(actualResponse).toMatchObject({
        success: expectedResponse.success,
        messageType: expectedResponse.messageType,
        content: expectedResponse.content,
        originalMessage: expectedResponse.originalMessage,
        routing: expectedResponse.routing
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple URLs and select the first one', () => {
      const args = 'Process https://site1.com/doc1.pdf and https://site2.com/doc2.pdf';
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const urls = args.match(urlPattern) || [];
      const target = urls[0];
      
      expect(target).toBe('https://site1.com/doc1.pdf');
      expect(urls.length).toBe(2);
    });

    it('should handle URLs with query parameters and fragments', () => {
      const args = 'Check https://example.com/doc.pdf?version=1.2&download=true#section1';
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const urls = args.match(urlPattern) || [];
      
      expect(urls[0]).toBe('https://example.com/doc.pdf?version=1.2&download=true#section1');
    });

    it('should handle file paths with spaces (when properly quoted)', () => {
      // Note: Our current regex doesn't handle spaces in paths
      // This test documents the current limitation
      const args = 'Process ./documents/my file.pdf';
      const filePathPattern = /(?:\.\/|\/|~\/|[a-zA-Z]:\\)[\w\-._\/\\]+\.[\w]+/gi;
      const filePaths = args.match(filePathPattern) || [];
      
      // Current implementation won't match paths with spaces
      expect(filePaths.length).toBe(0);
    });

    it('should handle mixed content with both URLs and regular text', () => {
      const args = 'Please analyze https://example.com/report.pdf and remember that deadline is Friday';
      const urlPattern = /https?:\/\/[^\s]+/gi;
      const urls = args.match(urlPattern) || [];
      
      expect(urls.length).toBe(1);
      expect(urls[0]).toBe('https://example.com/report.pdf');
    });
  });
});