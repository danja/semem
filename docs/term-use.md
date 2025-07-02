# RDF Terms Usage Analysis - Semem Codebase

## Overview

This document provides a comprehensive inventory of RDF terms used throughout the Semem semantic memory system. The codebase makes extensive use of standard RDF vocabularies while defining domain-specific extensions for knowledge management, navigation, and AI-enhanced semantic processing.

## Namespace Declarations and Prefixes

### Core RDF/OWL Namespaces
- **rdf:** `http://www.w3.org/1999/02/22-rdf-syntax-ns#`
- **rdfs:** `http://www.w3.org/2000/01/rdf-schema#`
- **owl:** `http://www.w3.org/2002/07/owl#`
- **xsd:** `http://www.w3.org/2001/XMLSchema#`

### Semantic Web Vocabularies
- **skos:** `http://www.w3.org/2004/02/skos/core#`
- **prov:** `http://www.w3.org/ns/prov#`
- **dcterms:** `http://purl.org/dc/terms/`
- **foaf:** `http://xmlns.com/foaf/0.1/`

### Domain-Specific Ontologies
- **ragno:** `http://purl.org/stuff/ragno/` (Core Ragno ontology)
- **zpt:** `http://purl.org/stuff/zpt/` (ZPT ontology for navigation)
- **semem:** `http://semem.hyperdata.it/` (Semem custom namespace)
- **mcp:** `http://purl.org/stuff/mcp/` (MCP extensions)

### Wikidata Vocabularies
- **wd:** `http://www.wikidata.org/entity/`
- **wdt:** `http://www.wikidata.org/prop/direct/`
- **wikibase:** `http://wikiba.se/ontology#`
- **schema:** `https://schema.org/`

### Configuration & Transmission
- **:** `http://purl.org/stuff/transmissions/` (Transmissions namespace in TTL files)

## RDF Terms by Namespace and Usage Context

### 1. RDF Core Terms (`rdf:`)
**Used in:** All RDF-related files across `src/`, `examples/`, `tests/`

**Terms:**
- `rdf:type` - Universal typing predicate
- `rdf:Property` - Property definitions
- `rdf:Statement` - Reification support
- `rdf:subject`, `rdf:predicate`, `rdf:object` - Statement components

**Usage Context:** Basic RDF operations, type declarations, reification

### 2. RDFS Terms (`rdfs:`)
**Used in:** Core Ragno classes, SPARQL queries, ZPT definitions

**Terms:**
- `rdfs:Class` - Class definitions
- `rdfs:Resource` - Base resource type
- `rdfs:Literal` - Literal values
- `rdfs:label` - Human-readable labels
- `rdfs:comment` - Descriptions
- `rdfs:subClassOf`, `rdfs:subPropertyOf` - Hierarchy
- `rdfs:domain`, `rdfs:range` - Property constraints

**Usage Context:** Class hierarchies, labeling, property definitions

### 3. SKOS Terms (`skos:`)
**Used in:** `src/ragno/core/NamespaceManager.js`, knowledge graph models

**Terms:**
- `skos:Concept` - Concept definitions
- `skos:ConceptScheme` - Concept schemes
- `skos:Collection` - Concept collections
- `skos:prefLabel` - Preferred labels (heavily used)
- `skos:altLabel` - Alternative labels
- `skos:definition` - Concept definitions
- `skos:broader`, `skos:narrower`, `skos:related` - Concept relationships
- `skos:inScheme` - Scheme membership
- `skos:member` - Collection membership
- `skos:scopeNote` - Scope notes

**Usage Context:** Concept management, labeling system, semantic hierarchies

### 4. PROV-O Terms (`prov:`)
**Used in:** `src/ragno/` models, knowledge provenance tracking

**Terms:**
- `prov:Entity` - Data entities
- `prov:Activity` - Activities/processes
- `prov:Agent` - Agents (users, systems)
- `prov:wasGeneratedBy` - Generation relationships
- `prov:wasAssociatedWith` - Agent associations
- `prov:wasDerivedFrom` - Derivation chains
- `prov:startedAtTime`, `prov:endedAtTime` - Temporal bounds
- `prov:wasInformedBy` - Activity relationships

**Usage Context:** Provenance tracking, temporal relationships, activity logging

### 5. Dublin Core Terms (`dcterms:`)
**Used in:** Knowledge models, metadata management

**Terms:**
- `dcterms:title` - Resource titles
- `dcterms:description` - Resource descriptions
- `dcterms:creator` - Creator information
- `dcterms:created`, `dcterms:modified` - Temporal metadata
- `dcterms:subject` - Subject classification
- `dcterms:language` - Language tags
- `dcterms:source` - Source references

