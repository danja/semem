import { SPARQLQueryService } from './SPARQLQueryService.js';
import { QueryCache } from './QueryCache.js';

export { SPARQLQueryService, QueryCache };

// Convenience factory function
export function createQueryService(options = {}) {
    return new SPARQLQueryService(options);
}

// Default singleton instance
let defaultService = null;

export function getDefaultQueryService(options = {}) {
    if (!defaultService) {
        defaultService = new SPARQLQueryService(options);
    }
    return defaultService;
}

export function resetDefaultQueryService() {
    if (defaultService) {
        defaultService.cleanup();
        defaultService = null;
    }
}