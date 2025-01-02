import Config from './Config.js';
import SPARQLStore from './stores/SPARQLStore.js';
import MemoryManager from './MemoryManager.js';
import OllamaConnector from './connectors/OllamaConnector.js';

async function main() {
    // Initialize configuration
    const config = new Config({
        storage: {
            type: 'sparql',
            options: {
                graphName: 'http://example.org/mcp/memory'
            }
        }
    });

    // Get SPARQL endpoint configuration
    const sparqlConfig = config.get('sparqlEndpoints')[0];

    // Initialize SPARQL store
    const store = new SPARQLStore({
        query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
        update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
    }, {
        user: sparqlConfig.user,
        password: sparqlConfig.password,
        graphName: config.get('storage.options.graphName')
    });

    // Initialize other components
    const ollama = new OllamaConnector();
    const memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage: store
    });

    // Example usage
    const prompt = "How can Semantic Web technologies be used with AI?";
    try {
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt);
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions);
        console.log('Response:', response);

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`);
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`);
        await memoryManager.addInteraction(prompt, response, embedding, concepts);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await store.close();
    }
}

main().catch(console.error);
