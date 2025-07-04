/**
 * ZPT (Zoom-Pan-Tilt) Barrel File
 * 
 * Exports all ZPT navigation and transformation components including
 * the new RDF-based ontology integration for formal semantics.
 */

// Selection Components
export { default as CorpuscleSelector } from './selection/CorpuscleSelector.js';
export { default as TiltProjector } from './selection/TiltProjector.js';
export { default as PanDomainFilter } from './selection/PanDomainFilter.js';
export { default as ZoomLevelMapper } from './selection/ZoomLevelMapper.js';

// Parameter Processing
export { default as ParameterValidator } from './parameters/ParameterValidator.js';
export { default as ParameterNormalizer } from './parameters/ParameterNormalizer.js';
export { default as FilterBuilder } from './parameters/FilterBuilder.js';
export { default as SelectionCriteria } from './parameters/SelectionCriteria.js';

// Transformation Components
export { default as ContentChunker } from './transform/ContentChunker.js';
export { default as CorpuscleTransformer } from './transform/CorpuscleTransformer.js';
export { default as MetadataEncoder } from './transform/MetadataEncoder.js';
export { default as PromptFormatter } from './transform/PromptFormatter.js';
export { default as TokenCounter } from './transform/TokenCounter.js';

// API Components
export { default as NavigationEndpoint } from './api/NavigationEndpoint.js';
export { default as RequestParser } from './api/RequestParser.js';
export { default as ResponseFormatter } from './api/ResponseFormatter.js';
export { default as ErrorHandler } from './api/ErrorHandler.js';

// RDF Ontology Integration
export { ZPTDataFactory, zptDataFactory } from './ontology/ZPTDataFactory.js';
export { ZPTQueryBuilder } from './ontology/ZPTQueries.js';
export { 
    ZPT, 
    RAGNO, 
    ZPT_TERMS, 
    RAGNO_TERMS, 
    ZPT_STRING_MAPPINGS,
    ZPT_URI_MAPPINGS,
    NamespaceUtils,
    getSPARQLPrefixes 
} from './ontology/ZPTNamespaces.js';