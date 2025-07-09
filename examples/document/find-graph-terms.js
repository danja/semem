#!/usr/bin/env node

/**
 * Find literals containing graph-related terms
 * 
 * This script searches for any literals containing graph-related terms
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

async function findGraphTerms() {
    logger.info('🔍 Searching for graph-related terms in literals');
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

        // Search for various graph-related terms
        const searchTerms = [
            'heterograph', 'hetero-graph', 'heterogeneous graph',
            'graph', 'subgraph', 'hypergraph', 'knowledge graph',
            'network', 'topology', 'node', 'edge', 'vertex'
        ];

        logger.info(`🔍 Searching for terms: ${searchTerms.join(', ')}`);

        // Create SPARQL query to find literals containing graph-related terms
        const regexPattern = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')).join('|');
        
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
        
        # Use REGEX to find literals containing graph-related terms (case-insensitive)
        FILTER(isLiteral(?literal) && REGEX(str(?literal), "(${regexPattern})", "i"))
    }
}
ORDER BY ?class ?subject ?property
LIMIT 100
`;

        logger.info('🔍 Executing SPARQL query...');
        logger.debug(`📋 Query: ${query}`);

        const result = await sparqlHelper.executeSelect(query);
        
        if (!result.success) {
            throw new Error(`SPARQL query failed: ${result.error}`);
        }

        const bindings = result.data.results.bindings;
        logger.info(`📚 Found ${bindings.length} triples with graph-related terms`);

        if (bindings.length === 0) {
            logger.warn('⚠️  No literals containing graph-related terms found in the store');
            return;
        }

        // Group results by class and search term
        const resultsByClass = {};
        const subjectClasses = new Set();
        const foundTerms = new Set();

        bindings.forEach(binding => {
            const subject = binding.subject.value;
            const className = binding.class.value;
            const property = binding.property.value;
            const literal = binding.literal.value;

            subjectClasses.add(className);

            // Find which terms matched
            searchTerms.forEach(term => {
                const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'), 'i');
                if (regex.test(literal)) {
                    foundTerms.add(term);
                }
            });

            if (!resultsByClass[className]) {
                resultsByClass[className] = [];
            }

            resultsByClass[className].push({
                subject,
                property,
                literal: literal.length > 200 ? literal.substring(0, 200) + '...' : literal
            });
        });

        logger.info('\n📊 RESULTS BY CLASS:');
        logger.info('='.repeat(60));

        Object.keys(resultsByClass).sort().forEach(className => {
            logger.info(`\n🏷️  Class: ${className}`);
            logger.info(`   📝 Count: ${resultsByClass[className].length} triples`);
            
            resultsByClass[className].slice(0, 3).forEach((item, index) => {
                logger.info(`   ${index + 1}. Subject: ${item.subject}`);
                logger.info(`      Property: ${item.property}`);
                logger.info(`      Literal: "${item.literal}"`);
            });
            
            if (resultsByClass[className].length > 3) {
                logger.info(`   ... and ${resultsByClass[className].length - 3} more`);
            }
        });

        logger.info('\n📋 SUMMARY:');
        logger.info('='.repeat(60));
        logger.info(`🔍 Total triples found: ${bindings.length}`);
        logger.info(`🏷️  Distinct subject classes: ${subjectClasses.size}`);
        logger.info(`📝 Classes found:`);
        Array.from(subjectClasses).sort().forEach(className => {
            logger.info(`   - ${className}`);
        });

        logger.info(`\n🔍 Terms found in literals:`);
        Array.from(foundTerms).sort().forEach(term => {
            logger.info(`   - ${term}`);
        });

        // Show some example excerpts
        const uniqueExcerpts = new Set();
        bindings.slice(0, 5).forEach(binding => {
            const literal = binding.literal.value;
            // Extract context around graph terms
            searchTerms.forEach(term => {
                const regex = new RegExp(`(.{0,50}${term.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}.{0,50})`, 'gi');
                const matches = literal.match(regex);
                if (matches) {
                    matches.forEach(match => uniqueExcerpts.add(match.trim()));
                }
            });
        });

        if (uniqueExcerpts.size > 0) {
            logger.info('\n📖 EXAMPLE EXCERPTS:');
            logger.info('='.repeat(60));
            Array.from(uniqueExcerpts).slice(0, 10).forEach((excerpt, index) => {
                logger.info(`${index + 1}. "${excerpt}"`);
            });
        }

    } catch (error) {
        logger.error('❌ Error searching for graph-related terms:', error.message);
        throw error;
    }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    findGraphTerms().catch(error => {
        logger.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

export default findGraphTerms;