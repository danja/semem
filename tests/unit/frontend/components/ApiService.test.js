import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

import { ApiService } from '../../../../src/frontend/workbench/js/services/ApiService.js';

describe('ApiService', () => {
  let apiService;
  let mockStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStateManager = {
      recordPerformance: vi.fn()
    };
    
    apiService = new ApiService();
    apiService.stateManager = mockStateManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(apiService.baseUrl).toBe('http://localhost:3001');
      expect(apiService.timeout).toBe(30000);
      expect(apiService.stateManager).toBe(mockStateManager);
    });
  });

  describe('tell', () => {
    it('should make POST request to tell endpoint', async () => {
      const mockResponse = { success: true, id: 'test-id' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.tell('test content', { type: 'concept' });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/tell',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'test content',
            type: 'concept'
          }),
          signal: expect.any(AbortSignal)
        })
      );
      
      expect(result).toEqual(mockResponse);
      expect(mockStateManager.recordPerformance).toHaveBeenCalledWith('tell', expect.any(Number));
    });

    it('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid content')
      });

      await expect(apiService.tell('invalid content')).rejects.toThrow('API request failed: 400 Bad Request - Invalid content');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.tell('test content')).rejects.toThrow('Network error');
      expect(mockStateManager.recordPerformance).toHaveBeenCalledWith('tell', expect.any(Number));
    });

    it('should handle timeout', async () => {
      const slowApiService = new ApiService();
      slowApiService.timeout = 100; // 100ms timeout
      slowApiService.stateManager = mockStateManager;

      // Mock a slow response
      fetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(slowApiService.tell('test content')).rejects.toThrow();
    });
  });

  describe('ask', () => {
    it('should make POST request to ask endpoint', async () => {
      const mockResponse = { answer: 'Machine learning is...', sources: [] };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.ask('What is machine learning?');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/ask',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            question: 'What is machine learning?',
            useContext: true
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
      expect(mockStateManager.recordPerformance).toHaveBeenCalledWith('ask', expect.any(Number));
    });

    it('should support useContext parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await apiService.ask('test question', { useContext: false });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/ask',
        expect.objectContaining({
          body: JSON.stringify({
            question: 'test question',
            useContext: false
          })
        })
      );
    });
  });

  describe('zoom', () => {
    it('should make POST request to zoom endpoint', async () => {
      const mockResponse = { level: 'unit', query: 'test query' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.zoom('unit', 'test query');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/zoom',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            level: 'unit',
            query: 'test query'
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
      expect(mockStateManager.recordPerformance).toHaveBeenCalledWith('zoom', expect.any(Number));
    });
  });

  describe('pan', () => {
    it('should make POST request to pan endpoint', async () => {
      const mockResponse = { filters: { domains: ['tech'] } };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const filters = { domains: ['tech'], keywords: ['AI'] };
      const result = await apiService.pan(filters);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/pan',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(filters)
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('tilt', () => {
    it('should make POST request to tilt endpoint', async () => {
      const mockResponse = { style: 'graph', query: 'test' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.tilt('graph', 'test query');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/tilt',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            style: 'graph',
            query: 'test query'
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('inspect', () => {
    it('should make GET request to inspect endpoint', async () => {
      const mockResponse = { 
        session: { interactions: 5 },
        concepts: { count: 10 },
        embeddings: { count: 15 }
      };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.inspect('session');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/inspect?what=session&details=false',
        expect.objectContaining({
          method: 'GET'
        })
      );
      
      expect(result).toEqual(mockResponse);
      expect(mockStateManager.recordPerformance).toHaveBeenCalledWith('inspect', expect.any(Number));
    });

    it('should handle details parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      await apiService.inspect('all', { details: true });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/inspect?what=all&details=true',
        expect.any(Object)
      );
    });
  });

  describe('augment', () => {
    it('should make POST request to augment endpoint', async () => {
      const mockResponse = { operation: 'extract_concepts', result: [] };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.augment('extract_concepts', 'test content');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/augment',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            operation: 'extract_concepts',
            target: 'test content',
            parameters: {}
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
    });
  });

  describe('testConnection', () => {
    it('should test API connectivity', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      const result = await apiService.testConnection();

      expect(fetch).toHaveBeenCalledWith('http://localhost:3001/health');
      expect(result).toEqual({
        success: true,
        response: { status: 'healthy' }
      });
    });

    it('should handle connection failures', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await apiService.testConnection();

      expect(result).toEqual({
        success: false,
        error: 'Connection refused'
      });
    });
  });

  describe('error handling', () => {
    it('should provide detailed error information', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('Validation failed: Missing required field')
      });

      try {
        await apiService.tell('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('422 Unprocessable Entity');
        expect(error.message).toContain('Validation failed');
      }
    });

    it('should handle JSON parsing errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(apiService.tell('test')).rejects.toThrow('Invalid JSON');
    });
  });
});