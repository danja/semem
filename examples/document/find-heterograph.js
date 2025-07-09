#!/usr/bin/env node

/**
 * Find literals containing "heterograph" and identify subject classes
 * 
 * This script searches for any literals containing the word "heterograph"
 * and identifies the classes of the subjects of these triples.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import Config from '../../src/Config.js';
import SPARQLHelper from '../../src/services/sparql/SPARQLHelper.js';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

async function findHeterographLiterals() {
    logger.info('🔍 Searching for literals containing "heterograph"');
    logger.info('='.repeat(60));

    try {
        // Load configuration
        const configPath = process.cwd().endsWith('/examples/document') 
            ? '../../config/config.json' 
            : 'config/config.json';
        const config = new Config(configPath);
        await config.init();

        // Get storage configuration
        const storageConfig = config.get('storage');
        if (!storageConfig || storageConfig.type !== 'sparql') {
            throw new Error('No SPARQL storage configuration found');
        }

        const sparqlEndpoint = storageConfig.options.query;
        const graphName = storageConfig.options.graphName;

        // Initialize SPARQL helper
        const sparqlHelper = new SPARQLHelper(sparqlEndpoint, {
            user: storageConfig.options.user,
            password: storageConfig.options.password
        });

        logger.info(`📊 SPARQL endpoint: ${sparqlEndpoint}`);
        logger.info(`🗃️  Graph: ${graphName}`);

        // Create SPARQL query to find literals containing "heterograph"
        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT DISTINCT ?subject ?class ?property ?literal WHERE {
    GRAPH <${graphName}> {
        ?subject ?property ?literal .
        ?subject a ?class .
        
        # Use REGEX to find literals containing "heterograph" (case-insensitive)
        FILTER(isLiteral(?literal) && REGEX(str(?literal), "heterograph", "i"))
    }
}
ORDER BY ?class ?subject ?property
`;

        logger.info('🔍 Executing SPARQL query...');
        logger.debug(`📋 Query: ${query}`);

        const result = await sparqlHelper.executeSelect(query);
        
        if (!result.success) {
            throw new Error(`SPARQL query failed: ${result.error}`);
        }

        const bindings = result.data.results.bindings;
        logger.info(`📚 Found ${bindings.length} triples with literals containing "heterograph"`);

        if (bindings.length === 0) {
            logger.warn('⚠️  No literals containing "heterograph" found in the store');
            return;
        }

        // Group results by class
        const resultsByClass = {};
        const subjectClasses = new Set();

        bindings.forEach(binding => {
            const subject = binding.subject.value;
            const className = binding.class.value;
            const property = binding.property.value;
            const literal = binding.literal.value;

            subjectClasses.add(className);

            if (!resultsByClass[className]) {
                resultsByClass[className] = [];
            }

            resultsByClass[className].push({
                subject,
                property,
                literal: literal.length > 100 ? literal.substring(0, 100) + '...' : literal
            });
        });

        logger.info('\n📊 RESULTS BY CLASS:');
        logger.info('='.repeat(60));

        Object.keys(resultsByClass).sort().forEach(className => {
            logger.info(`\n🏷️  Class: ${className}`);
            logger.info(`   📝 Count: ${resultsByClass[className].length} triples`);
            
            resultsByClass[className].forEach((item, index) => {
                logger.info(`   ${index + 1}. Subject: ${item.subject}`);
                logger.info(`      Property: ${item.property}`);
                logger.info(`      Literal: "${item.literal}"`);
            });
        });

        logger.info('\n📋 SUMMARY:');
        logger.info('='.repeat(60));
        logger.info(`🔍 Total triples found: ${bindings.length}`);
        logger.info(`🏷️  Distinct subject classes: ${subjectClasses.size}`);
        logger.info(`📝 Classes found:`);
        Array.from(subjectClasses).sort().forEach(className => {
            logger.info(`   - ${className}`);
        });

        // Also show unique literal excerpts containing "heterograph"
        const uniqueLiterals = new Set();
        bindings.forEach(binding => {
            const literal = binding.literal.value;
            // Extract context around "heterograph"
            const regex = /(.{0,50}heterograph.{0,50})/gi;
            const matches = literal.match(regex);
            if (matches) {
                matches.forEach(match => uniqueLiterals.add(match.trim()));
            }
        });

        if (uniqueLiterals.size > 0) {
            logger.info('\n📖 LITERAL EXCERPTS CONTAINING "heterograph":');
            logger.info('='.repeat(60));
            Array.from(uniqueLiterals).forEach((excerpt, index) => {
                logger.info(`${index + 1}. "${excerpt}"`);
            });
        }

    } catch (error) {
        logger.error('❌ Error searching for heterograph literals:', error.message);
        throw error;
    }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    findHeterographLiterals().catch(error => {
        logger.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

export default findHeterographLiterals;