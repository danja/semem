# ZPT-Based Memory Implementation for ChatGPT-Style Features

## Overview
This document outlines how ChatGPT's memory features could be implemented using Semem's ZPT (Zoom-Pan-Tilt) paradigm, with particular focus on using Pan for project-specific context management. All memories are permanently preserved in the knowledge graph - "forgetting" is achieved through navigation away from irrelevant content rather than deletion.

## Core Principle: Navigation Over Deletion
In the ZPT paradigm, memories are never deleted but rather move in and out of the current navigation view. This aligns with human memory where "forgotten" information can often be recovered with the right retrieval cues.

## Memory Types Mapping to ZPT

### 1. Cross-Conversation Memory
**Implementation via ZPT:**
- **Pan**: Create a `zpt:UserDomain` extending `zpt:PanDomain` to scope memories to individual users
- **Zoom**: Store at `zpt:EntityLevel` for user facts, `zpt:UnitLevel` for conversation summaries
- **Tilt**: Use `zpt:MemoryProjection` for recency/importance-based retrieval

**Semem Operations:**
```javascript
// Store user preference (permanent)
tell({ 
  content: "User prefers TypeScript over JavaScript",
  type: "concept",
  metadata: { domain: "user:simon", persistent: true }
})

// Set user-specific pan (brings into view)
pan({ domains: ["user:simon"], persistent: true })
```

### 2. Project-Specific Memory
**Implementation via ZPT:**
- **Pan**: Define `zpt:ProjectDomain` instances for each project context
- **Zoom**: Use `zpt:CommunityLevel` for project overview, `zpt:TextLevel` for detailed docs
- **Tilt**: Apply `zpt:TopicProjection` for thematic organization within projects

**Semem Operations:**
```javascript
// Create project domain
augment({
  target: "Project: Semem Development",
  operation: "create_domain",
  options: {
    domainType: "project",
    domainId: "project:semem",
    metadata: {
      description: "Semantic memory toolkit development",
      technologies: ["Node.js", "RDF", "SPARQL"],
      startDate: "2024-01-01"
    }
  }
})

// Switch to project context (other projects fade from view)
pan({ 
  domains: ["project:semem"],
  keywords: ["memory", "graph", "semantic"]
})

// Store project-specific knowledge (permanent)
tell({
  content: "Use RDF-Ext for graph operations in this project",
  type: "concept",
  metadata: { 
    domain: "project:semem",
    category: "technical_decision"
  }
})
```

### 3. Session Memory (Working Memory)
**Implementation via ZPT:**
- **Pan**: Temporary `zpt:SessionDomain` with recency-based relevance scoring
- **Zoom**: Dynamic adjustment based on conversation depth
- **Tilt**: `zpt:TemporalProjection` for chronological context

**Existing Semem Feature:**
Session cache provides immediate access while permanent storage ensures persistence:
```javascript
// Automatic dual storage: session cache + permanent store
this.sessionCache.add({
  content: processedContent,
  embedding: embedding,
  concepts: concepts,
  timestamp: Date.now()
})
// Simultaneously stored in SPARQL/persistent store
```

### 4. Explicit User Instructions
**Implementation via ZPT:**
- **Pan**: Special `zpt:InstructionDomain` with high relevance weight
- **Zoom**: Store at `zpt:EntityLevel` as named instructions
- **Tilt**: Use `zpt:KeywordProjection` for command matching

**Semem Operations:**
```javascript
// Store explicit instruction (permanent, high relevance)
tell({
  content: "Always format code with 2-space indentation",
  type: "concept",
  metadata: {
    domain: "instructions",
    relevanceWeight: 1.0,  // Maximum relevance
    scope: "global"
  }
})
```

## Advanced Pan Domain Structure

### Hierarchical Project Domains
```turtle
# Define project hierarchy in RDF
project:semem a zpt:ProjectDomain ;
    rdfs:label "Semem Project" ;
    zpt:hasSubDomain project:semem-ragno ;
    zpt:hasSubDomain project:semem-zpt ;
    zpt:projectOwner "user:danny" ;
    zpt:relevanceDecay "0.95"^^xsd:float .  # Slow decay for active project

project:archived-2023 a zpt:ProjectDomain ;
    rdfs:label "Archived 2023 Projects" ;
    zpt:relevanceDecay "0.5"^^xsd:float .  # Faster decay for old projects
```

