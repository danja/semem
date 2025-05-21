import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { testUtils } from '../../helpers/testUtils.js';
import SearchServer from '../../../src/services/search/SearchServer.js';
import express from 'express';

// Mock dependencies
vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn().mockReturnValue({
      close: vi.fn()
    })
  };
  
  const express = vi.fn(() => mockApp);
  
  // Add static methods to the express function
  express.json = vi.fn().mockReturnValue('json-middleware');
  express.urlencoded = vi.fn().mockReturnValue('urlencoded-middleware');
  express.static = vi.fn().mockReturnValue('static-middleware');
  
  return express;
});

// Create a mock search service implementation
const createMockSearchService = () => ({
  initialize: vi.fn().mockResolvedValue(),
  search: vi.fn().mockResolvedValue([
    { 
      uri: 'http://example.org/article/1',
      title: 'Article 1',
      content: 'Content 1',
      score: 0.9
    }
  ]),
  index: vi.fn().mockResolvedValue({ id: 'test-id', success: true }),
  getIndexSize: vi.fn().mockResolvedValue(42)
});

vi.mock('../../../src/services/search/SearchService.js', () => ({
  default: vi.fn().mockImplementation(createMockSearchService)
}));

vi.mock('../../../src/services/embeddings/EmbeddingService.js');
vi.mock('../../../src/services/embeddings/SPARQLService.js');

describe('SearchServer', () => {
  let searchServer;
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    // Create the search server
    searchServer = new SearchServer({
      port: 4100,
      graphName: 'http://test.org/graph'
    });
    
    // Mock request and response objects
    mockReq = {
      query: { q: 'test query', limit: '5' }
    };
    
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      sendFile: vi.fn()
    };
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(searchServer.port).toBe(4100);
      expect(searchServer.graphName).toBe('http://test.org/graph');
    });
    
    it('should create necessary services', () => {
      expect(searchServer.embeddingService).toBeDefined();
      expect(searchServer.sparqlService).toBeDefined();
      expect(searchServer.searchService).toBeDefined();
      expect(searchServer.app).toBeDefined();
    });
  });
  
  describe('configureApp', () => {
    it('should set up middleware and routes', () => {
      searchServer.configureApp();
      
      // Should set up express middleware
      expect(express.json).toHaveBeenCalled();
      expect(express.urlencoded).toHaveBeenCalledWith({ extended: true });
      expect(express.static).toHaveBeenCalled();
      
      // Should set up routes
      expect(searchServer.app.get).toHaveBeenCalledTimes(2);
      expect(searchServer.app.get).toHaveBeenCalledWith('/api/search', expect.any(Function));
      expect(searchServer.app.get).toHaveBeenCalledWith('/', expect.any(Function));
    });
  });
  
  describe('handleSearch', () => {
    beforeEach(() => {
      // Extract the search handler function
      const handlers = searchServer.app.get.mock.calls.find(call => call[0] === '/api/search');
      // Call the handler manually
      if (handlers) {
        searchServer.handleSearch = handlers[1];
      }
    });
    
    it('should call searchService with query and limit', async () => {
      await searchServer.handleSearch(mockReq, mockRes);
      
      expect(searchServer.searchService.search).toHaveBeenCalledWith('test query', 5);
    });
    
    it('should return empty results for empty query', async () => {
      mockReq.query.q = '';
      
      await searchServer.handleSearch(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({ results: [] });
      expect(searchServer.searchService.search).not.toHaveBeenCalled();
    });
    
    it('should handle search errors', async () => {
      const error = new Error('Search failed');
      searchServer.searchService.search.mockRejectedValueOnce(error);
      
      await searchServer.handleSearch(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Search failed',
        message: error.message
      });
    });
    
    it('should use default limit when not provided', async () => {
      delete mockReq.query.limit;
      
      await searchServer.handleSearch(mockReq, mockRes);
      
      expect(searchServer.searchService.search).toHaveBeenCalledWith('test query', 5);
    });
    
    it('should parse limit as number', async () => {
      mockReq.query.limit = '10';
      
      await searchServer.handleSearch(mockReq, mockRes);
      
      expect(searchServer.searchService.search).toHaveBeenCalledWith('test query', 10);
    });
  });
  
  describe('start', () => {
    it('should configure the app', async () => {
      vi.spyOn(searchServer, 'configureApp');
      
      await searchServer.start();
      
      expect(searchServer.configureApp).toHaveBeenCalled();
    });
    
    it('should initialize the search service', async () => {
      await searchServer.start();
      
      expect(searchServer.searchService.initialize).toHaveBeenCalled();
    });
    
    it('should start the Express server on the configured port', async () => {
      await searchServer.start();
      
      expect(searchServer.app.listen).toHaveBeenCalledWith(
        4100,
        expect.any(Function)
      );
    });
    
    it('should handle initialization errors', async () => {
      searchServer.searchService.initialize.mockRejectedValueOnce(
        new Error('Initialization failed')
      );
      
      await expect(searchServer.start())
        .rejects.toThrowError('Initialization failed');
    });
  });
  
  describe('stop', () => {
    it('should close the server if running', async () => {
      // Start the server to get a reference
      await searchServer.start();
      
      // Then stop it
      await searchServer.stop();
      
      expect(searchServer.server.close).toHaveBeenCalled();
    });
    
    it('should handle server closing errors', async () => {
      // Start the server to get a reference
      await searchServer.start();
      
      // Make close fail
      const error = new Error('Failed to close');
      searchServer.server.close.mockImplementationOnce(cb => cb(error));
      
      await expect(searchServer.stop())
        .rejects.toEqual(error);
    });
    
    it('should resolve immediately if no server is running', async () => {
      searchServer.server = null;
      
      await expect(searchServer.stop()).resolves.toBeUndefined();
    });
  });
});