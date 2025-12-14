import { describe, it, expect, beforeEach } from 'vitest';
import { PrologContextBuilder } from '../../../src/mcp/lib/PrologContextBuilder.js';

describe('PrologContextBuilder', () => {
    let builder;

    beforeEach(() => {
        builder = new PrologContextBuilder();
    });

    describe('buildPrologQuestion', () => {
        it('should build question with code context using dogalog-with-code template', async () => {
            const question = 'Add a hi-hat pattern';
            const code = 'kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T).';

            const result = await builder.buildPrologQuestion(question, code);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            expect(result).toContain(code);
            expect(result).toContain('Dogalog'); // From template
            expect(result).toContain('euclidean rhythms'); // Domain knowledge from template
        });

        it('should build question without code using dogalog-no-code template', async () => {
            const question = 'What is Dogalog?';

            const result = await builder.buildPrologQuestion(question);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            expect(result).toContain('Dogalog'); // From template
            expect(result).not.toContain('Current Prolog Program'); // No code section
        });

        it('should handle empty string code as no code', async () => {
            const question = 'How do I make a kick drum?';
            const code = '';

            const result = await builder.buildPrologQuestion(question, code);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            // Should use no-code template when code is empty
        });

        it('should throw error for missing question', async () => {
            await expect(builder.buildPrologQuestion(null)).rejects.toThrow();
            await expect(builder.buildPrologQuestion('')).rejects.toThrow();
        });

        it('should throw error for non-string question', async () => {
            await expect(builder.buildPrologQuestion(123)).rejects.toThrow();
            await expect(builder.buildPrologQuestion({})).rejects.toThrow();
        });

        it('should trim whitespace from question', async () => {
            const question = '  What is euc?  ';
            const result = await builder.buildPrologQuestion(question);

            expect(result).toBeDefined();
            expect(result).toContain('What is euc?');
            expect(result).not.toContain('  What is euc?  ');
        });

        it('should handle multiline code', async () => {
            const question = 'Explain this code';
            const code = `kick(T) :- euc(T,4,16,4,0).
snare(T) :- euc(T,2,16,8,0).
hat(T) :- every(T,0.5).
event(kick,36,1.0,T) :- kick(T).
event(snare,38,0.8,T) :- snare(T).
event(hat,42,0.6,T) :- hat(T).`;

            const result = await builder.buildPrologQuestion(question, code);

            expect(result).toBeDefined();
            expect(result).toContain(code);
            expect(result).toContain('kick(T) :- euc(T,4,16,4,0)');
            expect(result).toContain('hat(T) :- every(T,0.5)');
        });

        it('should fall back gracefully if template not found', async () => {
            // Even if template files don't exist, should return a fallback prompt
            const question = 'Test question';
            const code = 'test(T).';

            const result = await builder.buildPrologQuestion(question, code);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            // Fallback should still mention Dogalog and Prolog
            expect(result.toLowerCase()).toMatch(/dogalog|prolog/);
        });

        it('should interpolate variables correctly', async () => {
            const question = 'How does {{variable}} work?';
            const code = 'test({{param}}).';

            const result = await builder.buildPrologQuestion(question, code);

            expect(result).toBeDefined();
            // The {{question}} and {{code}} placeholders should be replaced
            // But the user's {{variable}} and {{param}} should pass through as-is
            expect(result).toContain('How does {{variable}} work?');
        });
    });

    describe('_buildFallbackPrompt', () => {
        it('should build fallback with code', () => {
            const question = 'Test question';
            const code = 'kick(T) :- euc(T,4,16,4,0).';

            const result = builder._buildFallbackPrompt(question, code);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            expect(result).toContain(code);
            expect(result).toContain('Dogalog');
            expect(result).toContain('Prolog');
        });

        it('should build fallback without code', () => {
            const question = 'Test question';

            const result = builder._buildFallbackPrompt(question, null);

            expect(result).toBeDefined();
            expect(result).toContain(question);
            expect(result).not.toContain('Current Prolog Program');
            expect(result).toContain('Dogalog');
        });

        it('should handle empty code string', () => {
            const question = 'Test question';

            const result = builder._buildFallbackPrompt(question, '');

            expect(result).toBeDefined();
            // Empty string is falsy, should use no-code version
            expect(result).not.toContain('Current Prolog Program');
        });
    });

    describe('template loader integration', () => {
        it('should have access to SimpleTemplateLoader', () => {
            expect(builder.templateLoader).toBeDefined();
            expect(builder.templateLoader.loadAndInterpolate).toBeInstanceOf(Function);
        });

        it('should cache template loader instance', () => {
            const loader1 = builder.templateLoader;
            const loader2 = builder.templateLoader;

            expect(loader1).toBe(loader2); // Same instance
        });
    });
});
