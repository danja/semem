/**
 * Enhanced Research Workflow - Next-generation academic research processing
 * 
 * This workflow implements the complete enhanced research pipeline with:
 * - SPARQL-first storage with embeddings
 * - Hybrid search capabilities  
 * - Intelligent learning from user feedback
 * - Adaptive query processing
 */

export const enhancedResearchWorkflow = {
  name: 'enhanced-research-workflow',
  description: 'Intelligent document processing with SPARQL storage and learning',
  version: '2.0',
  category: 'integrated',
  
  arguments: [
    {
      name: 'research_documents',
      description: 'Array of research documents to process',
      required: true,
      type: 'array',
      validation: {
        minItems: 1,
        maxItems: 50,
        itemType: 'string|object'
      }
    },
    {
      name: 'domain_focus', 
      description: 'Research domain focus area',
      required: false,
      type: 'string',
      default: 'general',
      examples: ['AI/ML', 'neuroscience', 'climate_science', 'quantum_computing']
    },
    {
      name: 'analysis_goals',
      description: 'Specific analysis objectives',
      required: false,
      type: 'array',
      default: ['concept_extraction', 'relationship_mapping', 'insight_generation'],
      options: [
        'concept_extraction',
        'relationship_mapping', 
        'insight_generation',
        'trend_analysis',
        'methodology_analysis',
        'impact_assessment'
      ]
    },
    {
      name: 'user_context',
      description: 'User interaction context for personalization',
      required: false,
      type: 'object',
      default: {},
      properties: {
        userId: { type: 'string' },
        preferences: { type: 'object' },
        expertise_level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] }
      }
    },
    {
      name: 'storage_config',
      description: 'Enhanced storage configuration',
      required: false,
      type: 'object',
      default: {
        backend: 'CachedSPARQL',
        enableEmbeddings: true,
        cacheSize: 10000,
        graphName: 'http://semem.org/research-workflow'
      }
    }
  ],

  workflow: [
    {
      step: 'initialize_enhanced_storage',
      tool: 'semem_switch_storage_backend',
      arguments: {
        backend: '${storage_config.backend}',
        config: {
          endpoint: 'http://localhost:3030/semem/query',
          updateEndpoint: 'http://localhost:3030/semem/update',
          graphName: '${storage_config.graphName}',
          cacheSize: '${storage_config.cacheSize}',
          cacheTTL: 3600000,
          enableEmbeddings: '${storage_config.enableEmbeddings}',
          embeddingDimensions: 1536
        }
      },
      description: 'Initialize enhanced SPARQL storage with caching and embeddings',
      critical: true,
      timeout: 30000
    },
    
    {
      step: 'ingest_documents_enhanced', 
      tool: 'research_ingest_documents',
      arguments: {
        documents: '${research_documents}',
        domain: '${domain_focus}',
        options: {
          generateEmbeddings: true,
          extractEntities: true,
          buildRelationships: true,
          storeInSPARQL: true
        }
      },
      description: 'Enhanced document ingestion with dual storage and embeddings',
      critical: true,
      timeout: 300000,
      retryCount: 2
    },

    {
      step: 'extract_concepts_enhanced',
      tool: 'semem_extract_concepts', 
      arguments: {
        text: '${combined_document_text}',
        options: {
          minConfidence: 0.7,
          includeRelationships: true,
          domainFocus: '${domain_focus}'
        }
      },
      description: 'Extract domain-focused concepts with relationship mapping',
      critical: true,
      dependsOn: ['ingest_documents_enhanced']
    },

    {
      step: 'build_knowledge_graph_enhanced',
      tool: 'ragno_decompose_corpus',
      arguments: {
        textChunks: '${document_chunks}',
        options: {
          extractRelationships: true,
          generateSummaries: true,
          minEntityConfidence: 0.7,
          enableEmbeddings: true,
          domainVocabulary: '${domain_focus}',
          maxEntitiesPerUnit: 25
        }
      },
      description: 'Build enhanced knowledge graph with embeddings and domain vocabulary',
      critical: true,
      dependsOn: ['extract_concepts_enhanced']
    },

    {
      step: 'analyze_relationships_enhanced',
      tool: 'ragno_analyze_graph',
      arguments: {
        analysisTypes: ['statistics', 'centrality', 'communities', 'connectivity'],
        options: {
          includeDetails: true,
          topK: 15,
          communityDetection: true,
          centralityMeasures: ['degree', 'betweenness', 'eigenvector'],
          exportMetrics: true
        }
      },
      description: 'Comprehensive graph analysis with multiple centrality measures',
      critical: false,
      dependsOn: ['build_knowledge_graph_enhanced']
    },

    {
      step: 'generate_insights_enhanced',
      tool: 'research_generate_insights',
      arguments: {
        concepts: '${extracted_concepts}',
        entities: '${graph_entities}',
        relationships: '${graph_relationships}',
        goals: '${analysis_goals}',
        domainContext: '${domain_focus}',
        userContext: '${user_context}',
        graphAnalysis: '${relationship_analysis}'
      },
      description: 'Generate comprehensive research insights with user context',
      critical: true,
      dependsOn: ['analyze_relationships_enhanced']
    },

    {
      step: 'hybrid_search_setup',
      tool: 'hybrid_search',
      arguments: {
        query: '${domain_focus} research insights',
        threshold: 0.7,
        limit: 20,
        searchTypes: ['vector', 'sparql', 'dual'],
        options: {
          includeMetadata: true,
          rankingAlgorithm: 'hybrid',
          userPreferences: '${user_context.preferences}'
        }
      },
      description: 'Setup hybrid search capabilities for enhanced retrieval',
      critical: false,
      dependsOn: ['generate_insights_enhanced']
    },

    {
      step: 'create_executive_summary',
      tool: 'semem_generate_response',
      arguments: {
        prompt: 'Create comprehensive executive summary of research findings including key insights, methodology analysis, and future research directions for domain: ${domain_focus}',
        useMemory: true,
        contextLimit: 15,
        options: {
          temperature: 0.7,
          maxTokens: 2500,
          includeReferences: true,
          structuredOutput: true
        }
      },
      description: 'Generate structured executive summary with references',
      critical: true,
      dependsOn: ['hybrid_search_setup']
    },

    {
      step: 'setup_feedback_learning',
      tool: 'capture_user_feedback',
      arguments: {
        queryId: '${execution_id}',
        response: '${executive_summary}',
        feedback: {
          type: 'initial_setup',
          context: '${user_context}',
          workflow: 'enhanced-research-workflow'
        },
        enableLearning: true
      },
      description: 'Initialize feedback learning system for continuous improvement',
      critical: false,
      optional: true,
      condition: '${user_context.userId} != null'
    }
  ],

  outputs: {
    concepts: '${extracted_concepts}',
    entities: '${graph_entities}', 
    insights: '${research_insights}',
    summary: '${executive_summary}',
    metrics: '${relationship_analysis}',
    searchCapabilities: '${hybrid_search_results}',
    learningSystem: '${feedback_setup}',
    executionMetrics: {
      documentsProcessed: '${document_count}',
      entitiesExtracted: '${entity_count}',
      relationshipsFound: '${relationship_count}',
      processingTime: '${total_processing_time}',
      storageBackend: '${storage_config.backend}',
      embeddingsGenerated: '${embeddings_count}'
    }
  },

  features: {
    adaptiveLearning: true,
    hybridSearch: true,
    sparqlIntegration: true,
    embeddingSupport: true,
    userPersonalization: true,
    continuousImprovement: true,
    performanceOptimization: true,
    errorRecovery: true
  },

  performance: {
    estimatedExecutionTime: '2-10 minutes',
    memoryRequirement: '2-8 GB',
    scalability: 'Up to 50 documents per execution',
    cacheUtilization: 'High with repeated domain analysis',
    errorRecovery: 'Automatic retry with degraded functionality'
  },

  examples: [
    {
      name: 'AI Research Analysis',
      description: 'Analyze recent AI/ML research papers',
      arguments: {
        research_documents: [
          'Recent advances in transformer architectures have shown remarkable improvements...',
          'Multi-modal learning systems demonstrate enhanced performance across...'
        ],
        domain_focus: 'AI/ML',
        analysis_goals: ['concept_extraction', 'trend_analysis', 'methodology_analysis'],
        user_context: {
          userId: 'researcher_001',
          expertise_level: 'expert',
          preferences: {
            focus_areas: ['deep_learning', 'nlp', 'computer_vision'],
            output_detail: 'comprehensive'
          }
        }
      }
    },
    {
      name: 'Climate Science Literature Review',
      description: 'Process climate change research documents',
      arguments: {
        research_documents: [
          'Climate modeling studies show accelerating trends in global temperature...',
          'Carbon sequestration technologies demonstrate varying effectiveness...'
        ],
        domain_focus: 'climate_science',
        analysis_goals: ['concept_extraction', 'relationship_mapping', 'impact_assessment']
      }
    }
  ]
};