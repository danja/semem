// tests/helpers/sparqlMocks.js

export function createMockSparqlResult(data = []) {
    return {
        results: {
            bindings: data.map(item => ({
                id: { value: item.id || 'test-id' },
                value: { value: item.value || 'test value' }
            }))
        }
    };
}

export const mockSparqlResult = createMockSparqlResult([{id: 'mock-id', value: 'mock-value'}]);
