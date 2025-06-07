# Ragno Implementation Roadmap

## Phase 1: Foundation Classes (Week 1-2)

### 1.1 Create RagnoSPARQLStore
```javascript
// src/stores/RagnoSPARQLStore.js
export default class RagnoSPARQLStore extends SPARQLStore {
    constructor(endpoint, options = {}) {
        super(endpoint, options);
        this.ragnoGraph = options.ragnoGraph || 'http://example.org/semem/graph';
        this.corpusUri = options.corpusUri || 'http://example.org/semem/corpus';
    }
    
    async createConcept(label, aliases = []) {
        const conceptUri = this.generateConceptUri(label);
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            
            INSERT DATA {
                GRAPH <${this.ragnoGraph}> {
                    <${conceptUri}> a ragno:Entity ;
                        skos:prefLabel "${label}"@en ;
                        ragno:subType <http://example.org/semem/ExtractedConcept> ;
                        ragno:isEntryPoint true ;
                        ragno:inCorpus <${this.corpusUri}> .
                }
            }
        `;
        return this._executeSparqlUpdate(query);
    }
}
```

### 1.2 Create ConceptGraphManager
```javascript
// src/graph/ConceptGraphManager.js
export default class ConceptGraphManager {
    constructor(sparqlStore, graphologyGraph) {
        this.sparql = sparqlStore;
        this.memory = graphologyGraph;
    }
    
    async syncConceptToSPARQL(concept) {
        const exists = await this.sparql.conceptExists(concept);
        if (!exists) {
            await this.sparql.createConcept(concept);
        }
        await this.sparql.incrementConceptFrequency(concept);
    }
}
```

### Milestone 1.1: Basic CRUD Tests Pass
- ✅ Create concept entities
- ✅ Create relationships
- ✅ Query concepts by label
- ✅ Update weights

## Phase 2: Bidirectional Sync (Week 3-4)

### 2.1 Implement SyncQueue
```javascript
// src/graph/SyncQueue.js
export default class SyncQueue {
    constructor(batchSize = 100, flushInterval = 5000) {
        this.queue = [];
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.setupAutoFlush();
    }
    
    async addOperation(operation) {
        this.queue.push(operation);
        if (this.queue.length >= this.batchSize) {
            await this.flush();
        }
    }
    
    async flush() {
        const batch = this.queue.splice(0, this.batchSize);
        return this.executeBatch(batch);
    }
}
```

### 2.2 Extend MemoryStore
```javascript
// src/stores/MemoryStore.js modifications
export default class MemoryStore {
    setGraphSync(graphManager) {
        this.graphSync = graphManager;
    }
    
    async updateGraph(concepts) {
        // Existing in-memory update
        super.updateGraph(concepts);
        
        // Queue SPARQL sync
        if (this.graphSync) {
            for (const concept of concepts) {
                await this.graphSync.queueConceptUpdate(concept);
            }
            await this.graphSync.queueRelationshipUpdates(concepts);
        }
    }
}
```

### Milestone 2.1: Sync Tests Pass
- ✅ Memory → SPARQL sync
- ✅ SPARQL → Memory load
- ✅ Batch operations work
- ✅ No data loss on restart

## Phase 3: Advanced Queries (Week 5-6)

### 3.1 Graph Algorithm Queries
```javascript
// src/graph/RagnoQueryBuilder.js
export default class RagnoQueryBuilder {
    static findConceptCommunities(limit = 10) {
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            
            SELECT ?concept ?community ?weight WHERE {
                ?concept ragno:inCommunity ?community .
                ?community ragno:hasCommunityElement ?element .
                ?element ragno:hasWeight ?weight .
            }
            ORDER BY DESC(?weight)
            LIMIT ${limit}
        `;
    }
    
    static personalizedPageRank(seedConcepts, alpha = 0.85) {
        // Complex SPARQL implementation
    }
}
```

### 3.2 Similarity Search Integration
```javascript
// src/search/HybridSearch.js
export default class HybridSearch {
    async search(query, options = {}) {
        const [vectorResults, graphResults] = await Promise.all([
            this.vectorSearch(query, options),
            this.graphSearch(query, options)
        ]);
        
        return this.mergeResults(vectorResults, graphResults);
    }
}
```

### Milestone 3.1: Query Performance
- ✅ <100ms concept lookup
- ✅ <500ms community detection
- ✅ <200ms path finding
- ✅ Efficient pagination

## Phase 4: Migration & Deployment (Week 7-8)

### 4.1 Migration Script
```javascript
// scripts/migrate-to-ragno.js
async function migrateToRagno() {
    const oldStore = new JSONStore('memory.json');
    const newStore = new RagnoSPARQLStore(endpoint);
    
    const [shortTerm, longTerm] = await oldStore.loadHistory();
    
    // Create corpus
    await newStore.createCorpus();
    
    // Batch process interactions
    for (const batch of chunks(shortTerm, 100)) {
        await newStore.batchCreateUnits(batch);
    }
    
    // Extract and create concept graph
    const conceptMap = extractConceptGraph(shortTerm);
    await newStore.batchCreateConcepts(conceptMap);
}
```

### 4.2 Compatibility Layer
```javascript
// src/stores/HybridStore.js
export default class HybridStore extends BaseStore {
    constructor(ragnoStore, fallbackStore) {
        this.primary = ragnoStore;
        this.fallback = fallbackStore;
    }
    
    async loadHistory() {
        try {
            return await this.primary.loadHistory();
        } catch (error) {
            console.warn('Falling back to legacy store:', error);
            return await this.fallback.loadHistory();
        }
    }
}
```

### Milestone 4.1: Production Ready
- ✅ Zero-downtime migration
- ✅ Rollback capability
- ✅ Performance benchmarks met
- ✅ Documentation complete

## Testing Strategy

### Unit Tests
```javascript
// tests/unit/RagnoSPARQLStore.test.js
describe('RagnoSPARQLStore', () => {
    it('creates concept with proper RDF types', async () => {
        const store = new RagnoSPARQLStore(endpoint);
        await store.createConcept('AI');
        
        const result = await store.queryConcept('AI');
        expect(result.type).toBe('ragno:Entity');
        expect(result.label).toBe('AI');
    });
});
```

### Integration Tests
```javascript
// tests/integration/concept-sync.test.js
describe('Concept Graph Sync', () => {
    it('syncs bidirectionally without data loss', async () => {
        // Test full cycle: Memory → SPARQL → Memory
    });
});
```

## Monitoring & Metrics

### Key Metrics
- Sync queue size
- SPARQL query latency
- Concept graph size
- Memory/SPARQL consistency

### Health Checks
```javascript
// src/health/RagnoHealth.js
export default class RagnoHealth {
    async check() {
        return {
            sparqlConnection: await this.checkSPARQL(),
            graphIntegrity: await this.checkGraphIntegrity(),
            syncQueueSize: this.syncQueue.size,
            lastSyncTime: this.lastSync
        };
    }
}
```

## Rollout Plan

### Stage 1: Alpha (Internal Testing)
- Deploy to development environment
- Run parallel with existing system
- Monitor for data inconsistencies

### Stage 2: Beta (Limited Production)
- Enable for 10% of users
- A/B test performance
- Gather feedback

### Stage 3: General Availability
- Full production deployment
- Deprecate legacy storage
- Archive migration code