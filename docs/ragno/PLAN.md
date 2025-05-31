# Ragno Implementation Plan

## 1. Graph Decomposition

**Goal:** Transform raw text into a heterogeneous knowledge graph with semantic units, entities, and relationships.

**Steps:**
- Implement `decomposeCorpus(textChunks)`:
  - Use an LLM to extract semantic units from text chunks.
  - For each unit:
    - Create a `ragno:Unit` node with content, summary, and provenance.
    - Extract entities, create/find `ragno:Entity` nodes, mark as entry points, and connect with `ragno:hasUnit`.
    - Extract relationships, create `ragno:Relationship` nodes, and connect source/target entities.
- Use SPARQL templates from `ragno-sparql.md` for entity lookup/creation and edge creation.

## 2. Graph Augmentation

### 2.1 Node Importance-Based Augmentation

**Goal:** Add attribute summaries to important entities.

**Steps:**
- Implement `augmentWithAttributes(G₁)`:
  - Select important entities (e.g., via degree/K-core).
  - Gather connected units and relationships.
  - Use LLM to generate attribute summaries.
  - Create `ragno:Attribute` nodes and link to entities with `ragno:hasAttribute`.

### 2.2 Community Detection

**Goal:** Cluster the graph and summarize communities.

**Steps:**
- Implement `aggregateCommunities(G₂)`:
  - Apply Leiden or similar community detection algorithm.
  - For each community:
    - Create `ragno:CommunityElement` nodes.
    - Summarize and link community members.
    - Optionally, generate high-level overviews as `ragno:Attribute` (Overview).

## 3. Graph Enrichment

**Goal:** Add additional retrievable nodes and semantic edges.

**Steps:**
- Insert `ragno:TextElement` nodes for original text.
- Generate and store vector embeddings for retrievable nodes.
- Build HNSW or similar semantic index for fast similarity search.
- Link nodes with semantic similarity edges.

## 4. Graph Search & Retrieval

**Goal:** Enable efficient, multi-modal retrieval.

**Steps:**
- Implement dual search:
  - Similarity-based (vector) search for `TextElement`, `Unit`, `Attribute`, `CommunityElement`.
  - Exact match for `Entity`, Overview.
- Implement shallow PPR (Personalized PageRank) to find cross nodes.
- Filter retrieval nodes by type and entry point status.
- Use SPARQL patterns for search and filtering.

## 5. Configuration & Reference

**Goal:** Ensure system is tunable and referenceable.

**Steps:**
- Use `ragno-config.json` for all algorithm and system parameters.
- Refer to `ragno-reference.md` for class/property mappings, algorithm flow, and implementation checklist.
- Test against `ragno-example.ttl` for validation.

## 6. Ontology & Namespace

**Goal:** Maintain ontology compliance and extensibility.

**Steps:**
- Use `namespace.md` and `README.md` for class/property definitions and design principles.
- Ensure all graph elements conform to SKOS and Ragno ontology.
- Track provenance using PROV-O where applicable.

---

**Next Steps:**
- Implement each algorithm as a module/function, referencing the above plan.
- Use provided SPARQL templates for all graph operations.
- Validate each step with the example RDF graph.
