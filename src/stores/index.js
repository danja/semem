/**
 * Storage Providers Barrel File
 *
 * MIGRATION: Exports enhanced SPARQLStore exclusively
 * Legacy storage classes (InMemoryStore, JSONStore, MemoryStore) are deprecated
 * and will be removed in Phase 3 of the migration.
 *
 * Enhanced SPARQLStore now provides all functionality previously split across:
 * - MemoryStore (FAISS indexing, concept graphs, clustering)
 * - BaseStore implementations (persistence)
 * - InMemoryStore (transient storage)
 * - JSONStore (file-based persistence)
 */

// Core storage architecture
export { default as BaseStore } from './BaseStore.js';

// Enhanced unified storage (recommended for all new usage)
export { default as SPARQLStore } from './SPARQLStore.js';

// Cached variant (if needed for specific use cases)
export { default as CachedSPARQLStore } from './CachedSPARQLStore.js';

// DEPRECATED: These exports have been removed in Phase 3 of the migration
// All functionality is now available in enhanced SPARQLStore
//
// Migration Guide:
// - Replace MemoryStore with enhanced SPARQLStore
// - Replace InMemoryStore with enhanced SPARQLStore
// - Replace JSONStore with enhanced SPARQLStore
// - Replace RagnoMemoryStore with enhanced SPARQLStore
//
// The enhanced SPARQLStore provides all previous functionality plus:
// - FAISS indexing for fast similarity search
// - Concept graphs for relationship tracking
// - Memory classification (short/long-term promotion)
// - Clustering and semantic memory
// - Spreading activation algorithms