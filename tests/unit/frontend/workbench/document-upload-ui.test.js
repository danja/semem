import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock the workbench app
const mockApiService = {
  uploadDocument: vi.fn(),
  tell: vi.fn()
};

const mockConsoleService = {
  logInfo: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
  logOperationStart: vi.fn(),
  logOperationSuccess: vi.fn(),
  logOperationError: vi.fn()
};

const mockDomUtils = {
  $: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  showToast: vi.fn(),
  setButtonLoading: vi.fn(),
  getFormData: vi.fn(),
  resetForm: vi.fn()
};

// Mock globals
global.apiService = mockApiService;
global.consoleService = mockConsoleService;
global.DomUtils = mockDomUtils;

describe('Document Upload UI Tests', () => {
  let dom;
  let document;
  let window;
  let WorkbenchApp;

  beforeEach(async () => {
    // Create DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="tell-form">
            <select id="tell-type">
              <option value="concept">Concept</option>
              <option value="interaction">Interaction</option>
              <option value="document">Document</option>
            </select>
            <textarea id="tell-content"></textarea>
            <div id="document-upload-section" style="display: none;">
              <input type="file" id="document-file" accept=".pdf,.txt,.md">
              <button type="button" id="select-file-button">Select File</button>
              <button type="button" id="remove-file-button">Remove</button>
              <div id="selected-file-info" style="display: none;">
                <span id="selected-file-name"></span>
                <span id="selected-file-size"></span>
              </div>
            </div>
            <button type="submit" id="tell-submit">Submit</button>
          </form>
        </body>
      </html>
    `, {
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Setup DOM utility mocks
    mockDomUtils.$.mockImplementation((selector) => document.querySelector(selector));
    mockDomUtils.show.mockImplementation((element) => {
      if (element) element.style.display = 'block';
    });
    mockDomUtils.hide.mockImplementation((element) => {
      if (element) element.style.display = 'none';
    });

    // Import and create WorkbenchApp after setting up globals
    const { WorkbenchApp: App } = await import('../../../../src/frontend/workbench/public/js/workbench.js');
    WorkbenchApp = App;
  });

  afterEach(() => {
    vi.clearAllMocks();
    dom?.window?.close();
  });

  describe('File Type Detection', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should detect PDF file type correctly', () => {
      const fileType = app.getFileTypeFromExtension('document.pdf');
      expect(fileType).toBe('pdf');
    });

    it('should detect text file type correctly', () => {
      const fileType = app.getFileTypeFromExtension('document.txt');
      expect(fileType).toBe('text');
    });

    it('should detect markdown file type correctly', () => {
      const fileType = app.getFileTypeFromExtension('document.md');
      expect(fileType).toBe('markdown');
    });

    it('should return null for unsupported types', () => {
      const fileType = app.getFileTypeFromExtension('document.docx');
      expect(fileType).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(app.getFileTypeFromExtension('DOCUMENT.PDF')).toBe('pdf');
      expect(app.getFileTypeFromExtension('Document.Txt')).toBe('text');
      expect(app.getFileTypeFromExtension('README.MD')).toBe('markdown');
    });
  });

  describe('File Size Formatting', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should format bytes correctly', () => {
      expect(app.formatFileSize(0)).toBe('0 Bytes');
      expect(app.formatFileSize(1024)).toBe('1 KB');
      expect(app.formatFileSize(1048576)).toBe('1 MB');
      expect(app.formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle decimal places', () => {
      expect(app.formatFileSize(1536)).toBe('1.5 KB'); // 1.5 KB
      expect(app.formatFileSize(1572864)).toBe('1.5 MB'); // 1.5 MB
    });
  });

  describe('Media Type Detection', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should return correct media types', () => {
      expect(app.getMediaType('pdf')).toBe('application/pdf');
      expect(app.getMediaType('text')).toBe('text/plain');
      expect(app.getMediaType('markdown')).toBe('text/markdown');
    });

    it('should return default for unknown types', () => {
      expect(app.getMediaType('unknown')).toBe('application/octet-stream');
    });
  });

  describe('Tell Type Change Handler', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should show upload section when document type is selected', () => {
      const typeSelect = document.getElementById('tell-type');
      const uploadSection = document.getElementById('document-upload-section');
      const contentTextarea = document.getElementById('tell-content');

      // Simulate selecting document type
      typeSelect.value = 'document';
      const event = { target: typeSelect };
      
      app.handleTellTypeChange(event);

      expect(mockDomUtils.show).toHaveBeenCalledWith(uploadSection);
      expect(contentTextarea.placeholder).toContain('Upload a document file');
      expect(contentTextarea.hasAttribute('required')).toBe(false);
    });

    it('should hide upload section when non-document type is selected', () => {
      const typeSelect = document.getElementById('tell-type');
      const uploadSection = document.getElementById('document-upload-section');
      const contentTextarea = document.getElementById('tell-content');

      // First select document to show the section
      typeSelect.value = 'document';
      app.handleTellTypeChange({ target: typeSelect });

      // Then select concept to hide it
      typeSelect.value = 'concept';
      app.handleTellTypeChange({ target: typeSelect });

      expect(mockDomUtils.hide).toHaveBeenCalledWith(uploadSection);
      expect(contentTextarea.placeholder).toContain('Enter information to store');
      expect(contentTextarea.getAttribute('required')).toBe('required');
    });
  });

  describe('File Selection Handler', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should handle valid file selection', () => {
      const mockFile = {
        name: 'test.pdf',
        size: 1024,
        lastModified: Date.now()
      };

      const fileInput = document.getElementById('document-file');
      
      // Mock the files property
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      const event = { target: fileInput };
      
      app.handleFileSelection(event);

      expect(mockConsoleService.logInfo).toHaveBeenCalledWith(
        'File selected for upload',
        expect.objectContaining({
          filename: 'test.pdf',
          fileSize: 1024
        })
      );

      expect(mockConsoleService.logSuccess).toHaveBeenCalledWith(
        'File validation passed',
        expect.objectContaining({
          filename: 'test.pdf',
          documentType: 'pdf'
        })
      );
    });

    it('should reject files that are too large', () => {
      const mockFile = {
        name: 'large.pdf',
        size: 11 * 1024 * 1024, // 11MB (over 10MB limit)
        lastModified: Date.now()
      };

      const fileInput = document.getElementById('document-file');
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      const event = { target: fileInput };
      
      app.handleFileSelection(event);

      expect(mockConsoleService.logWarning).toHaveBeenCalledWith(
        'File too large for upload',
        expect.objectContaining({
          filename: 'large.pdf',
          fileSize: 11 * 1024 * 1024
        })
      );

      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        'File too large. Please select a file under 10MB.',
        'error'
      );
    });

    it('should reject unsupported file types', () => {
      const mockFile = {
        name: 'document.docx',
        size: 1024,
        lastModified: Date.now()
      };

      const fileInput = document.getElementById('document-file');
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      const event = { target: fileInput };
      
      app.handleFileSelection(event);

      expect(mockConsoleService.logWarning).toHaveBeenCalledWith(
        'Unsupported file type selected',
        expect.objectContaining({
          filename: 'document.docx',
          extension: 'docx'
        })
      );

      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        'Unsupported file type. Please select a PDF, TXT, or MD file.',
        'error'
      );
    });
  });

  describe('File Upload Processing', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
    });

    it('should process file upload successfully', async () => {
      const mockFile = new window.File(['test content'], 'test.txt', {
        type: 'text/plain',
        lastModified: Date.now()
      });

      const mockFormData = { tags: 'test, upload' };

      mockApiService.uploadDocument.mockResolvedValue({
        success: true,
        filename: 'test.txt',
        concepts: 3,
        processingTime: 1000
      });

      const result = await app.handleDocumentUpload(mockFile, mockFormData);

      expect(mockConsoleService.logInfo).toHaveBeenCalledWith(
        'Document upload started',
        expect.objectContaining({
          filename: 'test.txt',
          fileType: 'text',
          fileSize: expect.any(Number)
        })
      );

      expect(mockApiService.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'test.txt',
          documentType: 'text',
          mediaType: 'text/plain',
          metadata: expect.objectContaining({
            tags: ['test', 'upload']
          })
        })
      );

      expect(mockConsoleService.logSuccess).toHaveBeenCalledWith(
        'Document upload completed',
        expect.objectContaining({
          filename: 'test.txt',
          processed: true,
          concepts: 3
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle upload failures gracefully', async () => {
      const mockFile = new window.File(['test content'], 'test.txt', {
        type: 'text/plain'
      });

      mockApiService.uploadDocument.mockRejectedValue(
        new Error('Upload failed')
      );

      await expect(
        app.handleDocumentUpload(mockFile, {})
      ).rejects.toThrow('Failed to upload document: Upload failed');

      expect(mockConsoleService.logError).toHaveBeenCalledWith(
        'Document upload failed',
        expect.objectContaining({
          filename: 'test.txt',
          error: 'Upload failed',
          fileType: 'text'
        })
      );
    });
  });

  describe('Form Submission Integration', () => {
    let app;

    beforeEach(() => {
      app = new WorkbenchApp();
      app.components = {
        tell: {
          button: document.getElementById('tell-submit'),
          results: document.createElement('div')
        }
      };
    });

    it('should handle document upload form submission', async () => {
      const form = document.getElementById('tell-form');
      const typeSelect = document.getElementById('tell-type');
      const fileInput = document.getElementById('document-file');

      // Set up form for document upload
      typeSelect.value = 'document';
      
      const mockFile = new window.File(['test content'], 'test.pdf', {
        type: 'application/pdf'
      });

      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });

      mockDomUtils.getFormData.mockReturnValue({
        type: 'document',
        content: '',
        tags: 'test'
      });

      mockApiService.uploadDocument.mockResolvedValue({
        success: true,
        filename: 'test.pdf',
        concepts: 5
      });

      const event = {
        preventDefault: vi.fn(),
        target: form
      };

      await app.handleTellSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockApiService.uploadDocument).toHaveBeenCalled();
      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        'Content stored successfully',
        'success'
      );
    });

    it('should handle regular text submission when no file is selected', async () => {
      const form = document.getElementById('tell-form');
      const typeSelect = document.getElementById('tell-type');
      const fileInput = document.getElementById('document-file');

      typeSelect.value = 'concept';
      
      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false
      });

      mockDomUtils.getFormData.mockReturnValue({
        type: 'concept',
        content: 'Test concept content',
        tags: ''
      });

      mockApiService.tell.mockResolvedValue({
        success: true
      });

      const event = {
        preventDefault: vi.fn(),
        target: form
      };

      await app.handleTellSubmit(event);

      expect(mockApiService.tell).toHaveBeenCalledWith({
        content: 'Test concept content',
        type: 'concept',
        metadata: {}
      });
    });

    it('should show error when document type selected but no content or file provided', async () => {
      const form = document.getElementById('tell-form');
      const fileInput = document.getElementById('document-file');

      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false
      });

      mockDomUtils.getFormData.mockReturnValue({
        type: 'document',
        content: '',
        tags: ''
      });

      const event = {
        preventDefault: vi.fn(),
        target: form
      };

      await app.handleTellSubmit(event);

      expect(mockDomUtils.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Please provide content or upload a file'),
        'error'
      );
    });
  });
});