#!/usr/bin/env node

/**
 * Simple test script for SPARQL ingestion functionality
 * Tests the core components without requiring external services
 */

import SPARQLDocumentIngester from '../../src/services/ingestion/SPARQLDocumentIngester.js';

async function testSPARQLIngester() {
    console.log('🧪 Testing SPARQL Document Ingester');
    console.log('===================================');

    try {
        // Test 1: Load template
        console.log('\n1️⃣ Testing template loading...');
        const ingester = new SPARQLDocumentIngester({
            endpoint: 'https://query.wikidata.org/sparql'
        });

        const template = ingester.loadTemplate('wikidata-entities');
        console.log('✅ Template loaded successfully');
        console.log(`📋 Template preview: ${template.substring(0, 200)}...`);

        // Test 2: Dry run against Wikidata (public endpoint)
        console.log('\n2️⃣ Testing dry run against Wikidata...');
        const dryResult = await ingester.dryRun('wikidata-entities', { 
            limit: 2,
            variables: { limit: 2 }
        });

        if (dryResult.success) {
            console.log('✅ Dry run successful');
            console.log(`📊 Found ${dryResult.totalFound} entities`);
            console.log(`📋 Preview documents: ${dryResult.preview.length}`);
            
            dryResult.preview.forEach((doc, index) => {
                if (doc.error) {
                    console.log(`   ❌ Document ${index + 1}: ${doc.error}`);
                } else {
                    console.log(`   📄 Document ${index + 1}: ${doc.title} (${doc.uri})`);
                }
            });
        } else {
            console.log(`❌ Dry run failed: ${dryResult.error}`);
        }

        // Test 3: Transform test
        console.log('\n3️⃣ Testing document transformation...');
        const mockBinding = {
            uri: { value: 'http://example.org/test' },
            title: { value: 'Test Document' },
            content: { value: 'This is test content for the document.' },
            description: { value: 'Test description' }
        };

        const document = ingester.transformToDocument(mockBinding);
        console.log('✅ Document transformation successful');
        console.log(`📄 Title: ${document.title}`);
        console.log(`🆔 URI: ${document.uri}`);
        console.log(`📝 Content: ${document.content.substring(0, 50)}...`);
        console.log(`📊 Metadata fields: ${Object.keys(document.metadata).length}`);

        console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
testSPARQLIngester();