# Enhancement-Context Integration Plan

## Executive Summary

Create a hybrid knowledge system that intelligently merges enhancement services (Wikidata, Wikipedia, HyDE) with personal context from chunked documents, using ZPT navigation filters to guide and focus the integration process.

## Current Architecture Analysis

### Problems Identified
1. **Enhancement Bypass Issue**: Successful enhancements completely skip local context search
2. **ZPT Isolation**: Sophisticated zoom/pan/tilt system exists but isn't integrated with Ask operations  
3. **Enhancement Wastage**: External knowledge from APIs isn't stored for future reuse
4. **Context Competition**: External and personal knowledge compete rather than complement

### Architecture Strengths  
1. **EnhancementCoordinator**: Already has context weighting and concurrent processing
2. **ZPT Navigation**: Rich filtering capabilities (entity/unit/text scope, temporal/topic/geographic filters)
3. **SPARQLStore**: Flexible storage for different content types (ragno:TextElement, ragno:Unit)
4. **Chunking System**: Successfully breaks documents into searchable semantic units

## Implementation Plan

### Phase 1: Hybrid Context Architecture

#### 1.1 Enhanced Ask Orchestration
**Objective**: Replace either/or logic with intelligent parallel processing

**Implementation**:
- Modify `SimpleVerbsService.ask()` to run enhancement and local search concurrently
- Create `HybridContextManager` to merge results intelligently
- Use ZPT state to guide both search paths

**Files to modify**:
- `mcp/tools/simple-verbs.js`: Main Ask method
- Create: `src/services/context/HybridContextManager.js`

#### 1.2 ZPT-Guided Search Integration
**Objective**: Use zoom/pan/tilt state to focus enhancement queries and local searches

**Implementation**:
- Extract current ZPT state from session
- Apply zoom level to determine search scope (entity vs community vs corpus level)
- Use pan filters (topic, temporal, entity) to constrain both enhancement queries and local search
- Apply tilt preferences to format results appropriately

**Enhancement Query Mapping**:
- **Zoom=entity**: Focus on specific entity descriptions
- **Zoom=unit**: Retrieve related document excerpts  
- **Zoom=community**: Get broader topic context
- **Pan=topic**: Filter enhancement queries by subject domain
- **Pan=temporal**: Add time constraints to Wikidata queries
- **Tilt=graph**: Emphasize relationships in results

### Phase 2: Enhancement Storage and Reuse

#### 2.1 Enhancement Caching System
**Objective**: Store enhancement results as permanent, searchable knowledge

**Implementation**:
- Create new SPARQL entity types: `ragno:WikidataElement`, `ragno:WikipediaElement`, `ragno:HyDEElement`
- Store enhancement results with embeddings for future semantic search
- Link enhancement entities to original queries and personal context
- Implement TTL-based cache invalidation

**SPARQL Schema Extensions**:
```sparql
<enhancementUri> a ragno:WikidataElement ;
    ragno:content "Enhanced content..." ;
    ragno:sourceQuery "Original question" ;
    ragno:enhancementSource "wikidata" ;
    ragno:hasEmbedding <embeddingUri> ;
    ragno:relatedToLocal <personalContextUri> ;
    dcterms:created "timestamp" ;
    semem:cacheTTL "7 days" .
```

#### 2.2 Progressive Enhancement
**Objective**: Build enhancement knowledge incrementally over time

**Implementation**:
- Detect knowledge gaps in personal context
- Request targeted enhancements for specific missing information
- Build cross-references between personal and enhanced knowledge
- Create enhancement recommendation system

### Phase 3: Intelligent Context Merging

#### 3.1 Context Weighting Algorithm
**Objective**: Balance personal vs external knowledge based on query characteristics

**Weighting Factors**:
- **Personal Relevance**: Higher weight when personal context directly addresses query
- **Temporal Currency**: Recent personal experiences weighted higher for current topics
- **Enhancement Authority**: Wikidata/Wikipedia weighted higher for factual questions
- **ZPT Context**: Pan/zoom settings influence weighting (entity-level favors personal, corpus-level favors general knowledge)

#### 3.2 Synthesis Response Generation
**Objective**: Create unified responses that seamlessly blend personal and external knowledge

**Implementation**:
- Template-based response generation distinguishing sources
- Personal insights highlighted with attribution
- External facts integrated contextually
- Cross-references created between different knowledge types

**Response Format**:
```
Based on your personal experience with ADHD and authoritative sources:

**Your Experience**: You describe late diagnosis at 59, masking behaviors, and family history...

**Medical Context** (from Wikidata): ADHD affects 5-7% of children worldwide and is characterized by...

**Connection**: Your experience of "masking" aligns with research on compensatory behaviors in adult ADHD...
```

### Phase 4: ZPT Navigation Integration

#### 4.1 Navigation-Guided Enhancement
**Objective**: Use ZPT navigation to explore knowledge space systematically

**Implementation**:
- `zoom out`: Request broader context from enhancement services
- `zoom in`: Focus on specific personal experiences 
- `pan temporal`: Explore historical development of topics
- `tilt graph`: Emphasize relationship discovery between personal and external entities

#### 4.2 Dynamic Knowledge Exploration
**Objective**: Enable iterative knowledge discovery through navigation

**Implementation**:
- Save enhancement results at each ZPT navigation step
- Build navigation history with enhancement breadcrumbs
- Enable knowledge graph traversal combining personal and external entities

### Phase 5: Performance and Optimization

#### 5.1 Caching and Performance
- In-memory cache for recent enhancement results
- SPARQL query optimization for hybrid searches
- Concurrent processing of enhancement and local searches
- Smart prefetching based on ZPT navigation patterns

#### 5.2 Quality and Relevance
- Confidence scoring for enhancement vs personal context relevance
- User feedback integration to improve weighting algorithms
- A/B testing framework for different merging strategies

## Implementation Timeline

### Week 1-2: Foundation
- Create HybridContextManager
- Modify Ask operation for parallel processing
- Basic enhancement storage schema

### Week 3-4: ZPT Integration  
- ZPT state integration with Ask operations
- Navigation-guided enhancement queries
- Basic context weighting

### Week 5-6: Storage and Reuse
- Enhancement caching implementation
- Cross-referencing system
- Progressive enhancement logic

### Week 7-8: Advanced Features
- Synthesis response generation
- Quality scoring and feedback
- Performance optimization

## Success Metrics

1. **Context Coverage**: Percentage of queries that successfully merge personal and external context
2. **Response Quality**: User satisfaction scores for hybrid vs single-source responses  
3. **Enhancement Reuse**: Cache hit rates for stored enhancement results
4. **Navigation Effectiveness**: ZPT-guided queries show improved relevance scores
5. **Performance**: Response time maintains under 5 seconds for hybrid queries

## Risk Mitigation

1. **Complexity Management**: Incremental rollout with fallback to current behavior
2. **Performance Impact**: Concurrent processing and intelligent caching
3. **Quality Control**: Conservative merging with clear source attribution
4. **Storage Growth**: TTL-based cleanup and compression strategies

---

## Progress Reports

### Implementation Progress - Day 1

**Status**: Starting Phase 1 - Foundation Architecture

**Goals for this session**:
1. Create HybridContextManager base class
2. Modify SimpleVerbsService.ask() for parallel processing
3. Implement basic context merging logic
4. Test hybrid approach with existing ADHD content

**Next Steps**:
- Begin with HybridContextManager implementation
- Integrate with Ask operation
- Add basic ZPT state awareness