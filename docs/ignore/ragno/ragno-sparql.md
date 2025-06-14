# Ragno SPARQL Query Templates

## Graph Decomposition Queries

### Find or Create Entity
```sparql
# Check if entity exists
SELECT ?entity WHERE {
    ?entity a ragno:Entity ;
            skos:prefLabel ?label .
    FILTER(str(?label) = "Hinton")
}

# Create new entity if not found
INSERT {
    ?newEntity a ragno:Entity ;
               skos:prefLabel "Hinton" ;
               ragno:isEntryPoint true ;
               skos:inScheme ?corpus .
} WHERE {
    ?corpus a ragno:Corpus .
    BIND(IRI(CONCAT(str(?corpus), "/entity/", ENCODE_FOR_URI("Hinton"))) AS ?newEntity)
}
```

### Connect Entity to Unit
```sparql
INSERT {
    ?entity ragno:hasUnit ?unit .
} WHERE {
    ?entity a ragno:Entity ;
            skos:prefLabel "Hinton" .
    ?unit a ragno:Unit ;
          ragno:content ?content .
    FILTER(CONTAINS(?content, "Hinton"))
}
```

## Graph Augmentation Queries

### Select Important Entities (K-core)
```sparql
SELECT ?entity (COUNT(?connected) AS ?degree) WHERE {
    ?entity a ragno:Entity .
    ?entity ?p ?connected .
    FILTER(?p IN (ragno:hasUnit, skos:related))
} 
GROUP BY ?entity
HAVING (?degree >= ?k_threshold)
ORDER BY DESC(?degree)
```

### Gather Context for Attribute Generation
```sparql
SELECT ?entity ?unit ?unitContent ?rel ?relContent WHERE {
    ?entity a ragno:Entity ;
            skos:prefLabel ?entityLabel .
    
    OPTIONAL {
        ?entity ragno:hasUnit ?unit .
        ?unit ragno:content ?unitContent .
    }
    
    OPTIONAL {
        ?entity skos:related ?rel .
        ?rel a ragno:Relationship ;
             ragno:content ?relContent .
    }
}
```

### Find Community Members
```sparql
SELECT ?element ?type ?content WHERE {
    ?element ragno:inCommunity ?community .
    ?element a ?type ;
             ragno:content ?content .
    ?community skos:prefLabel "Community 1" .
}
```

## Graph Enrichment Queries

### Find Relevant Units for Text Element
```sparql
SELECT ?unit WHERE {
    ?unit a ragno:Unit ;
          ragno:content ?unitContent ;
          ragno:hasSourceDocument ?source .
    
    FILTER(?source = <http://example.org/doc1>)
}
```

### Get Nodes for Embedding
```sparql
SELECT ?node ?content ?type WHERE {
    ?node a ?type ;
          ragno:content ?content .
    FILTER(?type IN (ragno:TextElement, ragno:Unit, 
                     ragno:Attribute, ragno:CommunityElement))
}
```

### Add HNSW Semantic Edge
```sparql
INSERT {
    ?source ragno:connectsTo ?target .
    _:edge a rdf:Statement ;
           rdf:subject ?source ;
           rdf:predicate ragno:connectsTo ;
           rdf:object ?target ;
           ragno:hasWeight 1.0 ;
           ragno:subType ex:SemanticEdge .
} WHERE {
    BIND(<http://example.org/unit1> AS ?source)
    BIND(<http://example.org/unit2> AS ?target)
}
```

## Graph Searching Queries

### Exact Match Entry Points
```sparql
SELECT ?node WHERE {
    {
        ?node a ragno:Entity ;
              skos:prefLabel ?label .
    } UNION {
        ?node a ragno:Attribute ;
              ragno:subType ex:Overview ;
              skos:prefLabel ?label .
    }
    FILTER(REGEX(?label, "Hinton|Nobel Prize", "i"))
}
```

### Get Node Neighbors for PPR
```sparql
SELECT ?node ?neighbor ?weight WHERE {
    ?node ragno:connectsTo ?neighbor .
    OPTIONAL {
        ?edge rdf:subject ?node ;
              rdf:predicate ragno:connectsTo ;
              rdf:object ?neighbor ;
              ragno:hasWeight ?weight .
    }
}
```

### Filter Retrievable Nodes
```sparql
SELECT ?node ?type ?content WHERE {
    VALUES ?node { /* entry points and cross nodes */ }
    ?node a ?type ;
          ragno:content ?content .
    FILTER(?type IN (ragno:TextElement, ragno:Unit, 
                     ragno:Attribute, ragno:CommunityElement, 
                     ragno:Relationship))
}
```

## Utility Queries

### Graph Statistics
```sparql
SELECT ?type (COUNT(?node) AS ?count) WHERE {
    ?node a ?type .
    FILTER(?type IN (ragno:Entity, ragno:Relationship, ragno:Unit,
                     ragno:Attribute, ragno:CommunityElement,
                     ragno:TextElement))
}
GROUP BY ?type
```

### Get Corpus Overview
```sparql
SELECT ?corpus ?title (COUNT(?element) AS ?size) WHERE {
    ?corpus a ragno:Corpus ;
            skos:prefLabel ?title .
    ?element ragno:inCorpus ?corpus .
}
GROUP BY ?corpus ?title
```

### Community Detection Results
```sparql
SELECT ?community (COUNT(?member) AS ?size) 
       (GROUP_CONCAT(?type; separator=",") AS ?types) WHERE {
    ?member ragno:inCommunity ?community .
    ?member a ?type .
}
GROUP BY ?community
ORDER BY DESC(?size)
```