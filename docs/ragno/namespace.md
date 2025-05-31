# Ragno Namespace Documentation

**Namespace URI:** `http://purl.org/stuff/ragno/`  
**Preferred Prefix:** `ragno`  
**Version:** 0.3.0  
**Creator:** Danny Ayers <https://danny.ayers.name>  
**Repository:** <http://github.com/danja/ragno>

## Overview

Ragno is a SKOS-based ontology for describing knowledge bases and their graph-based organization. It provides vocabulary for modeling heterogeneous knowledge graphs that combine structured entities, relationships, and textual content with advanced retrieval mechanisms.

## Design Principles

1. **SKOS Foundation** - All elements are skos:Concept instances, enabling standard knowledge organization
2. **Heterogeneous Nodes** - Different element types serve distinct roles in knowledge representation
3. **Collection-Based Organization** - Knowledge is organized through skos:Collection structures
4. **Provenance Awareness** - Integration with PROV-O for tracking element origins
5. **Retrieval Support** - Built-in support for embeddings and graph algorithms

## Class Hierarchy

### Core Classes

#### ragno:Element
- **URI:** `http://purl.org/stuff/ragno/Element`
- **Type:** owl:Class
- **Superclass:** skos:Concept
- **Description:** Base class for all elements in Ragno knowledge graphs
- **SKOS Integration:** Inherits labeling and notation capabilities

#### ragno:Corpus
- **URI:** `http://purl.org/stuff/ragno/Corpus`
- **Type:** owl:Class
- **Superclass:** skos:Collection
- **Description:** A body of knowledge containing ragno:Element instances
- **Usage:** Top-level container for knowledge bases

#### ragno:Corpuscle
- **URI:** `http://purl.org/stuff/ragno/Corpuscle`
- **Type:** owl:Class
- **Superclass:** skos:Collection
- **Description:** A conceptual subset of a Corpus
- **Usage:** Thematic or structural groupings within a corpus

### Element Type Classes

#### ragno:Entity
- **URI:** `http://purl.org/stuff/ragno/Entity`
- **Superclass:** ragno:Element
- **Description:** Named entities serving as knowledge anchors
- **Role:** Entry points for graph traversal

#### ragno:Relationship
- **URI:** `http://purl.org/stuff/ragno/Relationship`
- **Superclass:** ragno:Element
- **Description:** First-class relationship nodes between entities
- **Properties:** hasSourceEntity, hasTargetEntity

#### ragno:Unit
- **URI:** `http://purl.org/stuff/ragno/Unit`
- **Superclass:** ragno:Element
- **Description:** Semantic units representing independent events
- **PROV Integration:** Can track derivation from source content

#### ragno:Attribute
- **URI:** `http://purl.org/stuff/ragno/Attribute`
- **Superclass:** ragno:Element
- **Description:** Properties of important entities
- **Relationship:** Connected via hasAttribute

#### ragno:TextElement
- **URI:** `http://purl.org/stuff/ragno/TextElement`
- **Superclass:** ragno:Element
- **Description:** Original text chunks with explicit content
- **Property:** Uses ragno:content for text storage

#### ragno:CommunityElement
- **URI:** `http://purl.org/stuff/ragno/CommunityElement`
- **Superclass:** ragno:Element
- **Description:** Insights summarizing graph communities
- **SKOS Integration:** Can use skos:scopeNote for summaries

#### ragno:IndexElement
- **URI:** `http://purl.org/stuff/ragno/IndexElement`
- **Superclass:** ragno:Element
- **Description:** Search and retrieval structures
- **Examples:** Vector embeddings, keyword sets, inverted indices

### Supporting Classes

#### ragno:Community
- **URI:** `http://purl.org/stuff/ragno/Community`
- **Superclass:** skos:Collection
- **Description:** Groups of related elements identified by clustering

## Properties

### Content Properties

#### ragno:content
- **Domain:** ragno:Element
- **Range:** xsd:string
- **Description:** Textual content of an element

#### ragno:subType
- **Domain:** ragno:Element
- **Range:** skos:Concept
- **Description:** Domain-specific typing for elements
- **Usage:** Allows fine-grained categorization within element types

### Structural Properties

#### ragno:hasSourceEntity
- **Domain:** ragno:Relationship
- **Range:** ragno:Entity
- **Superproperties:** skos:semanticRelation

#### ragno:hasTargetEntity
- **Domain:** ragno:Relationship
- **Range:** ragno:Entity
- **Superproperties:** skos:semanticRelation

#### ragno:hasUnit
- **Domain:** ragno:Entity
- **Range:** ragno:Unit
- **Superproperties:** skos:related

#### ragno:hasAttribute
- **Domain:** ragno:Entity
- **Range:** ragno:Attribute
- **Superproperties:** skos:related

#### ragno:hasCommunityElement
- **Domain:** ragno:Community
- **Range:** ragno:CommunityElement
- **Superproperties:** skos:member

#### ragno:hasTextElement
- **Domain:** ragno:Unit
- **Range:** ragno:TextElement
- **Superproperties:** prov:used

### Graph Properties

#### ragno:connectsTo
- **Domain:** ragno:Element
- **Range:** ragno:Element
- **Superproperties:** skos:semanticRelation
- **Description:** General connection between elements

#### ragno:inCommunity
- **Domain:** ragno:Element
- **Range:** ragno:Community
- **Superproperties:** skos:inScheme

### Algorithm Properties

#### ragno:hasPPRScore
- **Domain:** ragno:Element
- **Range:** xsd:float
- **Description:** Personalized PageRank score

#### ragno:hasSimilarityScore
- **Domain:** ragno:Element
- **Range:** xsd:float
- **Description:** Vector similarity score

#### ragno:hasWeight
- **Domain:** owl:ObjectProperty
- **Range:** xsd:float
- **Description:** Edge weight for graph algorithms

### Entry Properties

#### ragno:isEntryPoint
- **Domain:** ragno:Element
- **Range:** xsd:boolean
- **Description:** Marks elements suitable for search entry

### Corpus Properties

#### ragno:hasSourceDocument
- **Domain:** ragno:Element
- **Range:** prov:Entity
- **Superproperties:** prov:wasDerivedFrom

## SKOS Integration

Ragno leverages SKOS extensively:

- **Concept Modeling:** All elements are skos:Concept instances
- **Labeling:** Uses skos:prefLabel, skos:altLabel for naming
- **Collections:** Corpus, Corpuscle, and Community extend skos:Collection
- **Relations:** Builds on skos:semanticRelation for connections
- **Organization:** Uses skos:inScheme for community membership

## PROV-O Integration

Provenance tracking through:

- **prov:wasDerivedFrom:** Tracks element origins
- **prov:used:** Links to source materials
- **prov:wasGeneratedBy:** Can track generation processes

## Usage Patterns

### Creating a Corpus
```turtle
ex:myCorpus a ragno:Corpus ;
    skos:prefLabel "My Knowledge Base"@en ;
    skos:member ex:entity1, ex:unit1 .
```

### Defining Element Subtypes
```turtle
ex:PersonEntity a ragno:Entity ;
    ragno:subType ex:Person ;
    skos:prefLabel "John Doe"@en .
```

### Creating Index Elements
```turtle
ex:keywordIndex a ragno:IndexElement ;
    ragno:subType ex:KeywordIndex ;
    ragno:content "knowledge, graph, retrieval" ;
    skos:prefLabel "Keyword Index"@en .
```