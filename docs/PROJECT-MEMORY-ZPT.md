# Project Memory: ZPT Navigation for Semantic Memory Systems

## Context-Aware Memory That Adapts to Your Perspective

If you've worked with large language models, you've likely experienced the frustration of context windows that forget earlier parts of your conversation, or the challenge of helping an AI system understand which pieces of information are relevant to your current task. The Semem project addresses these limitations by implementing a persistent semantic memory system with a novel navigation paradigm called ZPT (Zoom-Pan-Tilt).

## What We've Built

At its core, Semem stores conversations, documents, and extracted concepts in a knowledge graph using RDF/SPARQL technology. But rather than requiring users to write complex graph queries, we've implemented an intuitive spatial metaphor for navigating this knowledge space.

The ZPT system works like adjusting a camera:

- **Zoom** controls the level of abstraction: from individual entities and concepts, up through semantic units, full documents, topic communities, and the entire corpus
- **Pan** filters the domain: temporal ranges, keywords, specific entities, or subject areas
- **Tilt** changes the view style: keyword-based summaries, embedding similarity clusters, graph relationships, or temporal sequences

## A Real Scenario: Research Assistant Workflow

Consider Sarah, a researcher studying the intersection of ADHD and creativity. She's been having ongoing conversations with an AI assistant about her work, importing research papers, and storing insights. Here's how the ZPT system adapts to her changing needs:

**Week 1 - Initial Research**
Sarah starts by telling the system about ADHD research papers she's reading. The system extracts concepts like "attention deficit," "hyperactivity," "executive function," and stores them with vector embeddings for semantic similarity.

**Week 2 - Discovering Patterns** 
When Sarah asks "What connections exist between ADHD traits and creative problem-solving?", she uses:
- **Zoom**: Entity level (individual concepts and their relationships)
- **Pan**: Keywords filtered to "ADHD, creativity, cognitive flexibility"
- **Tilt**: Graph view to see relationship networks

The system retrieves not just her recent conversations, but connects concepts from papers she read weeks ago, showing how "divergent thinking" relates to both "ADHD traits" and "creative output."

**Week 3 - Writing Phase**
Now writing a literature review, Sarah shifts her perspective:
- **Zoom**: Document level (full papers and substantial text chunks)
- **Pan**: Temporal filter for "papers published 2020-2024"
- **Tilt**: Temporal view to see how ideas evolved over time

The same underlying knowledge graph serves both use cases, but the navigation system surfaces different aspects based on her current context.

## Technical Implementation

The system uses several key components working together:

**Document Ingestion**: Research papers, blog posts, or other documents get chunked semantically and stored with embeddings. Concepts are extracted and linked in the knowledge graph.

**Conversation Memory**: Every interaction is stored with context about what was discussed, when, and how it relates to existing knowledge.

**Ragno Layer**: This component decomposes text into semantic units, entities, and relationships using RDF standards, making knowledge machine-readable and queryable.

**ZPT Navigation**: The spatial metaphor translates user intentions into precise graph queries without requiring technical expertise.

## Current Capabilities

Today, you can:
- Ingest documents from SPARQL endpoints or direct upload
- Have ongoing conversations that remember context across sessions
- Use the web-based workbench to chunk documents and ask questions
- Navigate your knowledge space using the ZPT controls
- Get contextually relevant answers that draw from your entire knowledge history

The system runs locally or in containerized deployments, with support for multiple LLM providers (Mistral, Claude, Ollama) and persistent storage in SPARQL triple stores.

## What Makes This Different

Unlike simple RAG (Retrieval-Augmented Generation) systems that match queries to document chunks, or conversational systems that maintain only recent context, this approach treats knowledge as a navigable space. You're not just searching—you're exploring from different vantage points.

The semantic web foundation means your knowledge connects not just through text similarity, but through meaningful relationships between concepts. When you ask about "attention mechanisms," the system understands connections to both "neural attention in AI models" and "cognitive attention in psychology" based on how you've used these concepts in context.

The result is an AI assistant that grows more useful over time, building a persistent understanding of your interests, expertise, and the conceptual frameworks you use to think about problems. Your conversations and documents become part of a queryable knowledge space that adapts its presentation to match your current perspective and goals.

---

## Implementation Details: ZPT-Based Memory for ChatGPT-Style Features

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