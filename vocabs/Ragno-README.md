# Ragno Ontology

Ragno is an ontology for describing heterogenous knowledge bases and their graph structures, designed for systematic, efficient and flexible retrieval and augmentation.

**Status: 2025-05-28 :** version 0.3.0. It should be adequate to begin testing in experimental deployment. Docs currently mostly AI-generated, manual intervention required.

*I had a rough draft of a model in mind, which I'd been just-in-time developing for [Semem](https://github.com/danja/semem) "Semantic Memory", but then stumbled on the paper [NodeRAG: Structuring Graph-based RAG with Heterogenous Nodes](https://arxiv.org/abs/2504.11544) which was a remarkably close fit, so I've integrated some ideas from there.*

- [Term Reference](namespace.md)
- [Definition](ragno.ttl) - Turtle RDF

![Ontology Diagram](ontology-diagram.png)

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


