import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SPARQLService from '../../../src/services/embeddings/SPARQLService.js';

// Mock node-fetch to avoid actual network requests
vi.mock('node-fetch', async () => {
  const actual = await vi.importActual('node-fetch');
  
  return {
    ...actual,
    default: vi.fn()
  };
});

// Import fetch after mocking
import fetch from 'node-fetch';

describe('SPARQLService', () => {
  let sparqlService;
  
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockReset();
    
    // Create the service
    sparqlService = new SPARQLService({
      queryEndpoint: 'http://test-sparql/query',
      updateEndpoint: 'http://test-sparql/update',
      graphName: 'http://test-graph',
      auth: {
        user: 'testuser',
        password: 'testpass'
      }
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
    it('should use provided configuration', () => {
      expect(sparqlService.queryEndpoint).toBe('http://test-sparql/query');
      expect(sparqlService.updateEndpoint).toBe('http://test-sparql/update');
      expect(sparqlService.graphName).toBe('http://test-graph');
      expect(sparqlService.auth).toEqual({ user: 'testuser', password: 'testpass' });
    });
    
    it('should use default values when not provided', () => {
      const defaultService = new SPARQLService();
      
      expect(defaultService.queryEndpoint).toBe('http://localhost:4030/semem/query');
      expect(defaultService.updateEndpoint).toBe('http://localhost:4030/semem/update');
      expect(defaultService.graphName).toBe('http://example.org/default');
      expect(defaultService.auth).toEqual({ user: 'admin', password: 'admin123' });
    });
  });
  
  describe('executeQuery', () => {
    it('should make a POST request with the correct headers and auth', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ results: { bindings: [] } })
      };
      fetch.mockResolvedValue(mockResponse);
      
      const query = 'SELECT * WHERE { ?s ?p ?o }';
      await sparqlService.executeQuery(query);
      
      // Verify fetch was called with correct params
      expect(fetch).toHaveBeenCalledWith('http://test-sparql/query', {
        method: 'POST',
        headers: {
          'Authorization': expect.stringContaining('Basic '), // Base64 encoded auth
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/json'
        },
        body: query
      });
      expect(mockResponse.json).toHaveBeenCalled();
    });
    
    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      await expect(sparqlService.executeQuery('test query'))
        .rejects.toThrowError('Network error');
    });
    
    it('should handle non-OK responses', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request')
      };
      fetch.mockResolvedValue(mockErrorResponse);
      
      await expect(sparqlService.executeQuery('test query'))
        .rejects.toThrowError('SPARQL query failed: 400 - Bad Request');
    });
  });
  
  describe('executeUpdate', () => {
    it('should make a POST request with the correct headers and auth', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true
      };
      fetch.mockResolvedValue(mockResponse);
      
      const update = 'INSERT DATA { <s> <p> <o> }';
      await sparqlService.executeUpdate(update);
      
      // Verify fetch was called with correct params
      expect(fetch).toHaveBeenCalledWith('http://test-sparql/update', {
        method: 'POST',
        headers: {
          'Authorization': expect.stringContaining('Basic '), // Base64 encoded auth
          'Content-Type': 'application/sparql-update',
          'Accept': 'application/json'
        },
        body: update
      });
    });
    
    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      await expect(sparqlService.executeUpdate('test update'))
        .rejects.toThrowError('Network error');
    });
    
    it('should handle non-OK responses', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request')
      };
      fetch.mockResolvedValue(mockErrorResponse);
      
      await expect(sparqlService.executeUpdate('test update'))
        .rejects.toThrowError('SPARQL update failed: 400 - Bad Request');
    });
  });
  
  describe('graphExists', () => {
    it('should send a ASK query to check if graph exists', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ boolean: true })
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await sparqlService.graphExists();
      
      // Verify correct query was sent
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(`ASK { GRAPH <http://test-graph>`)
        })
      );
      expect(result).toBe(true);
    });
    
    it('should return false if graph does not exist', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ boolean: false })
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await sparqlService.graphExists();
      expect(result).toBe(false);
    });
  });
  
  describe('storeEmbedding', () => {
    it('should send an INSERT DATA update to store embedding', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true
      };
      fetch.mockResolvedValue(mockResponse);
      
      const resourceUri = 'http://example.org/resource/123';
      const embedding = [0.1, 0.2, 0.3];
      
      await sparqlService.storeEmbedding(resourceUri, embedding);
      
      // Verify correct update was sent
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringMatching(/INSERT DATA.*<http:\/\/example.org\/resource\/123>.*\[0.1,0.2,0.3\]/)
        })
      );
    });
  });
  
  describe('fetchResourcesWithEmbeddings', () => {
    it('should send a SELECT query to fetch resources with embeddings', async () => {
      // Setup mock response with sample bindings
      const mockBindings = [
        {
          resource: { value: 'http://example.org/resource/1' },
          content: { value: 'Sample content 1' },
          embedding: { value: '[0.1,0.2,0.3]' }
        },
        {
          resource: { value: 'http://example.org/resource/2' },
          content: { value: 'Sample content 2' },
          embedding: { value: '[0.4,0.5,0.6]' }
        }
      ];
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: { bindings: mockBindings }
        })
      };
      fetch.mockResolvedValue(mockResponse);
      
      const result = await sparqlService.fetchResourcesWithEmbeddings();
      
      // Verify correct query was sent
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringMatching(/SELECT.*\?resource.*\?content.*\?embedding/)
        })
      );
      
      // Verify the result
      expect(result).toEqual(mockBindings);
    });
    
    it('should apply class filter when resourceClass is provided', async () => {
      // Setup mock response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: { bindings: [] }
        })
      };
      fetch.mockResolvedValue(mockResponse);
      
      await sparqlService.fetchResourcesWithEmbeddings('http://schema.org/Article');
      
      // Verify class type filter was included in query
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringMatching(/\?resource a <http:\/\/schema.org\/Article>/)
        })
      );
    });
  });
});