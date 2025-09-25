/**
 * CreateConceptsUnified.js - Refactored version using unified prompt management system
 * 
 * This module provides the same functionality as CreateConcepts.js but uses the
 * unified prompt management system instead of the legacy PromptTemplates approach.
 * 
 * Key Changes:
 * - Uses PromptManager and PromptContext instead of PromptTemplates
 * - Maintains exact same API for seamless replacement
 * - Improves prompt template management and caching
 * - Provides better error handling and fallback mechanisms
 */

import Config from '../Config.js';
import { SPARQLQueryService } from '../services/sparql/index.js';
import SPARQLHelper from '../services/sparql/SPARQLHelper.js';
import { Embeddings } from '../core/Embeddings.js';
import MistralConnector from '../connectors/MistralConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import { URIMinter } from '../utils/URIMinter.js';
import { createUnifiedLogger } from '../utils/LoggingConfig.js';
const logger = createUnifiedLogger('CreateConceptsUnified');
import dotenv from 'dotenv';

// Import unified prompt management system
import {
    getPromptManager,
    PromptContext,
    PromptOptions,
    PromptTemplate
} from '../prompts/index.js';

// Load environment variables
dotenv.config();

export class CreateConceptsUnified {
    constructor(config = null) {
        this.config = config;
        this.chatModel = Config.get('chatModel');
        this.embeddingModel = Config.get('embeddingModel');
        this.sparqlHelper = null;
        this.queryService = null;
        this.embeddings = null;
        this.promptManager = null;
        this.initialized = false;
    }

    /**
     * Initialize the CreateConceptsUnified system
     */
    async init() {
        if (this.initialized) {
            return;
        }

        // Initialize configuration if not provided
        if (!this.config) {
            const configPath = process.cwd().endsWith('/examples/document')
                ? '../../config/config.json'
                : 'config/config.json';
            this.config = new Config(configPath);
            await this.config.init();
        }

        const storageConfig = this.config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('CreateConceptsUnified requires SPARQL storage configuration');
        }

        // Initialize SPARQL services
        this.queryService = new SPARQLQueryService();
        this.sparqlHelper = new SPARQLHelper(storageConfig.options.update, {
            auth: {
                user: storageConfig.options.user,
                password: storageConfig.options.password
            }
        });

        // Initialize unified prompt management system
        await this.initializePromptManager();

        // Initialize LLM handler
        await this.initializeLLMHandler();

        // Initialize embedding services directly
        await this.initializeEmbeddingServices();

