#!/usr/bin/env node

/**
 * @fileoverview Module 9: Multi-Modal Question Answering
 * 
 * This module implements an intelligent question answering system that leverages
 * the semantic knowledge graph to provide comprehensive, cross-domain answers.
 * It combines semantic search, entity recognition, and LLM-based reasoning to
 * deliver contextual responses with source attribution and confidence scoring.
 * 
 * Dependencies: Module 2 (Enrich) - requires knowledge graph entities
 *               Module 3 (Search) - requires semantic search capabilities
 * 
 * Usage:
 *   node examples/end-to-end/QA.js
 * 
 * Features:
 * - Question analysis and intent recognition
 * - Entity extraction and semantic search
 * - Cross-domain knowledge integration
 * - Context-aware answer generation using LLM
 * - Confidence scoring and source attribution
 * - Multi-step reasoning for complex questions
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Config from '../../src/Config.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import { Embeddings } from '../../src/core/Embeddings.js';
import EmbeddingsAPIBridge from '../../src/services/EmbeddingsAPIBridge.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import CacheManager from '../../src/handlers/CacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Question Answering System
 */
class QuestionAnsweringSystem {
    constructor(llmHandler, embeddingHandler) {
        this.llmHandler = llmHandler;
        this.embeddingHandler = embeddingHandler;
        this.entities = [];
        this.documents = [];
        this.questionTypes = {
            factual: /^(what|who|when|where|which)/i,
            howTo: /^how (do|to|can)/i,
            why: /^why/i,
            comparison: /(compare|difference|versus|vs)/i,
            definition: /(define|meaning|what is)/i,
            causation: /(cause|effect|result|lead to)/i
        };
    }

    /**
     * Analyze question to determine type and extract key terms
     */
    analyzeQuestion(question) {
        const analysis = {
            question: question.trim(),
            type: 'general',
            keywords: [],
            entities: [],
            complexity: 'simple'
        };

        // Determine question type
        for (const [type, pattern] of Object.entries(this.questionTypes)) {
            if (pattern.test(question)) {
                analysis.type = type;
                break;
            }
        }

        // Extract keywords (simple approach - remove stop words)
        const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can']);
        
        const words = question.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
        
        analysis.keywords = [...new Set(words)];

        // Determine complexity
        if (question.includes(' and ') || question.includes(' or ') || question.includes(',') || words.length > 10) {
            analysis.complexity = 'complex';
        } else if (words.length > 6) {
            analysis.complexity = 'moderate';
        }

        return analysis;
    }

    /**
     * Find relevant entities using semantic search
     */
    async findRelevantEntities(question, topK = 5) {
        console.log(`🔍 Searching for entities relevant to: "${question}"`);
        
        // Generate embedding for the question
        const questionEmbedding = await this.embeddingHandler.generateEmbedding(question);
        if (!questionEmbedding) {
            console.log('⚠️  Failed to generate question embedding');
            return [];
        }

        const results = [];
        
        // Search through entities
        for (const entity of this.entities) {
            if (!entity.embedding || entity.embedding.length !== questionEmbedding.length) {
                continue;
            }
            
            const similarity = this.cosineSimilarity(questionEmbedding, entity.embedding);
            results.push({
                ...entity,
                similarity: similarity,
                type: 'entity'
            });
        }

        // Search through documents if available
        for (const doc of this.documents) {
            if (!doc.embedding || doc.embedding.length !== questionEmbedding.length) {
                continue;
            }
            
            const similarity = this.cosineSimilarity(questionEmbedding, doc.embedding);
            results.push({
                ...doc,
                similarity: similarity,
                type: 'document'
            });
        }

        // Sort by similarity and return top K
        const topResults = results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        console.log(`   Found ${topResults.length} relevant knowledge items`);
        topResults.forEach((item, idx) => {
            const name = item.name || item.title;
            console.log(`   ${idx + 1}. ${name} (${item.similarity.toFixed(3)})`);
        });

        return topResults;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }

