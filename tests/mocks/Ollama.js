export class MockOllamaConnector {
    async generateEmbedding(model, input) {
        // Generate deterministic but unique embedding
        return new Array(1536).fill(0).map((_, i) =>
            Math.sin(i + input.length))
    }

    async generateChat(model, messages) {
        return 'This is a mock response specific to: ' +
            messages[messages.length - 1].content
    }

    async generateCompletion(model, prompt) {
        if (prompt.includes('concepts')) {
            // Mock concept extraction
            return '["test", "mock", "concept"]'
        }
        return 'Mock completion for: ' + prompt
    }
}