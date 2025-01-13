export class MockOllamaConnector {
    async generateEmbedding(model, input) {
        return new Array(1536).fill(0).map(() => Math.random());
    }

    async generateChat(model, messages) {
        return 'Mock response';
    }

    async generateCompletion(model, prompt) {
        return 'Mock completion';
    }
}