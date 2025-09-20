// tests/core/unit/stores/modules/SPARQLExecute.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SPARQLExecute } from '../../../../../src/stores/modules/SPARQLExecute.js';

describe('SPARQLExecute', () => {
    let sparqlExecute;
    let mockFetch;
    let endpoint;
    let credentials;
    let graphName;

    beforeEach(() => {
        endpoint = {
            query: 'http://example.org/sparql/query',
            update: 'http://example.org/sparql/update'
        };
        credentials = {
            user: 'testuser',
            password: 'testpass'
        };
        graphName = 'http://test.org/graph';

        // Setup mock fetch
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: { bindings: [] } }),
            text: () => Promise.resolve(''),
            status: 200
        });
        global.fetch = mockFetch;

        sparqlExecute = new SPARQLExecute(endpoint, credentials, graphName);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with object endpoint', () => {
            const se = new SPARQLExecute(endpoint, credentials, graphName);
            expect(se.endpoint).toEqual(endpoint);
        });

        it('should initialize with string endpoint', () => {
            const stringEndpoint = 'http://example.org/sparql';
            const se = new SPARQLExecute(stringEndpoint, credentials, graphName);
            expect(se.endpoint).toEqual({
                query: stringEndpoint,
                update: stringEndpoint
            });
        });

        it('should set credentials and graph name', () => {
            expect(sparqlExecute.credentials).toEqual(credentials);
            expect(sparqlExecute.graphName).toBe(graphName);
        });

        it('should initialize transaction state', () => {
            expect(sparqlExecute.inTransaction).toBe(false);
            expect(sparqlExecute.transactionId).toBeNull();
        });
    });

    describe('executeSparqlQuery', () => {
        it('should execute SPARQL query successfully', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            const expectedResult = { results: { bindings: [] } };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(expectedResult),
                status: 200
            });

            const result = await sparqlExecute.executeSparqlQuery(query);

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.query,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/sparql-results+json',
                        'Authorization': expect.stringContaining('Basic')
                    }),
                    body: `query=${encodeURIComponent(query)}`
                })
            );
            expect(result).toEqual(expectedResult);
        });

        it('should use custom endpoint if provided', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            const customEndpoint = 'http://custom.org/sparql';

            await sparqlExecute.executeSparqlQuery(query, customEndpoint);

            expect(mockFetch).toHaveBeenCalledWith(
                customEndpoint,
                expect.any(Object)
            );
        });

        it('should handle fetch errors', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(sparqlExecute.executeSparqlQuery(query)).rejects.toThrow('Network error');
        });

        it('should handle HTTP errors', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve('Server error details')
            });

            await expect(sparqlExecute.executeSparqlQuery(query)).rejects.toThrow('HTTP 500');
        });
    });

    describe('executeSparqlUpdate', () => {
        it('should execute SPARQL update successfully', async () => {
            const update = 'INSERT DATA { <s> <p> <o> }';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(''),
                status: 200
            });

            await sparqlExecute.executeSparqlUpdate(update);

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }),
                    body: `update=${encodeURIComponent(update)}`
                })
            );
        });

        it('should use custom endpoint if provided', async () => {
            const update = 'INSERT DATA { <s> <p> <o> }';
            const customEndpoint = 'http://custom.org/sparql/update';

            await sparqlExecute.executeSparqlUpdate(update, customEndpoint);

            expect(mockFetch).toHaveBeenCalledWith(
                customEndpoint,
                expect.any(Object)
            );
        });

        it('should handle update errors', async () => {
            const update = 'INSERT DATA { <s> <p> <o> }';
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: () => Promise.resolve('Invalid query')
            });

            await expect(sparqlExecute.executeSparqlUpdate(update)).rejects.toThrow('HTTP 400');
        });
    });

    describe('beginTransaction', () => {
        it('should begin transaction successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(''),
                status: 200
            });

            await sparqlExecute.beginTransaction();

            expect(sparqlExecute.inTransaction).toBe(true);
            expect(sparqlExecute.transactionId).toBeTruthy();
            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                expect.objectContaining({
                    body: expect.stringContaining(`COPY GRAPH <${graphName}> TO GRAPH <${graphName}.backup>`)
                })
            );
        });

        it('should throw error if transaction already in progress', async () => {
            sparqlExecute.inTransaction = true;

            await expect(sparqlExecute.beginTransaction()).rejects.toThrow('Transaction already in progress');
        });

        it('should handle transaction begin failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve('Transaction failed')
            });

            await expect(sparqlExecute.beginTransaction()).rejects.toThrow('HTTP 500');
            expect(sparqlExecute.inTransaction).toBe(false);
        });
    });

    describe('commitTransaction', () => {
        beforeEach(() => {
            sparqlExecute.inTransaction = true;
            sparqlExecute.transactionId = 'test-transaction-123';
        });

        it('should commit transaction successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(''),
                status: 200
            });

            await sparqlExecute.commitTransaction();

            expect(sparqlExecute.inTransaction).toBe(false);
            expect(sparqlExecute.transactionId).toBeNull();
            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                expect.objectContaining({
                    body: expect.stringContaining(`DROP GRAPH <${graphName}.backup>`)
                })
            );
        });

        it('should throw error if no transaction in progress', async () => {
            sparqlExecute.inTransaction = false;

            await expect(sparqlExecute.commitTransaction()).rejects.toThrow('No transaction in progress');
        });
    });

    describe('rollbackTransaction', () => {
        beforeEach(() => {
            sparqlExecute.inTransaction = true;
            sparqlExecute.transactionId = 'test-transaction-123';
        });

        it('should rollback transaction successfully', async () => {
            mockFetch
                .mockResolvedValueOnce({ // DROP current graph
                    ok: true,
                    text: () => Promise.resolve(''),
                    status: 200
                })
                .mockResolvedValueOnce({ // COPY backup to current
                    ok: true,
                    text: () => Promise.resolve(''),
                    status: 200
                })
                .mockResolvedValueOnce({ // DROP backup
                    ok: true,
                    text: () => Promise.resolve(''),
                    status: 200
                });

            await sparqlExecute.rollbackTransaction();

            expect(sparqlExecute.inTransaction).toBe(false);
            expect(sparqlExecute.transactionId).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should throw error if no transaction in progress', async () => {
            sparqlExecute.inTransaction = false;

            await expect(sparqlExecute.rollbackTransaction()).rejects.toThrow('No transaction in progress');
        });

        it('should handle rollback failures gracefully', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve('Rollback failed')
            });

            // Should not throw, but should reset transaction state
            await sparqlExecute.rollbackTransaction();

            expect(sparqlExecute.inTransaction).toBe(false);
            expect(sparqlExecute.transactionId).toBeNull();
        });
    });

    describe('verify', () => {
        it('should verify connection successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: { bindings: [] } }),
                status: 200
            });

            await expect(sparqlExecute.verify()).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.query,
                expect.objectContaining({
                    body: expect.stringContaining('ASK WHERE')
                })
            );
        });

        it('should handle verification failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: () => Promise.resolve('Authentication failed')
            });

            await expect(sparqlExecute.verify()).rejects.toThrow('HTTP 401');
        });
    });

    describe('generateTransactionId', () => {
        it('should generate unique transaction IDs', () => {
            const id1 = sparqlExecute.generateTransactionId();
            const id2 = sparqlExecute.generateTransactionId();

            expect(id1).toBeTruthy();
            expect(id2).toBeTruthy();
            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^tx_\d+_[a-f0-9]{8}$/);
        });
    });

    describe('dispose', () => {
        it('should dispose resources and rollback transaction if needed', async () => {
            sparqlExecute.inTransaction = true;
            const rollbackSpy = vi.spyOn(sparqlExecute, 'rollbackTransaction').mockResolvedValue();

            await sparqlExecute.dispose();

            expect(rollbackSpy).toHaveBeenCalled();
        });

        it('should dispose without rollback if no transaction', async () => {
            sparqlExecute.inTransaction = false;
            const rollbackSpy = vi.spyOn(sparqlExecute, 'rollbackTransaction');

            await sparqlExecute.dispose();

            expect(rollbackSpy).not.toHaveBeenCalled();
        });
    });
});