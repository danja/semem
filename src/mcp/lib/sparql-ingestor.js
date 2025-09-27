/**
 * SPARQL Ingestor - Handles document ingestion from SPARQL endpoints
 * Supports templated queries and bulk document processing
 */

import { mcpDebugger } from './debug-utils.js';

class SPARQLIngestor {
  constructor() {
    this.name = 'SPARQLIngestor';
    this.defaultTemplates = {
      'documents': `
        SELECT ?document ?title ?content ?created WHERE {
          ?document a <http://schema.org/Document> ;
                   <http://schema.org/name> ?title ;
                   <http://schema.org/text> ?content ;
                   <http://schema.org/dateCreated> ?created .
        } LIMIT {{limit}}
      `,
      'articles': `
        SELECT ?article ?title ?content ?author WHERE {
          ?article a <http://schema.org/Article> ;
                  <http://schema.org/headline> ?title ;
                  <http://schema.org/articleBody> ?content ;
                  <http://schema.org/author> ?author .
        } LIMIT {{limit}}
      `,
      'concepts': `
        SELECT ?concept ?label ?description WHERE {
          ?concept a <http://www.w3.org/2004/02/skos/core#Concept> ;
                  <http://www.w3.org/2000/01/rdf-schema#label> ?label ;
                  <http://www.w3.org/2000/01/rdf-schema#comment> ?description .
        } LIMIT {{limit}}
      `
    };
  }

  /**
   * Ingest documents from SPARQL endpoint
   */
  async ingestDocuments(options = {}) {
    const {
      endpoint,
      template = 'documents',
      limit = 10,
      auth = null,
      variables = {},
      fieldMappings = {},
      dryRun = false
    } = options;

    mcpDebugger.info('SPARQLIngestor: Starting document ingestion', {
      endpoint,
      template,
      limit,
      hasAuth: !!auth,
      dryRun,
      variableCount: Object.keys(variables).length
    });

    try {
      // Validate input
      if (!endpoint) {
        throw new Error('SPARQL endpoint is required');
      }

      // Build SPARQL query
      const query = await this.buildQuery(template, { limit, ...variables });

      mcpDebugger.debug('SPARQLIngestor: Query built', {
        template,
        queryLength: query.length,
        queryPreview: query.substring(0, 200)
      });

      if (dryRun) {
        mcpDebugger.info('SPARQLIngestor: Dry run mode - returning preview');
        return this.createDryRunPreview(query, endpoint, limit);
      }

      // Execute SPARQL query
      const results = await this.executeSPARQLQuery(endpoint, query, auth);

      // Process and map results
      const documents = await this.processResults(results, fieldMappings, template);

      mcpDebugger.info('SPARQLIngestor: Document ingestion completed', {
        documentsIngested: documents.length,
        endpoint,
        template
      });

      return documents;

    } catch (error) {
      mcpDebugger.error('SPARQLIngestor: Document ingestion failed', {
        error: error.message,
        stack: error.stack,
        endpoint,
        template
      });
      throw error;
    }
  }

  /**
   * Build SPARQL query from template
   */
  async buildQuery(template, variables = {}) {
    try {
      let query;

      // Use predefined template or custom query
      if (this.defaultTemplates[template]) {
        query = this.defaultTemplates[template];
      } else if (typeof template === 'string' && template.includes('SELECT')) {
        // Assume it's a custom SPARQL query
        query = template;
      } else {
        throw new Error(`Unknown template: ${template}`);
      }

      // Replace variables in template
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        query = query.replace(placeholder, value);
      });

      // Clean up query (remove extra whitespace)
      query = query.replace(/\s+/g, ' ').trim();

