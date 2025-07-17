# ZPT Ontology Integration Plan - RDF-First Approach

## Overview

This document outlines the integration of the formal ZPT (Zoom-Pan-Tilt) ontology (`http://purl.org/stuff/zpt/`) with the existing Semem ZPT implementation. The approach uses RDF-Ext and SPARQL queries exclusively, replacing string-based navigation parameters with proper RDF semantics.

## Problem Statement

The current Semem implementation uses an extensive ZPT framework with string literals for navigation parameters:
- `zoom: 'entity'` instead of formal URI `zpt:EntityLevel`
- No RDF storage of navigation states and history
- Missing semantic interoperability with other knowledge navigation tools
- Limited provenance tracking and session management

Meanwhile, a complete formal ZPT ontology exists with:
- 46 classes including `zpt:NavigationView`, `zpt:ZoomLevel`, `zpt:PanDomain` 
- 30+ properties linking states and configurations
- 5 predefined zoom levels mapping to Ragno classes
- Integration with SKOS, PROV-O, and OWL standards

## Integration Strategy

### Phase 1: RDF Foundation Layer

**Objective**: Establish RDF-Ext infrastructure for ZPT ontology integration

**Components**:
- `src/zpt/ontology/ZPTDataFactory.js` - RDF-Ext dataset management and factory methods
- `src/zpt/ontology/ZPTNamespaces.js` - Namespace definitions using RDF-Ext
- `src/zpt/ontology/ZPTQueries.js` - SPARQL query builders for common patterns

**Technical Implementation**:
```javascript
import { DataFactory } from 'rdf-ext';
const { namedNode, quad, literal } = DataFactory;

// Create navigation view with formal semantics
const navView = namedNode('http://example.org/nav/view1');
const hasZoomState = namedNode('http://purl.org/stuff/zpt/hasZoomState');
const zoomState = namedNode('http://example.org/nav/zoom1');
const atZoomLevel = namedNode('http://purl.org/stuff/zpt/atZoomLevel');
const entityLevel = namedNode('http://purl.org/stuff/zpt/EntityLevel');
```

### Phase 2: Parameter Transformation

**Objective**: Replace string-based parameters with ZPT ontology URIs

**Files to Modify**:
- `mcp/tools/zpt-tools.js` - Transform string parameters to URIs
- `src/zpt/parameters/ParameterValidator.js` - Validate against ontology terms
- `src/zpt/parameters/ParameterNormalizer.js` - Convert to RDF representation

**Transformation Examples**:

*Before (string-based)*:
```javascript
const params = {
  zoom: 'entity',
  pan: { domains: ['ai'] },
  tilt: 'embedding'
};
```

*After (URI-based)*:
```javascript
import { ZPT } from '../ontology/ZPTNamespaces.js';
const params = {
  zoom: ZPT.EntityLevel,
  pan: { domains: [namedNode('http://example.org/domain/ai')] },
  tilt: ZPT.EmbeddingProjection
};
```

### Phase 3: Navigation State Storage

**Objective**: Store navigation sessions as RDF using SPARQL INSERT operations

**Files to Modify**:
- `src/zpt/selection/CorpuscleSelector.js` - Create and store navigation views
- `examples/beerqa/BeerEmbedding.js` - Add ZPT metadata during embedding generation

**RDF Storage Pattern**:
```sparql
PREFIX zpt: <http://purl.org/stuff/zpt/>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
  GRAPH <http://purl.org/stuff/navigation> {
    <nav:view1> a zpt:NavigationView ;
      zpt:hasZoomState [
        a zpt:ZoomState ;
        zpt:atZoomLevel zpt:UnitLevel
      ] ;
      zpt:hasPanState [
        a zpt:PanState ;
        zpt:withPanDomain <domain:ai>
      ] ;
      zpt:hasTiltState [
        a zpt:TiltState ;
        zpt:withTiltProjection zpt:EmbeddingProjection
      ] ;
      zpt:answersQuery "machine learning applications" ;
      zpt:selectedCorpuscle <ragno:corpuscle123> ;
      zpt:navigationTimestamp "2025-06-28T10:00:00Z"^^xsd:dateTime ;
      prov:wasGeneratedBy <session:user123> .
  }
}
```

