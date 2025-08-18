# PROBES.md - Comprehensive Testing Strategy for Semem Simple Verbs

## Overview

This document provides a comprehensive testing framework for all 7 Simple Verbs in Semem's semantic memory system. It implements **multi-layer verification** that tests operations across session cache, persistent storage, and RDF graph layers with performance monitoring and agent-friendly interfaces.

## Testing Philosophy

### Multi-Layer Verification
Every operation is tested across three architectural layers:
1. **Session Cache** - Immediate in-memory operations
2. **Persistent Storage** - Backend storage (SPARQL/JSON)
3. **RDF Graph** - Knowledge graph consistency and semantics

### Performance-Aware Testing
All probes include timing benchmarks and resource monitoring to detect:
- Memory leaks and excessive resource consumption
- Performance degradation over time
- Bottlenecks in semantic search operations
- Embedding generation efficiency

### Agent-Friendly Interface
Test results provide:
- Clear pass/fail indicators
- Actionable feedback for failures
- Performance metrics in human-readable format
- Debugging guidance for common issues

## The 7 Simple Verbs Test Suite

### 1. `tell` Operation Probes

#### Probe 1.1: Basic Storage Verification
```javascript
// Test: Store content and verify across all layers
{
  "test": "tell_basic_storage",
  "operation": "tell",
  "input": {
    "content": "Machine learning uses neural networks for pattern recognition",
    "type": "concept"
  },
  "verification_layers": [
    {
      "layer": "session_cache",
      "checks": [
        "content stored in sessionCache.interactions Map",
        "embedding generated and cached",
        "concept extracted and added to concepts Set"
      ]
    },
    {
      "layer": "persistent_storage", 
      "checks": [
        "content persisted to configured backend",
        "embedding stored with proper dimensionality",
        "metadata correctly formatted"
      ]
    },
    {
      "layer": "rdf_graph",
      "checks": [
        "RDF triples generated with proper ontology",
        "semantic relationships established",
        "graph consistency maintained"
      ]
    }
  ],
  "performance_benchmarks": {
    "max_duration": "2000ms",
    "max_memory_delta": "10MB",
    "embedding_generation": "500ms"
  }
}
```

#### Probe 1.2: Session Cache Integration
```javascript
// Test: Immediate availability for retrieval
{
  "test": "tell_session_cache_integration",
  "operation": "tell",
  "workflow": [
    {"action": "tell", "content": "React hooks enable state management in functional components"},
    {"action": "ask", "query": "How do React hooks work?"},
    {"verify": "immediate_retrieval", "threshold": 0.7}
  ],
  "performance_benchmarks": {
    "tell_to_ask_latency": "100ms",
    "similarity_calculation": "50ms"
  }
}
```

#### Probe 1.3: Bulk Storage Performance
```javascript
// Test: Multiple tell operations with performance monitoring
{
  "test": "tell_bulk_storage_performance",
  "operation": "tell",
  "batch_size": 50,
  "content_generator": "random_technical_concepts",
  "performance_benchmarks": {
    "operations_per_second": 10,
    "memory_growth_linear": true,
    "cache_efficiency": 0.95
  }
}
```

### 2. `ask` Operation Probes

#### Probe 2.1: Hybrid Retrieval Strategy
```javascript
// Test: Session cache + persistent storage search
{
  "test": "ask_hybrid_retrieval",
  "operation": "ask",
  "setup": [
    {"tell": "Session content: JavaScript closures capture variables"},
    {"persistent_seed": "Pre-existing content about programming concepts"}
  ],
  "query": "What are closures in programming?",
  "verification_layers": [
    {
      "layer": "session_cache",
      "checks": [
        "session cache searched first",
        "cosine similarity calculated correctly",
        "results ranked by relevance"
      ]
    },
    {
      "layer": "persistent_storage",
      "checks": [
        "fallback search executed",
        "results merged with session results",
        "combined ranking maintained"
      ]
    }
  ],
  "expected_results": {
    "min_similarity_score": 0.6,
    "result_sources": ["session", "persistent"],
    "response_relevance": "high"
  }
}
```

