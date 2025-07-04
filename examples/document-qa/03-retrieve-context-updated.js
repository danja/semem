#!/usr/bin/env node

/**
 * 03-retrieve-context.js - Context Retrieval for Document QA
 * 
 * This script performs semantic similarity search to find relevant document
 * chunks for each processed question, using cosine similarity with embeddings.
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import { getDefaultQueryService } from '../../src/services/sparql/index.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📚 DOCUMENT QA CONTEXT RETRIEVAL             ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     Semantic similarity search for relevant document chunks   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Get processed questions that need context retrieval
 */
async function getProcessedQuestions(sparqlHelper, config, limit = null) {
    console.log(chalk.bold.white('📋 Finding processed questions...'));

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('processed-questions', {
        graphURI: config.graphName,
        additionalFilters: '',
        limitClause: queryService.formatLimit(limit)
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        throw new Error(`Failed to retrieve processed questions: ${result.error}`);
    }

    const questions = result.data.results.bindings.map(binding => ({
        uri: binding.question.value,
        label: binding.label.value,
        content: binding.content.value,
        embedding: JSON.parse(binding.embedding.value)
    }));

    console.log(`   Found ${chalk.green(questions.length)} processed questions needing context`);
    return questions;
}

/**
 * Get document chunk count for progress reporting
 */
async function getDocumentChunkCount(sparqlHelper, config) {
    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('document-chunks-count', {
        graphURI: config.graphName
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        console.warn(`Failed to get chunk count: ${result.error}`);
        return 0;
    }

    if (result.data.results.bindings.length === 0) {
        return 0;
    }

    return parseInt(result.data.results.bindings[0].totalChunks.value);
}

/**
 * Get all document chunks with embeddings
 */
async function getDocumentChunks(sparqlHelper, config, limit = null) {
    console.log(chalk.bold.white('📄 Loading document chunks...'));

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('document-chunks', {
        graphURI: config.graphName,
        additionalFilters: '',
        limitClause: queryService.formatLimit(limit)
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        throw new Error(`Failed to retrieve document chunks: ${result.error}`);
    }

    const chunks = result.data.results.bindings.map(binding => ({
        uri: binding.chunk.value,
        content: binding.content.value,
        title: binding.title.value,
        embedding: JSON.parse(binding.embedding.value),
        sourceUri: binding.sourceUri?.value,
        size: binding.size ? parseInt(binding.size.value) : null,
        index: binding.index ? parseInt(binding.index.value) : null
    }));

    console.log(`   Loaded ${chalk.green(chunks.length)} document chunks`);
    return chunks;
}

/**
 * Store context retrieval results
 */
async function storeContextResults(sparqlHelper, config, question, relevantChunks) {
    const timestamp = new Date().toISOString();
    const contextAttrUri = `${question.uri}_context_${Date.now()}`;
    const flowAttrUri = `${question.uri}_flow_${Date.now()}`;

    // Build chunk reference triples
    const chunkTriples = relevantChunks.map((chunk, index) => {
        const chunkRefUri = `${contextAttrUri}_chunk_${index}`;
        return `
        <${contextAttrUri}> ragno:hasChunkReference <${chunkRefUri}> .
        <${chunkRefUri}> a ragno:ChunkReference ;
            ragno:referencesChunk <${chunk.uri}> ;
            ragno:similarityScore ${chunk.similarity} ;
            ragno:rank ${index + 1} ;
            ragno:chunkTitle "${chunk.title.replace(/"/g, '\\"')}" ;
            ragno:chunkSource "${chunk.sourceUri || 'unknown'}" .`;
    }).join('\n        ');

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('context-results-storage', {
        graphURI: config.graphName,
        questionURI: question.uri,
        contextAttrURI: contextAttrUri,
        chunksFound: relevantChunks.length,
        timestamp: timestamp,
        chunkTriples: chunkTriples,
        flowAttrURI: flowAttrUri,
        flowStage: '03-retrieve-context',
        processingStage: 'context-retrieved'
    });

    const result = await sparqlHelper.executeUpdate(query);

    if (!result.success) {
        throw new Error(`Failed to store context results: ${result.error}`);
    }

    console.log(`     ✓ Stored ${relevantChunks.length} context chunks for question`);
}

// Rest of the implementation remains the same...
// (continuing with cosine similarity calculations, main function, etc.)