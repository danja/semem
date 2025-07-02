import ContentChunker from '../../zpt/transform/ContentChunker.js';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from 'loglevel';

/**
 * Document chunking service with Ragno ontology compliance
 * Implements paragraph-level chunking with markdown header delimiters
 * Creates hash-based URIs and maps to Ragno classes
 */
export default class Chunker {
  constructor(options = {}) {
    this.config = {
      maxChunkSize: options.maxChunkSize || 2000,
      minChunkSize: options.minChunkSize || 100,
      overlapSize: options.overlapSize || 100,
      strategy: options.strategy || 'semantic',
      baseNamespace: options.baseNamespace || 'http://example.org/semem/',
      ...options
    };

    // Initialize ZPT ContentChunker with our settings
    this.contentChunker = new ContentChunker({
      defaultChunkSize: this.config.maxChunkSize,
      maxChunkSize: this.config.maxChunkSize,
      minChunkSize: this.config.minChunkSize,
      overlapSize: this.config.overlapSize,
      preserveStructure: true,
      semanticBoundaries: true,
      balanceChunks: true
    });
  }

  /**
   * Chunk markdown content with Ragno compliance
   * @param {string} markdown - Markdown content to chunk
   * @param {Object} metadata - Source document metadata
   * @param {Object} options - Chunking options
   * @returns {Promise<Object>} Chunking result with Ragno-compliant data structures
   */
  async chunk(markdown, metadata = {}, options = {}) {
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Chunker: markdown content is required and must be a string');
    }

    if (markdown.trim().length === 0) {
      throw new Error('Chunker: markdown content is empty');
    }

