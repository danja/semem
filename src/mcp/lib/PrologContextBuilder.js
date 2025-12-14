/**
 * PrologContextBuilder - Builds Dogalog-aware prompts using the template system
 *
 * This utility loads and interpolates Dogalog-specific prompt templates
 * to create context-aware questions for the LLM. It leverages the existing
 * SimpleTemplateLoader infrastructure.
 */

import { SimpleTemplateLoader } from './SimpleTemplateLoader.js';
import { verbsLogger } from '../tools/VerbsLogger.js';

export class PrologContextBuilder {
    constructor() {
        this.templateLoader = new SimpleTemplateLoader();
    }

    /**
     * Build a Prolog-aware question using Dogalog templates
     *
     * Selects the appropriate template based on whether Prolog code context is provided:
     * - With code: Uses dogalog-with-code template (includes current program)
     * - Without code: Uses dogalog-no-code template (general assistance)
     *
     * @param {string} question - User's question or prompt
     * @param {string|null} code - Optional Prolog code for context
     * @returns {Promise<string>} - Enhanced question with Dogalog context
     */
    async buildPrologQuestion(question, code = null) {
        if (!question || typeof question !== 'string') {
            throw new Error('Question is required and must be a string');
        }

        // Select template based on code presence
        const templateName = code ? 'dogalog-with-code' : 'dogalog-no-code';

        try {
            // Load and interpolate the template
            const enhancedPrompt = await this.templateLoader.loadAndInterpolate(
                'mcp',
                templateName,
                {
                    question: question.trim(),
                    code: code || ''
                }
            );

            if (!enhancedPrompt) {
                // Template not found, fall back to basic prompt
                verbsLogger.warn(`Dogalog template '${templateName}' not found, using basic prompt`);
                return this._buildFallbackPrompt(question, code);
            }

            return enhancedPrompt;

        } catch (error) {
            verbsLogger.error(`Failed to build Prolog question with template '${templateName}':`, error.message);
            // Fall back to basic prompt on error
            return this._buildFallbackPrompt(question, code);
        }
    }

    /**
     * Build a basic fallback prompt when templates are unavailable
     *
     * @param {string} question - User's question
     * @param {string|null} code - Optional Prolog code
     * @returns {string} - Basic prompt
     * @private
     */
    _buildFallbackPrompt(question, code) {
        if (code) {
            return `You are helping with Dogalog, a Prolog-based audio programming language.

Current Prolog Program:
${code}

User Question: ${question}

Please provide a helpful response focused on Prolog and audio programming.`;
        } else {
            return `You are helping with Dogalog, a Prolog-based audio programming language.

User Question: ${question}

Please provide a helpful response focused on Prolog and audio programming.`;
        }
    }
}

export default PrologContextBuilder;
