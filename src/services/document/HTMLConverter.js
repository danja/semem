import HTML2MD from '../../aux/markup/HTML2MD.js';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from 'loglevel';

/**
 * HTML to Markdown converter service
 * Converts HTML files and strings to markdown format with metadata extraction
 */
export default class HTMLConverter {
  /**
   * Convert HTML file to markdown
   * @param {string} filePath - Path to HTML file
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result with markdown and metadata
   */
  static async convert(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('HTMLConverter: filePath is required and must be a string');
    }

    try {
      // Read and validate file
      const html = readFileSync(filePath, 'utf8');
      
      if (!html || html.trim().length === 0) {
        throw new Error(`HTMLConverter: HTML file is empty: ${filePath}`);
      }

      const startTime = Date.now();
      
      // Convert HTML to markdown
      const markdown = HTML2MD.html2md(html);
      
      const processingTime = Date.now() - startTime;
      
      if (!markdown) {
        throw new Error(`HTMLConverter: Failed to convert HTML to markdown: ${filePath}`);
      }

      // Extract metadata from HTML
      const htmlMetadata = this.extractHtmlMetadata(html);
      
      const metadata = {
        sourceFile: filePath,
        fileSize: Buffer.byteLength(html, 'utf8'),
        processingTime,
        conversionId: uuidv4(),
        timestamp: new Date().toISOString(),
        format: 'html',
        converter: 'turndown',
        ...htmlMetadata,
        ...options.metadata
      };

      logger.debug(`HTMLConverter: Converted ${filePath} (${metadata.fileSize} bytes) in ${processingTime}ms`);

      return {
        markdown,
        metadata,
        success: true
      };

    } catch (error) {
      logger.error(`HTMLConverter: Error converting ${filePath}:`, error.message);
      throw new Error(`HTMLConverter: Failed to convert HTML: ${error.message}`);
    }
  }

  /**
   * Convert HTML string to markdown
   * @param {string} html - HTML string
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result with markdown and metadata
   */
  static async convertString(html, options = {}) {
    if (!html || typeof html !== 'string') {
      throw new Error('HTMLConverter: html is required and must be a string');
    }

    if (html.trim().length === 0) {
      throw new Error('HTMLConverter: HTML string is empty');
    }

    try {
      const startTime = Date.now();
      
      // Convert HTML to markdown
      const markdown = HTML2MD.html2md(html);
      
      const processingTime = Date.now() - startTime;
      
      if (!markdown) {
        throw new Error('HTMLConverter: Failed to convert HTML string to markdown');
      }

      // Extract metadata from HTML
      const htmlMetadata = this.extractHtmlMetadata(html);
      
      const metadata = {
        fileSize: Buffer.byteLength(html, 'utf8'),
        processingTime,
        conversionId: uuidv4(),
        timestamp: new Date().toISOString(),
        format: 'html',
        converter: 'turndown',
        ...htmlMetadata,
        ...options.metadata
      };

      logger.debug(`HTMLConverter: Converted HTML string (${metadata.fileSize} bytes) in ${processingTime}ms`);

      return {
        markdown,
        metadata,
        success: true
      };

    } catch (error) {
      logger.error('HTMLConverter: Error converting HTML string:', error.message);
      throw new Error(`HTMLConverter: Failed to convert HTML string: ${error.message}`);
    }
  }

  /**
   * Extract metadata from HTML content
   * @private
   * @param {string} html - HTML content
   * @returns {Object} Extracted metadata
   */
  static extractHtmlMetadata(html) {
    const metadata = {};
    
    try {
      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) {
        metadata.title = titleMatch[1].trim();
      }

      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name\s*=\s*["\']description["\'][^>]*content\s*=\s*["\']([^"']*)["\'][^>]*>/i);
      if (descMatch) {
        metadata.description = descMatch[1].trim();
      }

      // Extract meta keywords
      const keywordsMatch = html.match(/<meta[^>]*name\s*=\s*["\']keywords["\'][^>]*content\s*=\s*["\']([^"']*)["\'][^>]*>/i);
      if (keywordsMatch) {
        metadata.keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k);
      }

      // Extract author
      const authorMatch = html.match(/<meta[^>]*name\s*=\s*["\']author["\'][^>]*content\s*=\s*["\']([^"']*)["\'][^>]*>/i);
      if (authorMatch) {
        metadata.author = authorMatch[1].trim();
      }

      // Extract lang attribute
      const langMatch = html.match(/<html[^>]*lang\s*=\s*["\']([^"']*)["\'][^>]*>/i);
      if (langMatch) {
        metadata.language = langMatch[1].trim();
      }

      // Count structural elements
      metadata.headings = (html.match(/<h[1-6][^>]*>/gi) || []).length;
      metadata.paragraphs = (html.match(/<p[^>]*>/gi) || []).length;
      metadata.links = (html.match(/<a[^>]*href/gi) || []).length;
      metadata.images = (html.match(/<img[^>]*src/gi) || []).length;

    } catch (error) {
      logger.warn('HTMLConverter: Error extracting HTML metadata:', error.message);
    }

    return metadata;
  }

  /**
   * Validate HTML content
   * @param {string} html - HTML content to validate
   * @returns {Object} Validation result
   */
  static validate(html) {
    try {
      if (!html || typeof html !== 'string') {
        return {
          valid: false,
          message: 'HTML content is required and must be a string'
        };
      }

      if (html.trim().length === 0) {
        return {
          valid: false,
          message: 'HTML content is empty'
        };
      }

      // Basic HTML validation - check for common HTML elements
      const hasHtmlTags = /<[^>]+>/g.test(html);
      
      if (!hasHtmlTags) {
        return {
          valid: false,
          message: 'Content does not appear to contain HTML tags'
        };
      }

      // Check for balanced basic tags (optional)
      const warnings = [];
      const htmlCount = (html.match(/<html[^>]*>/gi) || []).length;
      const htmlCloseCount = (html.match(/<\/html>/gi) || []).length;
      
      if (htmlCount !== htmlCloseCount) {
        warnings.push('Unbalanced <html> tags detected');
      }

      return {
        valid: true,
        message: 'Valid HTML content',
        warnings: warnings.length > 0 ? warnings : undefined,
        size: Buffer.byteLength(html, 'utf8')
      };

    } catch (error) {
      return {
        valid: false,
        message: `HTML validation failed: ${error.message}`
      };
    }
  }

  /**
   * Get supported file extensions
   * @returns {Array<string>} Supported extensions
   */
  static getSupportedExtensions() {
    return ['.html', '.htm', '.xhtml'];
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

  /**
   * Clean HTML before conversion (remove scripts, styles, etc.)
   * @param {string} html - HTML content
   * @param {Object} options - Cleaning options
   * @returns {string} Cleaned HTML
   */
  static cleanHtml(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    let cleaned = html;

    // Remove script tags and content
    if (options.removeScripts !== false) {
      cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    }

    // Remove style tags and content
    if (options.removeStyles !== false) {
      cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    }

    // Remove comments
    if (options.removeComments !== false) {
      cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    }

    // Remove meta tags (but keep title)
    if (options.removeMeta !== false) {
      cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
    }

    return cleaned;
  }
}