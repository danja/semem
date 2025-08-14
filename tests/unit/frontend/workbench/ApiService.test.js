/**
 * Unit tests for ApiService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiService } from '../../../../src/frontend/workbench/public/js/services/ApiService.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('ApiService', () => {
  let apiService;

  beforeEach(() => {
    apiService = new ApiService('/api');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default base URL', () => {
      const service = new ApiService();
      expect(service.baseUrl).toBe('/api');
    });

    it('should initialize with custom base URL', () => {
      const service = new ApiService('/custom-api');
      expect(service.baseUrl).toBe('/custom-api');
    });

    it('should have default headers', () => {
      expect(apiService.defaultHeaders).toEqual({
        'Content-Type': 'application/json'
      });
    });
  });

  describe('makeRequest', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.makeRequest('/test');

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make successful POST request with body', async () => {
      const mockResponse = { success: true };
      const requestBody = { content: 'test' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.makeRequest('/test', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle HTTP error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Endpoint not found' })
      });

      await expect(apiService.makeRequest('/nonexistent'))
        .rejects
        .toThrow('Endpoint not found');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.makeRequest('/test'))
        .rejects
        .toThrow('Network error');
    });

    it('should handle non-JSON responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('Plain text response')
      });

      const result = await apiService.makeRequest('/text');
      expect(result).toBe('Plain text response');
    });
  });

  describe('tell', () => {
    it('should make tell request with required parameters', async () => {
      const mockResponse = { success: true, id: 'test-id' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.tell({
        content: 'Test content',
        type: 'concept',
        metadata: { tags: ['test'] }
      });

      expect(fetch).toHaveBeenCalledWith('/api/tell', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content',
          type: 'concept',
          metadata: { tags: ['test'] }
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default values for optional parameters', async () => {
      const mockResponse = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      await apiService.tell({ content: 'Test content' });

      expect(fetch).toHaveBeenCalledWith('/api/tell', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content',
          type: 'interaction',
          metadata: {}
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('ask', () => {
    it('should make ask request with all parameters', async () => {
      const mockResponse = { success: true, answer: 'Test answer' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.ask({
        question: 'What is testing?',
        mode: 'comprehensive',
        useContext: false
      });

      expect(fetch).toHaveBeenCalledWith('/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is testing?',
          mode: 'comprehensive',
          useContext: false
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should use default values', async () => {
      const mockResponse = { success: true, answer: 'Test answer' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      await apiService.ask({ question: 'What is testing?' });

      expect(fetch).toHaveBeenCalledWith('/api/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: 'What is testing?',
          mode: 'standard',
          useContext: true
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('augment', () => {
    it('should make augment request', async () => {
      const mockResponse = { success: true, concepts: ['test'] };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.augment({
        target: 'Content to analyze',
        operation: 'concepts',
        options: { minConfidence: 0.8 }
      });

      expect(fetch).toHaveBeenCalledWith('/api/augment', {
        method: 'POST',
        body: JSON.stringify({
          target: 'Content to analyze',
          operation: 'concepts',
          options: { minConfidence: 0.8 }
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('zoom', () => {
    it('should make zoom request', async () => {
      const mockResponse = { success: true, level: 'unit' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.zoom({
        level: 'unit',
        query: 'test query'
      });

      expect(fetch).toHaveBeenCalledWith('/api/zoom', {
        method: 'POST',
        body: JSON.stringify({
          level: 'unit',
          query: 'test query'
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('pan', () => {
    it('should make pan request with array parameters', async () => {
      const mockResponse = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.pan({
        domains: ['AI', 'technology'],
        keywords: ['machine learning', 'neural networks'],
        entities: ['entity1', 'entity2'],
        query: 'test query'
      });

      expect(fetch).toHaveBeenCalledWith('/api/pan', {
        method: 'POST',
        body: JSON.stringify({
          domains: ['AI', 'technology'],
          keywords: ['machine learning', 'neural networks'],
          entities: ['entity1', 'entity2'],
          query: 'test query'
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should parse string parameters into arrays', async () => {
      const mockResponse = { success: true };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      await apiService.pan({
        domains: 'AI, technology',
        keywords: 'machine learning, neural networks'
      });

      expect(fetch).toHaveBeenCalledWith('/api/pan', {
        method: 'POST',
        body: JSON.stringify({
          domains: ['AI', 'technology'],
          keywords: ['machine learning', 'neural networks']
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('tilt', () => {
    it('should make tilt request', async () => {
      const mockResponse = { success: true, style: 'graph' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.tilt({
        style: 'graph',
        query: 'test query'
      });

      expect(fetch).toHaveBeenCalledWith('/api/tilt', {
        method: 'POST',
        body: JSON.stringify({
          style: 'graph',
          query: 'test query'
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getState', () => {
    it('should make GET request to state endpoint', async () => {
      const mockResponse = { success: true, state: {} };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.getState();

      expect(fetch).toHaveBeenCalledWith('/api/state', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getHealth', () => {
    it('should make GET request to health endpoint', async () => {
      const mockResponse = { status: 'ok' };
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiService.getHealth();

      expect(fetch).toHaveBeenCalledWith('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful health check', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve({ status: 'ok' })
      });

      const result = await apiService.testConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed health check', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await apiService.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return error message from error object', () => {
      const error = new Error('Test error message');
      const result = apiService.getErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('should return fetch-specific message for fetch errors', () => {
      const error = new Error('fetch error occurred');
      const result = apiService.getErrorMessage(error);
      expect(result).toBe('Unable to connect to server. Please check if the service is running.');
    });

    it('should return HTTP-specific messages', () => {
      const error404 = new Error('HTTP 404: Not Found');
      const error500 = new Error('HTTP 500: Server Error');
      
      expect(apiService.getErrorMessage(error404)).toBe('API endpoint not found. Please check server configuration.');
      expect(apiService.getErrorMessage(error500)).toBe('Server error occurred. Please try again or check server logs.');
    });

    it('should return default message for unknown error', () => {
      const result = apiService.getErrorMessage({});
      expect(result).toBe('Unknown error occurred');
    });
  });

  describe('batch', () => {
    it('should execute multiple requests in parallel', async () => {
      const mockTellResponse = { success: true, verb: 'tell' };
      const mockAskResponse = { success: true, verb: 'ask' };
      
      // Mock multiple fetch calls
      fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve(mockTellResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve(mockAskResponse)
        });

      const requests = [
        { method: 'tell', params: { content: 'test content' } },
        { method: 'ask', params: { question: 'test question' } }
      ];

      const results = await apiService.batch(requests);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockTellResponse);
      expect(results[1]).toEqual(mockAskResponse);
    });

    it('should handle errors in batch requests', async () => {
      fetch.mockRejectedValueOnce(new Error('Request failed'));

      const requests = [
        { method: 'tell', params: { content: 'test content' } }
      ];

      const results = await apiService.batch(requests);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ error: 'Request failed' });
    });

    it('should handle unknown methods', async () => {
      const requests = [
        { method: 'unknownMethod', params: {} }
      ];

      const results = await apiService.batch(requests);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ error: 'Unknown method: unknownMethod' });
    });
  });
});