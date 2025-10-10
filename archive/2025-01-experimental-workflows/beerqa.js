/**
 * BeerQA SPARQL Templates - Domain-specific queries for BeerQA workflows
 * 
 * This file contains specialized SPARQL query templates for BeerQA operations
 * including question augmentation, relationship building, and context retrieval.
 */

export const beerqaTemplates = {
    // Question and relationship queries
    'beerqa-questions-with-relationships': {
        query: `SELECT ?question ?questionText ?relationship ?targetEntity ?relationshipType ?weight ?sourceCorpus
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        ?relationship a ragno:Relationship ;
                     ragno:hasSourceEntity ?question ;
                     ragno:hasTargetEntity ?targetEntity ;
                     ragno:relationshipType ?relationshipType ;
                     ragno:weight ?weight .
        
        OPTIONAL { ?relationship ragno:sourceCorpus ?sourceCorpus }
        
        FILTER(?question != ?targetEntity)
        \${additionalFilters}
    }
}
ORDER BY ?question DESC(?weight)
\${limitClause}`,
        prefixes: ['ragno', 'rdfs'],
        parameters: ['beerqaGraph'],
        description: 'Retrieve BeerQA questions with their semantic relationships'
    },

    'beerqa-enhanced-entity-context': {
        query: `SELECT ?entity ?label ?content ?embedding ?conceptValue ?relationshipWeight
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL {
            ?entity ragno:hasTextElement ?textElement .
            ?textElement ragno:content ?content .
        }
        
        OPTIONAL {
            ?entity ragno:hasAttribute ?embeddingAttr .
            ?embeddingAttr ragno:attributeType "vector-embedding" ;
                          ragno:attributeValue ?embedding .
        }
        
        OPTIONAL {
            ?entity ragno:hasAttribute ?conceptAttr .
            ?conceptAttr ragno:attributeType "concept" ;
                        ragno:attributeValue ?conceptValue .
        }
        
        OPTIONAL {
            ?relationship ragno:hasTargetEntity ?entity ;
                         ragno:hasSourceEntity <\${questionURI}> ;
                         ragno:weight ?relationshipWeight .
        }
        
        FILTER(?entity IN (\${entityList}))
    }
    
    UNION
    
    GRAPH <\${wikipediaGraph}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL {
            ?entity ragno:hasTextElement ?textElement .
            ?textElement ragno:content ?content .
        }
        
        FILTER(?entity IN (\${entityList}))
    }
    
    UNION
    
    GRAPH <\${wikidataGraph}> {
        ?entity a ragno:Corpuscle ;
               rdfs:label ?label .
        
        OPTIONAL {
            ?entity ragno:hasTextElement ?textElement .
            ?textElement ragno:content ?content .
        }
        
        FILTER(?entity IN (\${entityList}))
    }
}
ORDER BY DESC(?relationshipWeight) ?label`,
        prefixes: ['ragno', 'rdfs'],
        parameters: ['beerqaGraph', 'wikipediaGraph', 'wikidataGraph', 'questionURI', 'entityList'],
        description: 'Get enhanced entity context from multiple graphs for BeerQA workflows'
    },

    'beerqa-test-questions': {
        query: `SELECT ?corpuscle ?label ?source WHERE {
    GRAPH <\${beerqaGraph}> {
        ?corpuscle a ragno:Corpuscle ;
                 rdfs:label ?label ;
                 dcterms:source ?source ;
                 ragno:corpuscleType "test-question" .
        \${categoryFilter}
    }
}
ORDER BY ?corpuscle
\${limitClause}`,
        prefixes: ['ragno', 'rdfs', 'dcterms'],
        parameters: ['beerqaGraph'],
        description: 'Select BeerQA test questions for evaluation'
    },

    'beerqa-insert-relationship': {
        query: `INSERT DATA {
    GRAPH <\${beerqaGraph}> {
        <\${relationshipURI}> a ragno:Relationship ;
                             ragno:hasSourceEntity <\${sourceEntity}> ;
                             ragno:hasTargetEntity <\${targetEntity}> ;
                             ragno:relationshipType "\${relationshipType}" ;
                             ragno:weight \${weight} ;
                             ragno:sourceCorpus "\${sourceCorpus}" ;
                             dcterms:created "\${timestamp}" ;
                             prov:wasGeneratedBy <\${generatedBy}> .
        \${additionalTriples}
    }
}`,
        prefixes: ['ragno', 'dcterms', 'prov'],
        parameters: ['beerqaGraph', 'relationshipURI', 'sourceEntity', 'targetEntity', 'relationshipType', 'weight', 'sourceCorpus', 'timestamp', 'generatedBy'],
        description: 'Insert a new ragno:Relationship between entities'
    },

    'beerqa-navigable-questions-with-embeddings': {
        query: `SELECT ?question ?questionText ?embedding ?conceptValue ?conceptType ?conceptConfidence
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?questionText .
        
        # Must have embedding for similarity search
        ?question ragno:hasAttribute ?embeddingAttr .
        {
            ?embeddingAttr a ragno:VectorEmbedding ;
                          ragno:attributeValue ?embedding .
        } UNION {
            ?embeddingAttr ragno:attributeType "vector-embedding" ;
                          ragno:attributeValue ?embedding .
        }
        
        # Must have concepts for semantic navigation
        ?question ragno:hasAttribute ?conceptAttr .
        ?conceptAttr ragno:attributeType "concept" ;
                    ragno:attributeValue ?conceptValue .
        
        OPTIONAL { ?conceptAttr ragno:attributeConfidence ?conceptConfidence }
        OPTIONAL { ?conceptAttr ragno:attributeSubType ?conceptType }
        
        \${typeFilter}
        \${additionalFilters}
    }
}
ORDER BY ?question
\${limitClause}`,
        prefixes: ['ragno', 'rdfs'],
        parameters: ['beerqaGraph'],
        description: 'Select questions suitable for ZPT navigation with embeddings and concepts'
    },

    'beerqa-corpuscle-by-content': {
        query: `SELECT ?corpuscle ?label ?content ?embedding ?source
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?corpuscle a ragno:Corpuscle ;
                  rdfs:label ?label .
        
        OPTIONAL {
            ?corpuscle ragno:hasTextElement ?textElement .
            ?textElement ragno:content ?content .
        }
        
        OPTIONAL {
            ?corpuscle ragno:hasAttribute ?embeddingAttr .
            ?embeddingAttr ragno:attributeType "vector-embedding" ;
                          ragno:attributeValue ?embedding .
        }
        
        OPTIONAL { ?corpuscle dcterms:source ?source }
        
        \${contentFilter}
        \${typeFilter}
    }
}
ORDER BY ?label
\${limitClause}`,
        prefixes: ['ragno', 'rdfs', 'dcterms'],
        parameters: ['beerqaGraph'],
        description: 'Search BeerQA corpuscles by content patterns'
    }
};

export default beerqaTemplates;