    /**
     * Generate context from relevant entities and documents
     */
    buildContext(relevantItems, question) {
        if (relevantItems.length === 0) {
            return "No specific knowledge found in the database.";
        }

        let context = "Based on the knowledge graph, here are relevant pieces of information:\n\n";
        
        relevantItems.forEach((item, idx) => {
            const name = item.name || item.title;
            const content = item.content || `Entity: ${name}`;
            const source = item.id || name;
            
            context += `${idx + 1}. **${name}** (relevance: ${(item.similarity * 100).toFixed(1)}%)\n`;
            context += `   ${content}\n`;
            context += `   Source: ${source}\n\n`;
        });

        return context;
    }

    /**
     * Generate answer using LLM with context
     */
    async generateAnswer(question, context, questionAnalysis) {
        const systemPrompt = this.buildSystemPrompt(questionAnalysis);
        
        const prompt = `${systemPrompt}

CONTEXT:
${context}

QUESTION: ${question}

Please provide a comprehensive answer based on the context provided. Include:
1. A direct answer to the question
2. Supporting details from the context
3. Cross-connections between different knowledge areas if relevant
4. Acknowledgment of any limitations in the available information

ANSWER:`;

        try {
            console.log('🤖 Generating answer using LLM...');
            const response = await this.llmHandler.generateResponse(
                prompt,
                '', // no additional context needed
                {
                    temperature: 0.7
                }
            );

            return response.trim();
        } catch (error) {
            console.log(`⚠️  LLM generation failed: ${error.message}`);
            return this.generateFallbackAnswer(question, context, questionAnalysis);
        }
    }

    /**
     * Build system prompt based on question analysis
     */
    buildSystemPrompt(analysis) {
        let prompt = "You are an AI assistant that answers questions using a semantic knowledge graph. ";
        
        switch (analysis.type) {
            case 'factual':
                prompt += "Provide precise, factual answers with specific details.";
                break;
            case 'howTo':
                prompt += "Provide step-by-step explanations and practical guidance.";
                break;
            case 'why':
                prompt += "Focus on explanations, causes, and reasoning.";
                break;
            case 'comparison':
                prompt += "Compare and contrast the relevant concepts, highlighting similarities and differences.";
                break;
            case 'definition':
                prompt += "Provide clear definitions and explanations of concepts.";
                break;
            case 'causation':
                prompt += "Explain causal relationships and their mechanisms.";
                break;
            default:
                prompt += "Provide comprehensive information relevant to the question.";
        }

        prompt += " Use only information from the provided context and clearly indicate if information is limited.";
        
        return prompt;
    }

    /**
     * Generate fallback answer when LLM fails
     */
    generateFallbackAnswer(question, context, analysis) {
        const relevantLines = context.split('\n').filter(line => 
            line.trim() && !line.startsWith('Source:') && !line.match(/^\d+\./)
        );

        if (relevantLines.length === 0) {
            return "I don't have sufficient information in the knowledge graph to answer this question.";
        }

        let answer = `Based on the available knowledge graph information:\n\n`;
        answer += relevantLines.slice(0, 3).join('\n');
        answer += `\n\nThis answer is generated from ${relevantLines.length} relevant knowledge items in the database.`;

        return answer;
    }

    /**
     * Calculate confidence score for the answer
     */
    calculateConfidence(relevantItems, questionAnalysis) {
        if (relevantItems.length === 0) {
            return { score: 0.1, reasoning: "No relevant information found" };
        }

        let confidence = 0;
        
        // Base confidence from similarity scores
        const avgSimilarity = relevantItems.reduce((sum, item) => sum + item.similarity, 0) / relevantItems.length;
        confidence += avgSimilarity * 0.6;

        // Boost for multiple relevant sources
        const sourceBonus = Math.min(relevantItems.length / 5, 0.2);
        confidence += sourceBonus;

        // Adjust based on question complexity
        switch (questionAnalysis.complexity) {
            case 'simple':
                confidence += 0.1;
                break;
            case 'moderate':
                // No change
                break;
            case 'complex':
                confidence -= 0.1;
                break;
        }

        // Ensure confidence is between 0 and 1
        confidence = Math.max(0, Math.min(1, confidence));

        let reasoning = `Based on ${relevantItems.length} relevant sources `;
        reasoning += `with average similarity ${(avgSimilarity * 100).toFixed(1)}%`;

        return { score: confidence, reasoning };
    }

