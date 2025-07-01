/**
 * Feedback SPARQL Templates - Queries for iterative feedback workflows
 * 
 * This file contains SPARQL query templates specifically for the iterative
 * feedback system including question generation, iteration tracking, and
 * research progress monitoring.
 */

export const feedbackTemplates = {
    // Follow-up question management
    'feedback-insert-generated-question': {
        query: `INSERT DATA {
    GRAPH <\${beerqaGraph}> {
        <\${questionURI}> a ragno:Corpuscle ;
                        rdfs:label "\${questionText}" ;
                        dcterms:created "\${timestamp}" ;
                        dcterms:type "\${questionType}" ;
                        beerqa:iterationLevel \${iterationLevel} ;
                        beerqa:priority \${priority} ;
                        beerqa:parentQuestion <\${parentQuestionURI}> ;
                        beerqa:parentQuestionText "\${parentQuestionText}" ;
                        beerqa:generationMethod "\${generationMethod}" ;
                        beerqa:completenessScore \${completenessScore} ;
                        beerqa:questionType "\${questionType}" ;
                        prov:wasGeneratedBy beerqa:FeedbackGenerator ;
                        prov:generatedAtTime "\${timestamp}"^^xsd:dateTime .
        \${additionalTriples}
    }
}`,
        prefixes: ['ragno', 'rdfs', 'dcterms', 'prov', 'beerqa', 'xsd'],
        parameters: ['beerqaGraph', 'questionURI', 'questionText', 'timestamp', 'questionType', 'iterationLevel', 'priority', 'parentQuestionURI', 'parentQuestionText', 'generationMethod', 'completenessScore'],
        description: 'Insert a generated follow-up question with iteration metadata'
    },

    'feedback-select-questions-for-research': {
        query: `SELECT ?question ?text ?type ?priority ?parentQuestion ?parentText WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?text ;
                 beerqa:iterationLevel \${iterationLevel} ;
                 beerqa:questionType ?type ;
                 beerqa:priority ?priority ;
                 beerqa:parentQuestion ?parentQuestion ;
                 beerqa:parentQuestionText ?parentText .
        
        # Only get questions that haven't been researched yet
        FILTER NOT EXISTS {
            ?question beerqa:researchCompleted ?completed .
        }
        
        \${priorityFilter}
        \${typeFilter}
    }
}
ORDER BY DESC(?priority)
\${limitClause}`,
        prefixes: ['ragno', 'rdfs', 'beerqa'],
        parameters: ['beerqaGraph', 'iterationLevel'],
        description: 'Select generated questions ready for research in a specific iteration'
    },

    'feedback-mark-question-researched': {
        query: `INSERT DATA {
    GRAPH <\${beerqaGraph}> {
        <\${questionURI}> beerqa:researchCompleted true ;
                        beerqa:researchTimestamp "\${timestamp}"^^xsd:dateTime ;
                        beerqa:entitiesFound \${entityCount} ;
                        beerqa:conceptsFound \${conceptCount} .
        \${additionalResults}
    }
}`,
        prefixes: ['beerqa', 'xsd'],
        parameters: ['beerqaGraph', 'questionURI', 'timestamp', 'entityCount', 'conceptCount'],
        description: 'Mark a follow-up question as researched with results'
    },

    'feedback-get-question-statistics': {
        query: `SELECT 
    (COUNT(?question) as ?totalGenerated)
    (COUNT(?researched) as ?totalResearched)
    (AVG(?priority) as ?avgPriority)
    (MAX(?iterationLevel) as ?maxIteration)
    (AVG(?completenessScore) as ?avgCompleteness)
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 beerqa:iterationLevel ?iterationLevel ;
                 beerqa:priority ?priority ;
                 beerqa:completenessScore ?completenessScore .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched .
            FILTER(?researched = true)
        }
        
        \${parentFilter}
        \${timeFilter}
    }
}`,
        prefixes: ['ragno', 'beerqa'],
        parameters: ['beerqaGraph'],
        description: 'Get comprehensive statistics about generated questions and research progress'
    },

    'feedback-select-iteration-history': {
        query: `SELECT ?question ?text ?iteration ?completeness ?researched ?entitiesFound ?timestamp
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?text ;
                 beerqa:parentQuestion <\${parentQuestionURI}> ;
                 beerqa:iterationLevel ?iteration ;
                 beerqa:completenessScore ?completeness ;
                 dcterms:created ?timestamp .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched ;
                     beerqa:entitiesFound ?entitiesFound .
        }
    }
}
ORDER BY ?iteration ?timestamp`,
        prefixes: ['ragno', 'rdfs', 'beerqa', 'dcterms'],
        parameters: ['beerqaGraph', 'parentQuestionURI'],
        description: 'Get complete iteration history for a parent question'
    },

    'feedback-select-research-progress': {
        query: `SELECT ?question ?text ?type ?iteration ?researched ?entitiesFound ?researchTime
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 rdfs:label ?text ;
                 beerqa:questionType ?type ;
                 beerqa:iterationLevel ?iteration .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched ;
                     beerqa:entitiesFound ?entitiesFound ;
                     beerqa:researchTimestamp ?researchTime .
        }
        
        \${statusFilter}
        \${iterationFilter}
    }
}
ORDER BY ?iteration DESC(?entitiesFound)`,
        prefixes: ['ragno', 'rdfs', 'beerqa'],
        parameters: ['beerqaGraph'],
        description: 'Monitor research progress across all generated questions'
    },

    'feedback-update-iteration-metadata': {
        query: `DELETE {
    GRAPH <\${beerqaGraph}> {
        <\${questionURI}> beerqa:iterationStatus ?oldStatus ;
                        beerqa:lastUpdated ?oldTimestamp .
    }
}
INSERT {
    GRAPH <\${beerqaGraph}> {
        <\${questionURI}> beerqa:iterationStatus "\${status}" ;
                        beerqa:lastUpdated "\${timestamp}"^^xsd:dateTime ;
                        beerqa:processingNotes "\${notes}" .
        \${additionalUpdates}
    }
}
WHERE {
    GRAPH <\${beerqaGraph}> {
        <\${questionURI}> a ragno:Corpuscle .
        OPTIONAL { <\${questionURI}> beerqa:iterationStatus ?oldStatus }
        OPTIONAL { <\${questionURI}> beerqa:lastUpdated ?oldTimestamp }
    }
}`,
        prefixes: ['ragno', 'beerqa', 'xsd'],
        parameters: ['beerqaGraph', 'questionURI', 'status', 'timestamp', 'notes'],
        description: 'Update iteration metadata for question processing tracking'
    },

    'feedback-cleanup-completed-iterations': {
        query: `DELETE {
    GRAPH <\${beerqaGraph}> {
        ?question beerqa:temporaryData ?tempData .
    }
}
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 beerqa:researchCompleted true ;
                 beerqa:temporaryData ?tempData .
        
        # Only clean up old completed iterations
        ?question beerqa:researchTimestamp ?researchTime .
        FILTER(?researchTime < "\${cutoffDate}"^^xsd:dateTime)
    }
}`,
        prefixes: ['ragno', 'beerqa', 'xsd'],
        parameters: ['beerqaGraph', 'cutoffDate'],
        description: 'Clean up temporary data from completed old iterations'
    },

    'feedback-get-completeness-trends': {
        query: `SELECT ?iteration 
    (AVG(?completeness) as ?avgCompleteness)
    (COUNT(?question) as ?questionCount)
    (COUNT(?researched) as ?researchedCount)
WHERE {
    GRAPH <\${beerqaGraph}> {
        ?question a ragno:Corpuscle ;
                 beerqa:iterationLevel ?iteration ;
                 beerqa:completenessScore ?completeness .
        
        OPTIONAL {
            ?question beerqa:researchCompleted ?researched .
            FILTER(?researched = true)
        }
        
        \${timeRangeFilter}
    }
}
GROUP BY ?iteration
ORDER BY ?iteration`,
        prefixes: ['ragno', 'beerqa'],
        parameters: ['beerqaGraph'],
        description: 'Analyze completeness trends across iterations'
    }
};

export default feedbackTemplates;