### Phase 4: Enhanced Navigation Queries

**Objective**: Leverage SPARQL's power for sophisticated navigation patterns

**Query Categories**:

1. **Navigation View Discovery**:
```sparql
SELECT ?view ?query ?selectedCorpuscles WHERE {
  ?view a zpt:NavigationView ;
    zpt:hasZoomState [ zpt:atZoomLevel zpt:EntityLevel ] ;
    zpt:answersQuery ?query ;
    zpt:selectedCorpuscle ?selectedCorpuscles .
}
```

2. **Cross-Zoom Navigation**:
```sparql
SELECT ?entityView ?unitView ?sharedCorpuscle WHERE {
  ?entityView zpt:hasZoomState [ zpt:atZoomLevel zpt:EntityLevel ] ;
              zpt:selectedCorpuscle ?sharedCorpuscle .
  ?unitView zpt:hasZoomState [ zpt:atZoomLevel zpt:UnitLevel ] ;
            zpt:selectedCorpuscle ?sharedCorpuscle .
}
```

3. **Navigation History Analysis**:
```sparql
SELECT ?session ?view ?timestamp WHERE {
  ?view a zpt:NavigationView ;
    zpt:partOfSession ?session ;
    zpt:navigationTimestamp ?timestamp .
} ORDER BY ?session ?timestamp
```

4. **Semantic Pan Domain Filtering**:
```sparql
SELECT ?corpuscle ?content WHERE {
  ?view a zpt:NavigationView ;
    zpt:hasPanState [ zpt:withPanDomain ?domain ] ;
    zpt:selectedCorpuscle ?corpuscle .
  ?corpuscle ragno:content ?content .
  ?domain rdfs:label ?domainLabel .
  FILTER(CONTAINS(LCASE(?domainLabel), "artificial intelligence"))
}
```

## Technical Architecture

### RDF Data Model Structure

The integration creates a layered RDF model:

```turtle
# Navigation Session (top level)
ex:session1 a zpt:NavigationSession ;
  prov:startedAtTime "2025-06-28T10:00:00Z"^^xsd:dateTime ;
  zpt:sessionDuration "PT15M"^^xsd:duration .

# Navigation View (specific query)
ex:nav1 a zpt:NavigationView ;
  zpt:partOfSession ex:session1 ;
  zpt:hasZoomState ex:zoom1 ;
  zpt:hasPanState ex:pan1 ;
  zpt:hasTiltState ex:tilt1 ;
  zpt:answersQuery "machine learning applications" ;
  zpt:selectedCorpuscle ragno:corpuscle123, ragno:corpuscle456 ;
  zpt:candidateCorpuscle ragno:corpuscle789 ;
  zpt:optimizationScore 0.89 ;
  zpt:navigationTimestamp "2025-06-28T10:05:00Z"^^xsd:dateTime .

# State Objects (configuration)
ex:zoom1 a zpt:ZoomState ;
  zpt:atZoomLevel zpt:UnitLevel .

ex:pan1 a zpt:PanState ;
  zpt:withPanDomain ex:aiDomain .

ex:tilt1 a zpt:TiltState ;
  zpt:withTiltProjection zpt:EmbeddingProjection .

# Link to Ragno Corpus Data
ragno:corpuscle123 a ragno:Corpuscle ;
  ragno:content "Detailed content about machine learning applications..." ;
  ragno:hasEmbedding "[0.1, 0.2, 0.3, ...]" ;
  zpt:optimizationScore 0.92 ;
  zpt:zoomRelevance 0.95 ;
  zpt:panCoverage 0.88 ;
  zpt:tiltEffectiveness 0.93 .
```

### SPARQL Query Integration Points

1. **Navigation Parameter Resolution**:
   - Convert string parameters to URIs using SPARQL CONSTRUCT
   - Validate parameter combinations against ontology constraints