        this.initialized = true;
        logger.info('✅ CreateConceptsUnified system initialized');
    }

    /**
     * Initialize unified prompt management system
     */
    async initializePromptManager() {
        try {
            // Get global prompt manager and ensure it's initialized
            this.promptManager = getPromptManager();

            // Register custom concept extraction templates if not already present
            await this.registerConceptExtractionTemplates();

            logger.info('🎯 Unified prompt management system initialized');
        } catch (error) {
            logger.error('Failed to initialize prompt management system:', error);
            throw error;
        }
    }

    /**
     * Load concept extraction templates from external files
     */
    async registerConceptExtractionTemplates() {
        try {
            // Load external templates from prompts/templates/concept-extraction/
            await this.promptManager.loadExternalTemplates();

            // Check if required templates are loaded
            const requiredTemplates = [
                'concept-extraction-enhanced',
                'concept-extraction-mistral',
                'concept-extraction-llama'
            ];

            const loadedTemplates = [];
            for (const templateName of requiredTemplates) {
                const template = this.promptManager.getTemplate(templateName);
                if (template) {
                    loadedTemplates.push(templateName);
                } else {
                    console.warn(`⚠️  MISSING TEMPLATE: ${templateName}`);
                    console.warn(`📁 Expected: prompts/templates/concept-extraction/${templateName.replace('concept-extraction-', '')}.json`);
                }
            }

            if (loadedTemplates.length > 0) {
                logger.info(`🎯 Loaded ${loadedTemplates.length} concept extraction templates from external files`);
                logger.debug('Loaded templates:', loadedTemplates);
            } else {
                throw new Error('No concept extraction templates could be loaded from external files');
            }

        } catch (error) {
            console.error('\n' + '='.repeat(80));
            console.error('⚠️  WARNING: EXTERNAL TEMPLATE LOADING FAILED');
            console.error('='.repeat(80));
            console.error('❌ Failed to load concept extraction templates from external files');
            console.error('📁 Expected location: prompts/templates/concept-extraction/');
            console.error('💥 Error:', error.message);
            console.error('🔄 Using fallback template - PERFORMANCE MAY BE DEGRADED');
            console.error('🔧 Action required: Check template files exist and are valid JSON');
            console.error('='.repeat(80) + '\n');

            // Fallback to inline template registration for backward compatibility
            await this.registerFallbackTemplates();
        }
    }

    /**
     * Fallback inline template registration if external files are not available
     */
    async registerFallbackTemplates() {
        const { PromptTemplate } = await import('../prompts/interfaces.js');

        // Register basic fallback template
        const fallbackTemplate = new PromptTemplate({
            name: 'concept-extraction-enhanced',
            description: 'Enhanced concept extraction (fallback)',
            content: 'Extract key concepts from the following text and return them as a JSON array of strings only. Be precise and focus on the most important concepts. Text: "${text}"',
            format: 'completion',
            arguments: [
                {
                    name: 'text',
                    type: 'string',
                    required: true,
                    description: 'Text to extract concepts from'
                }
            ],
            supportedModels: ['*'],
            category: 'concept-extraction',
            metadata: {
                purpose: 'Fallback concept extraction template',
                version: '2.0',
                fallback: true
            }
        });

        this.promptManager.registerTemplate(fallbackTemplate);

        console.warn('\n' + '⚠️'.repeat(20));
        console.warn('🔄 FALLBACK TEMPLATE ACTIVE - SUBOPTIMAL PERFORMANCE');
        console.warn('📝 Using basic concept extraction template');
        console.warn('🎯 Fix external templates for model-specific optimizations');
        console.warn('⚠️'.repeat(20) + '\n');
    }

    /**
     * Initialize LLM handler for concept extraction
     */
    async initializeLLMHandler() {
        try {
            // Get LLM providers from config and find chat-capable one
            const llmProviders = this.config.get('llmProviders') || [];
            const chatProviders = llmProviders.filter(p => p.capabilities?.includes('chat'));

            // Sort by priority and use the highest priority chat provider
            const sortedProviders = chatProviders.sort((a, b) => (a.priority || 999) - (b.priority || 999));

            let llmProvider = null;
            let chatModel = null;

            // Try providers in priority order
            for (const provider of sortedProviders) {
                try {
                    chatModel = provider.chatModel || this.config.get('chatModel');

                    if (provider.type === 'mistral' && provider.apiKey) {
                        llmProvider = new MistralConnector(process.env.MISTRAL_API_KEY);
                        logger.info(`🤖 Using Mistral LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'claude' && provider.apiKey) {
                        llmProvider = new ClaudeConnector(process.env.CLAUDE_API_KEY);
                        logger.info(`🤖 Using Claude LLM with model: ${chatModel}`);
                        break;
                    } else if (provider.type === 'ollama') {
                        const ollamaBaseUrl = provider.baseUrl || this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                        llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                        logger.info(`🤖 Using Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
                        break;
                    }
                } catch (error) {
                    logger.warn(`Failed to initialize ${provider.type} provider: ${error.message}`);
                    continue;
                }
            }

            // Fallback to Ollama if no providers worked
            if (!llmProvider) {
                const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
                chatModel = this.config.get('chatModel');
                llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);
                logger.info(`🤖 Fallback to Ollama LLM at: ${ollamaBaseUrl} with model: ${chatModel}`);
            }

            // Store for unified prompt system
            this.llmProvider = llmProvider;
            this.chatModel = chatModel;

        } catch (error) {
            logger.warn('Failed to load LLM provider configuration, defaulting to Ollama:', error.message);
            const ollamaBaseUrl = this.config.get('ollama.baseUrl') || 'http://localhost:11434';
            const chatModel = this.config.get('chatModel');
            const llmProvider = new OllamaConnector(ollamaBaseUrl, chatModel);

            this.llmProvider = llmProvider;
            this.chatModel = chatModel;
        }
    }

    /**
     * Initialize embedding services directly
     */
    async initializeEmbeddingServices() {
        try {
            const embeddingProvider = this.config.get('embeddingProvider') || 'ollama';
            const embeddingModel = this.config.get('embeddingModel');

            this.embeddings = new Embeddings(this.config);

            logger.info(`🧠 Using embedding provider: ${embeddingProvider}`);
            logger.info(`🧠 Embedding model: ${embeddingModel}`);
        } catch (error) {
            logger.error('Failed to initialize embedding services:', error.message);
        }
    }

    /**
     * Generate embedding for text
     */
    async generateEmbedding(text) {
        try {
            return await this.embeddings.generateEmbedding(text);
        } catch (error) {
            logger.error('Error generating embedding:', error.message);
            throw error;
        }
    }

    /**
     * Check for existing concepts in the store to enable deduplication
     * @param {string[]} concepts - Array of concept texts to check
     * @param {string} targetGraph - Graph URI to search in
     * @returns {Object} Map of concept text to existing concept information
     */
    async checkExistingConcepts(concepts, targetGraph) {
        if (!concepts || concepts.length === 0) {
            return {};
        }

        // Check if deduplication is enabled in config
        const deduplicationConfig = this.config.get('conceptExtraction.deduplication') || {};
        if (!deduplicationConfig.enabled) {
            logger.info(`⚠️  Concept deduplication disabled in configuration - creating all concepts as new`);
            return {};
        }

        try {
            logger.info(`🔍 Checking for existing concepts: ${concepts.length} concepts to verify (deduplication enabled)`);

            // Build dynamic filter for concept text matching based on config
            const caseInsensitive = deduplicationConfig.caseInsensitive !== false; // Default true
            const maxConceptsToCheck = deduplicationConfig.maxExistingConceptsToCheck || 1000;

            const conceptFilters = concepts.map(concept => {
                const escapedConcept = concept.replace(/"/g, '\\"');
                if (caseInsensitive) {
                    return `(LCASE(?conceptContent) = LCASE("${escapedConcept}") || LCASE(?conceptText) = LCASE("${escapedConcept}"))`;
                } else {
                    return `(?conceptContent = "${escapedConcept}" || ?conceptText = "${escapedConcept}")`;
                }
            }).join(' || ');

            const conceptTextsFilter = `FILTER(${conceptFilters})`;

            // Load and execute the find-existing-concepts query
            const queryTemplate = await this.queryService.loadQuery('find-existing-concepts');
            if (!queryTemplate) {
                throw new Error('find-existing-concepts query template not found');
            }

            const query = queryTemplate
                .replace('${graphURI}', targetGraph)
                .replace('${conceptTexts}', conceptTextsFilter)
                .replace('${additionalFilters}', '')
                .replace('${limitClause}', `LIMIT ${maxConceptsToCheck}`);

            logger.debug('Executing concept existence check query...');
            const result = await this.sparqlHelper.executeSelect(query);

            if (!result.success) {
                throw new Error(`SPARQL query failed: ${result.error}`);
            }

            // Process results into a lookup map
            const existingConcepts = {};
            const bindings = result.data.results.bindings;

            for (const binding of bindings) {
                const conceptText = binding.conceptText?.value || binding.conceptContent?.value;
                if (conceptText) {
                    // Store the first (most recent) match for each concept text
                    if (!existingConcepts[conceptText.toLowerCase()]) {
                        existingConcepts[conceptText.toLowerCase()] = {
                            conceptCorpuscle: binding.conceptCorpuscle?.value,
                            conceptUnit: binding.conceptUnit?.value,
                            conceptText: conceptText,
                            conceptContent: binding.conceptContent?.value,
                            conceptLabel: binding.conceptLabel?.value,
                            embedding: binding.embedding?.value,
                            created: binding.created?.value,
                            sourceTextElement: binding.sourceTextElement?.value,
                            sourceUnit: binding.sourceUnit?.value,
                            collectionCorpuscle: binding.collectionCorpuscle?.value
                        };
                    }
                }
            }

            const foundCount = Object.keys(existingConcepts).length;
            const newCount = concepts.length - foundCount;

            logger.info(`✅ Concept deduplication check completed:`);
            logger.info(`   📋 Concepts checked: ${concepts.length}`);
            logger.info(`   🔍 Existing concepts found: ${foundCount}`);
            logger.info(`   ✨ New concepts to create: ${newCount}`);

            if (foundCount > 0) {
                const foundConcepts = Object.values(existingConcepts).map(c => c.conceptText).slice(0, 3);
                logger.info(`   📝 Sample existing: ${foundConcepts.join(', ')}${foundCount > 3 ? '...' : ''}`);
            }

            return existingConcepts;

        } catch (error) {
            logger.warn(`⚠️  Failed to check existing concepts: ${error.message}`);
            logger.warn('Falling back to creating all concepts as new (no deduplication)');
            return {}; // Return empty map to indicate no existing concepts found
        }
    }

    /**
     * Find TextElements without concepts using SPARQL template
     */
    async findTextElementsWithoutConcepts(targetGraph, limit = 0) {
        try {
            // Use SPARQL template for finding TextElements without concepts
            const query = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX olo: <http://purl.org/ontology/olo/core#>
                PREFIX semem: <http://semem.hyperdata.it/>

                SELECT ?textElement ?content WHERE {
                    GRAPH <${targetGraph}> {
                        ?textElement a ragno:TextElement ;
                                     ragno:content ?content .
                        
                        # Only process chunks (which have olo:index) to avoid original documents that are too large
                        OPTIONAL { ?textElement olo:index ?index }
                        FILTER (BOUND(?index))
                        
                        # Filter out TextElements that already have concepts extracted
                        FILTER NOT EXISTS {
                            ?textElement semem:hasConcepts true .
                        }
                    }
                }
                ${limit > 0 ? `LIMIT ${limit}` : ''}
            `;

            const storageConfig = this.config.get('storage');
            const result = await this.sparqlHelper.executeSelect(query);

            if (!result.success) {
                throw new Error(`SPARQL query failed: ${result.error}`);
            }

            return result.data.results.bindings;

        } catch (error) {
            logger.error(`Error finding TextElements without concepts: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract concepts from text using unified prompt system
     */
    async extractConcepts(content) {
        try {
            logger.info(`🧠 Extracting concepts from content (${content.length} characters) using unified prompt system...`);

            // Get config values
            const temperature = this.config.get('conceptExtraction.temperature') || 0.2;
            const retries = this.config.get('conceptExtraction.retries') || 3;

            // Create prompt context
            const context = new PromptContext({
                arguments: { text: content },
                model: this.chatModel,
                temperature: temperature
            });

            // Create prompt options
            const options = new PromptOptions({
                format: 'completion',
                temperature: temperature,
                retries: retries,
                useMemory: false,
                debug: false
            });

            // Select appropriate template based on model and availability
            let templateName = 'concept-extraction-enhanced'; // Default fallback

            if (this.chatModel.includes('mistral')) {
                const mistralTemplate = this.promptManager.getTemplate('concept-extraction-mistral');
                if (mistralTemplate) {
                    templateName = 'concept-extraction-mistral';
                    options.format = 'chat';
                } else {
                    console.warn('⚠️  Mistral-specific template not available, using fallback');
                }
            } else if (this.chatModel.includes('llama') || this.chatModel.includes('qwen')) {
                const llamaTemplate = this.promptManager.getTemplate('concept-extraction-llama');
                if (llamaTemplate) {
                    templateName = 'concept-extraction-llama';
                    options.format = 'completion';
                } else {
                    console.warn('⚠️  Llama-specific template not available, using fallback');
                }
            }

            // Final check that the selected template exists
            const selectedTemplate = this.promptManager.getTemplate(templateName);
            if (!selectedTemplate) {
                throw new Error(`No suitable concept extraction template available. Template '${templateName}' not found.`);
            }

            // Show which template is being used
            const templateFile = templateName.replace('concept-extraction-', '') + '.json';
            console.log(`Using prompt template: prompts/templates/concept-extraction/${templateFile}`);

            // Generate prompt using unified system
            const promptResult = await this.promptManager.generatePrompt(templateName, context, options);

            if (!promptResult.success) {
                throw new Error(`Prompt generation failed: ${promptResult.error}`);
            }

            // Execute the prompt with LLM
            const response = await this.executeLLMPrompt(promptResult.content, options);

            logger.info(`LLM response for concept extraction: ${response}`);

            // Parse response to extract concepts
            const concepts = this.parseConceptsFromResponse(response);

            logger.info(`✅ Extracted ${concepts.length} concepts using unified prompt system`);
            return concepts;

        } catch (error) {
            logger.error('❌ Error extracting concepts with unified prompt system:', error.message);
            throw error;
        }
    }

    /**
     * Execute LLM prompt with appropriate method
     */
    async executeLLMPrompt(promptContent, options) {
        const isMessagesFormat = Array.isArray(promptContent);
        const maxRetries = options.retries || 3;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    // Add delay between retries
                    const delay = 1000 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                if (isMessagesFormat) {
                    // Use chat method for message arrays
                    if (this.llmProvider.chat) {
                        return await this.llmProvider.chat(promptContent, {
                            model: this.chatModel,
                            temperature: options.temperature
                        });
                    } else if (this.llmProvider.generateChat) {
                        return await this.llmProvider.generateChat(
                            this.chatModel,
                            promptContent,
                            { temperature: options.temperature }
                        );
                    }
                } else {
                    // Use completion method for text prompts
                    if (this.llmProvider.complete) {
                        return await this.llmProvider.complete(promptContent, {
                            model: this.chatModel,
                            temperature: options.temperature
                        });
                    } else if (this.llmProvider.generateCompletion) {
                        return await this.llmProvider.generateCompletion(
                            this.chatModel,
                            promptContent,
                            { temperature: options.temperature }
                        );
                    }
                }

                throw new Error('LLM provider does not support required method');

            } catch (error) {
                lastError = error;

                // Check if it's a rate limit error
                if (error.code === 529 || error.message?.includes('overloaded') || error.message?.includes('rate limit')) {
                    if (attempt < maxRetries - 1) {
                        logger.warn(`Rate limited (attempt ${attempt + 1}/${maxRetries}), retrying...`);
                        continue;
                    }
                }

                // For non-rate-limit errors, throw immediately
                if (!error.message?.includes('overloaded') && error.code !== 529) {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * Parse concepts from LLM response with enhanced error handling
     */
    parseConceptsFromResponse(response) {
        try {
            // Try to parse as JSON first
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(response);
            } catch (jsonError) {
                // If not valid JSON, try to extract JSON from the response
                const jsonMatch = response.match(/\[.*\]/s);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON array found in response');
                }
            }

            // Handle different response formats
            let concepts = [];

            if (Array.isArray(parsedResponse)) {
                concepts = parsedResponse;
            } else if (typeof parsedResponse === 'object' && parsedResponse !== null) {
                // Handle object format like {"concept1": "value1", "concept2": "value2"}
                concepts = Object.values(parsedResponse);
                logger.info(`Converted object format to array with ${concepts.length} concepts`);
            } else {
                throw new Error('Response is not in expected format');
            }

            // Clean and validate concepts using config
            const maxConcepts = this.config.get('conceptExtraction.maxConcepts') || 5;
            const minLength = this.config.get('conceptExtraction.minConceptLength') || 3;
            const maxLength = this.config.get('conceptExtraction.maxConceptLength') || 100;

            const cleanedConcepts = concepts
                .filter(concept => concept && typeof concept === 'string')
                .map(concept => concept.trim())
                .filter(concept => concept.length >= minLength && concept.length <= maxLength)
                .slice(0, maxConcepts);

            logger.info(`Successfully parsed ${cleanedConcepts.length} concepts`);
            return cleanedConcepts;

        } catch (error) {
            logger.warn('JSON parsing failed, attempting manual concept extraction');

            // Fallback to manual extraction
            const extractedConcepts = this.extractConceptsManually(response);
            if (extractedConcepts.length > 0) {
                logger.info(`Manually extracted ${extractedConcepts.length} concepts`);
                return extractedConcepts;
            }

            logger.error('All concept extraction methods failed');
            logger.error('Raw response was:', response);
            return []; // Return empty array instead of throwing error
        }
    }

    /**
     * Manual concept extraction fallback (same as original)
     */
    extractConceptsManually(response) {
        const concepts = [];

        // Pattern 1: Extract from quoted strings
        const quotedPatterns = [
            /"([^"]+)"/g,
            /'([^']+)'/g,
        ];

        for (const pattern of quotedPatterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                const concept = match[1].trim();
                if (concept.length > 2 && !concepts.includes(concept)) {
                    concepts.push(concept);
                }
            }
        }

        // Pattern 2: Extract from numbered/bulleted lists
        const listPatterns = [
            /^\s*[-*•]\s*(.+)$/gm,
            /^\s*\d+\.?\s*(.+)$/gm,
        ];

        for (const pattern of listPatterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                const concept = match[1].trim().replace(/["""'']/g, '').trim();
                if (concept.length > 2 && !concepts.includes(concept)) {
                    concepts.push(concept);
                }
            }
        }

        // Pattern 3: Extract from comma-separated values (without quotes)
        if (concepts.length === 0) {
            const commaPattern = /([A-Za-z][A-Za-z0-9\s]{2,}(?:[A-Za-z0-9]|[.!?]))(?:\s*,\s*|$)/g;
            let match;
            while ((match = commaPattern.exec(response)) !== null) {
                const concept = match[1].trim();
                if (concept.length > 2 && !concepts.includes(concept)) {
                    concepts.push(concept);
                }
            }
        }

        // Limit to reasonable number and clean up using config
        const maxConcepts = this.config.get('conceptExtraction.maxConcepts') || 5;
        const minLength = this.config.get('conceptExtraction.minConceptLength') || 3;
        const maxLength = this.config.get('conceptExtraction.maxConceptLength') || 100;

        return concepts
            .slice(0, maxConcepts)
            .filter(c => c.length >= minLength && c.length <= maxLength)
            .map(c => c.replace(/["""'']/g, '').trim()); // Clean quotes
    }

    /**
     * Create embeddings for concept text values
     */
    async createConceptEmbeddings(concepts) {
        logger.info(`🧠 Generating embeddings for ${concepts.length} concepts...`);

        const conceptEmbeddings = [];

        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            try {
                logger.info(`   📝 Processing concept ${i + 1}/${concepts.length}: "${concept}"`);

                // Generate embedding for the concept text
                const embedding = await this.generateEmbedding(concept);

                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    logger.warn(`   ⚠️  Failed to generate valid embedding for concept: "${concept}"`);
                    continue;
                }

                conceptEmbeddings.push({
                    concept: concept,
                    embedding: embedding
                });

                logger.info(`   ✅ Generated embedding with ${embedding.length} dimensions`);

            } catch (error) {
                logger.error(`   ❌ Error generating embedding for concept "${concept}": ${error.message}`);
                // Continue with other concepts even if one fails
            }
        }

        logger.info(`✅ Successfully generated ${conceptEmbeddings.length} concept embeddings`);
        return conceptEmbeddings;
    }

    /**
     * Create references to existing concepts instead of new corpuscles
     * @param {string} textElementURI - URI of the source text element
     * @param {Object[]} existingConceptMappings - Array of existing concept info
     * @param {string} targetGraph - Target graph URI
     * @returns {Object} Reference data for existing concepts
     */
    async createConceptReferences(textElementURI, existingConceptMappings, targetGraph) {
        logger.info(`🔗 Creating references to ${existingConceptMappings.length} existing concepts...`);

        const now = new Date().toISOString();
        const referencedConceptURIs = [];
        let referenceTriples = '';

        for (const conceptInfo of existingConceptMappings) {
            const conceptUnit = conceptInfo.conceptUnit;
            const conceptText = conceptInfo.conceptText;

            if (conceptUnit) {
                referencedConceptURIs.push(conceptUnit);

                // Create lightweight reference relationship
                referenceTriples += `
                    # Reference to existing concept instead of creating duplicate
                    <${textElementURI}> semem:referencesConcept <${conceptUnit}> ;
                                       semem:conceptDerivation "reference" ;
                                       dcterms:created "${now}"^^xsd:dateTime .
                    
                    # Track this text element as a new source for the concept
                    <${conceptUnit}> semem:referencedBy <${textElementURI}> ;
                                    semem:lastReferenced "${now}"^^xsd:dateTime .
                `;
            }
        }

        logger.info(`✅ Generated references to ${referencedConceptURIs.length} existing concepts`);

        return {
            referencedConceptURIs,
            referenceTriples,
            type: 'references'
        };
    }

    /**
     * Create concept corpuscles with embeddings and store in SPARQL (enhanced with deduplication)
     */
    async createConceptCorpuscles(textElementURI, conceptEmbeddings, targetGraph) {
        logger.info(`📦 Creating concept corpuscles for ${conceptEmbeddings.length} concepts with deduplication...`);

        // Step 1: Check for existing concepts to enable deduplication
        const conceptTexts = conceptEmbeddings.map(ce => ce.concept);
        const existingConcepts = await this.checkExistingConcepts(conceptTexts, targetGraph);

        // Step 2: Separate existing vs new concepts
        const existingConceptMappings = [];
        const newConceptEmbeddings = [];

        for (const { concept, embedding } of conceptEmbeddings) {
            const existingInfo = existingConcepts[concept.toLowerCase()];
            if (existingInfo && existingInfo.conceptUnit) {
                existingConceptMappings.push(existingInfo);
            } else {
                newConceptEmbeddings.push({ concept, embedding });
            }
        }

        logger.info(`📊 Deduplication analysis:`);
        logger.info(`   🔍 Found ${existingConceptMappings.length} existing concepts to reference`);
        logger.info(`   ✨ Creating ${newConceptEmbeddings.length} new concept corpuscles`);

        // Step 3: Create references to existing concepts
        let referenceData = { referencedConceptURIs: [], referenceTriples: '', type: 'references' };
        if (existingConceptMappings.length > 0) {
            referenceData = await this.createConceptReferences(textElementURI, existingConceptMappings, targetGraph);
        }

        // Step 4: Create new concept corpuscles for concepts that don't exist
        let newConceptData = { conceptURIs: [], conceptCorpuscleURIs: [], conceptTriples: '', type: 'new' };
        if (newConceptEmbeddings.length > 0) {
            newConceptData = await this.createNewConceptCorpuscles(textElementURI, newConceptEmbeddings, targetGraph);
        }

        // Step 5: Combine all concept URIs for collection corpuscle
        const allConceptURIs = [
            ...referenceData.referencedConceptURIs,
            ...newConceptData.conceptURIs
        ];

        // Step 6: Combine all triples
        const combinedTriples = [
            referenceData.referenceTriples,
            newConceptData.conceptTriples
        ].filter(t => t.trim()).join('\n');

        logger.info(`✅ Concept processing completed:`);
        logger.info(`   🔗 Referenced existing: ${referenceData.referencedConceptURIs.length}`);
        logger.info(`   📦 Created new corpuscles: ${newConceptData.conceptCorpuscleURIs.length}`);
        logger.info(`   📋 Total concepts: ${allConceptURIs.length}`);

        return {
            conceptURIs: allConceptURIs,
            conceptCorpuscleURIs: newConceptData.conceptCorpuscleURIs, // Only new corpuscles
            referencedConceptURIs: referenceData.referencedConceptURIs,
            conceptTriples: combinedTriples,
            stats: {
                existing: existingConceptMappings.length,
                new: newConceptEmbeddings.length,
                total: allConceptURIs.length,
                deduplicationEnabled: true
            }
        };
    }

    /**
     * Create new concept corpuscles for concepts that don't already exist
     */
    async createNewConceptCorpuscles(textElementURI, conceptEmbeddings, targetGraph) {
        logger.info(`📦 Creating ${conceptEmbeddings.length} new concept corpuscles...`);

        const now = new Date().toISOString();
        const conceptCorpuscleURIs = [];
        const conceptURIs = [];
        let conceptTriples = '';

        for (let i = 0; i < conceptEmbeddings.length; i++) {
            const { concept, embedding } = conceptEmbeddings[i];

            // Generate URIs for concept unit and corpuscle
            const conceptURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept', concept);
            const conceptCorpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'concept-corpuscle', concept);

            conceptURIs.push(conceptURI);
            conceptCorpuscleURIs.push(conceptCorpuscleURI);

            // Convert embedding to comma-separated string
            const embeddingString = embedding.join(',');

            conceptTriples += `
                # Concept unit
                <${conceptURI}> a ragno:Unit ;
                    rdfs:label ${SPARQLHelper.createLiteral(concept)} ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:inCorpuscle <${conceptCorpuscleURI}> ;
                    semem:conceptDerivation "new" .
                
                # Individual concept corpuscle with embedding
                <${conceptCorpuscleURI}> a ragno:Corpuscle ;
                    rdfs:label ${SPARQLHelper.createLiteral('Concept: ' + concept)} ;
                    dcterms:created "${now}"^^xsd:dateTime ;
                    prov:wasDerivedFrom <${textElementURI}> ;
                    ragno:content ${SPARQLHelper.createLiteral(concept)} ;
                    ragno:embedding ${SPARQLHelper.createLiteral(embeddingString)} ;
                    skos:member <${conceptURI}> .
            `;
        }

        return {
            conceptURIs,
            conceptCorpuscleURIs,
            conceptTriples,
            type: 'new'
        };
    }

    /**
     * Create collection corpuscle that groups all concepts from a text element
     */
    async createCollectionCorpuscle(textElementURI, conceptURIs, targetGraph) {
        logger.info(`📦 Creating collection corpuscle for ${conceptURIs.length} concepts...`);

        const now = new Date().toISOString();
        const collectionCorpuscleURI = URIMinter.mintURI('http://purl.org/stuff/instance/', 'corpuscle', textElementURI);

        const conceptMembers = conceptURIs.map(uri => `<${uri}>`).join(', ');

        const collectionTriples = `
            # Collection corpuscle that groups all concepts from this text element
            <${collectionCorpuscleURI}> a ragno:Corpuscle ;
                rdfs:label ${SPARQLHelper.createLiteral('Concepts from ' + textElementURI.split('/').pop())} ;
                dcterms:created "${now}"^^xsd:dateTime ;
                prov:wasDerivedFrom <${textElementURI}> ;
                skos:member ${conceptMembers} .
        `;

        return {
            collectionCorpuscleURI,
            collectionTriples
        };
    }

    /**
     * Store all concept-related data in SPARQL store (enhanced for deduplication)
     */
    async storeConceptData(textElementURI, conceptTriples, collectionTriples, collectionCorpuscleURI, targetGraph, stats = null) {
        logger.info(`💾 Storing concept data in SPARQL store...`);

        const updateTriples = `
            # Mark TextElement as having concepts extracted
            <${textElementURI}> semem:hasConcepts true ;
                               semem:hasCorpuscle <${collectionCorpuscleURI}> .
            
            ${conceptTriples}
            
            ${collectionTriples}
        `;

        const query = this.sparqlHelper.createInsertDataQuery(targetGraph, updateTriples);
        const result = await this.sparqlHelper.executeUpdate(query);

        if (!result.success) {
            throw new Error(`Failed to store concept data: ${result.error}`);
        }

        if (stats && stats.deduplicationEnabled) {
            logger.info(`✅ Successfully stored concept data with deduplication:`);
            logger.info(`   🔗 Referenced existing concepts: ${stats.existing}`);
            logger.info(`   📦 Created new corpuscles: ${stats.new}`);
            logger.info(`   📋 Total concepts processed: ${stats.total}`);
        } else {
            logger.info(`✅ Successfully stored concept data in SPARQL store`);
        }
    }

    /**
     * Process a single text element and extract concepts with embeddings
     */
    async processTextElement(textElement, targetGraph) {
        const textElementURI = textElement.textElement.value;
        const content = textElement.content.value;

        logger.info(`📄 Processing TextElement: ${textElementURI}`);
        logger.info(`   📏 Content length: ${content.length} characters`);

        try {
            // Step 1: Extract concepts using unified prompt system
            const concepts = await this.extractConcepts(content);

            if (concepts.length === 0) {
                logger.info(`   ⚠️  No concepts extracted, marking as processed`);

                // Mark as processed even if no concepts found
                const markProcessedTriples = `
                    <${textElementURI}> semem:hasConcepts true .
                `;

                const query = this.sparqlHelper.createInsertDataQuery(targetGraph, markProcessedTriples);
                await this.sparqlHelper.executeUpdate(query);

                return {
                    textElementURI,
                    conceptCount: 0,
                    collectionCorpuscleURI: null,
                    conceptCorpuscleURIs: [],
                    concepts: []
                };
            }

            // Step 2: Create embeddings for concepts
            const conceptEmbeddings = await this.createConceptEmbeddings(concepts);

            if (conceptEmbeddings.length === 0) {
                logger.warn(`   ⚠️  No embeddings generated for concepts, marking as processed`);

                // Mark as processed even if no embeddings generated
                const markProcessedTriples = `
                    <${textElementURI}> semem:hasConcepts true .
                `;

                const query = this.sparqlHelper.createInsertDataQuery(targetGraph, markProcessedTriples);
                await this.sparqlHelper.executeUpdate(query);

                return {
                    textElementURI,
                    conceptCount: concepts.length,
                    collectionCorpuscleURI: null,
                    conceptCorpuscleURIs: [],
                    concepts: concepts
                };
            }

            // Step 3: Create concept corpuscles with embeddings (with deduplication)
            const { conceptURIs, conceptCorpuscleURIs, referencedConceptURIs, conceptTriples, stats } =
                await this.createConceptCorpuscles(textElementURI, conceptEmbeddings, targetGraph);

            // Step 4: Create collection corpuscle
            const { collectionCorpuscleURI, collectionTriples } =
                await this.createCollectionCorpuscle(textElementURI, conceptURIs, targetGraph);

            // Step 5: Store all data in SPARQL store
            await this.storeConceptData(
                textElementURI,
                conceptTriples,
                collectionTriples,
                collectionCorpuscleURI,
                targetGraph,
                stats
            );

            logger.info(`   ✅ Successfully processed with deduplication using unified prompt system`);
            logger.info(`   📝 Concepts: ${concepts.slice(0, 5).join(', ')}${concepts.length > 5 ? '...' : ''}`);

            return {
                textElementURI,
                conceptCount: conceptEmbeddings.length,
                collectionCorpuscleURI,
                conceptCorpuscleURIs,
                referencedConceptURIs: referencedConceptURIs || [],
                concepts,
                deduplicationStats: stats
            };

        } catch (error) {
            logger.error(`   ❌ Error processing ${textElementURI}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Main processing method
     */
    async processTextElements(options = {}) {
        if (!this.initialized) {
            await this.init();
        }

        const { limit = 0, graph } = options;

        const storageConfig = this.config.get('storage');
        const targetGraph = graph || storageConfig.options.graphName ||
            this.config.get('graphName') ||
            'http://tensegrity.it/semem';

        logger.info(`🔍 Finding TextElements without concepts in graph: ${targetGraph}`);
        logger.info(`📏 Limit: ${limit === 0 ? 'No limit (process all)' : limit}`);

        const textElementsWithoutConcepts = await this.findTextElementsWithoutConcepts(targetGraph, limit);
        logger.info(`📋 Found ${textElementsWithoutConcepts.length} TextElements without concepts`);

        if (textElementsWithoutConcepts.length === 0) {
            logger.info('✅ All TextElements already have concepts extracted.');
            return [];
        }

        const results = [];
        let processed = 0;
        let failed = 0;
        let totalConcepts = 0;
        let totalCorpuscles = 0;
        let totalReferencedConcepts = 0;
        let totalNewConcepts = 0;
        let totalExistingConcepts = 0;

        for (const textElement of textElementsWithoutConcepts) {
            try {
                const result = await this.processTextElement(textElement, targetGraph);
                results.push(result);
                processed++;
                totalConcepts += result.conceptCount;
                totalCorpuscles += result.conceptCorpuscleURIs.length;
                if (result.collectionCorpuscleURI) {
                    totalCorpuscles += 1; // Add collection corpuscle
                }

                // Track deduplication statistics
                if (result.deduplicationStats) {
                    totalNewConcepts += result.deduplicationStats.new;
                    totalExistingConcepts += result.deduplicationStats.existing;
                }
                totalReferencedConcepts += (result.referencedConceptURIs || []).length;

            } catch (error) {
                logger.error(`Failed to process TextElement: ${error.message}`);
                failed++;
            }
        }

        logger.info(`\n📊 Enhanced Concept Extraction Summary (With Deduplication):`);
        logger.info(`   ✅ Successfully processed: ${processed} TextElements`);
        logger.info(`   ❌ Failed: ${failed} TextElements`);
        logger.info(`   🧠 Total concepts extracted: ${totalConcepts}`);
        logger.info(`   📦 Total corpuscles created: ${totalCorpuscles}`);
        logger.info(`   🔗 Collection corpuscles: ${results.filter(r => r.collectionCorpuscleURI).length}`);
        logger.info(`   ✨ New concept corpuscles: ${totalNewConcepts}`);
        logger.info(`   🔍 Existing concepts referenced: ${totalExistingConcepts}`);
        logger.info(`   💡 Deduplication efficiency: ${totalExistingConcepts > 0 ? Math.round((totalExistingConcepts / totalConcepts) * 100) : 0}% concepts reused`);
        logger.info(`   🎯 Graph: ${targetGraph}`);
        logger.info(`   🎯 Prompt System: Unified (v2.0) + Deduplication`);

        return results;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.embeddingHandler && typeof this.embeddingHandler.cleanup === 'function') {
            await this.embeddingHandler.cleanup();
        }

        if (this.sparqlHelper && typeof this.sparqlHelper.cleanup === 'function') {
            await this.sparqlHelper.cleanup();
        }

        if (this.queryService && typeof this.queryService.cleanup === 'function') {
            await this.queryService.cleanup();
        }

        this.initialized = false;
        logger.info('✅ CreateConceptsUnified cleanup completed');
    }
}