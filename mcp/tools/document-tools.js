import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import PDFConverter from '../../src/services/document/PDFConverter.js';
import { URIMinter } from '../../src/utils/URIMinter.js';
import SPARQLDocumentIngester from '../../src/services/ingestion/SPARQLDocumentIngester.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Document upload and processing tools for MCP
 * Following the pattern from examples/document/LoadPDFs.js
 */
export class DocumentProcessor {
  constructor(config, sparqlHelper, simpleVerbsService = null) {
    this.config = config;
    this.sparqlHelper = sparqlHelper;
    this.simpleVerbsService = simpleVerbsService;
    this.tempDir = join(process.cwd(), 'temp', 'uploads');
    
    // Ensure temp directory exists
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Process uploaded document file
   * @param {string} fileUrl - Data URL of the uploaded file
   * @param {string} filename - Original filename
   * @param {string} mediaType - MIME type
   * @param {string} documentType - Inferred type (pdf, text, markdown)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Processing result
   */
  async processUploadedDocument({ fileUrl, filename, mediaType, documentType, metadata = {} }) {
    const uploadId = uuidv4();
    const processingStartTime = Date.now();
    
    try {
      // Save file to temp directory
      const tempFilePath = await this.saveDataUrlToFile(fileUrl, filename, uploadId);
      
      // Process based on document type
      let content, processedMetadata;
      
      switch (documentType) {
        case 'pdf':
          ({ content, processedMetadata } = await this.processPDF(tempFilePath, filename, metadata));
          break;
        case 'text':
          ({ content, processedMetadata } = await this.processTextFile(tempFilePath, filename, metadata));
          break;
        case 'markdown':
          ({ content, processedMetadata } = await this.processMarkdownFile(tempFilePath, filename, metadata));
          break;
        default:
          throw new Error(`Unsupported document type: ${documentType}`);
      }
      
      // Store in SPARQL following LoadPDFs pattern
      const result = await this.storeDocumentInSPARQL(content, filename, processedMetadata, documentType);
      
      // For large documents (>2000 chars), skip immediate memory integration
      // Store full document first, then handle chunking and embeddings separately
      let memoryResult = null;
      let conceptsExtracted = 0;
      const MEMORY_INTEGRATION_LIMIT = 2000; // Conservative limit for memory processing
      
      if (this.simpleVerbsService && content.length <= MEMORY_INTEGRATION_LIMIT) {
        try {
          console.log(`📚 Integrating ${filename} with memory system for semantic search...`);
          memoryResult = await this.simpleVerbsService.tell({
            content: content,
            type: 'document',
            metadata: {
              ...processedMetadata,
              originalFormat: documentType,
              filename: filename,
              unitURI: result.unitURI,
              textURI: result.textURI,
              source: 'document_upload'
            }
          });
          
          conceptsExtracted = memoryResult.concepts || 0;
          console.log(`✅ Memory integration complete. Extracted ${conceptsExtracted} concepts.`);
        } catch (error) {
          console.warn(`⚠️ Memory system integration failed for ${filename}:`, error.message);
          // Don't fail the entire operation if memory integration fails
        }
      } else if (content.length > MEMORY_INTEGRATION_LIMIT) {
        console.log(`📄 Document too large (${content.length} chars > ${MEMORY_INTEGRATION_LIMIT}) for immediate memory integration.`);
        console.log(`🔄 Automatically chunking document for semantic processing...`);
        
        try {
          // Import chunker service
          const Chunker = (await import('../../src/services/document/Chunker.js')).default;
          const chunker = new Chunker({
            maxChunkSize: 2000,
            minChunkSize: 100,
            overlapSize: 100
          });
          
          // Chunk the document content
          const chunks = await chunker.chunkText(content, {
            sourceURI: result.textURI,
            metadata: processedMetadata
          });
          
          console.log(`📝 Created ${chunks.length} chunks from document`);
          
          // Process each chunk through memory integration
          let totalConcepts = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (this.simpleVerbsService) {
              try {
                const chunkResult = await this.simpleVerbsService.tell({
                  content: chunk.content,
                  type: 'document_chunk',
                  metadata: {
                    ...processedMetadata,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    parentDocument: filename,
                    chunkURI: chunk.uri
                  }
                });
                totalConcepts += chunkResult.concepts || 0;
              } catch (chunkError) {
                console.warn(`⚠️ Failed to process chunk ${i + 1}:`, chunkError.message);
              }
            }
          }
          
          conceptsExtracted = totalConcepts;
          console.log(`✅ Document chunking complete. Extracted ${conceptsExtracted} concepts from ${chunks.length} chunks.`);
          memoryResult = { 
            chunked: true, 
            chunkCount: chunks.length, 
            concepts: conceptsExtracted 
          };
          
        } catch (chunkingError) {
          console.error(`❌ Document chunking failed:`, chunkingError.message);
          console.log(`✨ Document stored in SPARQL. Manual chunking may be required.`);
          memoryResult = { deferred: true, reason: 'chunking_failed', error: chunkingError.message };
        }
      } else {
        console.warn('⚠️ Simple verbs service not available for memory integration');
      }
      
      // Cleanup temp file
      this.cleanupTempFile(tempFilePath);
      
      const processingTime = Date.now() - processingStartTime;
      
      return {
        success: true,
        verb: 'uploadDocument',
        filename: filename,
        documentType: documentType,
        processingTime: processingTime,
        stored: result.stored,
        unitURI: result.unitURI,
        textURI: result.textURI,
        contentLength: content.length,
        concepts: conceptsExtracted,
        memoryIntegration: memoryResult?.deferred ? 'deferred' : (memoryResult ? 'success' : 'failed'),
        message: `Successfully processed and stored ${documentType.toUpperCase()} document${memoryResult?.deferred ? '. Run ChunkDocuments.js to create searchable chunks.' : (memoryResult ? ' with memory integration' : '')}`
      };
      
    } catch (error) {
      const processingTime = Date.now() - processingStartTime;
      
      return {
        success: false,
        verb: 'uploadDocument',
        filename: filename,
        documentType: documentType,
        processingTime: processingTime,
        error: error.message,
        message: `Failed to process document: ${error.message}`
      };
    }
  }

