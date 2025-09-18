/**
 * Prompt Synthesis Module
 * Handles LLM-based response synthesis from search results and context
 */

import { SimpleTemplateLoader } from './SimpleTemplateLoader.js';

export class PromptSynthesis {
  constructor(llmHandler) {
    this.llmHandler = llmHandler;
    this.templateLoader = new SimpleTemplateLoader();
  }

  /**
   * Synthesize a natural language response from search results
   * @param {string} question - The original question
   * @param {Array} searchResults - Array of search results with content/prompt/response
   * @param {Object} options - Synthesis options
   * @returns {Promise<string>} - Synthesized response
   */
  async synthesizeResponse(question, searchResults, options = {}) {
    if (!this.llmHandler) {
      throw new Error('LLM handler not available for response synthesis');
    }

    // If no search results, provide a direct response
    if (!searchResults || searchResults.length === 0) {
      return await this._generateNoContextResponse(question);
    }

    // Build context from search results
    const context = this._buildContextFromResults(searchResults);

    // Create synthesis prompt
    const synthesisPrompt = await this._createSynthesisPrompt(question, context, options);

    // Generate response using LLM
    try {
      const response = await this.llmHandler.generateResponse(synthesisPrompt, [], options);
      return response;
    } catch (error) {
      console.error('❌ LLM synthesis failed:', error);
      // Fallback to best search result
      return await this._createFallbackResponse(question, searchResults);
    }
  }

  /**
   * Build contextual information from search results
   * @private
   */
  _buildContextFromResults(results) {
    return results
      .filter(result => result && (result.content || result.prompt || result.response))
      .map((result, index) => {
        const content = result.content || result.prompt || result.response || '';
        const similarity = result.similarity ? ` (relevance: ${(result.similarity * 100).toFixed(1)}%)` : '';
        return `[Context ${index + 1}${similarity}]: ${content}`;
      })
      .join('\n\n');
  }

  /**
   * Create a synthesis prompt for the LLM
   * @private
   */
  async _createSynthesisPrompt(question, context, options = {}) {
    const { mode = 'standard', useContext = true } = options;

    if (!useContext || !context.trim()) {
      const template = await this.templateLoader.loadAndInterpolate('mcp', 'synthesis-no-context', {
        question: question
      });
      return template || `Please answer this question based on your knowledge: ${question}`;
    }

    const template = await this.templateLoader.loadAndInterpolate('mcp', 'synthesis-with-context', {
      context: context,
      question: question
    });

    // Fallback to inline prompt if template not found
    return template || `Based on the following context information, please provide a comprehensive answer to the question.

Context Information:
${context}

Question: ${question}

Instructions:
- Use the context information to inform your answer
- If the context contains relevant information, synthesize it into a coherent response
- If the context is insufficient, combine it with your general knowledge
- Be clear about what information comes from the provided context
- Provide a natural, conversational response

Answer:`;
  }

  /**
   * Generate a response when no context is available
   * @private
   */
  async _generateNoContextResponse(question) {
    const template = await this.templateLoader.loadAndInterpolate('mcp', 'no-context-response', {
      question: question
    });

    return template || `I don't have any specific information about "${question}" in my current knowledge base. This could mean:

1. The information hasn't been stored yet
2. The question doesn't match any stored content
3. The search threshold needs to be adjusted

You might want to try:
- Rephrasing your question
- Checking if relevant information has been stored using 'tell'
- Asking a more general question about the topic`;
  }

  /**
   * Create a fallback response from search results when LLM synthesis fails
   * @private
   */
  async _createFallbackResponse(question, results) {
    const bestResult = results[0];
    if (bestResult && (bestResult.content || bestResult.prompt || bestResult.response)) {
      const content = bestResult.content || bestResult.prompt || bestResult.response;
      return `Based on stored information: ${content}`;
    }

    return await this._generateNoContextResponse(question);
  }
}