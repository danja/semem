import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { SPARQLQueryService } from '../../../../src/services/sparql/SPARQLQueryService.js';
import { QueryCache } from '../../../../src/services/sparql/QueryCache.js';

describe('SPARQLQueryService', () => {
    let queryService;
    let tempDir;

    beforeEach(async () => {
        // Create temporary test directory
        tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-sparql-'));
        
        // Create directory structure
        await fs.mkdir(path.join(tempDir, 'queries', 'test'), { recursive: true });
        await fs.mkdir(path.join(tempDir, 'templates'), { recursive: true });
        await fs.mkdir(path.join(tempDir, 'config'), { recursive: true });

        // Create test files
        await fs.writeFile(
            path.join(tempDir, 'templates', 'prefixes.sparql'),
            'PREFIX test: <http://example.org/test#>\nPREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n'
        );

        await fs.writeFile(
            path.join(tempDir, 'queries', 'test', 'simple-query.sparql'),
            'SELECT ?s ?p ?o\nWHERE {\n    GRAPH <${graphURI}> {\n        ?s ?p ?o .\n    }\n}\nLIMIT ${limit}'
        );

        await fs.writeFile(
            path.join(tempDir, 'config', 'query-mappings.json'),
            JSON.stringify({
                'simple-query': 'test/simple-query.sparql'
            })
        );

        queryService = new SPARQLQueryService({
            queryPath: path.join(tempDir, 'queries'),
            templatePath: path.join(tempDir, 'templates'),
            configPath: path.join(tempDir, 'config')
        });
    });

    afterEach(async () => {
        if (queryService) {
            queryService.cleanup();
        }
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('Initialization', () => {
        it('should initialize with default paths', () => {
            const service = new SPARQLQueryService();
            expect(service).toBeDefined();
            expect(service.cache).toBeInstanceOf(QueryCache);
        });

        it('should initialize with custom options', () => {
            const customOptions = {
                queryPath: '/custom/queries',
                cacheOptions: { maxSize: 50 }
            };
            const service = new SPARQLQueryService(customOptions);
            expect(service.queryPath).toBe('/custom/queries');
        });
    });

    describe('Prefix Loading', () => {
        it('should load prefixes from file', async () => {
            const prefixes = await queryService.loadPrefixes();
            expect(prefixes).toContain('PREFIX test: <http://example.org/test#>');
            expect(prefixes).toContain('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>');
        });

        it('should use default prefixes when file not found', async () => {
            // Remove prefixes file
            await fs.unlink(path.join(tempDir, 'templates', 'prefixes.sparql'));
            
            const prefixes = await queryService.loadPrefixes();
            expect(prefixes).toContain('PREFIX ragno: <http://purl.org/stuff/ragno/>');
            expect(prefixes).toContain('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>');
        });

        it('should cache prefixes after first load', async () => {
            const firstLoad = await queryService.loadPrefixes();
            const secondLoad = await queryService.loadPrefixes();
            expect(firstLoad).toBe(secondLoad); // Same reference = cached
        });
    });

    describe('Query Mappings', () => {
        it('should load query mappings from file', async () => {
            const mappings = await queryService.loadQueryMappings();
            expect(mappings).toEqual({
                'simple-query': 'test/simple-query.sparql'
            });
        });

        it('should use default mappings when file not found', async () => {
            // Remove mappings file
            await fs.unlink(path.join(tempDir, 'config', 'query-mappings.json'));
            
            const mappings = await queryService.loadQueryMappings();
            expect(mappings).toHaveProperty('questions-with-relationships');
            expect(mappings).toHaveProperty('entity-content-retrieval');
        });

        it('should cache mappings after first load', async () => {
            const firstLoad = await queryService.loadQueryMappings();
            const secondLoad = await queryService.loadQueryMappings();
            expect(firstLoad).toBe(secondLoad); // Same reference = cached
        });
    });

    describe('Query Loading', () => {
        it('should load query from file', async () => {
            const queryContent = await queryService.loadQuery('simple-query');
            expect(queryContent).toContain('SELECT ?s ?p ?o');
            expect(queryContent).toContain('${graphURI}');
            expect(queryContent).toContain('${limit}');
        });

        it('should throw error for unknown query', async () => {
            await expect(queryService.loadQuery('unknown-query'))
                .rejects.toThrow('Unknown query: unknown-query');
        });

        it('should throw error when query file not found', async () => {
            // Add mapping for non-existent file
            await fs.writeFile(
                path.join(tempDir, 'config', 'query-mappings.json'),
                JSON.stringify({
                    'missing-query': 'test/missing.sparql'
                })
            );
            queryService.queryMappings = null; // Reset cache

            await expect(queryService.loadQuery('missing-query'))
                .rejects.toThrow('Failed to load query missing-query');
        });

        it('should use cache for repeated loads', async () => {
            const spy = vi.spyOn(fs, 'readFile');
            
            await queryService.loadQuery('simple-query');
            await queryService.loadQuery('simple-query');
            
            // First call loads from file, second from cache
            expect(spy).toHaveBeenCalledTimes(3); // mappings + prefixes + query
        });
    });

    describe('Query Generation', () => {
        it('should generate query with parameters', async () => {
            const query = await queryService.getQuery('simple-query', {
                graphURI: 'http://example.org/graph',
                limit: '10'
            });

            expect(query).toContain('PREFIX test: <http://example.org/test#>');
            expect(query).toContain('GRAPH <http://example.org/graph>');
            expect(query).toContain('LIMIT 10');
            expect(query).not.toContain('${graphURI}');
            expect(query).not.toContain('${limit}');
        });

        it('should handle missing parameters gracefully', async () => {
            const query = await queryService.getQuery('simple-query', {
                graphURI: 'http://example.org/graph'
                // missing limit parameter
            });

            expect(query).toContain('GRAPH <http://example.org/graph>');
            expect(query).toContain('LIMIT ${limit}'); // Unchanged
        });

        it('should handle empty parameters', async () => {
            const query = await queryService.getQuery('simple-query');
            expect(query).toContain('${graphURI}');
            expect(query).toContain('${limit}');
        });
    });

    describe('Helper Methods', () => {
        it('should format entity list correctly', () => {
            const entities = ['http://example.org/e1', 'http://example.org/e2'];
            const formatted = queryService.formatEntityList(entities);
            expect(formatted).toBe('<http://example.org/e1>, <http://example.org/e2>');
        });

        it('should format limit clause', () => {
            expect(queryService.formatLimit(10)).toBe('LIMIT 10');
            expect(queryService.formatLimit(null)).toBe('');
            expect(queryService.formatLimit(undefined)).toBe('');
        });

        it('should format timestamps', () => {
            const timestamp = queryService.formatTimestamp();
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should format XSD dateTime', () => {
            const date = new Date('2023-01-01T12:00:00Z');
            const formatted = queryService.formatXSDDateTime(date);
            expect(formatted).toBe('"2023-01-01T12:00:00.000Z"^^xsd:dateTime');
        });
    });

    describe('Cache Management', () => {
        it('should clear cache', async () => {
            await queryService.getQuery('simple-query');
            expect(queryService.cache.size()).toBe(1);
            
            await queryService.clearCache();
            expect(queryService.cache.size()).toBe(0);
            expect(queryService.prefixes).toBeNull();
            expect(queryService.queryMappings).toBeNull();
        });

        it('should reload specific query', async () => {
            const spy = vi.spyOn(fs, 'readFile');
            
            await queryService.loadQuery('simple-query');
            await queryService.reloadQuery('simple-query');
            
            // Should reload the query file
            expect(spy).toHaveBeenCalledWith(
                path.join(tempDir, 'queries', 'test', 'simple-query.sparql'),
                'utf8'
            );
        });

        it('should provide cache statistics', async () => {
            await queryService.getQuery('simple-query');
            
            const stats = queryService.getCacheStats();
            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('maxSize');
            expect(stats).toHaveProperty('totalSizeBytes');
            expect(stats.size).toBeGreaterThan(0);
        });
    });

    describe('Available Queries', () => {
        it('should list available queries', async () => {
            const queries = await queryService.listAvailableQueries();
            expect(queries).toContain('simple-query');
            expect(Array.isArray(queries)).toBe(true);
        });

        it('should provide query statistics', async () => {
            const stats = await queryService.getQueryStats();
            expect(stats).toHaveProperty('totalQueries');
            expect(stats).toHaveProperty('cachedQueries');
            expect(stats).toHaveProperty('categories');
            expect(stats.totalQueries).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle file system errors gracefully', async () => {
            const badService = new SPARQLQueryService({
                queryPath: '/nonexistent/path'
            });

            await expect(badService.loadQuery('simple-query'))
                .rejects.toThrow();
        });

        it('should handle JSON parsing errors in mappings', async () => {
            // Write invalid JSON
            await fs.writeFile(
                path.join(tempDir, 'config', 'query-mappings.json'),
                'invalid json'
            );
            queryService.queryMappings = null; // Reset cache

            const mappings = await queryService.loadQueryMappings();
            expect(mappings).toHaveProperty('questions-with-relationships'); // Falls back to defaults
        });
    });
});