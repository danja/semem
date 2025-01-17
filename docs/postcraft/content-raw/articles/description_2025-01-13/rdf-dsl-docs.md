# Semem RDF Turtle DSL

## Overview
Domain-specific language for semantic operations in Semem, providing direct integration with RDF and SPARQL while maintaining a concise, Turtle-like syntax.

## Quick Start
```turtle
# Define prefixes
@prefix mcp: <http://purl.org/stuff/mcp/> .
@prefix sem: <http://example.org/semem#> .

# Store memory interaction
store {
  _:memory1 a mcp:Interaction ;
    mcp:prompt "What is RDF?" ;
    mcp:timestamp "2025-01-13T20:00:00Z" .
}

# Query memories
query SELECT ?p ?o 
WHERE { sem:memory1 ?p ?o }
```

## Features

### Memory Storage
```turtle
# Basic storage
store {
  _:m1 a mcp:Interaction ;
    mcp:prompt "Query text" ;
    mcp:response "Response text" ;
    mcp:embedding [1.2, 3.4, 5.6] ;
    mcp:concepts ("rdf" "storage") .
}

# With metadata
store --graph <http://example.org/memories> {
  _:m2 a mcp:Interaction ;
    mcp:timestamp "2025-01-13T20:00:00Z" ;
    mcp:accessCount 1 ;
    mcp:decayFactor 1.0 .
}
```

### Querying
```turtle
# Simple query
query "semantic memory"

# SPARQL query
query SELECT ?m ?p 
WHERE { 
  ?m a mcp:Interaction ;
     mcp:prompt ?p .
  FILTER(contains(?p, "rdf"))
}

# With parameters
query --limit 5 --format json 
  SELECT * WHERE { ?s ?p ?o }
```

### Updates
```turtle
# Update interaction
update DELETE { ?m mcp:accessCount ?c }
INSERT { ?m mcp:accessCount ?newCount }
WHERE {
  ?m mcp:id "memory-1" ;
     mcp:accessCount ?c .
  BIND(?c + 1 AS ?newCount)
}

# Batch update
update --graph <http://example.org/memories> {
  DELETE { ?m mcp:decayFactor ?old }
  INSERT { ?m mcp:decayFactor ?new }
  WHERE {
    ?m mcp:decayFactor ?old .
    BIND(?old * 0.9 AS ?new)
  }
}
```

### Data Definition
```turtle
# Define prefixes
define qb: <http://purl.org/linked-data/cube#>
define skos: <http://www.w3.org/2004/02/skos/core#>

# Define shapes
shape InteractionShape {
  targetClass: mcp:Interaction
  properties: [
    { path: mcp:prompt, minCount: 1 }
    { path: mcp:response, minCount: 1 }
    { path: mcp:embedding, datatype: xsd:string }
  ]
}
```

### Advanced Features

#### Federated Queries
```turtle
# Query across endpoints
query SELECT ?m ?p 
FROM <http://endpoint1/graph1>
FROM <http://endpoint2/graph2>
WHERE { 
  ?m mcp:prompt ?p 
}

# Service-based federation
query SELECT *
WHERE {
  SERVICE <http://endpoint1/sparql> {
    ?s ?p ?o
  }
}
```

#### Transactions
```turtle
# Begin transaction
begin

# Multiple operations
store { ... }
update { ... }
query { ... }

# Commit or rollback
commit
# or
rollback
```

#### Graph Operations
```turtle
# Create graph
create graph <http://example.org/memories>

# Copy graph
copy <http://source/graph> to <http://target/graph>

# Drop graph
drop graph <http://example.org/memories>
```

## Command Options
- `--format`: Output format (json, turtle, xml)
- `--graph`: Target graph URI
- `--inference`: Enable/disable inference
- `--validate`: Enable shape validation
- `--timeout`: Query timeout in seconds

## Error Handling
```turtle
# Try-catch block
try {
  store { ... }
  update { ... }
} catch {
  rollback
}

# Validation
store --validate InteractionShape {
  _:m1 a mcp:Interaction ;
    mcp:prompt "Test" .
}
```