#### Probe 2.2: Semantic Search Quality
```javascript
// Test: Semantic understanding and context retrieval
{
  "test": "ask_semantic_search_quality",
  "operation": "ask", 
  "knowledge_base": [
    "Neural networks process information through interconnected nodes",
    "Deep learning uses multi-layer neural architectures", 
    "Backpropagation adjusts network weights through gradient descent"
  ],
  "test_queries": [
    {"query": "How do AI systems learn?", "expected_concepts": ["neural networks", "learning"]},
    {"query": "What is gradient optimization?", "expected_concepts": ["backpropagation", "weights"]},
    {"query": "Multi-layer architectures", "expected_concepts": ["deep learning", "layers"]}
  ],
  "quality_metrics": {
    "concept_coverage": 0.8,
    "semantic_coherence": 0.75,
    "context_relevance": 0.7
  }
}
```

#### Probe 2.3: Context Window Management
```javascript
// Test: Large context handling and chunking
{
  "test": "ask_context_window_management",
  "operation": "ask",
  "context_size": "32k_tokens",
  "query": "Summarize the key concepts from this large document",
  "performance_benchmarks": {
    "chunking_strategy": "semantic_boundaries",
    "context_coherence": 0.8,
    "processing_time": "5000ms"
  }
}
```

### 3. `augment` Operation Probes

#### Probe 3.1: Concept Extraction Quality
```javascript
// Test: LLM-based concept extraction
{
  "test": "augment_concept_extraction",
  "operation": "augment",
  "target_text": "Machine learning algorithms require large datasets for training. Supervised learning uses labeled examples while unsupervised learning discovers patterns in unlabeled data.",
  "operation_params": {"operation": "extract_concepts"},
  "expected_concepts": [
    "machine learning", "algorithms", "datasets", "training",
    "supervised learning", "unsupervised learning", "patterns"
  ],
  "quality_metrics": {
    "precision": 0.8,
    "recall": 0.75,
    "concept_coherence": 0.9
  }
}
```

#### Probe 3.2: Text Analysis Operations
```javascript
// Test: Various augmentation operations
{
  "test": "augment_text_analysis",
  "operation": "augment",
  "target_texts": [
    "Complex technical documentation requiring analysis",
    "Academic research paper abstract",
    "Code documentation with implementation details"
  ],
  "operations": ["extract_concepts", "analyze_text", "generate_embedding"],
  "verification_layers": [
    {
      "layer": "llm_processing",
      "checks": [
        "appropriate LLM provider selected",
        "context properly formatted",
        "response parsed correctly"
      ]
    }
  ]
}
```

### 4. `zoom` Operation Probes

#### Probe 4.1: Abstraction Level Management
```javascript
// Test: ZPT zoom level changes and state persistence
{
  "test": "zoom_abstraction_levels",
  "operation": "zoom",
  "test_sequence": [
    {"level": "entity", "verify": "entity_level_filtering_active"},
    {"level": "unit", "verify": "unit_level_processing"},
    {"level": "community", "verify": "community_detection_enabled"},
    {"level": "corpus", "verify": "corpus_wide_analysis"}
  ],
  "verification_layers": [
    {
      "layer": "zpt_state",
      "checks": [
        "ZPTStateManager updated correctly",
        "zoom level persisted in session",
        "ontology URIs generated properly"
      ]
    }
  ]
}
```

#### Probe 4.2: Content Selection Strategy
```javascript
// Test: How zoom level affects content selection
{
  "test": "zoom_content_selection",
  "operation": "zoom", 
  "setup": "knowledge_graph_with_multiple_abstractions",
  "zoom_levels": ["entity", "unit", "text", "community", "corpus"],
  "content_verification": {
    "entity": "individual_concepts_selected",
    "unit": "semantic_units_grouped",
    "text": "full_documents_included",
    "community": "topic_clusters_identified",
    "corpus": "entire_dataset_processed"
  }
}
```

### 5. `pan` Operation Probes

#### Probe 5.1: Domain Filtering
```javascript
// Test: Subject domain filters
{
  "test": "pan_domain_filtering",
  "operation": "pan",
  "knowledge_base": "mixed_domain_content",
  "filter_tests": [
    {
      "domains": ["AI", "technology"],
      "keywords": ["neural networks"],
      "expected_filtering": "ai_tech_content_only"
    },
    {
      "entities": ["TensorFlow", "PyTorch"],
      "expected_filtering": "framework_specific_content"
    }
  ],
  "verification_layers": [
    {
      "layer": "content_filtering",
      "checks": [
        "domain ontology mapping correct",
        "keyword matching semantic not literal",
        "entity recognition accurate"
      ]
    }
  ]
}
```

