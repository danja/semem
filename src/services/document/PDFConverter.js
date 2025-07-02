import pdf2md from '@opendocsg/pdf2md';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from 'loglevel';

/**
 * PDF to Markdown converter service
 * Converts PDF files to markdown format with metadata extraction
 */
export default class PDFConverter {
  /**
   * Convert PDF file to markdown
   * @param {string} filePath - Path to PDF file
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result with markdown and metadata
   */
  static async convert(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('PDFConverter: filePath is required and must be a string');
    }

    try {
      // Validate file exists and is accessible
      const buffer = readFileSync(filePath);
      
      if (buffer.length === 0) {
        throw new Error(`PDFConverter: PDF file is empty: ${filePath}`);
      }

      const startTime = Date.now();
      
      // Convert PDF to markdown
      const result = await pdf2md(buffer, {
        outputDir: options.outputDir || null,
        debug: options.debug || false,
        ...options
      });

      const processingTime = Date.now() - startTime;
      
      if (!result || typeof result !== 'string') {
        throw new Error(`PDFConverter: Failed to extract text from PDF: ${filePath}`);
      }

      const text = result;

      // Extract metadata
      const metadata = {
        sourceFile: filePath,
        fileSize: buffer.length,
        processingTime,
        conversionId: uuidv4(),
        timestamp: new Date().toISOString(),
        format: 'pdf',
        converter: 'pdf2md',
        pages: this.estimatePageCount(text),
        ...options.metadata
      };

      logger.debug(`PDFConverter: Converted ${filePath} (${buffer.length} bytes) in ${processingTime}ms`);

      return {
        markdown: text,
        metadata,
        success: true
      };

    } catch (error) {
      logger.error(`PDFConverter: Error converting ${filePath}:`, error.message);
      throw new Error(`PDFConverter: Failed to convert PDF: ${error.message}`);
    }
  }

  /**
   * Convert PDF buffer to markdown
   * @param {Buffer} buffer - PDF file buffer
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result with markdown and metadata
   */
  static async convertBuffer(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('PDFConverter: buffer must be a Buffer instance');
    }

    if (buffer.length === 0) {
      throw new Error('PDFConverter: PDF buffer is empty');
    }

    try {
      const startTime = Date.now();
      
      // Convert PDF buffer to markdown
      const result = await pdf2md(buffer, {
        outputDir: options.outputDir || null,
        debug: options.debug || false,
        ...options
      });

      const processingTime = Date.now() - startTime;
      
      if (!result || typeof result !== 'string') {
        throw new Error('PDFConverter: Failed to extract text from PDF buffer');
      }

      const text = result;

      // Extract metadata
      const metadata = {
        fileSize: buffer.length,
        processingTime,
        conversionId: uuidv4(),
        timestamp: new Date().toISOString(),
        format: 'pdf',
        converter: 'pdf2md',
        pages: this.estimatePageCount(text),
        ...options.metadata
      };

      logger.debug(`PDFConverter: Converted PDF buffer (${buffer.length} bytes) in ${processingTime}ms`);

      return {
        markdown: text,
        metadata,
        success: true
      };

    } catch (error) {
      logger.error('PDFConverter: Error converting PDF buffer:', error.message);
      throw new Error(`PDFConverter: Failed to convert PDF buffer: ${error.message}`);
    }
  }

  /**
   * Validate PDF file
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} Validation result
   */
  static async validate(filePath) {
    try {
      const buffer = readFileSync(filePath);
      
      // Basic PDF validation - check for PDF header
      const pdfHeader = buffer.slice(0, 4).toString();
      const isValidPDF = pdfHeader === '%PDF';
      
      return {
        valid: isValidPDF,
        fileSize: buffer.length,
        filePath,
        message: isValidPDF ? 'Valid PDF file' : 'Invalid PDF file - missing PDF header'
      };
      
    } catch (error) {
      return {
        valid: false,
        fileSize: 0,
        filePath,
        message: `File validation failed: ${error.message}`
      };
    }
  }

  /**
   * Estimate page count from markdown text
   * @private
   * @param {string} text - Markdown text
   * @returns {number} Estimated page count
   */
  static estimatePageCount(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Rough estimation: ~500 words per page, ~5 chars per word
    const chars = text.length;
    const estimatedPages = Math.max(1, Math.ceil(chars / 2500));
    
    return estimatedPages;
  }

  /**
   * Get supported file extensions
   * @returns {Array<string>} Supported extensions
   */
  static getSupportedExtensions() {
    return ['.pdf'];
  }

  /**
   * Check if file extension is supported
   * @param {string} filePath - File path to check
   * @returns {boolean} True if supported
   */
  static isSupported(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    
    const extension = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
    return this.getSupportedExtensions().includes(extension);
  }
}