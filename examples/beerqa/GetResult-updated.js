#!/usr/bin/env node

/**
 * GetResult.js - Final LLM-based question answering for BeerQA
 * 
 * This script uses ContextManager.js to combine question corpuscles with
 * related corpuscles (found through ZPT navigation), formulates them as
 * augmented questions for the LLM, and returns the final answers to users.
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import ContextManager from '../../src/ContextManager.js';
import LLMHandler from '../../src/handlers/LLMHandler.js';
import OllamaConnector from '../../src/connectors/OllamaConnector.js';
import ClaudeConnector from '../../src/connectors/ClaudeConnector.js';
import MistralConnector from '../../src/connectors/MistralConnector.js';
import SPARQLHelper from './SPARQLHelper.js';
import { getDefaultQueryService } from '../../src/services/sparql/index.js';

// Configure logging
logger.setLevel('info');

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🎯 BEER QA FINAL RESULTS                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Context-augmented question answering with LLM completion  ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display configuration information
 */
function displayConfiguration(config) {
    console.log(chalk.bold.yellow('🔧 Configuration:'));
    console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.sparqlEndpoint)}`);
    console.log(`   ${chalk.cyan('BeerQA Graph URI:')} ${chalk.white(config.beerqaGraphURI)}`);
    console.log(`   ${chalk.cyan('Wikipedia Graph URI:')} ${chalk.white(config.wikipediaGraphURI)}`);
    console.log(`   ${chalk.cyan('Max Context Tokens:')} ${chalk.white(config.maxContextTokens)}`);
    console.log(`   ${chalk.cyan('Context Window Size:')} ${chalk.white(config.maxContextSize)}`);
    console.log(`   ${chalk.cyan('LLM Model:')} ${chalk.white(config.llmModel)}`);
    console.log('');
}

/**
 * Get questions with their relationships (from ZPT navigation)
 */
async function getQuestionsWithRelationships(sparqlHelper, beerqaGraphURI) {
    console.log(chalk.bold.white('📋 Finding questions with relationships...'));

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('questions-with-relationships', {
        graphURI: beerqaGraphURI
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        throw new Error(`Failed to retrieve questions with relationships: ${result.error}`);
    }

    // Group results by question
    const questionsMap = new Map();

    for (const binding of result.data.results.bindings) {
        const questionURI = binding.question.value;

        if (!questionsMap.has(questionURI)) {
            questionsMap.set(questionURI, {
                uri: questionURI,
                text: binding.questionText.value,
                relationships: []
            });
        }

        const question = questionsMap.get(questionURI);
        question.relationships.push({
            uri: binding.relationship.value,
            targetEntity: binding.targetEntity.value,
            relationshipType: binding.relationshipType.value,
            weight: parseFloat(binding.weight.value),
            sourceCorpus: binding.sourceCorpus?.value || 'unknown'
        });
    }

    const questions = Array.from(questionsMap.values());
    console.log(`   Found ${chalk.green(questions.length)} questions with relationships`);
    
    return questions;
}

/**
 * Get entity content from BeerQA graph
 */
async function getBeerQAEntityContent(sparqlHelper, beerqaGraphURI, entityURIs) {
    if (entityURIs.length === 0) {
        return [];
    }

    console.log(chalk.bold.white(`📝 Fetching BeerQA entity content for ${entityURIs.length} entities...`));

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('entity-content-retrieval', {
        graphURI: beerqaGraphURI,
        entityList: queryService.formatEntityList(entityURIs)
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        console.warn(`Failed to retrieve BeerQA entity content: ${result.error}`);
        return [];
    }

    const entities = result.data.results.bindings.map(binding => ({
        uri: binding.entity.value,
        content: binding.content.value
    }));

    console.log(`   Retrieved ${chalk.green(entities.length)} BeerQA entities`);
    return entities;
}

/**
 * Get entity content from Wikipedia graph
 */
async function getWikipediaEntityContent(sparqlHelper, wikipediaGraphURI, entityURIs) {
    if (entityURIs.length === 0) {
        return [];
    }

    console.log(chalk.bold.white(`📝 Fetching Wikipedia entity content for ${entityURIs.length} entities...`));

    const queryService = getDefaultQueryService();
    const query = await queryService.getQuery('entity-content-retrieval', {
        graphURI: wikipediaGraphURI,
        entityList: queryService.formatEntityList(entityURIs)
    });

    const result = await sparqlHelper.executeSelect(query);

    if (!result.success) {
        console.warn(`Failed to retrieve Wikipedia entity content: ${result.error}`);
        return [];
    }

    const entities = result.data.results.bindings.map(binding => ({
        uri: binding.entity.value,
        title: binding.title?.value || 'Unknown Title',
        content: binding.content?.value || binding.title?.value || 'No content available',
        contentType: binding.contentType?.value || 'text'
    }));

    console.log(`   Retrieved ${chalk.green(entities.length)} Wikipedia entities`);
    return entities;
}

// Rest of the file remains the same...
// (continuing with the existing implementation)