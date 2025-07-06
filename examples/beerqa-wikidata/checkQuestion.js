#!/usr/bin/env node

/**
 * checkQuestion.js - Debug utility to check if a question exists in the knowledge base
 * Refactored to use SPARQL service utilities
 */

import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Config from '../../src/Config.js';
import { 
    createBeerQAQueryService, 
    createSPARQLHelper, 
    GRAPH_URIS,
    formatQuestionFilter,
    executeSelectQuery
} from './sparqlUtils.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkQuestion() {
    const questionText = process.argv[2];
    
    if (!questionText) {
        console.log(chalk.red('Usage: node checkQuestion.js "your question text"'));
        process.exit(1);
    }
    
    console.log(chalk.bold.blue(`🔍 Checking for question: "${questionText}"`));
    console.log('');
    
    try {
        // Load Config.js
        const configPath = path.join(process.cwd(), 'config/config.json');
        const configObj = new Config(configPath);
        await configObj.init();
        
        // Initialize services
        const sparqlHelper = createSPARQLHelper(configObj);
        const queryService = createBeerQAQueryService();
        
        // Check in BeerQA graph
        console.log(chalk.yellow('📋 Checking BeerQA graph...'));
        
        const beerqaParams = {
            graphURI: GRAPH_URIS.beerqa,
            escapedQuestionLower: SPARQLHelper.escapeString(questionText.toLowerCase())
        };
        
        const beerqaResult = await executeSelectQuery(
            queryService, 
            'questionCheck', 
            beerqaParams, 
            sparqlHelper
        );
        
        if (beerqaResult.success && beerqaResult.data.results.bindings.length > 0) {
            console.log(chalk.green(`   ✓ Found ${beerqaResult.data.results.bindings.length} matching questions in BeerQA:`));
            beerqaResult.data.results.bindings.forEach((binding, i) => {
                console.log(chalk.white(`      ${i + 1}. "${binding.questionText.value}"`));
                console.log(chalk.gray(`         URI: ${binding.question.value}`));
            });
        } else if (beerqaResult.success) {
            console.log(chalk.red('   ❌ No matching questions found in BeerQA graph'));
        } else {
            console.log(chalk.red(`   ❌ Query failed: ${beerqaResult.error}`));
        }
        
        console.log('');
        
        // Check for enhanced relationships
        console.log(chalk.yellow('🔗 Checking for enhanced relationships...'));
        
        const relationshipParams = {
            beerqaGraphURI: GRAPH_URIS.beerqa,
            navigationGraphURI: GRAPH_URIS.navigation,
            questionFilter: formatQuestionFilter(questionText)
        };
        
        const relationshipResult = await executeSelectQuery(
            queryService,
            'questionsWithRelationships',
            relationshipParams,
            sparqlHelper
        );
        
        if (relationshipResult.success) {
            const relationships = relationshipResult.data.results.bindings;
            
            if (relationships.length > 0) {
                console.log(chalk.green(`   ✓ Found ${relationships.length} enhanced relationships`));
                
                // Group by question
                const questionMap = new Map();
                relationships.forEach(binding => {
                    const questionURI = binding.question.value;
                    if (!questionMap.has(questionURI)) {
                        questionMap.set(questionURI, {
                            text: binding.questionText.value,
                            relationships: []
                        });
                    }
                    questionMap.get(questionURI).relationships.push({
                        target: binding.targetEntity.value,
                        type: binding.relationshipType.value,
                        weight: binding.weight.value
                    });
                });
                
                questionMap.forEach((question, uri) => {
                    console.log(chalk.white(`      Question: "${question.text}"`));
                    console.log(chalk.gray(`      Relationships: ${question.relationships.length}`));
                });
            } else {
                console.log(chalk.yellow(`   ⚠️  Question found but no enhanced relationships`));
                console.log(chalk.cyan('   💡 Run WikidataNavigate.js to create enhanced relationships'));
            }
        } else {
            console.log(chalk.red(`   ❌ Relationship query failed: ${relationshipResult.error}`));
        }
        
    } catch (error) {
        console.log(chalk.red('❌ Error:', error.message));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    checkQuestion();
}