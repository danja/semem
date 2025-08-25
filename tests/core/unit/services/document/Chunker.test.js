import { describe, it, expect, beforeEach } from 'vitest';
import Chunker from '../../../../../src/services/document/Chunker.js';

describe('Chunker', () => {
  let chunker;

  beforeEach(() => {
    chunker = new Chunker({
      maxChunkSize: 500,
      minChunkSize: 50,
      overlapSize: 50,
      baseNamespace: 'http://test.example.org/'
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultChunker = new Chunker();
      
      expect(defaultChunker.config.maxChunkSize).toBe(2000);
      expect(defaultChunker.config.minChunkSize).toBe(100);
      expect(defaultChunker.config.strategy).toBe('semantic');
    });

    it('should accept custom config', () => {
      const config = {
        maxChunkSize: 1000,
        strategy: 'fixed',
        baseNamespace: 'http://custom.org/'
      };
      
      const customChunker = new Chunker(config);
      
      expect(customChunker.config.maxChunkSize).toBe(1000);
      expect(customChunker.config.strategy).toBe('fixed');
      expect(customChunker.config.baseNamespace).toBe('http://custom.org/');
    });
  });

  describe('chunk', () => {
    it('should chunk markdown content successfully', async () => {
      const markdown = `
# Introduction

This is the introduction paragraph that explains the topic.

## Background

The background section provides context and historical information.

## Methodology

This section describes the methods used in the research.
      `.trim();

      const metadata = {
        title: 'Test Document',
        sourceFile: 'test.md',
        format: 'markdown'
      };

      const result = await chunker.chunk(markdown, metadata);

      expect(result.success).toBe(true);
      expect(result.chunks).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.corpus).toBeDefined();
      expect(result.community).toBeDefined();
      expect(result.sourceUri).toBeDefined();
    });

    it('should create Ragno-compliant chunks', async () => {
      const markdown = '# Test\n\nThis is a test paragraph with some content.';
      const metadata = { format: 'markdown' };

      const result = await chunker.chunk(markdown, metadata);
      const chunk = result.chunks[0];

      expect(chunk.uri).toBeDefined();
      expect(chunk.type).toBe('ragno:TextElement');
      expect(chunk.content).toBeDefined();
      expect(chunk.size).toBeGreaterThan(0);
      expect(chunk.isCorpuscle).toBe(true);
      expect(chunk.partOf).toBe(result.sourceUri);
      expect(chunk.metadata.hash).toBeDefined();
      expect(chunk.provenance).toBeDefined();
    });

    it('should create corpus structure', async () => {
      const markdown = '# Test\n\nContent here.';
      const metadata = { title: 'Test Doc', format: 'markdown' };

      const result = await chunker.chunk(markdown, metadata);

      expect(result.corpus.uri).toBeDefined();
      expect(result.corpus.type).toBe('ragno:Corpus');
      expect(result.corpus.label).toBe('Test Doc');
      expect(result.corpus.hasElement).toEqual(result.chunks.map(c => c.uri));
      expect(result.corpus.memberCount).toBe(result.chunks.length);
    });

    it('should create community structure', async () => {
      const markdown = '# Test\n\nContent here.';
      const metadata = { format: 'markdown' };

      const result = await chunker.chunk(markdown, metadata);

      expect(result.community.uri).toBeDefined();
      expect(result.community.type).toBe('ragno:Community');
      expect(result.community.hasCommunityElement).toBeDefined();
      expect(result.community.metadata.elementCount).toBe(result.chunks.length);
      expect(result.community.metadata.cohesion).toBeGreaterThanOrEqual(0);
      expect(result.community.metadata.cohesion).toBeLessThanOrEqual(1);
    });

    it('should throw error for empty content', async () => {
      await expect(chunker.chunk('')).rejects.toThrow('Chunker: markdown content is required and must be a string');
    });

    it('should throw error for whitespace-only content', async () => {
      await expect(chunker.chunk('   ')).rejects.toThrow('Chunker: markdown content is empty');
    });

    it('should throw error for non-string content', async () => {
      await expect(chunker.chunk(null)).rejects.toThrow('markdown content is required and must be a string');
    });
  });

  describe('extractTitle', () => {
    it('should extract title from markdown header', () => {
      const content = '# Main Title\n\nSome content here.';
      
      const title = chunker.extractTitle(content);
      
      expect(title).toBe('Main Title');
    });

    it('should extract title from different header levels', () => {
      expect(chunker.extractTitle('## Section Title\nContent')).toBe('Section Title');
      expect(chunker.extractTitle('### Subsection\nContent')).toBe('Subsection');
    });

    it('should return first line as title if no header', () => {
      const content = 'This is a short title\n\nFollowed by more content.';
      
      const title = chunker.extractTitle(content);
      
      expect(title).toBe('This is a short title');
    });

    it('should return null for long first lines', () => {
      const content = 'This is a very long first line that would not make a good title because it contains too much information and goes on and on.';
      
      const title = chunker.extractTitle(content);
      
      expect(title).toBeNull();
    });
  });

  describe('createContentHash', () => {
    it('should create consistent hashes for same content', () => {
      const content = 'Test content';
      
      const hash1 = chunker.createContentHash(content);
      const hash2 = chunker.createContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should create different hashes for different content', () => {
      const hash1 = chunker.createContentHash('Content 1');
      const hash2 = chunker.createContentHash('Content 2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateCohesion', () => {
    it('should return 1.0 for single chunk', () => {
      const chunks = [{ size: 100 }];
      
      const cohesion = chunker.calculateCohesion(chunks);
      
      expect(cohesion).toBe(1.0);
    });

    it('should return high cohesion for uniform sizes', () => {
      const chunks = [
        { size: 100 },
        { size: 100 },
        { size: 100 }
      ];
      
      const cohesion = chunker.calculateCohesion(chunks);
      
      expect(cohesion).toBeGreaterThan(0.9);
    });

    it('should return lower cohesion for variable sizes', () => {
      const chunks = [
        { size: 50 },
        { size: 200 },
        { size: 100 }
      ];
      
      const cohesion = chunker.calculateCohesion(chunks);
      
      expect(cohesion).toBeLessThan(0.9);
    });
  });

  describe('static methods', () => {
    describe('validateConfig', () => {
      it('should validate correct config', () => {
        const config = {
          maxChunkSize: 1000,
          minChunkSize: 100,
          overlapSize: 50,
          strategy: 'semantic'
        };
        
        const result = Chunker.validateConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect invalid chunk sizes', () => {
        const config = {
          maxChunkSize: 50,
          minChunkSize: 100
        };
        
        const result = Chunker.validateConfig(config);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('maxChunkSize must be greater than minChunkSize');
      });

      it('should warn about unknown strategy', () => {
        const config = { strategy: 'unknown_strategy' };
        
        const result = Chunker.validateConfig(config);
        
        expect(result.warnings).toContain('Unknown chunking strategy: unknown_strategy');
      });
    });

    describe('getAvailableStrategies', () => {
      it('should return available strategies', () => {
        const strategies = Chunker.getAvailableStrategies();
        
        expect(strategies).toContain('semantic');
        expect(strategies).toContain('fixed');
        expect(strategies).toContain('adaptive');
        expect(strategies).toContain('hierarchical');
        expect(strategies).toContain('token_aware');
      });
    });

    describe('getDefaultConfig', () => {
      it('should return default configuration', () => {
        const config = Chunker.getDefaultConfig();
        
        expect(config.maxChunkSize).toBe(2000);
        expect(config.minChunkSize).toBe(100);
        expect(config.overlapSize).toBe(100);
        expect(config.strategy).toBe('semantic');
        expect(config.baseNamespace).toBeDefined();
      });
    });
  });
});