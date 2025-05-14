import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { testUtils } from '../../helpers/testUtils.js';
import SearchService from '../../../src/services/search/SearchService.js';

// Mock faiss-node module
vi.mock('faiss-node', () => {
  return {
    default: {
      IndexFlatIP: vi.fn().mockImplementation(() => ({
        add: vi.fn(),
        search: vi.fn().mockReturnValue({
          labels: [0, 1, 2],
          distances: [0.9, 0.8, 0.7]
        })
      }))
    }
  };
});

describe('SearchService', () => {
  let searchService;
  let mockEmbeddingService;
  let mockSparqlService;
  
  beforeEach(() => {
    // Create mock services
    mockEmbeddingService = testUtils.createMockEmbeddingService();
    mockSparqlService = testUtils.createMockSPARQLService();
    
    // Configure specific mock responses
    mockSparqlService.graphExists.mockResolvedValue(true);
    
    // Sample resources with embeddings
    const mockResources = [
      {
        resource: { value: 'http://example.org/article/1' },
        content: { value: 'Article 1 content with # Heading\nAnd some text.' },
        embedding: { value: '[0.1,0.2,0.3]' }
      },
      {
        resource: { value: 'http://example.org/article/2' },
        content: { value: 'Article 2 content' },
        embedding: { value: '[0.4,0.5,0.6]' }
      },
      {
        resource: { value: 'http://example.org/article/3' },
        content: { value: 'Article 3 content' },
        embedding: { value: '[0.7,0.8,0.9]' }
      }
    ];
    
    // Configure mock response for fetching resources
    mockSparqlService.fetchResourcesWithEmbeddings.mockResolvedValue(mockResources);
    
    // Create the search service with mocked dependencies
    searchService = new SearchService({
      embeddingService: mockEmbeddingService,
      sparqlService: mockSparqlService,
      graphName: 'http://test.org/graph',
      dimension: 768
    });
    
    // Override the index with a mock for easier testing
    searchService.index = {
      add: vi.fn(),
      search: vi.fn().mockReturnValue({
        labels: [0, 1, 2],
        distances: [0.9, 0.8, 0.7]
      })
    };
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with provided services and options', () => {
      expect(searchService.embeddingService).toBe(mockEmbeddingService);
      expect(searchService.sparqlService).toBe(mockSparqlService);
      expect(searchService.graphName).toBe('http://test.org/graph');
      expect(searchService.dimension).toBe(768);
      expect(searchService.initialized).toBe(false);
    });
  });
  
  describe('initialize', () => {
    it('should check if the graph exists', async () => {
      await searchService.initialize();
      expect(mockSparqlService.graphExists).toHaveBeenCalledWith('http://test.org/graph');
    });
    
    it('should throw an error if graph does not exist', async () => {
      mockSparqlService.graphExists.mockResolvedValueOnce(false);
      
      await expect(searchService.initialize())
        .rejects.toThrowError(/Graph .* does not exist/);
    });
    
    it('should fetch resources with embeddings', async () => {
      await searchService.initialize();
      
      expect(mockSparqlService.fetchResourcesWithEmbeddings).toHaveBeenCalledWith(
        null,
        'http://schema.org/articleBody',
        'http://example.org/embedding/vector',
        'http://test.org/graph'
      );
    });
    
    it('should add embeddings to the index', async () => {
      await searchService.initialize();
      
      // Should have added 3 embeddings to the index
      expect(searchService.index.add).toHaveBeenCalledTimes(3);
      
      // Should have parsed and added the embeddings
      expect(searchService.index.add).toHaveBeenCalledWith([0.1, 0.2, 0.3]);
      expect(searchService.index.add).toHaveBeenCalledWith([0.4, 0.5, 0.6]);
      expect(searchService.index.add).toHaveBeenCalledWith([0.7, 0.8, 0.9]);
    });
    
    it('should extract titles from content when available', async () => {
      await searchService.initialize();
      
      // The first resource had a Markdown heading, which should become its title
      expect(searchService.resources[0].title).toBe('Heading');
      
      // Others should have the filename
      expect(searchService.resources[1].title).toBe('2');
      expect(searchService.resources[2].title).toBe('3');
    });
    
    it('should truncate content for display', async () => {
      await searchService.initialize();
      
      expect(searchService.resources[0].content.length).toBeLessThanOrEqual(200);
      expect(searchService.resources[0].content.endsWith('...')).toBe(true);
    });
    
    it('should only initialize once', async () => {
      await searchService.initialize();
      const firstCall = mockSparqlService.fetchResourcesWithEmbeddings.mock.calls.length;
      
      // Call initialize again
      await searchService.initialize();
      
      // Should not have called fetchResourcesWithEmbeddings again
      expect(mockSparqlService.fetchResourcesWithEmbeddings.mock.calls.length).toBe(firstCall);
    });
  });
  
  describe('search', () => {
    beforeEach(async () => {
      // Initialize the service for search tests
      await searchService.initialize();
      
      // Map resources to searchService.resources for easier access in tests
      searchService.resources = [
        { uri: 'http://example.org/article/1', title: 'Article 1', content: 'Content 1' },
        { uri: 'http://example.org/article/2', title: 'Article 2', content: 'Content 2' },
        { uri: 'http://example.org/article/3', title: 'Article 3', content: 'Content 3' }
      ];
      
      // Setup the resource map
      searchService.resourceMap = new Map([
        [0, 'http://example.org/article/1'],
        [1, 'http://example.org/article/2'],
        [2, 'http://example.org/article/3']
      ]);
    });
    
    it('should initialize if not already initialized', async () => {
      // Reset initialized flag
      searchService.initialized = false;
      
      await searchService.search('test query');
      
      // Should have called initialize
      expect(mockSparqlService.fetchResourcesWithEmbeddings).toHaveBeenCalled();
    });
    
    it('should return empty array for empty query', async () => {
      const results = await searchService.search('');
      expect(results).toEqual([]);
      
      const nullResults = await searchService.search(null);
      expect(nullResults).toEqual([]);
    });
    
    it('should generate an embedding for the query', async () => {
      await searchService.search('test query');
      
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
    });
    
    it('should search the index with the query embedding', async () => {
      await searchService.search('test query', 5);
      
      // Should have searched the index with the embedding and limit
      expect(searchService.index.search).toHaveBeenCalledWith(
        expect.any(Array), // The embedding array
        5 // The limit
      );
    });
    
    it('should map search results to resources', async () => {
      const results = await searchService.search('test query');
      
      // Should return resources in order of similarity
      expect(results).toHaveLength(3);
      expect(results[0].uri).toBe('http://example.org/article/1');
      expect(results[1].uri).toBe('http://example.org/article/2');
      expect(results[2].uri).toBe('http://example.org/article/3');
      
      // Should include titles and content
      expect(results[0].title).toBe('Article 1');
      expect(results[0].content).toBe('Content 1');
      
      // Should normalize scores to 0-1 range
      expect(results[0].score).toBe(0.9);
      expect(results[1].score).toBe(0.8);
      expect(results[2].score).toBe(0.7);
    });
    
    it('should handle errors in embedding generation', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValueOnce(
        new Error('Failed to generate embedding')
      );
      
      await expect(searchService.search('test query'))
        .rejects.toThrowError('Failed to generate embedding');
    });
    
    it('should normalize score values', async () => {
      // Set up a search result with a score > 1
      searchService.index.search.mockReturnValueOnce({
        labels: [0],
        distances: [1.5] // Score > 1
      });
      
      const results = await searchService.search('test query');
      
      // Should clamp the score to 1
      expect(results[0].score).toBe(1);
    });
  });
  
  describe('utility methods', () => {
    it('extractTitle should extract title from markdown heading', () => {
      const content = '# Heading\nContent';
      expect(searchService.extractTitle('uri', content)).toBe('Heading');
    });
    
    it('extractTitle should fallback to URI when no heading', () => {
      const content = 'No heading here';
      expect(searchService.extractTitle('http://example.org/article/123', content)).toBe('123');
    });
    
    it('getFilenameFromUri should extract filename from URI', () => {
      expect(searchService.getFilenameFromUri('http://example.org/path/to/file.txt')).toBe('file.txt');
    });
    
    it('truncateContent should truncate long content', () => {
      const longContent = 'a'.repeat(300);
      const truncated = searchService.truncateContent(longContent, 200);
      
      expect(truncated.length).toBe(203); // 200 chars + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });
    
    it('truncateContent should not truncate short content', () => {
      const shortContent = 'short content';
      expect(searchService.truncateContent(shortContent, 200)).toBe(shortContent);
    });
  });
});