**Usage Context:** Metadata management, documentation, temporal tracking

### 6. Ragno Ontology Terms (`ragno:`)
**Used in:** `src/ragno/`, `examples/`, SPARQL templates

#### Core Classes
- `ragno:Element` - Base class for all Ragno elements
- `ragno:Entity` - Named entities and concepts
- `ragno:Relationship` - First-class relationships
- `ragno:Unit` - Semantic units
- `ragno:Attribute` - Attributes of entities
- `ragno:CommunityElement` - Community insights
- `ragno:TextElement` - Text fragments
- `ragno:IndexElement` - Index structures
- `ragno:VectorEmbedding` - Vector embeddings
- `ragno:Corpus` - Document collections
- `ragno:Corpuscle` - Document chunks
- `ragno:Community` - Concept clusters

#### Core Properties
- `ragno:content` - Text content property
- `ragno:subType` - Element subtypes
- `ragno:hasSourceDocument` - Document references
- `ragno:isEntryPoint` - Entry point designation
- `ragno:hasSourceEntity`, `ragno:hasTargetEntity` - Relationship endpoints
- `ragno:hasUnit`, `ragno:hasAttribute` - Structural relationships
- `ragno:hasCommunityElement`, `ragno:hasTextElement` - Component relationships
- `ragno:inCommunity`, `ragno:connectsTo` - Network structure
- `ragno:hasWeight` - Weighted relationships
- `ragno:hasPPRScore`, `ragno:hasSimilarityScore` - Algorithm scores
- `ragno:hasElement`, `ragno:inCorpus`, `ragno:inCorpuscle` - Collection relationships

**Usage Context:** Core knowledge representation, graph structure, semantic relationships

### 7. ZPT Ontology Terms (`zpt:`)
**Used in:** `src/zpt/ontology/`, navigation components

#### Navigation Classes
- `zpt:NavigationView` - Navigation states
- `zpt:NavigationSession` - Session management
- `zpt:NavigationAgent` - Navigation agents
- `zpt:NavigationDimension` - Dimension abstractions

#### State Classes
- `zpt:ZoomState`, `zpt:PanState`, `zpt:TiltState` - Navigation states

#### Dimension Classes
- `zpt:ZoomLevel` - Zoom level abstractions
- `zpt:PanDomain` - Pan domain constraints
- `zpt:TiltProjection` - Tilt projection methods

#### Predefined Zoom Levels
- `zpt:EntityLevel`, `zpt:UnitLevel`, `zpt:TextLevel` - Granularity levels
- `zpt:CommunityLevel`, `zpt:CorpusLevel` - Aggregation levels

#### Projection Types
- `zpt:EmbeddingProjection`, `zpt:KeywordProjection` - Analysis methods
- `zpt:GraphProjection`, `zpt:TemporalProjection` - Organizational methods

#### Domain Types
- `zpt:TopicDomain`, `zpt:EntityDomain` - Content filtering
- `zpt:TemporalDomain`, `zpt:GeospatialDomain` - Constraint types

#### Navigation Properties
- `zpt:hasZoomState`, `zpt:hasPanState`, `zpt:hasTiltState` - State management
- `zpt:atZoomLevel`, `zpt:withPanDomain`, `zpt:withTiltProjection` - Configuration
- `zpt:selectedCorpuscle`, `zpt:candidateCorpuscle` - Selection state
- `zpt:optimizationScore`, `zpt:zoomRelevance` - Performance metrics
- `zpt:navigationTimestamp`, `zpt:sessionDuration` - Temporal tracking

**Usage Context:** Content navigation, multi-scale analysis, intelligent chunking

### 8. Wikidata Terms
**Used in:** `src/aux/wikidata/`, Wikidata integration

#### Wikibase Ontology (`wikibase:`)
- `wikibase:directClaim`, `wikibase:claim` - Property relationships
- `wikibase:statementProperty`, `wikibase:statementValue` - Statement structure
- `wikibase:rank`, `wikibase:badge` - Statement metadata

#### Common Wikidata Properties (`wdt:`)
- `wdt:P31` - instance of
- `wdt:P279` - subclass of
- `wdt:P361` - part of
- `wdt:P527` - has part
- `wdt:P131` - located in administrative territorial entity
- `wdt:P17` - country
- `wdt:P625` - coordinate location
- `wdt:P18` - image
- `wdt:P569`, `wdt:P570` - birth/death dates
- `wdt:P580`, `wdt:P582` - start/end times
- `wdt:P159` - headquarters location
- `wdt:P36` - capital
- `wdt:P50` - author
- `wdt:P577` - publication date
- `wdt:P136` - genre
- `wdt:P495` - country of origin

