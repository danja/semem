import logger from 'loglevel'
import Config from '../src/Config.js'
import SPARQLStore from '../src/stores/SPARQLStore.js'
import MemoryManager from '../src/MemoryManager.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'

async function main() {
    // Initialize configuration
    /*
        const config = new Config({
            storage: {
                type: 'sparql',
                options: {
                    graphName: 'http://example.org/mcp/memory'
                }
            }
        })
    */
    const config = new Config()
    config.init()
    logger.setLevel('debug')
    logger.log('config:', config.config)
    // Get SPARQL endpoint configuration
    //  const sparqlConfig = config.get('sparqlEndpoints')[0]
    const sparqlConfig = config.config.sparqlEndpoints[0] // TODO unhackify

    // Initialize SPARQL store
    const store = new SPARQLStore({
        query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
        update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
    }, {
        user: sparqlConfig.user,
        password: sparqlConfig.password,
        graphName: config.get('storage.options.graphName')
    })

    // Initialize other components
    const ollama = new OllamaConnector()
    const memoryManager = new MemoryManager({
        llmProvider: ollama,
        chatModel: config.get('models.chat.model'),
        embeddingModel: config.get('models.embedding.model'),
        storage: store
    })

    // Example usage
    const prompt = "How can Semantic Web technologies be used with AI?"
    try {
        const relevantInteractions = await memoryManager.retrieveRelevantInteractions(prompt)
        const response = await memoryManager.generateResponse(prompt, [], relevantInteractions)
        console.log('Response:', response)

        const embedding = await memoryManager.generateEmbedding(`${prompt} ${response}`)
        const concepts = await memoryManager.extractConcepts(`${prompt} ${response}`)
        await memoryManager.addInteraction(prompt, response, embedding, concepts)
    } catch (error) {
        console.error('Error:', error)
    } finally {
        await store.close()
    }
}

main().catch(console.error)