#### Probe 5.2: Temporal Filtering
```javascript
// Test: Temporal range filtering
{
  "test": "pan_temporal_filtering",
  "operation": "pan",
  "temporal_params": {
    "start_date": "2023-01-01",
    "end_date": "2024-12-31",
    "recency_weight": 0.8
  },
  "content_verification": {
    "time_range_respected": true,
    "recency_scoring_applied": true,
    "temporal_metadata_used": true
  }
}
```

### 6. `tilt` Operation Probes

#### Probe 6.1: View Perspective Changes
```javascript
// Test: Different representation styles
{
  "test": "tilt_view_perspectives",
  "operation": "tilt",
  "perspective_tests": [
    {
      "style": "keywords",
      "verify": "keyword_extraction_active",
      "output_format": "term_frequency_analysis"
    },
    {
      "style": "embedding", 
      "verify": "vector_similarity_used",
      "output_format": "semantic_ranking"
    },
    {
      "style": "graph",
      "verify": "relationship_analysis_active", 
      "output_format": "network_structure"
    },
    {
      "style": "temporal",
      "verify": "chronological_ordering",
      "output_format": "timeline_based"
    }
  ]
}
```

#### Probe 6.2: Representation Consistency
```javascript
// Test: View consistency across operations
{
  "test": "tilt_representation_consistency",
  "workflow": [
    {"tilt": {"style": "embedding"}},
    {"ask": "test query"},
    {"verify": "embedding_style_maintained"},
    {"tilt": {"style": "graph"}},
    {"ask": "same test query"},
    {"verify": "graph_style_applied"}
  ],
  "consistency_checks": [
    "style_persistence_across_operations",
    "appropriate_result_formatting",
    "ontology_compliance_maintained"
  ]
}
```

### 7. `inspect` Operation Probes

#### Probe 7.1: Session Cache Inspection
```javascript
// Test: Session cache debugging capabilities
{
  "test": "inspect_session_cache",
  "operation": "inspect",
  "setup": [
    {"tell": "Sample content for inspection"},
    {"ask": "Query to populate cache"},
    {"augment": "Content to generate concepts"}
  ],
  "inspection_params": {
    "what": "session",
    "details": true
  },
  "expected_contents": {
    "interactions_count": ">=1",
    "embeddings_present": true,
    "concepts_populated": true,
    "cache_timestamps": "valid"
  }
}
```

#### Probe 7.2: Concept Analysis
```javascript
// Test: Concept extraction inspection
{
  "test": "inspect_concepts",
  "operation": "inspect",
  "params": {"what": "concepts"},
  "verification": {
    "concept_list_returned": true,
    "concept_metadata_complete": true,
    "extraction_sources_tracked": true,
    "semantic_relationships_shown": true
  }
}
```

#### Probe 7.3: System State Debugging
```javascript
// Test: Complete system state inspection
{
  "test": "inspect_system_state",
  "operation": "inspect", 
  "params": {"what": "all", "details": true},
  "debugging_capabilities": [
    "session_cache_statistics",
    "persistent_storage_connection",
    "zpt_state_current_values",
    "performance_metrics_history"
  ]
}
```

## Cross-Verb Integration Probes

### Probe I.1: Complete Workflow Integration
```javascript
// Test: All 7 verbs in realistic workflow
{
  "test": "complete_workflow_integration",
  "workflow": [
    {"zoom": {"level": "entity"}},
    {"pan": {"domains": ["programming"], "keywords": ["functions"]}},
    {"tilt": {"style": "embedding"}},
    {"tell": {"content": "JavaScript functions are first-class objects"}},
    {"ask": {"query": "What are JavaScript functions?"}},
    {"augment": {"target": "retrieved_content", "operation": "extract_concepts"}},
    {"inspect": {"what": "session", "details": false}}
  ],
  "integration_checks": [
    "state_persistence_across_operations",
    "context_awareness_maintained", 
    "performance_within_acceptable_bounds",
    "semantic_coherence_preserved"
  ]
}
```

