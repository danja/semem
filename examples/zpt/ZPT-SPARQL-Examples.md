# ZPT + Ragno SPARQL Query Examples

This document provides concrete examples of SPARQL queries that demonstrate the integration between the ZPT (Zoom-Pan-Tilt) ontology and Ragno corpus data.

## Query Categories

1. [Navigation View Operations](#navigation-view-operations)
2. [Corpuscle Selection with ZPT Parameters](#corpuscle-selection-with-zpt-parameters)
3. [Cross-Zoom Navigation Analysis](#cross-zoom-navigation-analysis)
4. [Navigation History and Provenance](#navigation-history-and-provenance)
5. [Optimization and Analytics](#optimization-and-analytics)
6. [Advanced Semantic Queries](#advanced-semantic-queries)

## Standard Prefixes

All queries assume these SPARQL prefixes:

```sparql
PREFIX zpt: <http://purl.org/stuff/zpt/>
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
```

## Navigation View Operations

### Create a Navigation View

```sparql
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
        # Main navigation view
        <http://example.org/nav/view1> a zpt:NavigationView ;
            zpt:answersQuery "machine learning applications in brewing" ;
            zpt:navigationTimestamp "2025-06-28T10:30:00Z"^^xsd:dateTime ;
            zpt:partOfSession <http://example.org/nav/session1> ;
            zpt:hasZoomState <http://example.org/nav/view1_zoom> ;
            zpt:hasPanState <http://example.org/nav/view1_pan> ;
            zpt:hasTiltState <http://example.org/nav/view1_tilt> ;
            zpt:selectedCorpuscle <http://purl.org/stuff/beerqa/corpuscle/brewing_001> ,
                                 <http://purl.org/stuff/beerqa/corpuscle/ml_002> .

        # Zoom state - Unit level for contextual information
        <http://example.org/nav/view1_zoom> a zpt:ZoomState ;
            zpt:atZoomLevel zpt:UnitLevel .

        # Pan state - Technology and AI domains
        <http://example.org/nav/view1_pan> a zpt:PanState ;
            zpt:withPanDomain <http://example.org/domains/technology> ,
                             <http://example.org/domains/ai> .

        # Tilt state - Embedding-based similarity
        <http://example.org/nav/view1_tilt> a zpt:TiltState ;
            zpt:withTiltProjection zpt:EmbeddingProjection .
    }
}
```

### Query Navigation Views by Parameters

```sparql
SELECT ?view ?query ?timestamp ?optimizationScore WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel zpt:UnitLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection zpt:EmbeddingProjection ] .
        
        OPTIONAL { ?view zpt:optimizationScore ?optimizationScore }
    }
}
ORDER BY DESC(?timestamp)
LIMIT 10
```

## Corpuscle Selection with ZPT Parameters

### Find Corpuscles for Entity-Level Navigation

```sparql
SELECT ?corpuscle ?content ?embedding ?entityLabel WHERE {
    # Navigation context: Entity zoom with keyword tilt
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:hasZoomState [ zpt:atZoomLevel zpt:EntityLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection zpt:KeywordProjection ] ;
              zpt:selectedCorpuscle ?corpuscle .
    }
    
    # Corpuscle data from BeerQA graph
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
        OPTIONAL { ?corpuscle ragno:hasEmbedding ?embedding }
    }
    
    # Extract entity information
    OPTIONAL {
        ?corpuscle ragno:hasEntity ?entity .
        ?entity rdfs:label ?entityLabel .
    }
}
LIMIT 20
```

### Community-Level Navigation with Domain Filtering

```sparql
SELECT ?corpuscle ?content ?communityLabel ?domainMatch WHERE {
    # Navigation context: Community zoom with specific pan domains
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:hasZoomState [ zpt:atZoomLevel zpt:CommunityLevel ] ;
              zpt:hasPanState [ zpt:withPanDomain ?domain ] ;
              zpt:selectedCorpuscle ?corpuscle .
        
        # Get domain information
        ?domain rdfs:label ?domainMatch .
        FILTER(CONTAINS(LCASE(?domainMatch), "brewing") || 
               CONTAINS(LCASE(?domainMatch), "quality"))
    }
    
    # Corpuscle and community data
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content ;
                   ragno:belongsToommunity ?community .
        ?community rdfs:label ?communityLabel .
    }
}
ORDER BY ?domainMatch ?communityLabel
```

### Embedding-Based Similarity Navigation

```sparql
SELECT ?corpuscle ?content ?similarity ?zoomRelevance WHERE {
    # Navigation context: Any zoom with embedding projection
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:hasTiltState [ zpt:withTiltProjection zpt:EmbeddingProjection ] ;
              zpt:selectedCorpuscle ?corpuscle .
        
        # Include optimization scores
        OPTIONAL { 
            ?corpuscle zpt:zoomRelevance ?zoomRelevance ;
                      zpt:tiltEffectiveness ?similarity .
        }
    }
    
    # Require embeddings for similarity-based navigation
    {
        GRAPH <http://purl.org/stuff/beerqa> {
            ?corpuscle ragno:content ?content ;
                      ragno:hasEmbedding ?embedding .
            FILTER(BOUND(?embedding))
        }
    } UNION {
        GRAPH <http://purl.org/stuff/ragno> {
            ?corpuscle ragno:content ?content ;
                      ragno:hasEmbedding ?embedding .
            FILTER(BOUND(?embedding))
        }
    }
}
ORDER BY DESC(?similarity) DESC(?zoomRelevance)
LIMIT 15
```

## Cross-Zoom Navigation Analysis

### Find Corpuscles Accessed at Multiple Zoom Levels

```sparql
SELECT ?corpuscle ?content 
       (COUNT(DISTINCT ?zoomLevel) AS ?zoomCount)
       (GROUP_CONCAT(DISTINCT ?zoomLevel; separator=",") AS ?zoomLevels)
       (AVG(?optimizationScore) AS ?avgScore) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view zpt:selectedCorpuscle ?corpuscle ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
        
        OPTIONAL { ?corpuscle zpt:optimizationScore ?optimizationScore }
    }
    
    # Get corpuscle content
    {
        GRAPH <http://purl.org/stuff/beerqa> {
            ?corpuscle ragno:content ?content .
        }
    } UNION {
        GRAPH <http://purl.org/stuff/ragno> {
            ?corpuscle ragno:content ?content .
        }
    }
}
GROUP BY ?corpuscle ?content
HAVING(?zoomCount > 1)
ORDER BY DESC(?zoomCount) DESC(?avgScore)
```

### Zoom Level Transition Patterns

```sparql
SELECT ?fromZoom ?toZoom ?transitionCount ?avgDuration WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        # Find sequential navigation views
        ?view1 zpt:hasZoomState [ zpt:atZoomLevel ?fromZoom ] ;
               zpt:navigationTimestamp ?time1 ;
               zpt:partOfSession ?session .
        
        ?view2 zpt:hasZoomState [ zpt:atZoomLevel ?toZoom ] ;
               zpt:navigationTimestamp ?time2 ;
               zpt:partOfSession ?session ;
               zpt:previousView ?view1 .
        
        FILTER(?time2 > ?time1)
        FILTER(?fromZoom != ?toZoom)
        
        BIND((?time2 - ?time1) AS ?duration)
    }
}
GROUP BY ?fromZoom ?toZoom
HAVING(COUNT(*) AS ?transitionCount)
ORDER BY DESC(?transitionCount)
```

## Navigation History and Provenance

### Session Analysis with User Behavior

```sparql
SELECT ?session ?agent ?duration ?viewCount ?uniqueCorpuscles 
       (MIN(?timestamp) AS ?startTime)
       (MAX(?timestamp) AS ?endTime) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?session a zpt:NavigationSession ;
                prov:wasAssociatedWith ?agent .
        
        OPTIONAL { ?session zpt:sessionDuration ?duration }
        
        ?view zpt:partOfSession ?session ;
              zpt:navigationTimestamp ?timestamp .
              
        OPTIONAL { ?view zpt:selectedCorpuscle ?corpuscle }
    }
}
GROUP BY ?session ?agent ?duration
HAVING(COUNT(DISTINCT ?view) AS ?viewCount)
HAVING(COUNT(DISTINCT ?corpuscle) AS ?uniqueCorpuscles)
ORDER BY DESC(?viewCount)
```

### Navigation Path Reconstruction

```sparql
SELECT ?view ?previousView ?query ?zoomLevel ?timestamp WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:partOfSession <http://example.org/nav/session1> .
              
        OPTIONAL { ?view zpt:previousView ?previousView }
    }
}
ORDER BY ?timestamp
```

### Provenance Chain with Agent Actions

```sparql
SELECT ?view ?agent ?activity ?timestamp ?derivedFrom WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:navigationTimestamp ?timestamp ;
              prov:wasGeneratedBy ?activity ;
              prov:wasAssociatedWith ?agent .
              
        OPTIONAL { ?view prov:wasDerivedFrom ?derivedFrom }
    }
}
ORDER BY ?agent ?timestamp
```

## Optimization and Analytics

### Best Performing Tilt Projections

```sparql
SELECT ?tiltProjection 
       (AVG(?optimizationScore) AS ?avgScore)
       (COUNT(?view) AS ?usageCount)
       (AVG(?tiltEffectiveness) AS ?avgEffectiveness) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view zpt:hasTiltState [ zpt:withTiltProjection ?tiltProjection ] ;
              zpt:selectedCorpuscle ?corpuscle .
        
        ?corpuscle zpt:optimizationScore ?optimizationScore ;
                  zpt:tiltEffectiveness ?tiltEffectiveness .
    }
}
GROUP BY ?tiltProjection
ORDER BY DESC(?avgScore)
```

### Zoom Level Effectiveness Analysis

```sparql
SELECT ?zoomLevel 
       (COUNT(?view) AS ?usageCount)
       (AVG(?zoomRelevance) AS ?avgRelevance)
       (COUNT(DISTINCT ?corpuscle) AS ?uniqueCorpuscles) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:selectedCorpuscle ?corpuscle .
        
        OPTIONAL { ?corpuscle zpt:zoomRelevance ?zoomRelevance }
    }
}
GROUP BY ?zoomLevel
ORDER BY DESC(?avgRelevance)
```

### Pan Domain Coverage Analysis

```sparql
SELECT ?panDomain ?domainLabel
       (COUNT(?view) AS ?usageCount)
       (AVG(?panCoverage) AS ?avgCoverage)
       (COUNT(DISTINCT ?query) AS ?uniqueQueries) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view zpt:hasPanState [ zpt:withPanDomain ?panDomain ] ;
              zpt:answersQuery ?query ;
              zpt:selectedCorpuscle ?corpuscle .
        
        OPTIONAL { ?panDomain rdfs:label ?domainLabel }
        OPTIONAL { ?corpuscle zpt:panCoverage ?panCoverage }
    }
}
GROUP BY ?panDomain ?domainLabel
ORDER BY DESC(?usageCount)
```

## Advanced Semantic Queries

### Find Similar Navigation Patterns

```sparql
SELECT ?view1 ?view2 ?query1 ?query2 ?sharedCorpuscles WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        # Two different views with similar configurations
        ?view1 a zpt:NavigationView ;
               zpt:answersQuery ?query1 ;
               zpt:hasZoomState [ zpt:atZoomLevel ?zoom ] ;
               zpt:hasTiltState [ zpt:withTiltProjection ?tilt ] .
        
        ?view2 a zpt:NavigationView ;
               zpt:answersQuery ?query2 ;
               zpt:hasZoomState [ zpt:atZoomLevel ?zoom ] ;
               zpt:hasTiltState [ zpt:withTiltProjection ?tilt ] .
        
        FILTER(?view1 != ?view2)
        FILTER(?query1 != ?query2)
        
        # Count shared corpuscles
        {
            SELECT ?view1 ?view2 (COUNT(?sharedCorpuscle) AS ?sharedCorpuscles) WHERE {
                ?view1 zpt:selectedCorpuscle ?sharedCorpuscle .
                ?view2 zpt:selectedCorpuscle ?sharedCorpuscle .
            }
            GROUP BY ?view1 ?view2
            HAVING(?sharedCorpuscles > 2)
        }
    }
}
ORDER BY DESC(?sharedCorpuscles)
```

### Temporal Navigation Patterns

```sparql
SELECT ?timeWindow 
       (COUNT(?view) AS ?navigationCount)
       (AVG(?optimizationScore) AS ?avgScore) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:selectedCorpuscle ?corpuscle .
        
        OPTIONAL { ?corpuscle zpt:optimizationScore ?optimizationScore }
        
        # Create time windows (e.g., hourly)
        BIND(CONCAT(
            STR(YEAR(?timestamp)), "-",
            STR(MONTH(?timestamp)), "-", 
            STR(DAY(?timestamp)), "T",
            STR(HOURS(?timestamp)), ":00"
        ) AS ?timeWindow)
    }
}
GROUP BY ?timeWindow
ORDER BY ?timeWindow
```

### Knowledge Graph Connectivity via Navigation

```sparql
SELECT ?entity1 ?entity2 ?connectionStrength WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        # Entities connected through navigation sessions
        ?view1 zpt:selectedCorpuscle ?corpuscle1 ;
               zpt:partOfSession ?session .
        ?view2 zpt:selectedCorpuscle ?corpuscle2 ;
               zpt:partOfSession ?session .
        
        FILTER(?corpuscle1 != ?corpuscle2)
    }
    
    # Get entities from corpuscles
    {
        GRAPH <http://purl.org/stuff/beerqa> {
            ?corpuscle1 ragno:hasEntity ?entity1 .
            ?corpuscle2 ragno:hasEntity ?entity2 .
        }
    } UNION {
        GRAPH <http://purl.org/stuff/ragno> {
            ?corpuscle1 ragno:hasEntity ?entity1 .
            ?corpuscle2 ragno:hasEntity ?entity2 .
        }
    }
    
    FILTER(?entity1 != ?entity2)
}
GROUP BY ?entity1 ?entity2
HAVING(COUNT(?session) AS ?connectionStrength)
ORDER BY DESC(?connectionStrength)
```

## Usage Notes

### Query Execution Tips

1. **Graph Selection**: Always specify the correct named graph (`<http://purl.org/stuff/navigation>` for ZPT data, `<http://purl.org/stuff/beerqa>` for BeerQA corpuscles)

2. **Optional Patterns**: Use `OPTIONAL` for optimization scores and metadata that might not exist for all corpuscles

3. **Performance**: Add `LIMIT` clauses to prevent large result sets, especially for analytics queries

4. **Filtering**: Combine SPARQL `FILTER` with ZPT semantic constraints for precise navigation

### Integration Patterns

1. **Cross-Graph Queries**: Use `UNION` to query across multiple corpus graphs (BeerQA, Ragno, etc.)

2. **Temporal Analysis**: Leverage `zpt:navigationTimestamp` for time-based navigation analytics

3. **Provenance Tracking**: Use PROV-O properties (`prov:wasGeneratedBy`, `prov:wasAssociatedWith`) for audit trails

4. **Optimization Data**: Include ZPT optimization properties (`zpt:optimizationScore`, etc.) for intelligent navigation

These queries demonstrate the power of combining formal ZPT ontology terms with Ragno corpus data to enable sophisticated knowledge navigation and analysis.