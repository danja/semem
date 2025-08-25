import { describe, it, expect } from 'vitest';
import HTMLConverter from '../../../../src/services/document/HTMLConverter.js';

describe('HTMLConverter', () => {
  describe('convertString', () => {
    it('should convert simple HTML to markdown', async () => {
      const html = '<h1>Test Title</h1><p>This is a paragraph.</p>';
      
      const result = await HTMLConverter.convertString(html);
      
      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Test Title');
      expect(result.markdown).toContain('This is a paragraph.');
      expect(result.metadata.format).toBe('html');
      expect(result.metadata.converter).toBe('turndown');
    });

    it('should extract metadata from HTML', async () => {
      const html = `
        <html lang="en">
          <head>
            <title>Test Document</title>
            <meta name="description" content="A test document">
            <meta name="author" content="Test Author">
            <meta name="keywords" content="test, document, html">
          </head>
          <body>
            <h1>Content</h1>
            <p>Test content</p>
          </body>
        </html>
      `;
      
      const result = await HTMLConverter.convertString(html);
      
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.description).toBe('A test document');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.language).toBe('en');
      expect(result.metadata.keywords).toEqual(['test', 'document', 'html']);
    });

    it('should throw error for empty HTML', async () => {
      await expect(HTMLConverter.convertString('   ')).rejects.toThrow('HTMLConverter: HTML string is empty');
    });

    it('should throw error for non-string input', async () => {
      await expect(HTMLConverter.convertString(null)).rejects.toThrow('html is required and must be a string');
    });
  });

  describe('validate', () => {
    it('should validate correct HTML', () => {
      const html = '<html><body><p>Valid HTML</p></body></html>';
      
      const result = HTMLConverter.validate(html);
      
      expect(result.valid).toBe(true);
      expect(result.message).toBe('Valid HTML content');
    });

    it('should reject empty content', () => {
      const result = HTMLConverter.validate('');
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('HTML content is required and must be a string');
    });

    it('should reject whitespace-only content', () => {
      const result = HTMLConverter.validate('   ');
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('HTML content is empty');
    });

    it('should reject content without HTML tags', () => {
      const result = HTMLConverter.validate('Just plain text');
      
      expect(result.valid).toBe(false);
      expect(result.message).toBe('Content does not appear to contain HTML tags');
    });
  });

  describe('extractHtmlMetadata', () => {
    it('should extract structural metadata', () => {
      const html = `
        <html>
          <body>
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
            <a href="#">Link 1</a>
            <a href="#">Link 2</a>
            <img src="image1.jpg" alt="Image 1">
          </body>
        </html>
      `;
      
      const metadata = HTMLConverter.extractHtmlMetadata(html);
      
      expect(metadata.headings).toBe(2);
      expect(metadata.paragraphs).toBe(2);
      expect(metadata.links).toBe(2);
      expect(metadata.images).toBe(1);
    });
  });

  describe('cleanHtml', () => {
    it('should remove scripts by default', () => {
      const html = '<script>alert("test");</script><p>Content</p>';
      
      const cleaned = HTMLConverter.cleanHtml(html);
      
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).toContain('<p>Content</p>');
    });

    it('should remove styles by default', () => {
      const html = '<style>body { color: red; }</style><p>Content</p>';
      
      const cleaned = HTMLConverter.cleanHtml(html);
      
      expect(cleaned).not.toContain('<style>');
      expect(cleaned).toContain('<p>Content</p>');
    });

    it('should preserve scripts when option is set', () => {
      const html = '<script>alert("test");</script><p>Content</p>';
      
      const cleaned = HTMLConverter.cleanHtml(html, { removeScripts: false });
      
      expect(cleaned).toContain('<script>');
      expect(cleaned).toContain('<p>Content</p>');
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return supported HTML extensions', () => {
      const extensions = HTMLConverter.getSupportedExtensions();
      
      expect(extensions).toEqual(['.html', '.htm', '.xhtml']);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported extensions', () => {
      expect(HTMLConverter.isSupported('test.html')).toBe(true);
      expect(HTMLConverter.isSupported('test.htm')).toBe(true);
      expect(HTMLConverter.isSupported('test.xhtml')).toBe(true);
    });

    it('should return false for unsupported extensions', () => {
      expect(HTMLConverter.isSupported('test.txt')).toBe(false);
      expect(HTMLConverter.isSupported('test.pdf')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(HTMLConverter.isSupported('test.HTML')).toBe(true);
      expect(HTMLConverter.isSupported('test.HTM')).toBe(true);
    });
  });
});