2. **Corpuscle Selection Enhancement**:
   - Use ZPT optimization properties for ranking
   - Apply semantic pan domain filtering
   - Leverage zoom level mappings to Ragno classes

3. **Navigation History and Provenance**:
   - Track navigation sessions with PROV-O
   - Enable navigation replay and analysis
   - Support user behavior analytics

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create RDF-Ext infrastructure files
- [ ] Define ZPT namespace constants and factory methods
- [ ] Build basic SPARQL query templates
- [ ] Test RDF dataset creation and manipulation

### Phase 2: Parameter Integration (Week 2)
- [ ] Replace string literals with URIs in MCP tools
- [ ] Update parameter validation to use ontology terms
- [ ] Modify selection logic to work with RDF parameters
- [ ] Test parameter transformation and validation

### Phase 3: Storage Implementation (Week 3)
- [ ] Implement navigation view creation and storage
- [ ] Add SPARQL INSERT operations for navigation states
- [ ] Create provenance tracking with PROV-O
- [ ] Test RDF storage and retrieval

### Phase 4: Query Enhancement (Week 4)
- [ ] Build sophisticated navigation SPARQL patterns
- [ ] Implement cross-zoom and historical navigation queries
- [ ] Create semantic pan domain filtering
- [ ] Performance optimization for complex queries

### Phase 5: Examples and Documentation (Week 5)
- [ ] Create comprehensive ZPT+Ragno integration examples
- [ ] Document SPARQL query patterns and best practices
- [ ] Build demo applications showing RDF navigation benefits
- [ ] Performance benchmarking and optimization

## Benefits of RDF-First Approach

### 1. Formal Semantics
- Navigation states have precise, machine-readable meaning
- Interoperability with other semantic web tools
- Standards compliance with SKOS, PROV-O, and OWL

### 2. Enhanced Query Capabilities
- Complex navigation patterns through SPARQL
- Temporal analysis of navigation sessions
- Cross-session pattern discovery
- Community detection via navigation clustering

### 3. Provenance and Auditability
- Complete audit trail of navigation decisions
- User behavior analysis and personalization
- Navigation effectiveness measurement
- Reproducible navigation workflows

### 4. Extensibility
- Easy addition of domain-specific zoom levels
- Custom pan domains for specialized knowledge areas
- Integration with external vocabularies and ontologies
- Plugin architecture for navigation algorithms

### 5. Performance Optimization
- SPARQL engine optimization for navigation queries
- Caching of frequently accessed navigation patterns
- Efficient indexing of navigation metadata
- Parallel processing of navigation operations

## Integration with Existing Semem Features

### Memory Management
- Navigation views stored alongside memory items
- Cross-referencing between memories and navigation contexts
- Navigation-aware memory retrieval and ranking

### Embedding Generation
- ZPT metadata attached to embedding processes
- Navigation context influences embedding selection
- Historical navigation patterns improve embedding relevance

### SPARQL Store Integration
- Navigation graphs stored in dedicated named graphs
- Seamless querying across Ragno and ZPT data
- Unified configuration and authentication

### MCP Tool Enhancement
- Rich RDF responses from navigation tools
- Semantic parameter validation and suggestion
- Navigation analytics and optimization recommendations

## Migration Strategy

### Backward Compatibility
During development, maintain dual operation:
- Accept both string and URI parameters
- Return both legacy and RDF-enhanced responses
- Gradual migration of internal operations to RDF

### Testing Strategy
- Unit tests for RDF data creation and manipulation
- Integration tests for SPARQL query execution
- Performance tests comparing string vs. RDF approaches
- End-to-end tests for complete navigation workflows

### Deployment Approach
- Feature flags for RDF functionality
- Gradual rollout to different user groups
- Performance monitoring and optimization
- Rollback capability for any issues

This plan provides a comprehensive roadmap for integrating the ZPT ontology with Semem while leveraging the full power of RDF and SPARQL for knowledge navigation.