#### Schema.org Integration (`schema:`)
- `schema:about`, `schema:isPartOf` - Structural relationships
- `schema:name`, `schema:url` - Basic properties

**Usage Context:** External knowledge integration, entity linking, factual relationships

### 9. XSD Data Types (`xsd:`)
**Used in:** Type definitions, literal values across the codebase

**Terms:**
- `xsd:string` - String literals
- `xsd:integer` - Integer values
- `xsd:float`, `xsd:double` - Numeric values
- `xsd:boolean` - Boolean values
- `xsd:dateTime`, `xsd:date`, `xsd:time` - Temporal types
- `xsd:duration` - Time intervals

**Usage Context:** Data typing, literal value constraints

### 10. Custom Extensions
**Used in:** Custom property definitions, application-specific terms

#### MCP Extensions (`mcp:`)
- `mcp:frequency` - Concept frequency counts
- `mcp:cooccurrenceCount` - Relationship co-occurrence
- `mcp:accessCount` - Memory access tracking
- `mcp:decayFactor` - Memory decay modeling
- `mcp:memoryType` - Memory type classification
- `mcp:firstSeen`, `mcp:lastAccessed` - Temporal tracking
- `mcp:model`, `mcp:dimension` - Embedding metadata
- `mcp:vectorNorm` - Vector normalization
- `mcp:clusterCentroid` - Clustering information

#### Semem Extensions (`semem:`)
- `semem:KnowledgeUniverse` - Top-level knowledge space
- `semem:SemanticSpace` - Semantic organization
- `semem:KnowledgeDomain` - Domain classification
- `semem:SemanticCorpuscle` - Intelligent chunks
- `semem:SemanticBridge` - Cross-domain connections
- `semem:ConceptualGem` - Extracted concepts
- `semem:EmergentPattern` - Discovered patterns
- `semem:KnowledgeInsight` - AI-generated insights
- `semem:VisualizationConfig` - Rendering metadata

**Usage Context:** Application-specific extensions, custom analytics, UI integration

## File and Directory Distribution

### Core Implementation (`src/`)
- **src/ragno/core/NamespaceManager.js** - Central namespace management
- **src/ragno/core/RDFGraphManager.js** - RDF-Ext integration
- **src/zpt/ontology/ZPTNamespaces.js** - ZPT namespace definitions
- **src/stores/SPARQLStore.js** - SPARQL query templates
- **src/ragno/*.js** - Ragno class implementations with RDF

### SPARQL Queries (`src/`)
- **src/compose/sparql/templates/beerqa.js** - BeerQA domain queries
- **src/aux/wikidata/queries/*.sparql** - Wikidata integration queries
- **examples/clips/semem-inference-demo.sparql** - Comprehensive demo query

### Knowledge Models (`docs/`)
- **docs/postcraft/knowledge/artifacts_2025-06-06/ragno-rdf-model.ttl** - Complete RDF model
- **docs/postcraft/tt.ttl** - Configuration ontology

### Examples and Tests
- **examples/** - Demonstration of RDF usage patterns
- **tests/** - RDF validation and testing

### Configuration Files
- Various config.json files with RDF endpoint configurations

## Usage Patterns by Context

### 1. SPARQL Queries
- Extensive use of namespace prefixes in query templates
- Complex graph pattern matching with ragno: and zpt: terms
- Multi-graph queries combining different knowledge sources
- Vector similarity queries with embedding properties

### 2. RDF-Ext Code
- Factory pattern for creating RDF nodes and quads
- Namespace objects for property and class creation
- Dataset manipulation with proper RDF semantics
- Serialization to N-Triples and Turtle formats

### 3. Configuration and Metadata
- TTL files for system configuration using transmissions ontology
- Dublin Core metadata for document management
- PROV-O terms for activity and provenance tracking

### 4. Knowledge Integration
- Wikidata property mappings for external knowledge
- Schema.org terms for web compatibility
- SKOS concepts for semantic organization

## Summary

The Semem codebase demonstrates sophisticated use of RDF vocabularies across multiple domains:

- **Standard vocabularies**: Proper use of RDF, RDFS, SKOS, PROV-O, and Dublin Core
- **Domain-specific ontologies**: Custom Ragno and ZPT vocabularies for knowledge representation and navigation
- **External integration**: Wikidata and Schema.org terms for knowledge augmentation
- **Application extensions**: MCP and Semem custom terms for specialized functionality

This comprehensive RDF foundation enables semantic interoperability, knowledge integration, and sophisticated graph-based reasoning capabilities throughout the system.