### Probe I.2: Error Recovery and Resilience
```javascript
// Test: System behavior under failure conditions
{
  "test": "error_recovery_resilience",
  "error_scenarios": [
    {"scenario": "llm_provider_unavailable", "expected": "graceful_degradation"},
    {"scenario": "storage_backend_offline", "expected": "session_cache_fallback"},
    {"scenario": "embedding_service_timeout", "expected": "retry_with_backoff"},
    {"scenario": "invalid_operation_params", "expected": "validation_error_clear"}
  ],
  "resilience_metrics": {
    "error_recovery_time": "<1000ms",
    "data_consistency_maintained": true,
    "user_feedback_actionable": true
  }
}
```

## Probe Runner System

### Agent-Friendly Test Interface

```javascript
// Example probe execution request
{
  "execute_probe": {
    "probe_id": "tell_basic_storage",
    "timeout": 30000,
    "performance_monitoring": true,
    "verbose_output": false
  }
}

// Example probe result
{
  "probe_id": "tell_basic_storage",
  "status": "PASSED",
  "execution_time": 1247,
  "performance_metrics": {
    "memory_delta": "2.3MB",
    "embedding_generation_time": 432,
    "storage_write_time": 156
  },
  "layer_results": {
    "session_cache": {"status": "PASSED", "checks_passed": 3, "checks_failed": 0},
    "persistent_storage": {"status": "PASSED", "checks_passed": 3, "checks_failed": 0}, 
    "rdf_graph": {"status": "PASSED", "checks_passed": 3, "checks_failed": 0}
  },
  "recommendations": [],
  "debug_info": {
    "session_cache_size": 1,
    "embedding_dimensions": 1536,
    "storage_backend": "sparql"
  }
}
```

### Performance Monitoring Framework

```javascript
// Performance baseline establishment
{
  "performance_baselines": {
    "tell_operation": {
      "p50_latency": "800ms",
      "p95_latency": "1500ms", 
      "memory_per_operation": "1MB",
      "embedding_generation": "400ms"
    },
    "ask_operation": {
      "p50_latency": "600ms",
      "p95_latency": "1200ms",
      "similarity_search": "200ms",
      "context_assembly": "150ms"
    }
  },
  "alerts": {
    "latency_regression": "20% increase from baseline",
    "memory_leak": "continuous growth over 10 operations",
    "accuracy_degradation": "similarity scores below 0.6"
  }
}
```

## Implementation Strategy

### Probe Development Guidelines

1. **Comprehensive Coverage**: Each verb tested in isolation and integration
2. **Multi-Layer Verification**: Every operation verified across all architectural layers
3. **Performance Awareness**: All probes include timing and resource benchmarks
4. **Agent-Friendly Results**: Clear pass/fail, actionable feedback, debugging guidance
5. **Realistic Scenarios**: Probes test real-world usage patterns and edge cases

### Continuous Integration

```bash
# Run all probes
npm run test:probes

# Run specific probe category
npm run test:probes --category=tell

# Run performance benchmark suite
npm run test:probes:performance

# Generate probe coverage report
npm run test:probes:coverage
```

### Probe Maintenance

- **Weekly Performance Baseline Updates**: Adjust benchmarks based on system evolution
- **Monthly Probe Review**: Add new scenarios based on usage patterns
- **Quarterly Integration Testing**: Full cross-system integration probe execution
- **Continuous Monitoring**: Alert on probe failure or performance regression

## Workbench Integration Probes

