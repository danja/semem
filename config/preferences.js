/**
 * Semem Configuration Preferences
 * 
 * This file contains configuration constants for various Semem components.
 * These values were extracted from hardcoded inline constants to make them
 * more manageable and configurable.
 * 
 * @fileoverview Configuration constants for search quality, similarity thresholds, and scoring weights
 */

/**
 * Search and Quality Configuration
 * Used by AdaptiveSearchEngine and related components
 */
export const SEARCH_CONFIG = {
    /**
     * Quality Assessment Thresholds
     * These control how search results are evaluated and filtered
     */
    QUALITY: {
        // Minimum acceptable quality score for search results (0.0 - 1.0)
        // Results below this threshold are filtered out
        MIN_ACCEPTABLE_QUALITY: 0.3,
        
        // Absolute minimum quality threshold floor (0.0 - 1.0)
        // Even if MIN_ACCEPTABLE_QUALITY is lower, this is the absolute minimum
        QUALITY_THRESHOLD_FLOOR: 0.05,
        
        // Quality improvement threshold for stopping multi-pass search (0.0 - 1.0)
        // If quality degrades by more than this amount, stop searching
        QUALITY_IMPROVEMENT_THRESHOLD: 0.1,
        
        // High confidence threshold for early stopping (0.0 - 1.0)
        // If search confidence exceeds this, stop with sufficient results
        HIGH_CONFIDENCE_THRESHOLD: 0.8,
        
        // Quality bands for adaptive behavior
        HIGH_QUALITY_THRESHOLD: 0.7,      // Results above this are considered high quality
        MEDIUM_QUALITY_THRESHOLD: 0.4     // Results above this are considered medium quality
    },

    /**
     * Search Result Scoring Weights
     * These control how different factors contribute to final result scoring
     */
    SCORING: {
        // Composite scoring weights (should sum to 1.0)
        QUALITY_WEIGHT: 0.6,               // Weight of quality score in final ranking
        SIMILARITY_WEIGHT: 0.4,            // Weight of similarity score in final ranking
        
        // Quality score calculation weights
        BASE_QUALITY_SCORE: 0.5,           // Starting quality score before adjustments
        SIMILARITY_CONTRIBUTION: 0.3,      // How much similarity affects quality score
        LENGTH_CONTRIBUTION: 0.2,          // How much content length affects quality score
        PAN_FILTER_MAX_CONTRIBUTION: 0.25, // Maximum contribution from pan filters
        RECENCY_CONTRIBUTION: 0.15,        // How much recency affects quality score
        CONCEPT_CONTRIBUTION: 0.1,         // How much concept matching affects quality score
        
        // Fallback scores
        DEFAULT_SIMILARITY_FALLBACK: 0.3,  // Default similarity when calculation fails
        FAILED_SIMILARITY_SCORE: 0.0       // Similarity score when calculation completely fails
    },

    /**
     * Pan Filter Boost Factors
     * These control how much different types of matches boost result relevance
     */
    BOOST_FACTORS: {
        KEYWORD_BOOST: 0.15,               // Boost for keyword matches in pan filters
        ENTITY_BOOST: 0.20,                // Boost for entity matches in pan filters  
        DOMAIN_BOOST: 0.10                 // Boost for domain matches in pan filters
    }
};

/**
 * SPARQL Store Configuration
 * Used by SPARQLStore for similarity search and data health assessment
 */
export const SPARQL_CONFIG = {
    /**
     * Similarity Search Defaults
     */
    SIMILARITY: {
        DEFAULT_LIMIT: 10,                  // Default number of results to return
        DEFAULT_THRESHOLD: 0.3,             // Default similarity threshold for search
        FINDALL_THRESHOLD: 0.7              // Higher threshold for findSimilarElements
    },

    /**
     * Data Health Assessment Thresholds
     * Used to determine if the knowledge graph is in good condition
     */
    HEALTH: {
        MIN_EMBEDDING_COVERAGE: 0.5,        // Minimum fraction of elements with embeddings
        MIN_CONNECTIVITY: 0.1,              // Minimum graph connectivity score
        DEFAULT_ENTITY_CENTRALITY: 0.0,     // Default centrality for new entities
        DEFAULT_UNIT_IMPORTANCE: 0.5,       // Default importance for new units
        DEFAULT_COMMUNITY_COHESION: 0.5,    // Default cohesion for new communities
        FAILED_SIMILARITY_SCORE: 0.0        // Similarity score when calculation completely fails
    }
};

/**
 * Memory and Interaction Configuration
 * Used by MemoryManager and interaction processing
 */
export const MEMORY_CONFIG = {
    /**
     * Decay and Persistence Settings
     */
    DECAY: {
        DEFAULT_DECAY_FACTOR: 1.0          // Default decay factor for new memories
    }
};

/**
 * Export all configurations as a single object for convenience
 */
export default {
    SEARCH_CONFIG,
    SPARQL_CONFIG,  
    MEMORY_CONFIG
};