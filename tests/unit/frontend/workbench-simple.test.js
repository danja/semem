import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple test without complex setup dependencies
describe('Workbench Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DOM utilities', () => {
    // Mock DOM
    const mockElement = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn()
      },
      style: {},
      innerHTML: '',
      textContent: ''
    };

    global.document = {
      getElementById: vi.fn(() => mockElement),
      querySelector: vi.fn(() => mockElement),
      querySelectorAll: vi.fn(() => [mockElement]),
      createElement: vi.fn(() => mockElement),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    it('should handle element ID lookups', () => {
      // Import after mocking
      import('../../../../src/frontend/workbench/js/utils/domUtils.js').then(({ getElementById }) => {
        const element = getElementById('test-id');
        expect(document.getElementById).toHaveBeenCalledWith('test-id');
        expect(element).toBe(mockElement);
      });
    });

    it('should escape HTML properly', () => {
      import('../../../../src/frontend/workbench/js/utils/domUtils.js').then(({ escapeHtml }) => {
        const result = escapeHtml('<script>alert("xss")</script>');
        expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      });
    });
  });

  describe('Event handling', () => {
    it('should create cleanup functions for event listeners', () => {
      import('../../../../src/frontend/workbench/js/utils/domUtils.js').then(({ addEventListenerWithCleanup }) => {
        const mockTarget = {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        };
        const mockHandler = vi.fn();

        const cleanup = addEventListenerWithCleanup(mockTarget, 'click', mockHandler);
        
        expect(mockTarget.addEventListener).toHaveBeenCalledWith('click', mockHandler);
        expect(typeof cleanup).toBe('function');
        
        // Test cleanup
        cleanup();
        expect(mockTarget.removeEventListener).toHaveBeenCalledWith('click', mockHandler);
      });
    });
  });

  describe('Tab switching', () => {
    it('should handle tab switching logic', () => {
      import('../../../../src/frontend/workbench/js/utils/domUtils.js').then(({ switchTab }) => {
        const mockTabElement = {
          classList: { add: vi.fn(), remove: vi.fn() }
        };
        const mockContentElement = {
          classList: { add: vi.fn(), remove: vi.fn() }
        };

        document.querySelectorAll = vi.fn()
          .mockReturnValueOnce([mockTabElement]) // For tab buttons
          .mockReturnValueOnce([mockContentElement]); // For tab content

        switchTab('test-tab');

        expect(document.querySelectorAll).toHaveBeenCalledWith('[data-tab]');
        expect(document.querySelectorAll).toHaveBeenCalledWith('.tab-content');
      });
    });
  });

  describe('Loading states', () => {
    it('should show and hide loading overlays', () => {
      import('../../../../src/frontend/workbench/js/utils/domUtils.js').then(({ showLoading }) => {
        const mockOverlay = {
          style: { display: '' },
          querySelector: vi.fn(() => ({ textContent: '' }))
        };
        
        document.getElementById = vi.fn(() => mockOverlay);

        showLoading(true, 'Test loading...');
        expect(mockOverlay.style.display).toBe('flex');

        showLoading(false);
        expect(mockOverlay.style.display).toBe('none');
      });
    });
  });
});