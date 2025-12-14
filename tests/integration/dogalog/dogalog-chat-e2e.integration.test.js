import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:4101';
const DOGALOG_ENDPOINT = `${BASE_URL}/dogalog/chat`;

describe('Dogalog Chat Endpoint E2E', () => {
    // Skip tests if INTEGRATION_TESTS is not set
    const shouldRun = process.env.INTEGRATION_TESTS === 'true';

    if (!shouldRun) {
        it.skip('Integration tests skipped (set INTEGRATION_TESTS=true to run)', () => {});
        return;
    }

    describe('Basic functionality', () => {
        it('should return message for simple prompt', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'What is Dogalog?'
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data).toBeDefined();
            expect(data.message).toBeDefined();
            expect(typeof data.message).toBe('string');
            expect(data.message.length).toBeGreaterThan(0);
        });

        it('should accept prompt with code context', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Explain what this code does',
                    code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
            expect(typeof data.message).toBe('string');
        });

        it('should include message field in all responses', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Hello'
                })
            });

            const data = await response.json();
            expect(data).toHaveProperty('message');
            expect(typeof data.message).toBe('string');
        });
    });

    describe('Code and query suggestions', () => {
        it('should potentially include codeSuggestion for code generation requests', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Create a simple kick drum pattern using euc with 4 hits in 16 steps'
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
            // codeSuggestion is optional - LLM might or might not return it
            if (data.codeSuggestion) {
                expect(typeof data.codeSuggestion).toBe('string');
                expect(data.codeSuggestion.length).toBeGreaterThan(0);
            }
        });

        it('should potentially include querySuggestion for query requests', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Give me a query to find all kick events at time 0',
                    code: 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).'
                })
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
            // querySuggestion is optional - LLM might or might not return it
            if (data.querySuggestion) {
                expect(typeof data.querySuggestion).toBe('string');
                expect(data.querySuggestion.length).toBeGreaterThan(0);
            }
        });

        it('should not include empty suggestions', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'What are euclidean rhythms?'
                })
            });

            const data = await response.json();

            // If suggestions are present, they should not be empty strings
            if (data.codeSuggestion !== undefined) {
                expect(data.codeSuggestion.length).toBeGreaterThan(0);
            }
            if (data.querySuggestion !== undefined) {
                expect(data.querySuggestion.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Error handling', () => {
        it('should return 200 with error message for missing prompt', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.message).toBeDefined();
            expect(data.message).toContain('prompt');
        });

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
        });

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
        });

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
        });
    });

    describe('CORS and headers', () => {
        it('should include CORS headers', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'http://localhost:3000'
                },
                body: JSON.stringify({
                    prompt: 'Test'
                })
            });

            // CORS headers should be present
            const corsHeader = response.headers.get('access-control-allow-origin');
            expect(corsHeader).toBeDefined();
        });

        it('should accept OPTIONS request for CORS preflight', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST'
                }
            });

            expect([200, 204]).toContain(response.status);
        });
    });

    describe('Response format compliance', () => {
        it('should always return JSON', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Test'
                })
            });

            const contentType = response.headers.get('content-type');
            expect(contentType).toContain('application/json');
        });

        it('should match Dogalog contract format', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Create a simple pattern'
                })
            });

            const data = await response.json();

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
        });

        it('should not include extra unexpected fields', async () => {
            const response = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Test'
                })
            });

            const data = await response.json();
            const allowedFields = ['message', 'codeSuggestion', 'querySuggestion'];
            const actualFields = Object.keys(data);

            actualFields.forEach(field => {
                expect(allowedFields).toContain(field);
            });
        });
    });

    describe('Stateless operation', () => {
        it('should handle independent requests without session dependency', async () => {
            // First request
            const response1 = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Create a kick pattern'
                })
            });

            const data1 = await response1.json();
            expect(data1.message).toBeDefined();

            // Second request - should not depend on first
            const response2 = await fetch(DOGALOG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: 'Create a snare pattern'
                })
            });

            const data2 = await response2.json();
            expect(data2.message).toBeDefined();

            // Both should succeed independently
            expect(response1.status).toBe(200);
            expect(response2.status).toBe(200);
        });
    });
});
