/**
 * Generate consistent test data for various test scenarios
 */

export class TestDataFactory {
  static createInteraction(overrides = {}) {
    return {
      id: `interaction-${Date.now()}`,
      prompt: 'Test prompt',
      response: 'Test response',
      timestamp: new Date().toISOString(),
      concepts: ['test', 'concepts'],
      embedding: Array(1536).fill(0).map(() => Math.random()),
      metadata: {
        source: 'test',
        confidence: 0.85
      },
      ...overrides
    };
  }

  static createMemoryItem(overrides = {}) {
    return {
      id: `memory-${Date.now()}`,
      content: 'Test memory content',
      domain: 'user',
      domainId: 'test-user',
      importance: 0.7,
      timestamp: new Date().toISOString(),
      embedding: Array(1536).fill(0).map(() => Math.random()),
      metadata: {
        tags: ['test'],
        category: 'general'
      },
      ...overrides
    };
  }

  static createEntity(overrides = {}) {
    return {
      uri: `http://example.org/entity/${Date.now()}`,
      type: 'http://purl.org/stuff/ragno/Entity',
      prefLabel: 'Test Entity',
      content: 'Test entity content',
      isEntryPoint: false,
      subType: 'concept',
      confidence: 0.8,
      embedding: Array(1536).fill(0).map(() => Math.random()),
      ...overrides
    };
  }

  static createSemanticUnit(overrides = {}) {
    return {
      uri: `http://example.org/unit/${Date.now()}`,
      type: 'http://purl.org/stuff/ragno/Unit',
      content: 'Test semantic unit content',
      chunkIndex: 0,
      source: 'test-document',
      embedding: Array(1536).fill(0).map(() => Math.random()),
      entities: [],
      ...overrides
    };
  }

  static createRelationship(overrides = {}) {
    return {
      uri: `http://example.org/relationship/${Date.now()}`,
      type: 'http://purl.org/stuff/ragno/Relationship',
      subject: 'http://example.org/entity/1',
      predicate: 'http://example.org/relation/related',
      object: 'http://example.org/entity/2',
      confidence: 0.75,
      ...overrides
    };
  }

  static createDocument(overrides = {}) {
    return {
      id: `doc-${Date.now()}`,
      title: 'Test Document',
      content: 'This is test document content for testing purposes.',
      type: 'text/plain',
      source: 'test',
      metadata: {
        author: 'Test Author',
        created: new Date().toISOString()
      },
      chunks: [],
      ...overrides
    };
  }

  static createTextChunk(overrides = {}) {
    return {
      id: `chunk-${Date.now()}`,
      content: 'Test chunk content',
      index: 0,
      startOffset: 0,
      endOffset: 100,
      documentId: 'test-doc',
      embedding: Array(1536).fill(0).map(() => Math.random()),
      ...overrides
    };
  }

  static createHyDEHypothesis(overrides = {}) {
    return {
      id: `hypothesis-${Date.now()}`,
      originalQuery: 'test query',
      hypothesis: 'Test hypothesis content',
      confidence: 0.8,
      reasoning: 'Test reasoning',
      embedding: Array(1536).fill(0).map(() => Math.random()),
      metadata: {
        model: 'test-model',
        temperature: 0.7
      },
      ...overrides
    };
  }

  static createSPARQLQuery(overrides = {}) {
    return {
      id: `query-${Date.now()}`,
      query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10',
      type: 'SELECT',
      variables: ['s', 'p', 'o'],
      prefixes: {
        'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
      },
      ...overrides
    };
  }

  static createAPIRequest(overrides = {}) {
    return {
      method: 'POST',
      url: '/api/test',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        query: 'test query'
      },
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }

  static createAPIResponse(overrides = {}) {
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        success: true,
        data: 'test data'
      },
      timestamp: new Date().toISOString(),
      duration: 100,
      ...overrides
    };
  }

  static createBatch(factory, count = 5, overrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      factory({ ...overrides, id: `${overrides.id || 'item'}-${index}` })
    );
  }

  static createLargeDataset(size = 1000) {
    return {
      interactions: this.createBatch(this.createInteraction, size),
      entities: this.createBatch(this.createEntity, Math.floor(size / 2)),
      units: this.createBatch(this.createSemanticUnit, Math.floor(size / 3)),
      relationships: this.createBatch(this.createRelationship, Math.floor(size / 4))
    };
  }
}

export default TestDataFactory;