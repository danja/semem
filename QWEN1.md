
tools/SimpleVerbsService.js:              const { maxConcepts = 20, embeddingModel = 'nomic-embed-text', batchSize = 5, graph } = mergedOptions;
tools/SimpleVerbsService.js:                      ragno:embeddingModel "nomic-embed-text" ;
tools/SimpleVerbsService.js:              embeddingModel = 'nomic-embed-text',
tools/VerbSchemas.js:    embeddingModel: z.string().optional().default('nomic-embed-text'),
lib/config.js:            model: provider.embeddingModel || 'nomic-embed-text-v1.5'
lib/config.js:          model: provider.embeddingModel || 'nomic-embed-text'
lib/config.js:      model: 'nomic-embed-text'
lib/config.js:      model: 'nomic-embed-text'
lib/config.js:      embeddingModel: workingEmbeddingProvider?.embeddingModel || 'nomic-embed-text'
lib/config.js:      embeddingModel: 'nomic-embed-text'
lib/config.js:  embeddingModel: 'nomic-embed-text'
index.js:            llmConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
index.js:            chatProvider.chatModel = 'qwen2:1.5b';
answer/AnswerHTTP.js:        llmConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
answer/AnswerHTTP.js:        chatProvider.chatModel = 'qwen2:1.5b';
answer/Answer.js:        llmConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
answer/Answer.js:        chatProvider.chatModel = 'qwen2:1.5b';
lib/config.js:      chatModel: workingChatProvider?.chatModel || 'qwen2:1.5b',
lib/config.js:      chatModel: 'qwen2:1.5b',
lib/config.js:  chatModel: 'qwen2:1.5b',
prompts/test-integration.js:        model: 'qwen2:1.5b'
prompts/test-integration.js:    const legacyTemplate = PromptTemplates.getTemplateForModel('qwen2:1.5b');
prompts/test-integration.js:        model: 'qwen2:1.5b'
prompts/interfaces.js:        this.model = options.model || 'qwen2:1.5b';
MemoryManager.js:        chatModel = 'qwen2:1.5b',
connectors/OllamaConnector.js:    constructor(baseUrl = 'http://localhost:11434', defaultModel = 'qwen2:1.5b') {
api/http/client/SememClient.js:                model: options.model || 'qwen2:1.5b',
api/http/client/SememClient.js:                model: options.model || 'qwen2:1.5b',
api/http/forms/web-forms.html:                        <option value="qwen2:1.5b">Qwen2 1.5B</option>
api/cli/CLIHandler.js:                    default: 'qwen2:1.5b',
api/features/PassiveHandler.js:    async handleChat({ prompt, model = 'qwen2:1.5b', options = {} }) {
ragno/TextToCorpuscle.js:                    chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';
ragno/TextToCorpuscle.js:                chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/TextToCorpuscle.js:            const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/CreateConcepts.js:                    chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';
ragno/CreateConcepts.js:                chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/CreateConcepts.js:            const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/algorithms/Hyde.js:            model: options.model || 'qwen2:1.5b', // Ensure we have a default model
ragno/algorithms/Hyde.js:                model: options.model || 'qwen2:1.5b',
ragno/CreateConceptsUnified.js:                    chatModel = provider.chatModel || this.config.get('chatModel') || 'qwen2:1.5b';
ragno/CreateConceptsUnified.js:                chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/CreateConceptsUnified.js:            const chatModel = this.config.get('chatModel') || 'qwen2:1.5b';
ragno/Memorise.js:                        chatModel = provider.chatModel || 'qwen2:1.5b';
ragno/Memorise.js:                chatModel = 'qwen2:1.5b';
ragno/Memorise.js:            this.llmHandler = new LLMHandler(new OllamaConnector('http://localhost:11434'), 'qwen2:1.5b');
services/search/SearchServer.js:        this.chatModel = options.chatModel || 'qwen2:1.5b';
servers/_mcp.js:          const { baseUrl = 'http://localhost:11434', chatModel = 'qwen2:1.5b' } = providerConfig;
servers/_mcp.js:  config.get('chatModel') || 'qwen2:1.5b',
servers/api-server.js:                chatModel: chatProvider?.chatModel || 'qwen2:1.5b',
servers/api-server.js:                chatModel: 'qwen2:1.5b',
servers/ui-server.js:    chatModel: process.env.CHAT_MODEL || 'qwen2:1.5b',
Config.js:                //  model: 'qwen2:1.5b',
types/MemoryTypes.js:        chatModel = 'qwen2:1.5b',
types/README.md:  chatModel: 'qwen2:1.5b',
types/README.md:     chatModel: 'qwen2:1.5b',