### Probe W.1: Document Upload and Query Workflow
```javascript
// Test: Complete document upload through workbench and subsequent querying
{
  "test": "workbench_document_upload_query_integration",
  "workflow_description": "Upload document via workbench Tell interface, then query for content via Ask interface",
  "test_steps": [
    {
      "step": 1,
      "action": "navigate_to_workbench",
      "url": "http://localhost:8081",
      "verify": "workbench_loaded_successfully"
    },
    {
      "step": 2,
      "action": "select_tell_tab",
      "verify": "tell_interface_active"
    },
    {
      "step": 3,
      "action": "select_document_type",
      "form_data": {"type": "document"},
      "verify": "document_upload_section_visible"
    },
    {
      "step": 4,
      "action": "upload_test_document",
      "file_path": "docs/manual/algorithms.md",
      "verify": [
        "file_accepted_successfully",
        "document_processing_started",
        "concepts_extracted",
        "embeddings_generated"
      ]
    },
    {
      "step": 5,
      "action": "switch_to_ask_tab",
      "verify": "ask_interface_active"
    },
    {
      "step": 6,
      "action": "query_document_content",
      "query": "What is VSOM?",
      "expected_results": {
        "should_contain": [
          "Visual Self-Organizing Maps",
          "VSOM",
          "clustering",
          "embeddings",
          "visualization"
        ],
        "min_relevance_score": 0.7,
        "response_source": "uploaded_document"
      }
    },
    {
      "step": 7,
      "action": "verify_document_content_accessible",
      "additional_queries": [
        {
          "query": "What algorithms are available for community detection?",
          "expected_concepts": ["Leiden", "community", "detection"]
        },
        {
          "query": "How does personalized PageRank work?",
          "expected_concepts": ["PageRank", "PPR", "random walk", "traversal"]
        }
      ]
    }
  ],
  "integration_checks": [
    {
      "layer": "frontend_ui",
      "checks": [
        "document_upload_form_functional",
        "file_validation_working",
        "progress_indicators_displayed",
        "success_notifications_shown"
      ]
    },
    {
      "layer": "api_backend",
      "checks": [
        "document_processed_via_mcp",
        "content_stored_in_sparql",
        "embeddings_generated_correctly",
        "concepts_extracted_and_stored"
      ]
    },
    {
      "layer": "query_retrieval",
      "checks": [
        "document_content_indexed",
        "semantic_search_functional",
        "relevance_scoring_accurate",
        "response_generation_includes_document"
      ]
    }
  ],
  "failure_scenarios": [
    {
      "scenario": "document_upload_fails",
      "symptoms": [
        "file_rejected_without_clear_error",
        "upload_hangs_indefinitely",
        "processing_fails_silently"
      ],
      "debug_actions": [
        "check_api_server_logs",
        "verify_mcp_connection",
        "inspect_sparql_store_status"
      ]
    },
    {
      "scenario": "document_not_queryable",
      "symptoms": [
        "ask_returns_no_results",
        "document_content_not_found",
        "embeddings_not_searchable"
      ],
      "debug_actions": [
        "verify_embeddings_stored",
        "check_sparql_content_storage", 
        "test_semantic_search_directly",
        "inspect_concept_extraction_results"
      ]
    }
  ],
  "performance_benchmarks": {
    "document_upload_time": "<10s for 50KB file",
    "concept_extraction_time": "<5s",
    "embedding_generation_time": "<3s",
    "query_response_time": "<2s"
  }
}
```

### Probe W.2: Cross-Session Document Persistence
```javascript
// Test: Document remains accessible across browser sessions
{
  "test": "workbench_document_persistence_across_sessions",
  "workflow": [
    {
      "session": 1,
      "actions": [
        "upload_document_algorithms_md",
        "verify_successful_upload",
        "close_browser"
      ]
    },
    {
      "session": 2,
      "actions": [
        "open_fresh_browser_session",
        "navigate_to_workbench",
        "query_for_vsom_information",
        "verify_document_content_accessible"
      ]
    }
  ],
  "persistence_checks": [
    "sparql_storage_retained",
    "embeddings_persisted",
    "concepts_available",
    "cross_session_retrieval_functional"
  ]
}
```

### Probe W.3: Multiple Document Integration
```javascript
// Test: Multiple documents uploaded and queryable together
{
  "test": "workbench_multiple_document_integration", 
  "workflow": [
    {"upload": "docs/manual/algorithms.md"},
    {"upload": "docs/manual/config.md"},
    {"upload": "docs/manual/infrastructure.md"},
    {
      "query": "How do I configure VSOM parameters?",
      "expected_integration": [
        "algorithms.md provides VSOM details",
        "config.md provides configuration guidance",
        "cross_document_synthesis_in_response"
      ]
    }
  ]
}
```

## Conclusion

This comprehensive probe system ensures that all 7 Simple Verbs operate correctly across session cache, persistent storage, and RDF graph layers. The multi-layer verification approach catches issues early, while performance monitoring prevents regression. The agent-friendly interface makes debugging and system optimization straightforward for both human developers and AI assistants.

The **Workbench Integration Probes** specifically test the end-to-end workflow that users experience when uploading documents and querying them through the web interface, ensuring that the document upload → storage → retrieval → response generation pipeline works correctly.

The probe system serves as both a testing framework and a system health monitoring tool, providing confidence in the semantic memory system's reliability and performance.