  /**
   * Get file type from filename extension
   */
  getFileTypeFromExtension(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    const typeMap = {
      'pdf': 'pdf',
      'txt': 'text',
      'md': 'markdown'
    };
    return typeMap[extension] || null;
  }

  /**
   * Save data URL to temporary file
   */
  async saveDataUrlToFile(dataUrl, originalFilename, uploadId) {
    // Extract base64 data from data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid data URL format');
    }
    
    const [, mimeType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate temporary file path
    const extension = extname(originalFilename);
    const tempFilename = `${uploadId}_${basename(originalFilename, extension)}${extension}`;
    const tempFilePath = join(this.tempDir, tempFilename);
    
    // Write file
    writeFileSync(tempFilePath, buffer);
    
    return tempFilePath;
  }

  /**
   * Process PDF file using existing PDFConverter
   */
  async processPDF(filePath, filename, metadata) {
    const result = await PDFConverter.convert(filePath, {
      metadata: { title: metadata.title || filename, sourceFile: filename }
    });
    
    return {
      content: result.markdown,
      processedMetadata: {
        ...result.metadata,
        ...metadata,
        type: 'ragno:Unit',
        format: 'pdf',
        pages: result.metadata.pages
      }
    };
  }

  /**
   * Process plain text file
   */
  async processTextFile(filePath, filename, metadata) {
    const content = readFileSync(filePath, 'utf8');
    
    return {
      content: content,
      processedMetadata: {
        ...metadata,
        type: 'ragno:Unit',
        format: 'text',
        title: metadata.title || filename,
        sourceFile: filename,
        size: content.length
      }
    };
  }

  /**
   * Process markdown file
   */
  async processMarkdownFile(filePath, filename, metadata) {
    const content = readFileSync(filePath, 'utf8');
    
    return {
      content: content,
      processedMetadata: {
        ...metadata,
        type: 'ragno:Unit',
        format: 'markdown',
        title: metadata.title || filename,
        sourceFile: filename,
        size: content.length
      }
    };
  }