    /**
     * Generate source attribution
     */
    generateAttribution(relevantItems) {
        if (relevantItems.length === 0) {
            return [];
        }

        return relevantItems.map(item => ({
            name: item.name || item.title,
            id: item.id,
            similarity: item.similarity,
            type: item.type
        }));
    }

    /**
     * Answer a question with full pipeline
     */
    async answerQuestion(question) {
        console.log(`\n❓ Question: "${question}"`);
        console.log('─'.repeat(60));

        // Step 1: Analyze question
        console.log('📊 Analyzing question...');
        const analysis = this.analyzeQuestion(question);
        console.log(`   Type: ${analysis.type}, Complexity: ${analysis.complexity}`);
        console.log(`   Keywords: ${analysis.keywords.join(', ')}`);

        // Step 2: Find relevant knowledge
        const relevantItems = await this.findRelevantEntities(question, 5);

        // Step 3: Build context
        console.log('🏗️  Building context from knowledge graph...');
        const context = this.buildContext(relevantItems, question);

        // Step 4: Generate answer
        const answer = await this.generateAnswer(question, context, analysis);

        // Step 5: Calculate confidence and attribution
        const confidence = this.calculateConfidence(relevantItems, analysis);
        const sources = this.generateAttribution(relevantItems);

        const result = {
            question: question,
            answer: answer,
            confidence: confidence,
            sources: sources,
            analysis: analysis,
            relevantItems: relevantItems.length
        };

        // Display result
        this.displayResult(result);

        return result;
    }

    /**
     * Display formatted result
     */
    displayResult(result) {
        console.log('\n💬 Answer:');
        console.log(result.answer);
        
        console.log(`\n📊 Confidence: ${(result.confidence.score * 100).toFixed(1)}%`);
        console.log(`   ${result.confidence.reasoning}`);

        if (result.sources.length > 0) {
            console.log('\n📚 Sources:');
            result.sources.forEach((source, idx) => {
                console.log(`   ${idx + 1}. ${source.name} (${source.type}, ${(source.similarity * 100).toFixed(1)}% relevant)`);
            });
        }

        console.log(`\n🔍 Analysis: ${result.analysis.type} question, ${result.analysis.complexity} complexity`);
        console.log(`📈 Knowledge items used: ${result.relevantItems}`);
    }

    /**
     * Load entities and documents for QA
     */
    async loadKnowledge(entities, documents = []) {
        this.entities = entities;
        this.documents = documents;
        console.log(`✅ Loaded ${entities.length} entities and ${documents.length} documents for QA`);
    }
}

/**
 * Create LLM handler based on config
 */
async function createLLMHandler(config) {
    const chatConfig = config.get('models.chat');
    const provider = chatConfig?.provider || 'ollama';
    const model = chatConfig?.model || 'qwen2:1.5b';
    
    console.log(`🤖 Initializing ${provider} LLM handler with model: ${model}`);
    
    let llmConnector;
    
    if (provider === 'mistral') {
        const apiKey = process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            console.log('⚠️  MISTRAL_API_KEY not found, falling back to Ollama');
            llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        } else {
            console.log(`✅ Using Mistral API with model: ${model}`);
            llmConnector = new MistralConnector(apiKey, 'https://api.mistral.ai/v1', model);
            await llmConnector.initialize();
        }
    } else if (provider === 'claude') {
        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            console.log('⚠️  CLAUDE_API_KEY not found, falling back to Ollama');
            llmConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b');
        } else {
            llmConnector = new ClaudeConnector(apiKey, model);
        }
    } else {
        // Default to Ollama
        const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
        llmConnector = new OllamaConnector(ollamaBaseUrl, model);
    }
    
    return new LLMHandler(llmConnector, model);
}

/**
 * Execute SPARQL SELECT query
 */
