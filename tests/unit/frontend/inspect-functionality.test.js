/**
 * Unit tests for Inspect Functionality
 * Tests API methods, event handlers, and data formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiService } from '../../../src/frontend/workbench/public/js/services/ApiService.js';

describe('Inspect Functionality', () => {
  let apiService;
  let mockFetch;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    apiService = new ApiService('http://localhost:4101');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Methods', () => {
    it('should call inspect session endpoint with correct parameters', async () => {
      const mockResponse = { 
        success: true, 
        zptState: { sessionId: 'test-123', zoom: 'entity' }, 
        sessionCache: { interactions: 5, concepts: 10 } 
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.inspectSession();
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4101/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ what: 'session', details: true })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should call inspect concepts endpoint with details parameter', async () => {
      const mockResponse = { 
        success: true, 
        conceptCount: 25,
        concepts: ['ai', 'machine learning', 'data'],
        storageType: 'sparql'
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.inspectConcepts(false);
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4101/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ what: 'concepts', details: false })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should call inspect all data endpoint', async () => {
      const mockResponse = { 
        success: true,
        sessionCache: { interactions: 5 },
        zptState: { zoom: 'entity', tilt: 'keywords' },
        systemInfo: { uptime: '1h 23m' }
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.inspectAllData();
      
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:4101/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ what: 'all', details: true })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'MCP service unavailable' })
      });

      await expect(apiService.inspectSession()).rejects.toThrow('MCP service unavailable');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(apiService.inspectConcepts()).rejects.toThrow('Network error');
    });
  });

  describe('Error Handling', () => {
    it('should extract meaningful error messages', () => {
      const fetchError = new Error('Failed to fetch');
      const apiError = new Error('HTTP 404: Not Found');
      const serverError = new Error('HTTP 500: Internal Server Error');

      expect(apiService.getErrorMessage(fetchError))
        .toBe('Unable to connect to server. Please check if the service is running.');
      expect(apiService.getErrorMessage(apiError))
        .toBe('API endpoint not found. Please check server configuration.');
      expect(apiService.getErrorMessage(serverError))
        .toBe('Server error occurred. Please try again or check server logs.');
    });

    it('should return generic message for unknown errors', () => {
      const unknownError = new Error();
      const nullError = null;

      expect(apiService.getErrorMessage(unknownError)).toBe('Unknown error occurred');
      expect(apiService.getErrorMessage(nullError)).toBe('Unknown error occurred');
    });
  });

  describe('Request Configuration', () => {
    it('should use correct base URL and headers', () => {
      const service = new ApiService('http://localhost:8080/api');
      expect(service.baseUrl).toBe('http://localhost:8080/api');
      expect(service.defaultHeaders).toEqual({
        'Content-Type': 'application/json'
      });
    });

    it('should handle different base URL formats', () => {
      const service1 = new ApiService('/api');
      const service2 = new ApiService('https://example.com/api/v1');
      
      expect(service1.baseUrl).toBe('/api');
      expect(service2.baseUrl).toBe('https://example.com/api/v1');
    });
  });

  describe('Response Processing', () => {
    it('should parse JSON responses correctly', async () => {
      const mockData = { success: true, data: 'test' };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockData)
      });

      const result = await apiService.inspectSession();
      expect(result).toEqual(mockData);
    });

    it('should handle text responses', async () => {
      const mockText = 'Plain text response';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve(mockText)
      });

      const result = await apiService.inspectSession();
      expect(result).toBe(mockText);
    });

    it('should handle responses without content-type header', async () => {
      const mockText = 'No content type';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map(),
        text: () => Promise.resolve(mockText)
      });

      const result = await apiService.inspectSession();
      expect(result).toBe(mockText);
    });
  });
});