### Multi-Domain Navigation
```javascript
// Combine user and project context
pan({
  domains: ["user:simon", "project:semem"],
  operator: "intersection",  // Only memories relevant to both
  relevanceThreshold: 0.1   // Hide memories below threshold
})

// Switch context completely (previous context fades)
pan({
  domains: ["project:new-venture"],
  operator: "exclusive",  // Focus only on new project
  fadeOutPrevious: true   // Gracefully reduce relevance of previous domains
})
```

## Memory "Forgetting" Through Navigation

### Relevance Decay Without Deletion
```javascript
// Memory relevance calculation
function calculateMemoryRelevance(memory, currentState) {
  const factors = {
    domainMatch: computeDomainOverlap(memory.domains, currentState.panDomains),
    temporalDecay: Math.exp(-timeSinceAccess(memory) / decayConstant),
    semanticDistance: cosineSimilarity(memory.embedding, currentState.focusEmbedding),
    explicitImportance: memory.metadata.importance || 0.5
  };
  
  // Memories never deleted, just become less relevant
  return Math.max(
    0.01,  // Minimum relevance (never zero)
    factors.domainMatch * 0.4 +
    factors.temporalDecay * 0.2 +
    factors.semanticDistance * 0.3 +
    factors.explicitImportance * 0.1
  );
}
```

### Context Switching (Not Deletion)
```javascript
// "Forget" old project by panning away
async function switchProjectContext(fromProject, toProject) {
  // Old memories remain in store but fade from view
  await pan({
    domains: [toProject],
    fadeOut: [fromProject],  // Reduces relevance weight
    transition: "smooth"      // Gradual relevance adjustment
  });
  
  // Can always pan back to recover "forgotten" context
  // await pan({ domains: [fromProject] })  // Memories return!
}
```

## Memory Persistence and Recovery

### Permanent Storage with Dynamic Visibility
```javascript
// All memories stored permanently
const memoryStorage = {
  store: async (memory) => {
    // Always persist to SPARQL
    await sparqlStore.store({
      ...memory,
      uri: generatePermanentURI(memory),
      created: Date.now(),
      lastAccessed: Date.now()
    });
  },
  
  retrieve: async (query, zptState) => {
    // Fetch ALL memories, then filter by relevance
    const allMemories = await sparqlStore.query(query);
    
    // Apply ZPT navigation to determine visibility
    return allMemories
      .map(m => ({
        ...m,
        relevance: calculateMemoryRelevance(m, zptState)
      }))
      .filter(m => m.relevance > zptState.relevanceThreshold)
      .sort((a, b) => b.relevance - a.relevance);
  }
};
```

### Memory Recovery Patterns
```javascript
// Recover "forgotten" memories by adjusting navigation
async function recoverMemories(searchCriteria) {
  // Temporarily zoom out to see more
  const originalZoom = await getCurrentZoom();
  await zoom({ level: "corpus" });  // Widest view
  
  // Pan across all domains
  await pan({ 
    domains: ["*"],  // All domains
    temporalScope: "all_time",
    relevanceThreshold: 0.0  // Show everything
  });
  
  // Search with expanded context
  const recoveredMemories = await ask({
    question: searchCriteria,
    includeArchived: true
  });
  
  // Optionally restore original view
  await zoom({ level: originalZoom });
  
  return recoveredMemories;
}
```

## Implementation Workflow