  /**
   * Store document in SPARQL following LoadPDFs pattern
   */
  async storeDocumentInSPARQL(content, filename, metadata, documentType) {
    const targetGraph = this.config.get('storage.options.graphName') || 
                       this.config.get('graphName') || 
                       'http://purl.org/stuff/semem/documents';
    
    // Generate URIs following LoadPDFs pattern
    const unitURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'unit', filename);
    const textURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'text', content);
    
    const now = new Date().toISOString();
    
    // Create SPARQL update query following LoadPDFs pattern
    const updateQuery = `
      PREFIX ragno: <http://purl.org/stuff/ragno/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX prov: <http://www.w3.org/ns/prov#>
      PREFIX semem: <http://semem.hyperdata.it/>

      INSERT DATA {
        GRAPH <${targetGraph}> {
          # Store ragno:Unit
          <${unitURI}> a ragno:Unit ;
            rdfs:label "${(metadata.title || filename).replace(/"/g, '\\"')}" ;
            dcterms:created "${now}"^^xsd:dateTime ;
            semem:sourceFile "${filename}" ;
            semem:documentType "${documentType}" ;
            semem:uploadedAt "${metadata.uploadedAt || now}" ;
            ragno:hasTextElement <${textURI}> .
          
          # Store ragno:TextElement
          <${textURI}> a ragno:TextElement ;
            rdfs:label "${filename} content" ;
            dcterms:created "${now}"^^xsd:dateTime ;
            ragno:content "${content.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" ;
            dcterms:extent ${content.length} ;
            prov:wasDerivedFrom <${unitURI}> .
        }
      }
    `;
    
    await this.sparqlHelper.executeUpdate(updateQuery);
    
    return {
      stored: true,
      unitURI,
      textURI,
      targetGraph
    };
  }

  /**
   * Cleanup temporary file
   */
  cleanupTempFile(filePath) {
    try {
      if (existsSync(filePath)) {
        // Note: In a real implementation, you might want to use fs.unlink
        // For now, we'll leave temp files for debugging
        // unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
    }
  }

  /**
   * Check if document already exists in SPARQL store
   */
  async checkDocumentExists(filename, targetGraph) {
    try {
      const query = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX semem: <http://semem.hyperdata.it/>
        
        ASK {
          GRAPH <${targetGraph}> {
            ?unit a ragno:Unit ;
                  semem:sourceFile "${filename}" .
          }
        }
      `;
      
      const storageConfig = this.config.get('storage.options');
      const response = await fetch(storageConfig.query, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sparql-query',
          'Accept': 'application/sparql-results+json',
          'Authorization': `Basic ${Buffer.from(`${storageConfig.user}:${storageConfig.password}`).toString('base64')}`
        },
        body: query
      });
      
      const result = await response.json();
      return result.boolean === true;
    } catch (error) {
      console.warn(`Warning: Could not check if document exists: ${error.message}`);
      return false;
    }
  }
}

/**
 * Create MCP tool for document upload
 */
export const createDocumentUploadTool = (processor) => ({
  name: 'uploadDocument',
  description: 'Upload and process document file (PDF, TXT, MD)',
  parameters: {
    type: 'object',
    properties: {
      fileUrl: {
        type: 'string',
        description: 'Data URL of the uploaded file'
      },
      filename: {
        type: 'string',
        description: 'Original filename'
      },
      mediaType: {
        type: 'string',
        description: 'MIME type of the file'
      },
      documentType: {
        type: 'string',
        enum: ['pdf', 'text', 'markdown'],
        description: 'Document type inferred from extension'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata',
        properties: {
          title: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          uploadedAt: { type: 'string' },
          originalName: { type: 'string' },
          size: { type: 'number' }
        }
      }
    },
    required: ['fileUrl', 'filename', 'mediaType', 'documentType']
  },
  handler: async (params) => {
    return await processor.processUploadedDocument(params);
  }
});

/**
 * Create MCP tool for SPARQL document ingestion
 */
export const createSparqlIngestTool = (simpleVerbsService) => ({
  name: 'sparql_ingest_documents',
  description: 'Ingest documents from SPARQL endpoint using query templates',
  parameters: {
    type: 'object',
    properties: {
      endpoint: {
        type: 'string',
        description: 'SPARQL query endpoint URL'
      },
      template: {
        type: 'string',
        description: 'Name of SPARQL query template (blog-articles, generic-documents, wikidata-entities)',
        enum: ['blog-articles', 'generic-documents', 'wikidata-entities']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of documents to ingest (optional, unlimited if not specified)',
        minimum: 1
      },
      lazy: {
        type: 'boolean',
        description: 'Use lazy processing (store without immediate embedding/concept extraction)',
        default: false
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview documents without actually ingesting them',
        default: false
      },
      auth: {
        type: 'object',
        description: 'Authentication credentials for SPARQL endpoint',
        properties: {
          user: { type: 'string' },
          password: { type: 'string' }
        }
      },
      variables: {
        type: 'object',
        description: 'Variables to substitute in SPARQL template'
      },
      fieldMappings: {
        type: 'object',
        description: 'Custom field mappings for extracting document data'
      },
      graph: {
        type: 'string',
        description: 'Graph URI for SPARQL updates (default: http://hyperdata.it/content)'
      }
    },
    required: ['endpoint', 'template']
  },
  handler: async (params) => {
    const {
      endpoint,
      template,
      limit = null,
      lazy = false,
      dryRun = false,
      auth,
      variables = {},
      fieldMappings,
      graph = 'http://hyperdata.it/content'
    } = params;

    try {
      // Create SPARQL ingester
      const ingester = new SPARQLDocumentIngester({
        endpoint,
        auth,
        fieldMappings
      });

      // Handle dry run
      if (dryRun) {
        const result = await ingester.dryRun(template, { variables, limit, graph });
        return {
          success: true,
          type: 'dry_run',
          ...result
        };
      }

      // Create tell function that uses the simple verbs service
      const tellFunction = async (tellParams) => {
        if (!simpleVerbsService) {
          throw new Error('Simple verbs service not available');
        }
        return await simpleVerbsService.tell(tellParams);
      };

      // Execute ingestion
      const result = await ingester.ingestFromTemplate(template, {
        variables,
        limit,
        lazy,
        graph,
        tellFunction,
        progressCallback: (progress) => {
          // Could emit progress events here if needed
          console.log(`Progress: ${progress.processed}/${progress.total} documents processed`);
        }
      });

      return {
        success: result.success,
        type: 'ingestion',
        template,
        endpoint,
        documentsFound: result.statistics?.documentsFound || 0,
        documentsIngested: result.statistics?.documentsIngested || 0,
        errors: result.statistics?.errors || 0,
        duration: result.duration,
        errorDetails: result.errors?.slice(0, 5) || [], // Show first 5 errors
        message: result.success 
          ? `Successfully ingested ${result.statistics?.documentsIngested || 0} documents from ${endpoint}`
          : `Ingestion failed: ${result.error}`
      };

    } catch (error) {
      return {
        success: false,
        type: 'ingestion',
        error: error.message,
        endpoint,
        template
      };
    }
  }
});