# Ragno Implementation Progress Log

## 2025-05-31: Kickoff

- Began executing the Ragno implementation plan as per PLAN.md.
- Will proceed stepwise, documenting progress, design choices, and issues here.

---

## Step 1: Graph Decomposition

### Goal
Transform raw text into a heterogeneous knowledge graph with semantic units, entities, and relationships.

### Substeps
1. **Text chunk input:** Define input format for text chunks (e.g., JSON list of {content, source}).
2. **Semantic unit extraction:** Use LLM to extract semantic units from each chunk.
3. **Unit node creation:** For each semantic unit, create a `ragno:Unit` node with content, summary, and provenance.
4. **Entity extraction & linking:** Extract entities from units, create/find `ragno:Entity` nodes, mark as entry points, and connect with `ragno:hasUnit`.
5. **Relationship extraction & linking:** Extract relationships, create `ragno:Relationship` nodes, and connect source/target entities.
6. **SPARQL integration:** Use templates from ragno-sparql.md for entity lookup/creation and edge creation.

### Next Actions
- Draft data structures for text chunks, units, entities, and relationships.
- Outline the LLM prompt(s) and expected output structure for semantic unit/entity/relationship extraction.
- Prepare SPARQL queries for node and edge creation.
- Decide on initial implementation language and environment (Python, JS, etc.).

---

### 2025-05-31: Step 1 Progress - Initial Design

#### 1. Data Structures
- **Text Chunk:**
  ```json
  {
    "content": "The raw text...",
    "source": "document1.txt"
  }
  ```
- **Semantic Unit:**
  ```json
  {
    "text": "Summarized event or fact.",
    "summary": "Short summary.",
    "source": "document1.txt"
  }
  ```
- **Entity:**
  ```json
  {
    "name": "Entity Name",
    "isEntryPoint": true
  }
  ```
- **Relationship:**
  ```json
  {
    "description": "Relation between A and B.",
    "source": "Entity A",
    "target": "Entity B"
  }
  ```

#### 2. LLM Prompt Design
- **Semantic Unit Extraction:**
  > Extract independent, meaningful semantic units from the following text. For each, provide the unit text and a 1-sentence summary.
- **Entity Extraction:**
  > For each semantic unit, list named entities (people, places, concepts, etc.).
- **Relationship Extraction:**
  > For each semantic unit, identify explicit or implicit relationships between entities. Describe the relationship, source entity, and target entity.

#### 3. SPARQL Query Preparation
- **Entity Lookup/Creation:** (from ragno-sparql.md)
  ```sparql
  SELECT ?entity WHERE {
    ?entity a ragno:Entity ;
            skos:prefLabel ?label .
    FILTER(str(?label) = "Entity Name")
  }
  INSERT {
    ?newEntity a ragno:Entity ;
               skos:prefLabel "Entity Name" ;
               ragno:isEntryPoint true .
  } WHERE { ... }
  ```
- **Edge Creation:**
  ```sparql
  INSERT { ?entity ragno:hasUnit ?unit . }
  WHERE { ... }
  INSERT { ?relNode ragno:hasSourceEntity ?source ; ragno:hasTargetEntity ?target . }
  WHERE { ... }
  ```

#### 4. Language/Environment Recommendation
- **Python** is recommended for rapid prototyping, LLM integration, and RDF/SPARQL operations (using rdflib, SPARQLWrapper, etc.).
- **Alternatives:** JavaScript (for integration with web stack), but Python has richer ecosystem for LLM and graph processing.

---

(Next: begin prototyping the decomposition pipeline in Python and documenting code artifacts.)
