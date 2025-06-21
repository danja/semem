/**
 * Intelligent Q&A Workflow - Adaptive question answering with learning
 * 
 * This workflow provides intelligent question answering that:
 * - Adapts to user context and history
 * - Uses hybrid search for comprehensive retrieval
 * - Learns from user feedback to improve responses
 * - Provides multi-perspective analysis
 */

export const intelligentQAWorkflow = {
  name: 'intelligent-qa-workflow',
  description: 'Answer questions using hybrid search and incremental learning',
  version: '2.0',
  category: 'integrated',
  
  arguments: [
    {
      name: 'question',
      description: 'User question to answer using intelligent search',
      required: true,
      type: 'string',
      validation: {
        minLength: 10,
        maxLength: 1000
      }
    },
    {
      name: 'user_context',
      description: 'User interaction context for personalization',
      required: false,
      type: 'object',
      default: {},
      properties: {
        userId: { type: 'string' },
        sessionId: { type: 'string' },
        expertise_level: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
        preferences: { type: 'object' },
        previous_questions: { type: 'array' },
        domain_interests: { type: 'array' }
      }
    },
    {
      name: 'search_config',
      description: 'Advanced search configuration',
      required: false,
      type: 'object',
      default: {
        searchDepth: 'comprehensive',
        includeRelated: true,
        confidenceThreshold: 0.7,
        maxSources: 15
      }
    },
    {
      name: 'response_style',
      description: 'Desired response characteristics',
      required: false,
      type: 'object',
      default: {
        detail_level: 'balanced',
        include_sources: true,
        include_confidence: true,
        include_alternatives: false
      }
    }
  ],

  workflow: [
    {
      step: 'analyze_question_intent',
      tool: 'semem_extract_concepts',
      arguments: {
        text: '${question}',
        options: {
          extractIntent: true,
          extractEntities: true,
          extractRelationships: true,
          domainInference: true
        }
      },
      description: 'Analyze question to understand intent, concepts, and domain',
      critical: true
    },

    {
      step: 'retrieve_user_history',
      tool: 'semem_retrieve_memories',
      arguments: {
        query: 'user:${user_context.userId} OR session:${user_context.sessionId}',
        threshold: 0.5,
        limit: 25,
        options: {
          includeContext: true,
          timeWeighting: true,
          relevanceBoost: true
        }
      },
      description: 'Retrieve user interaction history for context',
      critical: false,
      condition: '${user_context.userId} != null OR ${user_context.sessionId} != null',
      optional: true
    },

    {
      step: 'adaptive_query_processing',
      tool: 'adaptive_query_processing',
      arguments: {
        query: '${question}',
        userContext: '${user_context}',
        queryAnalysis: '${question_analysis}',
        userHistory: '${user_history}',
        searchConfig: '${search_config}'
      },
      description: 'Process query adaptively based on user context and history',
      critical: true,
      dependsOn: ['analyze_question_intent']
    },

    {
      step: 'hybrid_search_execution',
      tool: 'hybrid_search',
      arguments: {
        query: '${question}',
        threshold: '${adaptive_strategy.threshold}',
        limit: '${adaptive_strategy.limit}',
        searchTypes: ['vector', 'sparql', 'dual'],
        options: {
          userPreferences: '${user_context.preferences}',
          domainFocus: '${inferred_domain}',
          includeRelated: '${search_config.includeRelated}',
          rankingAlgorithm: 'adaptive',
          confidenceFiltering: true
        }
      },
      description: 'Execute comprehensive hybrid search with adaptive parameters',
      critical: true,
      dependsOn: ['adaptive_query_processing']
    },

    {
      step: 'context_assembly',
      tool: 'semem_retrieve_memories',
      arguments: {
        query: '${extracted_concepts}',
        threshold: '${search_config.confidenceThreshold}',
        limit: '${search_config.maxSources}',
        options: {
          mergeWithSearchResults: '${search_results}',
          prioritizeRecent: true,
          diversityBoost: true,
          relevanceWeighting: true
        }
      },
      description: 'Assemble comprehensive context from multiple sources',
      critical: true,
      dependsOn: ['hybrid_search_execution']
    },

    {
      step: 'generate_intelligent_answer',
      tool: 'semem_generate_response',
      arguments: {
        prompt: '${enhanced_question_prompt}',
        useMemory: true,
        contextLimit: 20,
        options: {
          temperature: 0.7,
          maxTokens: 2000,
          includeConfidence: '${response_style.include_confidence}',
          includeSources: '${response_style.include_sources}',
          detailLevel: '${response_style.detail_level}',
          userExpertise: '${user_context.expertise_level}',
          structuredResponse: true
        }
      },
      description: 'Generate intelligent, context-aware answer',
      critical: true,
      dependsOn: ['context_assembly']
    },

    {
      step: 'confidence_assessment',
      tool: 'ragno_analyze_graph',
      arguments: {
        analysisTypes: ['confidence', 'source_reliability', 'fact_verification'],
        entities: '${answer_entities}',
        options: {
          confidenceMetrics: true,
          sourceValidation: true,
          factChecking: true,
          uncertaintyQuantification: true
        }
      },
      description: 'Assess answer confidence and source reliability',
      critical: false,
      dependsOn: ['generate_intelligent_answer'],
      condition: '${response_style.include_confidence} == true'
    },

    {
      step: 'alternative_perspectives',
      tool: 'hybrid_search',
      arguments: {
        query: 'alternative views ${question}',
        threshold: 0.6,
        limit: 10,
        options: {
          diversitySearch: true,
          perspectiveAnalysis: true,
          contraryEvidence: true,
          balancedViewpoint: true
        }
      },
      description: 'Search for alternative perspectives and contrary evidence',
      critical: false,
      optional: true,
      condition: '${response_style.include_alternatives} == true'
    },

    {
      step: 'store_qa_interaction',
      tool: 'semem_store_interaction',
      arguments: {
        prompt: '${question}',
        response: '${intelligent_answer}',
        metadata: {
          userContext: '${user_context}',
          searchResults: '${search_results}',
          confidence: '${answer_confidence}',
          sources: '${answer_sources}',
          processingTime: '${processing_time}',
          searchStrategy: '${adaptive_strategy}',
          timestamp: '${timestamp}',
          workflowVersion: '2.0'
        }
      },
      description: 'Store Q&A interaction for learning and history',
      critical: true,
      dependsOn: ['generate_intelligent_answer']
    },

    {
      step: 'prepare_feedback_system',
      tool: 'capture_user_feedback',
      arguments: {
        queryId: '${execution_id}',
        response: '${intelligent_answer}',
        feedback: {
          type: 'qa_response',
          context: '${user_context}',
          question: '${question}',
          confidence: '${answer_confidence}',
          sources: '${answer_sources}',
          searchStrategy: '${adaptive_strategy}'
        },
        enableLearning: true,
        feedbackTypes: ['rating', 'correction', 'refinement', 'source_feedback']
      },
      description: 'Setup feedback capture for continuous learning',
      critical: false,
      dependsOn: ['store_qa_interaction']
    }
  ],

  outputs: {
    question: '${question}',
    answer: '${intelligent_answer}',
    confidence: '${answer_confidence}',
    sources: '${answer_sources}',
    alternatives: '${alternative_perspectives}',
    searchStrategy: '${adaptive_strategy}',
    processingMetrics: {
      conceptsExtracted: '${concepts_count}',
      sourcesConsulted: '${sources_count}',
      searchResultsEvaluated: '${search_results_count}',
      processingTimeMs: '${processing_time}',
      confidenceScore: '${confidence_score}',
      userContextUtilized: '${context_utilized}'
    },
    learningMetrics: {
      userHistoryConsidered: '${history_count}',
      strategyAdaptations: '${adaptations_count}',
      feedbackSystemReady: '${feedback_ready}',
      improvementOpportunities: '${improvement_suggestions}'
    }
  },

  features: {
    adaptiveSearch: true,
    contextualLearning: true,
    confidenceAssessment: true,
    sourceVerification: true,
    perspectiveAnalysis: true,
    userPersonalization: true,
    continuousImprovement: true,
    realTimeAdaptation: true
  },

  performance: {
    estimatedResponseTime: '10-30 seconds',
    accuracyImprovement: 'Progressive with user feedback',
    scalability: 'Handles complex multi-part questions',
    memoryUtilization: 'Efficient with caching',
    learningRate: 'Adaptive based on feedback frequency'
  },

  examples: [
    {
      name: 'Expert Technical Question',
      description: 'Technical question from expert user',
      arguments: {
        question: 'How do transformer attention mechanisms compare to traditional RNN memory systems in terms of computational efficiency and long-range dependency modeling?',
        user_context: {
          userId: 'expert_researcher_001',
          expertise_level: 'expert',
          domain_interests: ['machine_learning', 'neural_networks', 'nlp'],
          preferences: {
            detail_level: 'comprehensive',
            include_mathematical_details: true,
            prefer_recent_research: true
          }
        },
        response_style: {
          detail_level: 'comprehensive',
          include_sources: true,
          include_confidence: true,
          include_alternatives: true
        }
      }
    },
    {
      name: 'General Knowledge Question',
      description: 'Beginner-level question requiring accessible explanation',
      arguments: {
        question: 'What is climate change and why is it happening?',
        user_context: {
          userId: 'student_001',
          expertise_level: 'beginner',
          preferences: {
            explanation_style: 'simple',
            include_examples: true,
            visual_aids_preferred: false
          }
        },
        response_style: {
          detail_level: 'accessible',
          include_sources: true,
          include_confidence: false
        }
      }
    },
    {
      name: 'Follow-up Question',
      description: 'Question building on previous conversation',
      arguments: {
        question: 'Can you elaborate on the economic implications you mentioned?',
        user_context: {
          userId: 'analyst_001',
          sessionId: 'session_12345',
          previous_questions: [
            'What are the main challenges in renewable energy adoption?'
          ],
          expertise_level: 'intermediate'
        },
        search_config: {
          searchDepth: 'focused',
          includeRelated: true,
          confidenceThreshold: 0.8
        }
      }
    }
  ]
};