/**
 * Document Processor - Handles document upload, processing, and content extraction
 * Supports multiple file types and formats
 */

import { mcpDebugger } from './debug-utils.js';
import path from 'path';

class DocumentProcessor {
  constructor() {
    this.name = 'DocumentProcessor';
    this.supportedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/json',
      'text/html',
      'text/csv',
      'application/xml',
      'text/xml'
    ];
  }

  /**
   * Process uploaded document
   */
  async processUpload(options = {}) {
    const {
      fileUrl,
      filename,
      mediaType = 'text/plain',
      documentType = 'text',
      metadata = {}
    } = options;

    mcpDebugger.info('DocumentProcessor: Starting document processing', {
      filename,
      mediaType,
      documentType,
      hasMetadata: Object.keys(metadata).length > 0
    });

    try {
      // Validate input
      if (!filename) {
        throw new Error('Filename is required for document processing');
      }

      // Determine file type and processing strategy
      const fileExtension = path.extname(filename).toLowerCase();
      const processingType = this.determineProcessingType(mediaType, fileExtension);

      mcpDebugger.debug('DocumentProcessor: Processing type determined', {
        filename,
        mediaType,
        fileExtension,
        processingType
      });

      // Process document based on type
      let processedDocument;
      if (fileUrl) {
        processedDocument = await this.processFromUrl(fileUrl, processingType, options);
      } else {
        // Handle in-memory content or base64 data
        processedDocument = await this.processInMemory(options);
      }

      // Extract metadata and content
      const extractedMetadata = await this.extractMetadata(processedDocument, options);
      const structuredContent = await this.structureContent(processedDocument, processingType);

      // Generate document summary
      const summary = await this.generateSummary(structuredContent);

      const result = {
        id: this.generateDocumentId(),
        filename,
        mediaType,
        documentType,
        processingType,
        content: structuredContent,
        metadata: {
          ...metadata,
          ...extractedMetadata,
          processed: new Date().toISOString(),
          fileExtension,
          wordCount: this.countWords(structuredContent.text || ''),
          characterCount: (structuredContent.text || '').length
        },
        summary,
        timestamp: new Date().toISOString()
      };

      mcpDebugger.info('DocumentProcessor: Document processing completed', {
        documentId: result.id,
        contentLength: result.content.text?.length || 0,
        metadataKeys: Object.keys(result.metadata).length
      });

      return result;

    } catch (error) {
      mcpDebugger.error('DocumentProcessor: Document processing failed', {
        error: error.message,
        stack: error.stack,
        filename,
        mediaType
      });
      throw error;
    }
  }

  /**
   * Determine processing type based on media type and file extension
   */
  determineProcessingType(mediaType, fileExtension) {
    const typeMap = {
      'text/plain': 'text',
      'text/markdown': 'markdown',
      'application/pdf': 'pdf',
      'application/json': 'json',
      'text/html': 'html',
      'text/csv': 'csv',
      'application/xml': 'xml',
      'text/xml': 'xml'
    };

    const extensionMap = {
      '.txt': 'text',
      '.md': 'markdown',
      '.pdf': 'pdf',
      '.json': 'json',
      '.html': 'html',
      '.htm': 'html',
      '.csv': 'csv',
      '.xml': 'xml'
    };

    return typeMap[mediaType] || extensionMap[fileExtension] || 'text';
  }

  /**
   * Process document from URL (mock implementation)
   */
  async processFromUrl(fileUrl, processingType, options) {
    mcpDebugger.debug('DocumentProcessor: Processing from URL', { fileUrl, processingType });

    try {
      // Mock URL processing - in real implementation, fetch the file
      const mockContent = `Document content from URL: ${fileUrl}\n` +
        `Processing type: ${processingType}\n` +
        `This is a mock implementation that would normally fetch and parse the actual file content.\n` +
        `File would be processed according to its type (${processingType}) with appropriate parsers.`;

      return {
        text: mockContent,
        url: fileUrl,
        processingType,
        size: mockContent.length
      };

    } catch (error) {
      mcpDebugger.warn('DocumentProcessor: URL processing failed', error.message);
      throw new Error(`Failed to process document from URL: ${error.message}`);
    }
  }

  /**
   * Process document from in-memory content
   */
  async processInMemory(options) {
    const { content, filename, documentType } = options;

    mcpDebugger.debug('DocumentProcessor: Processing in-memory content', {
      hasContent: !!content,
      contentLength: content?.length || 0,
      filename
    });

    try {
      if (!content) {
        throw new Error('Content is required for in-memory processing');
      }

      return {
        text: content,
        source: 'in-memory',
        filename,
        documentType,
        size: content.length
      };

    } catch (error) {
      mcpDebugger.warn('DocumentProcessor: In-memory processing failed', error.message);
      throw error;
    }
  }

  /**
   * Extract metadata from processed document
   */
  async extractMetadata(processedDocument, originalOptions) {
    try {
      const metadata = {
        source: processedDocument.url || processedDocument.source || 'unknown',
        size: processedDocument.size || 0,
        processingMethod: processedDocument.url ? 'url' : 'in-memory'
      };

      // Extract additional metadata based on content type
      if (processedDocument.processingType === 'json') {
        try {
          const jsonData = JSON.parse(processedDocument.text);
          metadata.jsonKeys = Object.keys(jsonData);
          metadata.jsonStructure = this.analyzeJsonStructure(jsonData);
        } catch (e) {
          mcpDebugger.warn('DocumentProcessor: Failed to parse JSON for metadata extraction');
        }
      }

      return metadata;

    } catch (error) {
      mcpDebugger.warn('DocumentProcessor: Metadata extraction failed', error.message);
      return {};
    }
  }

  /**
   * Structure content based on processing type
   */
  async structureContent(processedDocument, processingType) {
    try {
      const baseStructure = {
        text: processedDocument.text || '',
        type: processingType,
        sections: []
      };

      // Structure content based on type
      switch (processingType) {
        case 'markdown':
          return this.structureMarkdown(baseStructure);
        case 'html':
          return this.structureHtml(baseStructure);
        case 'json':
          return this.structureJson(baseStructure);
        case 'csv':
          return this.structureCsv(baseStructure);
        case 'xml':
          return this.structureXml(baseStructure);
        default:
          return this.structureText(baseStructure);
      }

    } catch (error) {
      mcpDebugger.warn('DocumentProcessor: Content structuring failed', error.message);
      return {
        text: processedDocument.text || '',
        type: processingType,
        sections: [],
        error: 'Failed to structure content'
      };
    }
  }

  /**
   * Structure plain text content
   */
  structureText(baseStructure) {
    const { text } = baseStructure;
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    return {
      ...baseStructure,
      sections: paragraphs.map((paragraph, index) => ({
        type: 'paragraph',
        index,
        content: paragraph.trim()
      }))
    };
  }

  /**
   * Structure markdown content
   */
  structureMarkdown(baseStructure) {
    const { text } = baseStructure;
    const lines = text.split('\n');
    const sections = [];

    let currentSection = null;

    lines.forEach((line, index) => {
      if (line.startsWith('#')) {
        // Header
        if (currentSection) sections.push(currentSection);
        const level = line.match(/^#+/)[0].length;
        currentSection = {
          type: 'header',
          level,
          title: line.replace(/^#+\s*/, ''),
          content: '',
          lineNumber: index
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    });

    if (currentSection) sections.push(currentSection);

    return { ...baseStructure, sections };
  }

  /**
   * Structure HTML content (basic implementation)
   */
  structureHtml(baseStructure) {
    const { text } = baseStructure;
    // Basic HTML structure extraction (would use proper parser in real implementation)
    return {
      ...baseStructure,
      sections: [{
        type: 'html',
        content: text,
        note: 'HTML parsing requires full parser implementation'
      }]
    };
  }

  /**
   * Structure JSON content
   */
  structureJson(baseStructure) {
    const { text } = baseStructure;
    try {
      const jsonData = JSON.parse(text);
      return {
        ...baseStructure,
        sections: [{
          type: 'json',
          data: jsonData,
          structure: this.analyzeJsonStructure(jsonData)
        }]
      };
    } catch (e) {
      return { ...baseStructure, sections: [{ type: 'json', error: 'Invalid JSON' }] };
    }
  }

  /**
   * Structure CSV content
   */
  structureCsv(baseStructure) {
    const { text } = baseStructure;
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

    return {
      ...baseStructure,
      sections: [{
        type: 'csv',
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length
      }]
    };
  }

  /**
   * Structure XML content (basic implementation)
   */
  structureXml(baseStructure) {
    const { text } = baseStructure;
    return {
      ...baseStructure,
      sections: [{
        type: 'xml',
        content: text,
        note: 'XML parsing requires full parser implementation'
      }]
    };
  }

  /**
   * Analyze JSON structure
   */
  analyzeJsonStructure(data, depth = 0) {
    if (depth > 3) return 'deep-nested';

    if (Array.isArray(data)) {
      return {
        type: 'array',
        length: data.length,
        elementType: data.length > 0 ? this.analyzeJsonStructure(data[0], depth + 1) : 'empty'
      };
    } else if (typeof data === 'object' && data !== null) {
      return {
        type: 'object',
        keys: Object.keys(data),
        properties: Object.keys(data).reduce((acc, key) => {
          acc[key] = this.analyzeJsonStructure(data[key], depth + 1);
          return acc;
        }, {})
      };
    } else {
      return typeof data;
    }
  }

  /**
   * Generate document summary
   */
  async generateSummary(structuredContent) {
    try {
      const { text, type, sections } = structuredContent;
      const wordCount = this.countWords(text);

      let summary = `Document type: ${type}, `;
      summary += `${wordCount} words, `;
      summary += `${sections.length} sections. `;

      if (text.length > 200) {
        const excerpt = text.substring(0, 200) + '...';
        summary += `Excerpt: ${excerpt}`;
      } else {
        summary += `Content: ${text}`;
      }

      return summary;

    } catch (error) {
      mcpDebugger.warn('DocumentProcessor: Summary generation failed', error.message);
      return 'Summary generation failed';
    }
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Generate unique document ID
   */
  generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new DocumentProcessor();