import { describe, it, expect } from 'vitest';
import DogalogResponseParser from '../../../src/utils/DogalogResponseParser.js';

describe('DogalogResponseParser', () => {
    describe('extractPrologSuggestions', () => {
        it('should extract labeled PROLOG CODE block', () => {
            const response = `Here's a drum pattern for you:

PROLOG CODE:
\`\`\`prolog
kick(T) :- euc(T,4,16,4,0).
snare(T) :- euc(T,2,16,8,0).
event(kick,36,1.0,T) :- kick(T).
event(snare,38,0.8,T) :- snare(T).
\`\`\`

This creates a basic 4-on-the-floor kick with snare on backbeats.`;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toBeDefined();
            expect(result.codeSuggestion).toContain('kick(T) :- euc(T,4,16,4,0)');
            expect(result.codeSuggestion).toContain('event(kick,36,1.0,T)');
        });

        it('should extract labeled PROLOG QUERY block', () => {
            const response = `Try this query to see all events at time 0:

PROLOG QUERY:
\`\`\`prolog
event(V, P, _, 0).
\`\`\`

This will show you what plays at the start.`;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.querySuggestion).toBeDefined();
            expect(result.querySuggestion).toContain('event(V, P, _, 0)');
            expect(result.codeSuggestion).toBeUndefined();
        });

        it('should extract both code and query from same response', () => {
            const response = `Here's a complete solution:

PROLOG CODE:
\`\`\`prolog
hat(T) :- every(T,0.5).
event(hat,42,0.7,T) :- hat(T).
\`\`\`

Now test it with:

PROLOG QUERY:
\`\`\`prolog
event(hat, P, V, 0).
\`\`\``;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toBeDefined();
            expect(result.codeSuggestion).toContain('hat(T) :- every(T,0.5)');
            expect(result.querySuggestion).toBeDefined();
            expect(result.querySuggestion).toContain('event(hat, P, V, 0)');
        });

        it('should fallback to unlabeled prolog code fences', () => {
            const response = `Try this pattern:

\`\`\`prolog
kick(T) :- euc(T,3,8,0,0).
hat(T) :- every(T,0.5).
event(kick,36,1.0,T) :- kick(T).
event(hat,42,0.6,T) :- hat(T).
\`\`\`

This creates a 3/8 pattern.`;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toBeDefined();
            expect(result.codeSuggestion).toContain('kick(T)');
        });

        it('should classify short code as query', () => {
            const response = `Run this query:

\`\`\`prolog
event(kick, _, _, 0).
\`\`\``;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.querySuggestion).toBeDefined();
            expect(result.querySuggestion).toContain('event(kick');
            expect(result.codeSuggestion).toBeUndefined();
        });

        it('should classify multi-line code as program', () => {
            const response = `\`\`\`prolog
kick(T) :- euc(T,4,16,4,0).
snare(T) :- euc(T,2,16,8,0).
hat(T) :- every(T,0.5).
\`\`\``;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toBeDefined();
            expect(result.querySuggestion).toBeUndefined();
        });

        it('should handle responses with no suggestions', () => {
            const response = 'Dogalog is a Prolog-based audio programming language for live coding.';

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toBeUndefined();
            expect(result.querySuggestion).toBeUndefined();
        });

        it('should handle empty responses', () => {
            const result = DogalogResponseParser.extractPrologSuggestions('');

            expect(result).toEqual({});
        });

        it('should handle null/undefined responses', () => {
            expect(DogalogResponseParser.extractPrologSuggestions(null)).toEqual({});
            expect(DogalogResponseParser.extractPrologSuggestions(undefined)).toEqual({});
        });

        it('should handle malformed code fences gracefully', () => {
            const response = `\`\`\`prolog
kick(T) :- euc(T,4,16,4,0).
Missing closing fence...`;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            // Should not crash, might not extract anything
            expect(result).toBeDefined();
        });

        it('should extract from generic code fence if it looks like Prolog', () => {
            const response = `Try this:

\`\`\`
event(kick, 36, 1.0, 0).
\`\`\``;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.querySuggestion || result.codeSuggestion).toBeDefined();
        });

        it('should prioritize labeled blocks over unlabeled ones', () => {
            const response = `First, some context:

\`\`\`prolog
% This is old code
old(T) :- every(T,1).
\`\`\`

Now use this instead:

PROLOG CODE:
\`\`\`prolog
new(T) :- every(T,0.5).
event(new,42,1.0,T) :- new(T).
\`\`\``;

            const result = DogalogResponseParser.extractPrologSuggestions(response);

            expect(result.codeSuggestion).toContain('new(T)');
            expect(result.codeSuggestion).not.toContain('old(T)');
        });
    });

    describe('_looksLikeQuery', () => {
        it('should identify single-line queries', () => {
            expect(DogalogResponseParser._looksLikeQuery('event(kick, _, _, 0).')).toBe(true);
        });

        it('should identify two-line simple queries', () => {
            const query = `event(V, P, _, 0),
V = kick.`;
            expect(DogalogResponseParser._looksLikeQuery(query)).toBe(true);
        });

        it('should NOT identify multi-line programs as queries', () => {
            const program = `kick(T) :- euc(T,4,16,4,0).
snare(T) :- euc(T,2,16,8,0).
hat(T) :- every(T,0.5).`;
            expect(DogalogResponseParser._looksLikeQuery(program)).toBe(false);
        });

        it('should handle empty strings', () => {
            expect(DogalogResponseParser._looksLikeQuery('')).toBe(false);
            expect(DogalogResponseParser._looksLikeQuery(null)).toBe(false);
        });
    });

    describe('_looksLikeProlog', () => {
        it('should identify Prolog with :- rules', () => {
            expect(DogalogResponseParser._looksLikeProlog('kick(T) :- euc(T,4,16,4,0).')).toBe(true);
        });

        it('should identify Prolog with event predicates', () => {
            expect(DogalogResponseParser._looksLikeProlog('event(kick,36,1.0,0).')).toBe(true);
        });

        it('should identify Prolog with euc predicates', () => {
            expect(DogalogResponseParser._looksLikeProlog('euc(T,4,16,4,0)')).toBe(true);
        });

        it('should identify Prolog with every predicates', () => {
            expect(DogalogResponseParser._looksLikeProlog('every(T,0.5)')).toBe(true);
        });

        it('should NOT identify random text as Prolog', () => {
            expect(DogalogResponseParser._looksLikeProlog('This is just some text')).toBe(false);
        });

        it('should handle empty strings', () => {
            expect(DogalogResponseParser._looksLikeProlog('')).toBe(false);
            expect(DogalogResponseParser._looksLikeProlog(null)).toBe(false);
        });
    });

    describe('hasSuggestions', () => {
        it('should return true when codeSuggestion exists', () => {
            const suggestions = { codeSuggestion: 'kick(T) :- euc(T,4,16,4,0).' };
            expect(DogalogResponseParser.hasSuggestions(suggestions)).toBe(true);
        });

        it('should return true when querySuggestion exists', () => {
            const suggestions = { querySuggestion: 'event(kick, _, _, 0).' };
            expect(DogalogResponseParser.hasSuggestions(suggestions)).toBe(true);
        });

        it('should return true when both exist', () => {
            const suggestions = {
                codeSuggestion: 'kick(T) :- euc(T,4,16,4,0).',
                querySuggestion: 'event(kick, _, _, 0).'
            };
            expect(DogalogResponseParser.hasSuggestions(suggestions)).toBe(true);
        });

        it('should return false when neither exists', () => {
            expect(DogalogResponseParser.hasSuggestions({})).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(DogalogResponseParser.hasSuggestions(null)).toBe(false);
            expect(DogalogResponseParser.hasSuggestions(undefined)).toBe(false);
        });
    });
});