      return query;

    } catch (error) {
      mcpDebugger.error('SPARQLIngestor: Query building failed', error.message);
      throw error;
    }
  }

  /**
   * Execute SPARQL query against endpoint
   */
  async executeSPARQLQuery(endpoint, query, auth = null) {
    mcpDebugger.debug('SPARQLIngestor: Executing SPARQL query', {
      endpoint,
      queryLength: query.length,
      hasAuth: !!auth
    });

    try {
      // Mock SPARQL execution - in real implementation, use actual HTTP client
      mcpDebugger.info('SPARQLIngestor: Mock SPARQL execution');

      // Simulate query execution with mock results
      const mockResults = this.generateMockResults(query);

      mcpDebugger.debug('SPARQLIngestor: Mock query executed', {
        resultCount: mockResults.length
      });

      return mockResults;

    } catch (error) {
      mcpDebugger.error('SPARQLIngestor: SPARQL query execution failed', error.message);
      throw new Error(`SPARQL query failed: ${error.message}`);
    }
  }

  /**
   * Generate mock SPARQL results for testing
   */
  generateMockResults(query) {
    const resultCount = Math.min(5, Math.floor(Math.random() * 8) + 1);
    const results = [];

    for (let i = 0; i < resultCount; i++) {
      if (query.includes('Document')) {
        results.push({
          document: `http://example.org/doc${i + 1}`,
          title: `Mock Document ${i + 1}`,
          content: `This is the content of mock document ${i + 1}. It contains information that would normally be retrieved from a SPARQL endpoint.`,
          created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        });
      } else if (query.includes('Article')) {
        results.push({
          article: `http://example.org/article${i + 1}`,
          title: `Mock Article ${i + 1}`,
          content: `This is mock article content ${i + 1} that demonstrates SPARQL ingestion capabilities.`,
          author: `Author ${i + 1}`
        });
      } else if (query.includes('Concept')) {
        results.push({
          concept: `http://example.org/concept${i + 1}`,
          label: `Concept ${i + 1}`,
          description: `Description of concept ${i + 1} from SPARQL endpoint.`
        });
      } else {
        // Generic result
        results.push({
          uri: `http://example.org/resource${i + 1}`,
          label: `Resource ${i + 1}`,
          value: `Value ${i + 1}`
        });
      }
    }

    return results;
  }

  /**
   * Process SPARQL results into document format
   */
  async processResults(results, fieldMappings = {}, template = 'documents') {
    mcpDebugger.debug('SPARQLIngestor: Processing SPARQL results', {
      resultCount: results.length,
      template,
      hasMappings: Object.keys(fieldMappings).length > 0
    });

    try {
      const documents = results.map((result, index) => {
        const document = this.mapFields(result, fieldMappings, template);

        return {
          id: this.generateDocumentId(template, index),
          source: 'sparql-ingestion',
          template,
          ...document,
          metadata: {
            ingested: new Date().toISOString(),
            template,
            originalResult: result,
            ...document.metadata
          }
        };
      });

      mcpDebugger.info('SPARQLIngestor: Results processed successfully', {
        documentsCreated: documents.length
      });

      return documents;

    } catch (error) {
      mcpDebugger.error('SPARQLIngestor: Result processing failed', error.message);
      throw error;
    }
  }

  /**
   * Map SPARQL result fields to document structure
   */
  mapFields(result, fieldMappings = {}, template = 'documents') {
    const defaultMappings = {
      documents: {
        title: ['title', 'name', 'label'],
        content: ['content', 'text', 'body'],
        uri: ['document', 'uri', 'resource'],
        created: ['created', 'dateCreated', 'timestamp']
      },
      articles: {
        title: ['title', 'headline', 'name'],
        content: ['content', 'articleBody', 'text'],
        uri: ['article', 'uri', 'resource'],
        author: ['author', 'creator', 'contributor']
      },
      concepts: {
        title: ['label', 'name', 'title'],
        content: ['description', 'comment', 'definition'],
        uri: ['concept', 'uri', 'resource']
      }
    };

    const mappings = { ...defaultMappings[template], ...fieldMappings };
    const document = {};

    // Map each field using priority order
    Object.entries(mappings).forEach(([docField, sourceFields]) => {
      for (const sourceField of sourceFields) {
        if (result[sourceField]) {
          document[docField] = result[sourceField];
          break;
        }
      }
    });

    // Ensure required fields have defaults
    document.title = document.title || 'Untitled Document';
    document.content = document.content || 'No content available';
    document.uri = document.uri || `http://example.org/generated/${Date.now()}`;

    return document;
  }

  /**
   * Create dry run preview
   */
  createDryRunPreview(query, endpoint, limit) {
    return {
      preview: true,
      endpoint,
      query,
      limit,
      estimatedResults: Math.min(limit, 5),
      message: `Dry run: Would execute SPARQL query against ${endpoint} with limit ${limit}`,
      queryPreview: query.substring(0, 300) + (query.length > 300 ? '...' : ''),
      mockDocuments: this.generateMockResults(query).slice(0, 3)
    };
  }

  /**
   * Generate document ID for ingested documents
   */
  generateDocumentId(template, index) {
    const timestamp = Date.now();
    return `sparql_${template}_${timestamp}_${index}`;
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return {
      templates: Object.keys(this.defaultTemplates),
      descriptions: {
        documents: 'Generic document ingestion with title and content',
        articles: 'Article-specific ingestion with author information',
        concepts: 'Concept/taxonomy ingestion with labels and descriptions'
      }
    };
  }

  /**
   * Validate SPARQL endpoint connectivity (mock)
   */
  async validateEndpoint(endpoint, auth = null) {
    mcpDebugger.debug('SPARQLIngestor: Validating endpoint', { endpoint, hasAuth: !!auth });

    try {
      // Mock endpoint validation
      if (!endpoint.startsWith('http')) {
        throw new Error('Endpoint must be a valid HTTP URL');
      }

      // Simulate connectivity check
      const isValid = !endpoint.includes('invalid');

      return {
        valid: isValid,
        endpoint,
        tested: new Date().toISOString(),
        message: isValid ? 'Endpoint connectivity confirmed (mock)' : 'Endpoint appears invalid'
      };

    } catch (error) {
      mcpDebugger.warn('SPARQLIngestor: Endpoint validation failed', error.message);
      return {
        valid: false,
        endpoint,
        error: error.message,
        tested: new Date().toISOString()
      };
    }
  }
}

export default new SPARQLIngestor();