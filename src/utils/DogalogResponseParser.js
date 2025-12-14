/**
 * DogalogResponseParser - Utility for extracting Prolog code and query suggestions from LLM responses
 *
 * This parser handles LLM responses that may include:
 * - Labeled blocks (PROLOG CODE:, PROLOG QUERY:)
 * - Markdown code fences with prolog syntax
 * - Mixed content with code embedded in explanatory text
 *
 * Based on patterns from ParseHelper.js with domain-specific enhancements for Prolog/Dogalog.
 */

export default class DogalogResponseParser {
    /**
     * Extract Prolog code and query suggestions from LLM response
     *
     * @param {string} responseText - Raw LLM response text
     * @returns {Object} - { codeSuggestion?: string, querySuggestion?: string }
     */
    static extractPrologSuggestions(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            return {};
        }

        const trimmed = responseText.trim();
        const result = {};

        // Pattern 1: Labeled PROLOG CODE block (from our prompt template)
        const labeledCodePattern = /PROLOG CODE:\s*\n?```(?:prolog)?\s*\n([\s\S]*?)\n?```/i;
        const labeledCodeMatch = trimmed.match(labeledCodePattern);

        if (labeledCodeMatch) {
            // Strip any accidental label inclusion inside the code block
            result.codeSuggestion = this._stripLabels(labeledCodeMatch[1].trim());
        }

        // Pattern 2: Labeled PROLOG QUERY block (from our prompt template)
        const labeledQueryPattern = /PROLOG QUERY:\s*\n?```(?:prolog)?\s*\n([\s\S]*?)\n?```/i;
        const labeledQueryMatch = trimmed.match(labeledQueryPattern);

        if (labeledQueryMatch) {
            // Strip any accidental label inclusion inside the code block
            result.querySuggestion = this._stripLabels(labeledQueryMatch[1].trim());
        }

        // If we found labeled blocks, return early
        if (result.codeSuggestion || result.querySuggestion) {
            return result;
        }

        // Pattern 3: Generic prolog code fences (fallback)
        // Look for all ```prolog blocks and classify them
        const prologFencePattern = /```(?:prolog)\s*\n([\s\S]*?)\n?```/gi;
        const allMatches = [];
        let match;

        while ((match = prologFencePattern.exec(trimmed)) !== null) {
            const code = match[1].trim();
            if (code) {
                allMatches.push(code);
            }
        }

        // Classify extracted blocks as query or code
        if (allMatches.length > 0) {
            for (const code of allMatches) {
                if (this._looksLikeQuery(code)) {
                    // First query-like block becomes querySuggestion
                    if (!result.querySuggestion) {
                        result.querySuggestion = code;
                    }
                } else {
                    // First program-like block becomes codeSuggestion
                    if (!result.codeSuggestion) {
                        result.codeSuggestion = code;
                    }
                }
            }
        }

        // Pattern 4: Generic code fence without language (very permissive fallback)
        if (!result.codeSuggestion && !result.querySuggestion) {
            const genericFencePattern = /```\s*\n([\s\S]*?)\n?```/;
            const genericMatch = trimmed.match(genericFencePattern);

            if (genericMatch) {
                const code = genericMatch[1].trim();
                if (this._looksLikeProlog(code)) {
                    if (this._looksLikeQuery(code)) {
                        result.querySuggestion = code;
                    } else {
                        result.codeSuggestion = code;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Heuristic check if code looks like a Prolog query vs a program
     *
     * Queries are typically:
     * - 1-2 lines
     * - Contain :- at start (rule head query) or simple predicate calls
     * - Often end with period
     * - May have variables (uppercase)
     *
     * Programs are typically:
     * - Multiple lines
     * - Multiple rules/facts
     * - Function definitions
     *
     * @param {string} code - Prolog code to classify
     * @returns {boolean} - True if it looks like a query
     * @private
     */
    static _looksLikeQuery(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }

        const trimmed = code.trim();
        const lines = trimmed.split('\n').filter(line => line.trim().length > 0);

        // Single line is likely a query
        if (lines.length === 1) {
            return true;
        }

        // Two lines might be a query
        if (lines.length === 2) {
            // If it's a simple rule or fact definition, it's not a query
            // Queries typically don't define new predicates
            const hasRuleDefinition = /^[a-z_][a-zA-Z0-9_]*\([^)]*\)\s*:-/.test(trimmed);
            if (!hasRuleDefinition) {
                return true;
            }
        }

        // More than 2 lines is likely a program
        return false;
    }

    /**
     * Quick heuristic check if a string looks like Prolog code
     *
     * @param {string} str - String to check
     * @returns {boolean} - True if it looks like Prolog
     * @private
     */
    static _looksLikeProlog(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }

        const trimmed = str.trim();

        // Check for Prolog-specific patterns
        const prologPatterns = [
            /:-/,                           // Rules
            /\([^)]*\)\s*\./,              // Predicate calls with period
            /^[a-z_][a-zA-Z0-9_]*\(/,     // Predicate names (lowercase start)
            /event\(/,                     // Dogalog-specific: event predicate
            /euc\(/,                       // Dogalog-specific: euclidean rhythm
            /every\(/,                     // Dogalog-specific: time predicate
        ];

        return prologPatterns.some(pattern => pattern.test(trimmed));
    }

    /**
     * Strip any label text that might have been included inside code blocks
     *
     * @param {string} code - Code to clean
     * @returns {string} - Cleaned code
     * @private
     */
    static _stripLabels(code) {
        if (!code) return code;

        // Remove "PROLOG CODE:" or "PROLOG QUERY:" if they appear at the start
        return code
            .replace(/^PROLOG\s+CODE:\s*/i, '')
            .replace(/^PROLOG\s+QUERY:\s*/i, '')
            .replace(/^\?-\s*PROLOG\s+QUERY:\s*/i, '?- ')  // Handle ?- prefix
            .trim();
    }

    /**
     * Validate that extracted suggestions are non-empty
     *
     * @param {Object} suggestions - { codeSuggestion?, querySuggestion? }
     * @returns {boolean} - True if at least one suggestion exists
     */
    static hasSuggestions(suggestions) {
        if (!suggestions || typeof suggestions !== 'object') {
            return false;
        }

        return !!(suggestions.codeSuggestion || suggestions.querySuggestion);
    }
}