    try {
      const startTime = Date.now();
      const chunkingOptions = { ...this.config, ...options };

      // Use ZPT ContentChunker for initial chunking
      const chunkingResult = await this.contentChunker.chunk(markdown, {
        strategy: chunkingOptions.strategy,
        chunkSize: chunkingOptions.maxChunkSize,
        minChunkSize: chunkingOptions.minChunkSize,
        overlapSize: chunkingOptions.overlapSize
      });

      const chunks = chunkingResult.chunks;
      const processingTime = Date.now() - startTime;

      // Create source document URI
      const sourceUri = this.mintDocumentUri(metadata);

      // Convert chunks to Ragno-compliant format
      const ragnoChunks = await this.createRagnoChunks(chunks, sourceUri, metadata);

      // Create corpus and community structures
      const corpus = this.createCorpus(sourceUri, ragnoChunks, metadata);
      const community = this.createCommunity(sourceUri, ragnoChunks, metadata);

      logger.debug(`Chunker: Created ${ragnoChunks.length} chunks from ${markdown.length} chars in ${processingTime}ms`);

      return {
        chunks: ragnoChunks,
        corpus,
        community,
        sourceUri,
        metadata: {
          ...metadata,
          chunking: {
            chunkCount: ragnoChunks.length,
            strategy: chunkingOptions.strategy,
            processingTime,
            avgChunkSize: Math.round(ragnoChunks.reduce((sum, c) => sum + c.size, 0) / ragnoChunks.length),
            ...chunkingResult.metadata
          }
        },
        success: true
      };

    } catch (error) {
      logger.error('Chunker: Error during chunking:', error.message);
      throw new Error(`Chunker: Failed to chunk content: ${error.message}`);
    }
  }

  /**
   * Create Ragno-compliant chunk objects
   * @private
   * @param {Array} chunks - Raw chunks from ContentChunker
   * @param {string} sourceUri - Source document URI
   * @param {Object} metadata - Source metadata
   * @returns {Promise<Array>} Ragno-compliant chunks
   */
  async createRagnoChunks(chunks, sourceUri, metadata) {
    const ragnoChunks = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkUri = this.mintChunkUri(chunk.content, sourceUri, i);
      
      // Extract title from content if it starts with header
      const title = this.extractTitle(chunk.content);
      
      const ragnoChunk = {
        // Core properties
        uri: chunkUri,
        type: 'ragno:TextElement',
        content: chunk.content,
        size: chunk.size,
        
        // Ragno-specific properties
        isCorpuscle: true,
        title: title || `Chunk ${i + 1}`,
        index: i,
        
        // Relationships
        partOf: sourceUri,
        position: chunk.position || { start: 0, end: chunk.size },
        
        // Metadata
        metadata: {
          chunkId: chunk.id,
          strategy: chunk.type,
          originalMetadata: chunk.metadata || {},
          sourceFormat: metadata.format,
          processingTimestamp: new Date().toISOString(),
          hash: this.createContentHash(chunk.content)
        },

        // PROV-O provenance
        provenance: {
          wasGeneratedBy: 'chunking_activity',
          wasDerivedFrom: sourceUri,
          generatedAtTime: new Date().toISOString(),
          wasAttributedTo: 'semem:Chunker'
        }
      };

      ragnoChunks.push(ragnoChunk);
    }

    return ragnoChunks;
  }

  /**
   * Create Ragno Corpus structure
   * @private
   * @param {string} sourceUri - Source document URI
   * @param {Array} chunks - Ragno chunks
   * @param {Object} metadata - Source metadata
   * @returns {Object} Ragno Corpus
   */
  createCorpus(sourceUri, chunks, metadata) {
    const corpusUri = this.mintCorpusUri(sourceUri);
    
    return {
      uri: corpusUri,
      type: 'ragno:Corpus',
      label: metadata.title || 'Document Corpus',
      description: `Corpus created from ${metadata.sourceFile || 'document'}`,
      
      // SKOS Collection properties
      hasElement: chunks.map(c => c.uri),
      memberCount: chunks.length,
      
      // Source reference
      wasDerivedFrom: sourceUri,
      
      metadata: {
        sourceFormat: metadata.format,
        totalSize: chunks.reduce((sum, c) => sum + c.size, 0),
        createdAt: new Date().toISOString(),
        sourceMetadata: metadata
      }
    };
  }

  /**
   * Create Ragno Community structure
   * @private
   * @param {string} sourceUri - Source document URI  
   * @param {Array} chunks - Ragno chunks
   * @param {Object} metadata - Source metadata
   * @returns {Object} Ragno Community
   */
  createCommunity(sourceUri, chunks, metadata) {
    const communityUri = this.mintCommunityUri(sourceUri);
    
    return {
      uri: communityUri,
      type: 'ragno:Community',
      label: metadata.title ? `${metadata.title} Community` : 'Document Community',
      description: `Community of text elements from ${metadata.sourceFile || 'document'}`,
      
      // Community-specific properties
      hasCommunityElement: chunks.map(c => ({
        element: c.uri,
        type: 'ragno:CommunityElement'
      })),
      
      // Relationships
      basedOn: sourceUri,
      
      metadata: {
        elementCount: chunks.length,
        avgElementSize: Math.round(chunks.reduce((sum, c) => sum + c.size, 0) / chunks.length),
        createdAt: new Date().toISOString(),
        cohesion: this.calculateCohesion(chunks)
      }
    };
  }

  /**
   * Mint URI for source document
   * @private
   * @param {Object} metadata - Document metadata
   * @returns {string} Document URI
   */
  mintDocumentUri(metadata) {
    const identifier = metadata.sourceFile || 
                      metadata.conversionId || 
                      this.createContentHash(JSON.stringify(metadata));
    
    return `${this.config.baseNamespace}document/${this.createContentHash(identifier)}`;
  }

  /**
   * Mint URI for chunk
   * @private
   * @param {string} content - Chunk content
   * @param {string} sourceUri - Source document URI
   * @param {number} index - Chunk index
   * @returns {string} Chunk URI
   */
  mintChunkUri(content, sourceUri, index) {
    const contentHash = this.createContentHash(content);
    const sourceHash = this.createContentHash(sourceUri);
    
    return `${this.config.baseNamespace}chunk/${sourceHash}_${index}_${contentHash}`;
  }

  /**
   * Mint URI for corpus
   * @private
   * @param {string} sourceUri - Source document URI
   * @returns {string} Corpus URI
   */
  mintCorpusUri(sourceUri) {
    const sourceHash = this.createContentHash(sourceUri);
    return `${this.config.baseNamespace}corpus/${sourceHash}`;
  }

  /**
   * Mint URI for community
   * @private
   * @param {string} sourceUri - Source document URI
   * @returns {string} Community URI
   */
  mintCommunityUri(sourceUri) {
    const sourceHash = this.createContentHash(sourceUri);
    return `${this.config.baseNamespace}community/${sourceHash}`;
  }

  /**
   * Create SHA-256 hash of content
   * @private
   * @param {string} content - Content to hash
   * @returns {string} Hex hash
   */
  createContentHash(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * Extract title from chunk content (if starts with markdown header)
   * @private
   * @param {string} content - Chunk content
   * @returns {string|null} Extracted title or null
   */
  extractTitle(content) {
    if (!content) return null;
    
    const lines = content.trim().split('\n');
    const firstLine = lines[0].trim();
    
    // Check for markdown headers
    const headerMatch = firstLine.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      return headerMatch[2].trim();
    }
    
    // Check if first line could be a title (short, no punctuation at end)
    if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.endsWith('!') && !firstLine.endsWith('?')) {
      return firstLine;
    }
    
    return null;
  }

  /**
   * Calculate cohesion score for community
   * @private
   * @param {Array} chunks - Chunks to analyze
   * @returns {number} Cohesion score (0-1)
   */
  calculateCohesion(chunks) {
    if (chunks.length <= 1) return 1.0;
    
    // Simple cohesion based on size variance - more uniform sizes = higher cohesion
    const sizes = chunks.map(c => c.size);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avg, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize to 0-1 scale
    const cohesion = Math.max(0, 1 - (stdDev / avg));
    return Math.round(cohesion * 100) / 100;
  }

  /**
   * Validate chunking configuration
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result
   */
  static validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (config.maxChunkSize && config.maxChunkSize < 100) {
      errors.push('maxChunkSize must be at least 100 characters');
    }

    if (config.minChunkSize && config.minChunkSize < 10) {
      errors.push('minChunkSize must be at least 10 characters');
    }

    if (config.maxChunkSize && config.minChunkSize && config.maxChunkSize <= config.minChunkSize) {
      errors.push('maxChunkSize must be greater than minChunkSize');
    }

    if (config.overlapSize && config.overlapSize < 0) {
      errors.push('overlapSize cannot be negative');
    }

    if (config.strategy && !['fixed', 'semantic', 'adaptive', 'hierarchical', 'token_aware'].includes(config.strategy)) {
      warnings.push(`Unknown chunking strategy: ${config.strategy}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available chunking strategies
   * @returns {Array<string>} Available strategies
   */
  static getAvailableStrategies() {
    return ['fixed', 'semantic', 'adaptive', 'hierarchical', 'token_aware'];
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  static getDefaultConfig() {
    return {
      maxChunkSize: 2000,
      minChunkSize: 100,
      overlapSize: 100,
      strategy: 'semantic',
      baseNamespace: 'http://example.org/semem/'
    };
  }
}