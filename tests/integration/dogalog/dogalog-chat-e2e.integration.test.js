import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:4101';
const DOGALOG_ENDPOINT = `${BASE_URL}/dogalog/chat`;
const TEST_TIMEOUT_MS = 60000;
const responseCache = new Map();

async function requestDogalog(payload) {
    const cacheKey = JSON.stringify(payload ?? {});
    if (responseCache.has(cacheKey)) {
        return responseCache.get(cacheKey);
    }

    const response = await fetch(DOGALOG_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload ?? {})
    });

    const data = await response.json();
    const result = { response, data };
    responseCache.set(cacheKey, result);
    return result;
}

describe('Dogalog Chat Endpoint E2E', () => {
    // Skip tests if INTEGRATION_TESTS is not set
    const shouldRun = process.env.INTEGRATION_TESTS === 'true';

    if (!shouldRun) {
        it.skip('Integration tests skipped (set INTEGRATION_TESTS=true to run)', () => {});
        return;
    }

    describe('Basic functionality', () => {
        it('should return message for simple prompt', async () => {
            const { response, data } = await requestDogalog({ prompt: 'What is Dogalog?' });
            expect(response.status).toBe(200);
            expect(data).toBeDefined();
            expect(data.message).toBeDefined();
            expect(typeof data.message).toBe('string');
            expect(data.message.length).toBeGreaterThan(0);
        }, TEST_TIMEOUT_MS);

        it('should accept prompt with code context', async () => {
            const { response, data } = await requestDogalog({
                prompt: 'Explain what this code does',
                code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
            });
            expect(response.status).toBe(200);
            expect(data.message).toBeDefined();
            expect(typeof data.message).toBe('string');
        }, TEST_TIMEOUT_MS);

        it('should include message field in all responses', async () => {
            const basic = await requestDogalog({ prompt: 'What is Dogalog?' });
            const withCode = await requestDogalog({
                prompt: 'Explain what this code does',
                code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
            });

            [basic.data, withCode.data].forEach((data) => {
                expect(data).toHaveProperty('message');
                expect(typeof data.message).toBe('string');
            });
        }, TEST_TIMEOUT_MS);
    });

    describe('Code and query suggestions', () => {
        it('should potentially include codeSuggestion for code generation requests', async () => {
            const { response, data } = await requestDogalog({
                prompt: 'Create a simple kick drum pattern using euc with 4 hits in 16 steps'
            });
            expect(response.status).toBe(200);
            expect(data.message).toBeDefined();
            // codeSuggestion is optional - LLM might or might not return it
            if (data.codeSuggestion) {
                expect(typeof data.codeSuggestion).toBe('string');
                expect(data.codeSuggestion.length).toBeGreaterThan(0);
            }
        }, TEST_TIMEOUT_MS);

        it('should potentially include querySuggestion for query requests', async () => {
            const { response, data } = await requestDogalog({
                prompt: 'Give me a query to find all kick events at time 0',
                code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
            });
            expect(response.status).toBe(200);
            expect(data.message).toBeDefined();
            // querySuggestion is optional - LLM might or might not return it
            if (data.querySuggestion) {
                expect(typeof data.querySuggestion).toBe('string');
                expect(data.querySuggestion.length).toBeGreaterThan(0);
            }
        }, TEST_TIMEOUT_MS);

        it('should not include empty suggestions', async () => {
            const codeRequest = await requestDogalog({
                prompt: 'Create a simple kick drum pattern using euc with 4 hits in 16 steps'
            });
            const queryRequest = await requestDogalog({
                prompt: 'Give me a query to find all kick events at time 0',
                code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
            });

            [codeRequest.data, queryRequest.data].forEach((data) => {
                if (data.codeSuggestion !== undefined) {
                    expect(data.codeSuggestion.length).toBeGreaterThan(0);
                }
                if (data.querySuggestion !== undefined) {
                    expect(data.querySuggestion.length).toBeGreaterThan(0);
                }
            });
        }, TEST_TIMEOUT_MS);
    });

    describe('Error handling', () => {
        it('should return 200 with error message for missing prompt', async () => {
            const { response, data } = await requestDogalog({});
            expect(response.status).toBe(200);
            expect(data.message).toBeDefined();
            expect(data.message).toContain('prompt');
        }, TEST_TIMEOUT_MS);

        it('should return 200 with error message for empty prompt', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: ''
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
        }, TEST_TIMEOUT_MS);

        it('should return 200 with error message for whitespace-only prompt', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: '   '
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
        }, TEST_TIMEOUT_MS);

        it('should handle invalid JSON gracefully', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: 'invalid json'
            });

            // Server should return 400 or 500, but not crash
            expect([200, 400, 500]).toContain(response.status);
        }, TEST_TIMEOUT_MS);
    });

    describe('CORS and headers', () => {
        it('should accept OPTIONS request for CORS preflight', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST'
                }
            });

            expect([200, 204]).toContain(response.status);
            const corsHeader = response.headers.get('access-control-allow-origin');
            expect(corsHeader).toBeDefined();
        }, TEST_TIMEOUT_MS);
    });

    describe('Response format compliance', () => {
        it('should always return JSON', async () => {
            const { response } = await requestDogalog({});

            const contentType = response.headers.get('content-type');
            expect(contentType).toContain('application/json');
        }, TEST_TIMEOUT_MS);

        it('should match Dogalog contract format', async () => {
            const { data } = await requestDogalog({});

            // Required field
            expect(data).toHaveProperty('message');
            expect(typeof data.message).toBe('string');

            // Optional fields (if present, must be strings)
            if ('codeSuggestion' in data) {
                expect(typeof data.codeSuggestion).toBe('string');
            }
            if ('querySuggestion' in data) {
                expect(typeof data.querySuggestion).toBe('string');
            }
        }, TEST_TIMEOUT_MS);

        it('should not include extra unexpected fields', async () => {
            const { data } = await requestDogalog({});
            const allowedFields = ['message', 'codeSuggestion', 'querySuggestion'];
            const actualFields = Object.keys(data);

            actualFields.forEach(field => {
                expect(allowedFields).toContain(field);
            });
        }, TEST_TIMEOUT_MS);
    });

    describe('Stateless operation', () => {
        it('should handle independent requests without session dependency', async () => {
            // First request
            const response1 = await requestDogalog({});
            const data1 = response1.data;
            expect(data1.message).toBeDefined();

            // Second request - should not depend on first
            const response2 = await requestDogalog({ prompt: 'Create a snare pattern' });
            const data2 = response2.data;
            expect(data2.message).toBeDefined();

            // Both should succeed independently
            expect(response1.response.status).toBe(200);
            expect(response2.response.status).toBe(200);
        }, TEST_TIMEOUT_MS);
    });
});
