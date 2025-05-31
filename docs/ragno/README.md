# Ragno Ontology

Ragno is an ontology for describing heterogenous knowledge bases and their graph structures, designed for systematic, efficient and flexible retrieval and augmentation.

**Status: 2025-05-28 :** version 0.3.0. It should be adequate to begin testing in experimental deployment. Docs currently mostly AI-generated, manual intervention required.

*I had a rough draft of a model in mind, which I'd been just-in-time developing for [Semem](https://github.com/danja/semem) "Semantic Memory", but then stumbled on the paper [NodeRAG: Structuring Graph-based RAG with Heterogenous Nodes](https://arxiv.org/abs/2504.11544) which was a remarkably close fit, so I've integrated some ideas from there.*

- [Term Reference](namespace.md)
- [Definition](ragno.ttl) - Turtle RDF

![Ontology Diagram](ontology-diagram.pnd)

## Ragno Node.js Module Integration with Semem

### Overview
The Ragno algorithmic pipeline is implemented as ES modules in `src/ragno/` and is fully integrated with the Semem infrastructure. The pipeline leverages Semem's LLMHandler for language model tasks and SPARQLHelpers for RDF graph output.

### Key Modules
- `src/ragno/decomposeCorpus.js`: Main entry point for decomposing text into Ragno graph elements.
- `src/ragno/SemanticUnit.js`, `Entity.js`, `Relationship.js`: Data models for semantic units, entities, and relationships.

### Integration Points
- **LLMHandler:** Used for extracting semantic units and entities from text chunks. Pass an initialized LLMHandler instance to `decomposeCorpus`.
- **SPARQLHelpers:** Used to export the resulting graph elements to an RDF triple store.

### Example Usage
```js
import { decomposeCorpus, exportToRDF } from '../src/ragno/decomposeCorpus.js';
import LLMHandler from '../src/handlers/LLMHandler.js';
import { SPARQLHelpers } from '../src/utils/SPARQLHelpers.js';

// Initialize LLMHandler (see Semem docs for provider/config)
const llmHandler = new LLMHandler(llmProvider, 'gpt-3.5-turbo');

const textChunks = [
  { content: 'Hinton invented backprop.', source: 'doc1.txt' },
  { content: 'LeCun developed convolutional nets.', source: 'doc2.txt' }
];

const result = await decomposeCorpus(textChunks, llmHandler);
console.log('Units:', result.units);
console.log('Entities:', result.entities);

// Export to RDF triple store
const endpoint = 'http://localhost:3030/dataset/update';
const auth = SPARQLHelpers.createAuthHeader('user', 'password');
await exportToRDF(result, endpoint, auth);
```

### Extending the Pipeline
- Add additional Ragno pipeline steps (augmentation, enrichment, search) as new ES modules in `src/ragno/`.
- Use the same integration pattern: call LLMHandler for language tasks, SPARQLHelpers for RDF output.
- See `docs/ragno/PLAN.md` for the full implementation plan.

## Overview

Ragno extends SKOS (Simple Knowledge Organization System) to model heterogeneous knowledge graphs with various element types that support semantic retrieval and graph-based navigation.

Namespace : `<http://purl.org/stuff/ragno/>`

## Core Concepts

- **Element** - Base class for all knowledge graph components (subclass of skos:Concept)
- **Corpus** - A body of knowledge represented as a skos:Collection of Elements
- **Corpuscle** - A conceptual subset of a Corpus, also a skos:Collection

## Element Types

- **Entity** - Named entities serving as knowledge anchors
- **Relationship** - First-class connections between entities
- **Unit** - Semantic units representing independent concepts
- **Attribute** - Properties of important entities
- **TextElement** - Original text chunks with explicit content
- **CommunityElement** - Cluster within graph
- **IndexElement** - Search/retrieval-oriented structures (embeddings, keywords)

## Key Features

- Support for standard RDF/OWL tooling, graph algorithms, similarity techniques, LLM-friendly
- Scale-independent knowledge organization
- SKOS integration for concept organization
- PROV-O integration for provenance tracking