async function executeSparqlSelect(query, config) {
    const sparqlEndpoints = config.get('sparqlEndpoints');
    const endpoint = sparqlEndpoints[0];
    const queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
    
    const response = await fetch(queryEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/sparql-query',
            'Accept': 'application/sparql-results+json',
            'Authorization': `Basic ${Buffer.from(`${endpoint.user}:${endpoint.password}`).toString('base64')}`
        },
        body: query
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SPARQL SELECT failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Load knowledge graph data
 */
async function loadKnowledgeGraph(config) {
    console.log('📚 Loading knowledge graph data...');
    
    // Load entities with embeddings
    const entitiesQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        
        SELECT ?entity ?name ?embedding ?content WHERE {
            GRAPH <http://semem.hyperdata.it/end-to-end> {
                ?entity a ragno:Element ;
                       skos:prefLabel ?name ;
                       ragno:embedding ?embedding .
                OPTIONAL { ?entity ragno:content ?content }
            }
        }
    `;
    
    const entitiesResult = await executeSparqlSelect(entitiesQuery, config);
    const entityBindings = entitiesResult.results?.bindings || [];
    
    console.log(`📊 Found ${entityBindings.length} entities`);
    
    const entities = [];
    for (const entity of entityBindings) {
        try {
            const embeddingStr = entity.embedding.value;
            const embedding = JSON.parse(embeddingStr);
            
            if (Array.isArray(embedding) && embedding.length === 1536) {
                entities.push({
                    id: entity.entity.value,
                    name: entity.name.value,
                    content: entity.content?.value || `Entity: ${entity.name.value}`,
                    embedding: embedding
                });
            }
        } catch (error) {
            console.log(`⚠️  Failed to parse entity ${entity.name.value}: ${error.message}`);
        }
    }

    // Load documents if available
    const documentsQuery = `
        PREFIX ragno: <http://purl.org/stuff/ragno/>
        PREFIX dcterms: <http://purl.org/dc/terms/>
        
        SELECT ?doc ?title ?content WHERE {
            GRAPH <http://semem.hyperdata.it/end-to-end> {
                ?doc a ragno:Document ;
                     dcterms:title ?title ;
                     ragno:content ?content .
            }
        }
    `;
    
    const documentsResult = await executeSparqlSelect(documentsQuery, config);
    const documentBindings = documentsResult.results?.bindings || [];
    
    const documents = documentBindings.map(doc => ({
        id: doc.doc.value,
        title: doc.title.value,
        content: doc.content.value
    }));

    console.log(`📖 Found ${documents.length} documents`);
    console.log(`✅ Loaded knowledge graph: ${entities.length} entities, ${documents.length} documents\n`);
    
    return { entities, documents };
}

/**
 * QA Module Class for orchestrator integration
 */
class QAModule {
    constructor(config = null) {
        this.config = config;
        this.results = {
            questionsAnswered: 0,
            averageConfidence: 0,
            totalSources: 0,
            questionTypes: {},
            bestAnswer: '',
            bestConfidence: 0,
            success: false
        };
    }

    async initialize() {
        if (!this.config) {
            this.config = new Config();
            await this.config.init();
        }
    }

    async execute() {
        const analysisResults = await runQAAnalysis();
        this.results.questionsAnswered = analysisResults?.questionsAnswered || 0;
        this.results.averageConfidence = analysisResults?.averageConfidence || 0;
        this.results.totalSources = analysisResults?.totalSources || 0;
        this.results.questionTypes = analysisResults?.questionTypes || {};
        this.results.bestAnswer = analysisResults?.bestAnswer || '';
        this.results.bestConfidence = analysisResults?.bestConfidence || 0;
        this.results.success = true;
    }

    async cleanup() {
        // Cleanup if needed
    }

    getResults() {
        return this.results;
    }
}

/**
 * Main QA analysis function
 */
async function runQAAnalysis() {
    console.log('💬 === MODULE 9: MULTI-MODAL QUESTION ANSWERING ===\n');
    
    try {
        // Initialize configuration
        const config = new Config();
        await config.init();
        
        console.log('✓ Configuration initialized');
        
        // Create LLM handler based on config
        const llmHandler = await createLLMHandler(config);
        console.log('✅ LLM handler created with config-based provider');
        
        // Initialize embedding handler (still uses Ollama for embeddings)
        const ollamaBaseUrl = config.get('ollama.baseUrl') || 'http://localhost:11434';
        
        // Test Ollama connection for embeddings
        console.log('🔌 Testing Ollama connection for embeddings...');
        const response = await fetch(`${ollamaBaseUrl}/api/version`);
        if (!response.ok) {
            throw new Error(`Ollama is required for embeddings. Please start Ollama at ${ollamaBaseUrl}`);
        }
        
        const ollamaConnector = new OllamaConnector(ollamaBaseUrl, 'qwen2:1.5b');
        
        // Initialize cache manager and embedding handler
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });
        
        const embeddingHandler = new Embeddings(
            new EmbeddingsAPIBridge(ollamaConnector, 'nomic-embed-text:latest', 1536, cacheManager)
        );
        
        console.log('✅ LLM and embedding services initialized');
        
        // Load knowledge graph
        const { entities, documents } = await loadKnowledgeGraph(config);
        
        if (entities.length === 0) {
            console.log('❌ No entities found. Please run Module 2 (Enrich) first.');
            return {
                questionsAnswered: 0,
                averageConfidence: 0,
                totalSources: 0,
                questionTypes: {},
                bestAnswer: '',
                bestConfidence: 0
            };
        }
        
        // Initialize QA system
        const qaSystem = new QuestionAnsweringSystem(llmHandler, embeddingHandler);
        await qaSystem.loadKnowledge(entities, documents);
        
        console.log('🚀 Question Answering system initialized\n');
        
        // Define test questions covering different types and domains
        const testQuestions = [
            "What is neural network learning?",
            "How do climate patterns affect ocean circulation?",
            "Why is sustainable urban planning important?",
            "What are the main differences between neural networks and traditional algorithms?",
            "How does memory formation work in the brain?",
            "What causes environmental impacts from transportation systems?",
            "Compare climate science and neuroscience research methods",
            "What connections exist between urban planning and environmental science?"
        ];
        
        console.log(`🎯 Testing QA system with ${testQuestions.length} questions...`);
        
        const results = [];
        let totalConfidence = 0;
        let totalSources = 0;
        const questionTypeCount = {};
        let bestResult = null;
        
        for (let i = 0; i < testQuestions.length; i++) {
            const question = testQuestions[i];
            console.log(`\n${'='.repeat(80)}`);
            console.log(`Question ${i + 1}/${testQuestions.length}`);
            console.log('='.repeat(80));
            
            // Add delay between questions to avoid rate limiting
            if (i > 0) {
                console.log('   ⏱️  Waiting to avoid rate limits...');
                await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
            }
            
            try {
                const result = await qaSystem.answerQuestion(question);
                
                totalConfidence += result.confidence.score;
                totalSources += result.sources.length;
                
                // Track question types
                const type = result.analysis.type;
                questionTypeCount[type] = (questionTypeCount[type] || 0) + 1;
                
                // Track best result
                if (!bestResult || result.confidence.score > bestResult.confidence.score) {
                    bestResult = result;
                }
                
                results.push(result);
                
            } catch (error) {
                console.log(`❌ Question failed: ${error.message}`);
            }
        }
        
        // Generate summary analysis
        console.log('\n' + '='.repeat(80));
        console.log('🎯 QUESTION ANSWERING SUMMARY');
        console.log('='.repeat(80));
        
        const avgConfidence = results.length > 0 ? totalConfidence / results.length : 0;
        const avgSources = results.length > 0 ? totalSources / results.length : 0;
        
        console.log(`\n📊 Overall Performance:`);
        console.log(`   Questions Answered: ${results.length}/${testQuestions.length}`);
        console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        console.log(`   Average Sources per Answer: ${avgSources.toFixed(1)}`);
        console.log(`   Total Knowledge Sources Used: ${totalSources}`);
        
        if (bestResult) {
            console.log(`\n🏆 Best Answer:`);
            console.log(`   Question: "${bestResult.question}"`);
            console.log(`   Confidence: ${(bestResult.confidence.score * 100).toFixed(1)}%`);
            console.log(`   Sources: ${bestResult.sources.length}`);
        }
        
        // Question type analysis
        console.log(`\n📋 Question Type Distribution:`);
        Object.entries(questionTypeCount).forEach(([type, count]) => {
            const percentage = ((count / results.length) * 100).toFixed(1);
            console.log(`   ${type}: ${count} questions (${percentage}%)`);
        });
        
        // Confidence distribution
        const highConfidence = results.filter(r => r.confidence.score > 0.7).length;
        const mediumConfidence = results.filter(r => r.confidence.score >= 0.4 && r.confidence.score <= 0.7).length;
        const lowConfidence = results.filter(r => r.confidence.score < 0.4).length;
        
        console.log(`\n🎯 Confidence Distribution:`);
        console.log(`   High Confidence (>70%): ${highConfidence}/${results.length}`);
        console.log(`   Medium Confidence (40-70%): ${mediumConfidence}/${results.length}`);
        console.log(`   Low Confidence (<40%): ${lowConfidence}/${results.length}`);
        
        // Cross-domain analysis
        console.log(`\n🌐 Cross-Domain Capabilities:`);
        const crossDomainQuestions = results.filter(r => 
            r.question.toLowerCase().includes('between') || 
            r.question.toLowerCase().includes('compare') ||
            r.question.toLowerCase().includes('connection')
        );
        console.log(`   Cross-domain questions: ${crossDomainQuestions.length}/${results.length}`);
        if (crossDomainQuestions.length > 0) {
            const avgCrossDomainConfidence = crossDomainQuestions.reduce((sum, r) => 
                sum + r.confidence.score, 0) / crossDomainQuestions.length;
            console.log(`   Cross-domain average confidence: ${(avgCrossDomainConfidence * 100).toFixed(1)}%`);
        }
        
        console.log(`\n💡 Key Insights:`);
        if (avgConfidence > 0.6) {
            console.log(`   ✓ QA system shows high overall confidence in answers`);
        } else if (avgConfidence > 0.4) {
            console.log(`   ⚠️ QA system shows moderate confidence - may need more training data`);
        } else {
            console.log(`   ⚠️ QA system shows low confidence - knowledge graph may be insufficient`);
        }
        
        if (avgSources > 2) {
            console.log(`   ✓ Good source attribution with multiple knowledge references`);
        }
        
        if (highConfidence > results.length / 2) {
            console.log(`   ✓ Majority of answers have high confidence scores`);
        }
        
        if (totalSources > 0) {
            console.log(`   ✓ Successfully integrated ${totalSources} knowledge sources across all answers`);
        }
        
        console.log('\n🎉 Question Answering analysis completed successfully!');
        
        // Return results for orchestrator
        return {
            questionsAnswered: results.length,
            averageConfidence: avgConfidence,
            totalSources: totalSources,
            questionTypes: questionTypeCount,
            bestAnswer: bestResult?.question || '',
            bestConfidence: bestResult?.confidence.score || 0
        };
        
    } catch (error) {
        console.error('❌ QA analysis failed:', error.message);
        if (error.message.includes('Ollama')) {
            console.log('\n💡 Tip: Make sure Ollama is running with the required models (qwen2:1.5b, nomic-embed-text)');
        }
        if (error.message.includes('Entity') || error.message.includes('SPARQL')) {
            console.log('\n💡 Tip: Make sure to run Module 2 (Enrich) first to populate the knowledge graph');
        }
        
        // Return default results on error
        return {
            questionsAnswered: 0,
            averageConfidence: 0,
            totalSources: 0,
            questionTypes: {},
            bestAnswer: '',
            bestConfidence: 0
        };
    }
}

// Run the module if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runQAAnalysis().catch(console.error);
}

export default QAModule;
export { runQAAnalysis };