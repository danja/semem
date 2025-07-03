#!/usr/bin/env node

/**
 * Document API Showcase Stage 2: Query NodeRAG Content via HTTP
 * 
 * This script demonstrates querying the ingested nodeRAG.pdf content
 * using HTTP API calls to ask about the algorithms supported by NodeRAG.
 * 
 * Usage:
 *   From project root: node examples/document-api/02-query-noderag-http.js  
 *   From examples/document-api: node 02-query-noderag-http.js
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import log from 'loglevel';

// Configure logging
log.setLevel('info');
const logger = log.getLogger('DocumentAPI-Query');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4100/api';
const API_KEY = process.env.API_KEY || 'your-api-key'; // Match .env file

/**
 * Display styled header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('           🔍 DOCUMENT API SHOWCASE: QUERY NODERAG           ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('      Query ingested nodeRAG.pdf via HTTP API endpoints      ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Check document ingestion status
 */
async function checkIngestionStatus() {
    logger.info(chalk.blue('📋 Checking document ingestion status...'));
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents?status=ingested`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const noderagDoc = result.documents?.find(doc => 
                doc.filename && doc.filename.toLowerCase().includes('noderag')
            );
            
            if (noderagDoc) {
                logger.info(chalk.green('✅ NodeRAG document found and ingested:'));
                logger.info(chalk.gray(`   Document ID: ${noderagDoc.id}`));
                logger.info(chalk.gray(`   Status: ${noderagDoc.status}`));
                logger.info(chalk.gray(`   Operations: ${noderagDoc.operations?.join(', ')}`));
                
                if (noderagDoc.ingestion) {
                    logger.info(chalk.gray(`   Chunks Ingested: ${noderagDoc.ingestion.chunksIngested}`));
                    logger.info(chalk.gray(`   Triples Created: ${noderagDoc.ingestion.triplesCreated}`));
                }
                
                return noderagDoc;
            } else {
                logger.warn(chalk.yellow('⚠️  NodeRAG document not found in ingested documents'));
                logger.info(chalk.gray('   Available documents:'));
                result.documents.forEach(doc => {
                    logger.info(chalk.gray(`   - ${doc.filename} (${doc.status})`));
                });
                return null;
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        logger.error(chalk.red('❌ Failed to check ingestion status:'), error.message);
        throw error;
    }
}

/**
 * Search for NodeRAG algorithms using memory search API
 */
async function searchNodeRAGAlgorithms() {
    logger.info(chalk.blue('🔍 Searching for NodeRAG algorithms in memory...'));
    
    const queries = [
        'What algorithms does NodeRAG support?',
        'NodeRAG algorithm implementations',
        'graph algorithms in NodeRAG',
        'retrieval algorithms NodeRAG'
    ];
    
    const allResults = [];
    
    for (const query of queries) {
        try {
            logger.info(chalk.yellow(`   Searching: "${query}"`));
            
            const response = await fetch(`${API_BASE_URL}/memory/search?query=${encodeURIComponent(query)}&limit=5&threshold=0.1`, {
                headers: {
                    'X-API-Key': API_KEY
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.memories && result.memories.length > 0) {
                    logger.info(chalk.green(`   ✅ Found ${result.memories.length} relevant memories`));
                    allResults.push(...result.memories);
                } else {
                    logger.info(chalk.gray(`   No memories found for this query`));
                }
            } else {
                logger.warn(chalk.yellow(`   Search failed: HTTP ${response.status}`));
            }
        } catch (error) {
            logger.warn(chalk.yellow(`   Search error: ${error.message}`));
        }
    }
    
    return allResults;
}

/**
 * Generate response about NodeRAG algorithms using chat API
 */
async function generateAlgorithmDescription(searchResults) {
    logger.info(chalk.blue('🤖 Generating NodeRAG algorithm description...'));
    
    try {
        // Prepare context from search results
        const context = searchResults
            .slice(0, 10) // Use top 10 results
            .map(memory => `${memory.prompt} ${memory.response}`)
            .join('\n\n');
        
        const prompt = `Based on the following information about NodeRAG, please describe the algorithms supported by NodeRAG. Focus on specific algorithmic approaches, implementations, and capabilities mentioned in the document.

Context:
${context}

Question: What algorithms are supported by NodeRAG? Please provide a comprehensive description of the algorithmic approaches and implementations.`;
        
        logger.info(chalk.yellow('   Sending request to chat API...'));
        
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                prompt: prompt,
                maxTokens: 1000,
                temperature: 0.3
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            logger.info(chalk.green('✅ Generated algorithm description'));
            logger.info(chalk.gray(`   Response length: ${result.response?.length || 0} characters`));
            logger.info(chalk.gray(`   Processing time: ${result.duration}ms`));
            
            return result.response;
        } else {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
    } catch (error) {
        logger.error(chalk.red('❌ Failed to generate description:'), error.message);
        throw error;
    }
}

/**
 * Alternative: Use unified search API for better results
 */
async function unifiedSearchNodeRAG() {
    logger.info(chalk.blue('🔄 Using unified search for comprehensive results...'));
    
    try {
        const response = await fetch(`${API_BASE_URL}/search/unified`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                query: 'NodeRAG algorithms implementation graph retrieval',
                sources: ['memory', 'ragno'],
                limit: 10,
                enableRanking: true
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            logger.info(chalk.green(`✅ Unified search completed`));
            logger.info(chalk.gray(`   Total results: ${result.totalResults}`));
            logger.info(chalk.gray(`   Sources used: ${result.sourcesUsed?.join(', ')}`));
            logger.info(chalk.gray(`   Processing time: ${result.duration}ms`));
            
            if (result.rankedResults && result.rankedResults.length > 0) {
                logger.info(chalk.cyan('📊 Top results:'));
                result.rankedResults.slice(0, 5).forEach((item, index) => {
                    logger.info(chalk.gray(`   ${index + 1}. Score: ${item.score.toFixed(3)} | Source: ${item.source}`));
                    logger.info(chalk.gray(`      Content: ${item.content.substring(0, 100)}...`));
                });
            }
            
            return result;
        } else {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
    } catch (error) {
        logger.error(chalk.red('❌ Unified search failed:'), error.message);
        return null;
    }
}

/**
 * Display algorithm description in a formatted way
 */
function displayAlgorithmDescription(description) {
    console.log('');
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('                    🧠 NODERAG ALGORITHMS                    ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    
    // Split description into paragraphs and format
    const paragraphs = description.split('\n\n');
    
    paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
            // Wrap text to 70 characters
            const wrapped = wrapText(paragraph.trim(), 70);
            console.log(chalk.white(wrapped));
            console.log('');
        }
    });
}

/**
 * Simple text wrapping function
 */
function wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        if (currentLine.length + word.length + 1 <= width) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
}

/**
 * Main execution function
 */
async function main() {
    displayHeader();
    
    try {
        // Check if NodeRAG document is ingested
        logger.info(chalk.bold.blue('🔄 Checking document ingestion status...'));
        const noderagDoc = await checkIngestionStatus();
        
        if (!noderagDoc) {
            logger.error(chalk.red('❌ NodeRAG document not found or not ingested'));
            logger.info(chalk.yellow('💡 Run 01-upload-document-http.js first to upload and ingest the document'));
            process.exit(1);
        }
        
        console.log('');
        
        // Try unified search first
        logger.info(chalk.bold.blue('🔄 Searching for NodeRAG algorithm information...'));
        const unifiedResults = await unifiedSearchNodeRAG();
        
        console.log('');
        
        // Search for algorithm-related content
        const searchResults = await searchNodeRAGAlgorithms();
        
        if (searchResults.length === 0) {
            logger.warn(chalk.yellow('⚠️  No relevant memories found'));
            logger.info(chalk.gray('   This might mean:'));
            logger.info(chalk.gray('   - The document hasn\'t been processed through memory system'));
            logger.info(chalk.gray('   - The content doesn\'t contain algorithmic information'));
            logger.info(chalk.gray('   - Search thresholds are too restrictive'));
            
            if (unifiedResults && unifiedResults.rankedResults?.length > 0) {
                logger.info(chalk.blue('📋 Using unified search results instead...'));
                
                const combinedContent = unifiedResults.rankedResults
                    .slice(0, 5)
                    .map(r => r.content)
                    .join('\n\n');
                
                displayAlgorithmDescription(combinedContent);
            }
            
            return;
        }
        
        console.log('');
        logger.info(chalk.green(`✅ Found ${searchResults.length} relevant memories`));
        
        // Generate description
        logger.info(chalk.bold.blue('🔄 Generating algorithm description...'));
        const description = await generateAlgorithmDescription(searchResults);
        
        if (description) {
            displayAlgorithmDescription(description);
        } else {
            logger.error(chalk.red('❌ Failed to generate description'));
        }
        
        console.log('');
        logger.info(chalk.bold.green('🎉 NodeRAG algorithm query completed!'));
        
    } catch (error) {
        console.log('');
        logger.error(chalk.bold.red('💥 Query failed:'), error.message);
        process.exit(1);
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}

export { main as queryNodeRAGHTTP };