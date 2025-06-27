/**
 * ParseHelper - Utility for handling and cleaning LLM response parsing
 * 
 * This helper addresses common issues with LLM responses that may include
 * markdown formatting, code fences, or other wrapper syntax that interferes
 * with JSON parsing.
 */

export default class ParseHelper {
    /**
     * Resolve and clean JSON syntax from LLM responses
     * 
     * This method handles common patterns where LLMs wrap JSON in markdown
     * code fences or add explanatory text around the JSON content.
     * 
     * @param {string} responseText - Raw LLM response text
     * @returns {string|false} - Cleaned JSON string if pattern matches, false otherwise
     */
    static resolveSyntax(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            return false;
        }

        // Trim whitespace
        const trimmed = responseText.trim();
        
        // Pattern 1: JSON wrapped in markdown code fences
        // Matches: ```json\n{...}\n``` or ```\n{...}\n```
        const markdownFencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
        const markdownMatch = trimmed.match(markdownFencePattern);
        
        if (markdownMatch) {
            const extracted = markdownMatch[1].trim();
            // Validate that the extracted content looks like JSON
            if (this._looksLikeJson(extracted)) {
                return extracted;
            }
        }

        // Pattern 2: JSON with leading/trailing text
        // Look for JSON array or object patterns within the text
        const jsonArrayPattern = /(\[[\s\S]*?\])/;
        const jsonObjectPattern = /(\{[\s\S]*?\})/;
        
        const arrayMatch = trimmed.match(jsonArrayPattern);
        if (arrayMatch && this._looksLikeJson(arrayMatch[1])) {
            return arrayMatch[1].trim();
        }
        
        const objectMatch = trimmed.match(jsonObjectPattern);
        if (objectMatch && this._looksLikeJson(objectMatch[1])) {
            return objectMatch[1].trim();
        }

        // Pattern 3: Multiple JSON blocks - take the first valid one
        const multipleJsonPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
        let match;
        while ((match = multipleJsonPattern.exec(trimmed)) !== null) {
            const candidate = match[1].trim();
            if (this._looksLikeJson(candidate)) {
                return candidate;
            }
        }

        // Pattern 4: JSON with explanatory text before/after
        // Common patterns like "Here's the JSON:" or "The result is:"
        const explanationPatterns = [
            /(?:here's|here is|the result is|output|response)[\s\S]*?(\[[\s\S]*?\]|\{[\s\S]*?\})/i,
            /json[\s\S]*?(\[[\s\S]*?\]|\{[\s\S]*?\})/i
        ];
        
        for (const pattern of explanationPatterns) {
            const explanationMatch = trimmed.match(pattern);
            if (explanationMatch && this._looksLikeJson(explanationMatch[1])) {
                return explanationMatch[1].trim();
            }
        }

        // If no patterns match, return false
        return false;
    }

    /**
     * Quick heuristic check if a string looks like valid JSON
     * 
     * @param {string} str - String to check
     * @returns {boolean} - True if it looks like JSON
     * @private
     */
    static _looksLikeJson(str) {
        if (!str || typeof str !== 'string') {
            return false;
        }
        
        const trimmed = str.trim();
        
        // Must start and end with appropriate JSON delimiters
        const isArray = trimmed.startsWith('[') && trimmed.endsWith(']');
        const isObject = trimmed.startsWith('{') && trimmed.endsWith('}');
        
        if (!isArray && !isObject) {
            return false;
        }
        
        // Basic bracket balance check
        let arrayDepth = 0;
        let objectDepth = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];
            
            if (escaped) {
                escaped = false;
                continue;
            }
            
            if (char === '\\') {
                escaped = true;
                continue;
            }
            
            if (char === '"' && !escaped) {
                inString = !inString;
                continue;
            }
            
            if (inString) {
                continue;
            }
            
            switch (char) {
                case '[':
                    arrayDepth++;
                    break;
                case ']':
                    arrayDepth--;
                    break;
                case '{':
                    objectDepth++;
                    break;
                case '}':
                    objectDepth--;
                    break;
            }
            
            // Early exit if brackets become unbalanced
            if (arrayDepth < 0 || objectDepth < 0) {
                return false;
            }
        }
        
        // Check final balance
        return arrayDepth === 0 && objectDepth === 0;
    }

    /**
     * Attempt to parse JSON with syntax resolution
     * 
     * This is a convenience method that combines resolveSyntax with JSON.parse
     * and provides detailed error information.
     * 
     * @param {string} responseText - Raw LLM response text
     * @returns {Object} - {success: boolean, data?: any, error?: string, cleaned?: string}
     */
    static parseJsonResponse(responseText) {
        try {
            // First try direct parsing
            const directParse = JSON.parse(responseText);
            return { success: true, data: directParse };
        } catch (directError) {
            // Try with syntax resolution
            const cleaned = this.resolveSyntax(responseText);
            
            if (cleaned === false) {
                return {
                    success: false,
                    error: 'No recognizable JSON pattern found in response',
                    originalError: directError.message
                };
            }
            
            try {
                const resolvedParse = JSON.parse(cleaned);
                return { 
                    success: true, 
                    data: resolvedParse, 
                    cleaned: cleaned,
                    resolved: true 
                };
            } catch (resolvedError) {
                return {
                    success: false,
                    error: 'JSON parsing failed even after syntax resolution',
                    cleaned: cleaned,
                    originalError: directError.message,
                    resolvedError: resolvedError.message
                };
            }
        }
    }

    /**
     * Validate that parsed JSON matches expected structure
     * 
     * @param {any} data - Parsed JSON data
     * @param {string} expectedType - 'array' or 'object'
     * @param {Object} options - Validation options
     * @returns {boolean} - True if valid
     */
    static validateJsonStructure(data, expectedType = 'array', options = {}) {
        const { minLength = 0, maxLength = Infinity, requiredKeys = [] } = options;
        
        if (expectedType === 'array') {
            if (!Array.isArray(data)) return false;
            if (data.length < minLength || data.length > maxLength) return false;
            return true;
        }
        
        if (expectedType === 'object') {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
            
            // Check required keys
            for (const key of requiredKeys) {
                if (!(key in data)) return false;
            }
            
            return true;
        }
        
        return false;
    }
}