```javascript
// 1. Initialize session with full memory access
const session = await initializeSession({
  userId: "simon",
  memoryMode: "persistent",  // All memories permanent
  defaultRelevanceThreshold: 0.3
});

// 2. Set initial navigation state
await zoom({ level: "entity" });
await pan({ 
  domains: [`user:${session.userId}`],
  recencyBias: 0.2  // Slight preference for recent memories
});

// 3. Process with context-aware memory
const response = await ask({
  question: userQuery,
  memoryStrategy: "navigational",  // Use ZPT state for relevance
  includePeripheral: false  // Only highly relevant memories
});

// 4. Store new memories (always permanent)
await tell({
  content: extractMemorableContent(response),
  type: "concept",
  metadata: {
    domain: currentPanState.domains,
    timestamp: Date.now(),
    accessCount: 1
  }
});

// 5. Adjust view based on conversation flow
if (topicShift) {
  await pan({
    domains: newRelevantDomains,
    fadeOut: lessRelevantDomains,
    transition: "contextual"
  });
}
```

## Relevance-Based Memory Access

### Dynamic Relevance Scoring
```javascript
class MemoryNavigator {
  constructor() {
    this.relevanceWeights = {
      domainMatch: 0.35,
      temporal: 0.20,
      semantic: 0.30,
      frequency: 0.15
    };
  }
  
  async getVisibleMemories(query, zptState) {
    const allMemories = await this.fetchFromStore();
    
    return allMemories.map(memory => {
      // Calculate multi-factor relevance
      const relevance = this.calculateRelevance(memory, query, zptState);
      
      // Boost for explicit instructions
      if (memory.domain === "instructions") {
        relevance *= 1.5;
      }
      
      // Decay for archived projects
      if (memory.domain?.startsWith("project:archived")) {
        relevance *= 0.3;
      }
      
      return { ...memory, relevance };
    })
    .filter(m => m.relevance > zptState.threshold)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, zptState.maxMemories);
  }
}
```

### Navigation-Based "Forgetting"
```javascript
// Simulate forgetting by changing navigation focus
async function fadeMemoryContext(domainToFade) {
  // Memories aren't deleted, just become less accessible
  await pan({
    reduce: [domainToFade],  // Reduce relevance weight
    boostFactor: 0.1  // Make 10x less relevant
  });
  
  // Can be recovered later
  // await pan({ boost: [domainToFade], boostFactor: 10.0 })
}

// Time-based relevance decay (automatic "forgetting")
async function applyTemporalDecay() {
  const decayRules = {
    session: { halfLife: "1h" },
    daily: { halfLife: "7d" },
    project: { halfLife: "30d" },
    permanent: { halfLife: "365d" }
  };
  
  // Update relevance weights based on time, not delete
  await augment({
    operation: "update_relevance",
    options: { decayRules }
  });
}
```

## Privacy Through Navigation

### Domain-based Visibility
```javascript
// Private memories exist but are navigationally inaccessible
const privateMemory = {
  content: "Personal note",
  domain: "user:simon:private",
  visibility: "self"  // Only visible when explicitly panned to
};

// Public project memory
const projectMemory = {
  content: "Team decision",
  domain: "project:semem",
  visibility: "team"  // Visible to all team members
};

// Switch between private and public views
async function togglePrivateMode(userId, enable) {
  if (enable) {
    await pan({ 
      domains: [`user:${userId}:private`],
      exclusive: true  // Hide all non-private
    });
  } else {
    await pan({
      domains: [`user:${userId}`, "project:*"],
      exclude: [`user:${userId}:private`]
    });
  }
}
```

## Future Enhancements

1. **Adaptive Relevance Learning**: Learn optimal relevance weights per user based on access patterns
2. **Contextual Memory Clustering**: Automatically group related memories into navigable communities
3. **Memory Consolidation**: Create higher-zoom summaries while preserving original details
4. **Temporal Navigation**: "Rewind" to previous ZPT states to recover historical context
5. **Collaborative Memory Spaces**: Shared project memories with individual relevance tuning

## Key Advantages of Navigation-Based Memory

- **No Data Loss**: All memories preserved, enabling perfect recall with right navigation
- **Natural Forgetting**: Mimics human memory's relevance-based accessibility
- **Privacy by Design**: Visibility controlled through navigation, not access controls
- **Scalability**: Can handle unlimited memories through intelligent filtering
- **Auditability**: Complete history preserved for compliance and debugging