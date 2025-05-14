import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { testUtils } from '../../helpers/testUtils.js';
import EmbeddingCreator from '../../../src/services/embeddings/EmbeddingCreator.js';

describe('EmbeddingCreator', () => {
  let embeddingCreator;
  let mockEmbeddingService;
  let mockSparqlService;
  
  beforeEach(() => {
    // Create mock services
    mockEmbeddingService = testUtils.createMockEmbeddingService();
    mockSparqlService = testUtils.createMockSPARQLService();
    
    // Configure specific mock responses
    mockSparqlService.graphExists.mockResolvedValue(true);
    
    // Sample SPARQL query results
    const mockArticles = [
      {
        article: { value: 'http://example.org/article/1' },
        content: { value: 'Article 1 content' }
      },
      {
        article: { value: 'http://example.org/article/2' },
        content: { value: 'Article 2 content' }
      },
      {
        article: { value: 'http://example.org/article/3' },
        content: { value: 'Article 3 content' }
      }
    ];
    
    // Sample articles with existing embeddings
    const mockEmbeddedArticles = [
      {
        article: { value: 'http://example.org/article/1' }
      }
    ];
    
    // Configure mock responses for SPARQL queries
    mockSparqlService.executeQuery.mockImplementation((query) => {
      if (query.includes('?article <http://schema.org/articleBody> ?content')) {
        return Promise.resolve({ results: { bindings: mockArticles } });
      } else if (query.includes('?article <http://example.org/embedding/vector> ?embedding')) {
        return Promise.resolve({ results: { bindings: mockEmbeddedArticles } });
      } else {
        return Promise.resolve({ results: { bindings: [] } });
      }
    });
    
    // Create the embedding creator with mocked services
    embeddingCreator = new EmbeddingCreator({
      embeddingService: mockEmbeddingService,
      sparqlService: mockSparqlService,
      graphName: 'http://test.org/graph'
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with provided services and options', () => {
      expect(embeddingCreator.embeddingService).toBe(mockEmbeddingService);
      expect(embeddingCreator.sparqlService).toBe(mockSparqlService);
      expect(embeddingCreator.graphName).toBe('http://test.org/graph');
      expect(embeddingCreator.contentPredicate).toBe('http://schema.org/articleBody');
      expect(embeddingCreator.embeddingPredicate).toBe('http://example.org/embedding/vector');
    });
    
    it('should create default services if not provided', () => {
      const defaultCreator = new EmbeddingCreator();
      expect(defaultCreator.embeddingService).toBeDefined();
      expect(defaultCreator.sparqlService).toBeDefined();
      expect(defaultCreator.graphName).toBe('http://danny.ayers.name/content');
    });
  });
  
  describe('run', () => {
    it('should check if the graph exists', async () => {
      await embeddingCreator.run();
      expect(mockSparqlService.graphExists).toHaveBeenCalledWith('http://test.org/graph');
    });
    
    it('should throw an error if graph does not exist', async () => {
      mockSparqlService.graphExists.mockResolvedValueOnce(false);
      
      await expect(embeddingCreator.run())
        .rejects.toThrowError(/Graph .* does not exist/);
    });
    
    it('should query for articles and articles with embeddings', async () => {
      await embeddingCreator.run();
      
      // Should execute two queries
      expect(mockSparqlService.executeQuery).toHaveBeenCalledTimes(2);
      
      // Check query parameters more directly - matching the exact format used in EmbeddingCreator
      const firstCall = mockSparqlService.executeQuery.mock.calls[0][0];
      const secondCall = mockSparqlService.executeQuery.mock.calls[1][0];
      
      // Verify first query contains essential parts for articles
      expect(firstCall).toContain('SELECT * WHERE');
      expect(firstCall).toContain('GRAPH <http://test.org/graph>');
      expect(firstCall).toContain('?article <http://schema.org/articleBody> ?content');
      
      // Verify second query contains essential parts for embeddings
      expect(secondCall).toContain('SELECT ?article WHERE');
      expect(secondCall).toContain('GRAPH <http://test.org/graph>');
      expect(secondCall).toContain('?article <http://example.org/embedding/vector> ?embedding');
    });
    
    it('should skip articles that already have embeddings', async () => {
      await embeddingCreator.run();
      
      // Should generate embeddings for 2 articles (3 total, 1 with existing embedding)
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      
      // Should not generate embedding for article/1 (already has one)
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalledWith('Article 1 content');
      
      // Should generate for article/2 and article/3
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Article 2 content');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Article 3 content');
    });
    
    it('should store embeddings for articles that need them', async () => {
      await embeddingCreator.run();
      
      // Should store 2 embeddings
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledTimes(2);
      
      // Should store embedding for these articles
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledWith(
        'http://example.org/article/2',
        expect.any(Array),
        'http://test.org/graph',
        'http://example.org/embedding/vector'
      );
      
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledWith(
        'http://example.org/article/3',
        expect.any(Array),
        'http://test.org/graph',
        'http://example.org/embedding/vector'
      );
    });
    
    it('should skip articles with insufficient content', async () => {
      // Create a mock with one article having empty content
      const mockArticlesWithEmpty = [
        {
          article: { value: 'http://example.org/article/1' },
          content: { value: 'Article 1 content' }
        },
        {
          article: { value: 'http://example.org/article/empty' },
          content: { value: '' } // Empty content
        }
      ];
      
      // No existing embeddings
      const mockEmptyEmbeddings = [];
      
      mockSparqlService.executeQuery.mockImplementation((query) => {
        if (query.includes('?article <http://schema.org/articleBody> ?content')) {
          return Promise.resolve({ results: { bindings: mockArticlesWithEmpty } });
        } else if (query.includes('?article <http://example.org/embedding/vector> ?embedding')) {
          return Promise.resolve({ results: { bindings: mockEmptyEmbeddings } });
        }
        return Promise.resolve({ results: { bindings: [] } });
      });
      
      await embeddingCreator.run();
      
      // Should only generate embedding for the article with content
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('Article 1 content');
      
      // Should only store embedding for the article with content
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledTimes(1);
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledWith(
        'http://example.org/article/1',
        expect.any(Array),
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should respect the limit option', async () => {
      // Mock a large number of articles
      const manyArticles = Array(10).fill().map((_, i) => ({
        article: { value: `http://example.org/article/${i}` },
        content: { value: `Article ${i} content` }
      }));
      
      mockSparqlService.executeQuery.mockImplementation((query) => {
        if (query.includes('?article <http://schema.org/articleBody> ?content')) {
          return Promise.resolve({ results: { bindings: manyArticles } });
        } else if (query.includes('?article <http://example.org/embedding/vector> ?embedding')) {
          return Promise.resolve({ results: { bindings: [] } });
        }
        return Promise.resolve({ results: { bindings: [] } });
      });
      
      // Run with a limit of 3
      await embeddingCreator.run({ limit: 3 });
      
      // Should include the LIMIT clause in the query
      expect(mockSparqlService.executeQuery).toHaveBeenCalledWith(
        expect.stringMatching(/LIMIT 3/)
      );
    });
    
    it('should continue with next article if embedding generation fails', async () => {
      // Make the embedding generation fail for one article
      mockEmbeddingService.generateEmbedding.mockImplementation((text) => {
        if (text === 'Article 2 content') {
          return Promise.reject(new Error('Embedding generation failed'));
        }
        return Promise.resolve(new Array(768).fill(0));
      });
      
      await embeddingCreator.run();
      
      // Should try to generate embeddings for both articles without existing embeddings
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      
      // Should only store embedding for the successful article
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledTimes(1);
      expect(mockSparqlService.storeEmbedding).toHaveBeenCalledWith(
        'http://example.org/article/3',
        expect.any(Array),
        expect.any(String),
        expect.any(String)
      );
      
      // Check the stats
      expect(embeddingCreator.stats.failed).toBe(1);
      expect(embeddingCreator.stats.successful).toBe(1);
    });
    
    it('should return statistics about the run', async () => {
      const stats = await embeddingCreator.run();
      
      expect(stats).toEqual({
        total: 3,
        processed: 3,
        successful: 2,
        failed: 0,
        skipped: 1
      });
    });
  });
});