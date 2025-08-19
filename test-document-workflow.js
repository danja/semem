// Test document upload and query workflow
// Tests the complete pipeline: upload algorithms.md -> query for VSOM

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testDocumentWorkflow() {
    const browser = await chromium.launch({ 
        headless: false,  // Show browser for debugging
        slowMo: 1000      // Slow down for observation
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('📂 Testing document upload and query workflow...');
        
        // Step 1: Navigate to workbench
        console.log('🌐 Navigating to workbench...');
        await page.goto('http://localhost:8086', { waitUntil: 'networkidle' });
        
        // Step 2: Select Tell tab
        console.log('📤 Selecting Tell tab...');
        await page.click('#tell-tab');
        await page.waitForSelector('#tell-content', { state: 'visible' });
        
        // Step 3: Select document type
        console.log('📋 Selecting document type...');
        await page.selectOption('#tell-type', 'document');
        await page.waitForSelector('#document-upload-section', { state: 'visible' });
        
        // Step 4: Upload algorithms.md
        console.log('📄 Uploading algorithms.md...');
        const filePath = path.resolve('/flow/hyperdata/semem/docs/manual/algorithms.md');
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        await page.setInputFiles('#document-file', filePath);
        
        // Step 5: Submit the document
        console.log('⬆️ Submitting document...');
        
        // Listen for console messages and network requests
        const consoleMessages = [];
        const networkRequests = [];
        
        page.on('console', msg => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
            console.log(`🖥️ Console: ${msg.type()}: ${msg.text()}`);
        });
        
        page.on('request', req => {
            if (req.url().includes('/api/')) {
                networkRequests.push({
                    url: req.url(),
                    method: req.method(),
                    headers: req.headers()
                });
                console.log(`🌐 Request: ${req.method()} ${req.url()}`);
            }
        });
        
        page.on('response', resp => {
            if (resp.url().includes('/api/')) {
                console.log(`📡 Response: ${resp.status()} ${resp.url()}`);
            }
        });
        
        // Submit the form
        const submitButton = await page.locator('#tell-submit');
        await submitButton.click();
        
        // Wait for upload to complete
        console.log('⏳ Waiting for upload to complete...');
        await page.waitForTimeout(5000);  // Give it time to process
        
        // Step 6: Switch to Ask tab
        console.log('❓ Switching to Ask tab...');
        await page.click('#ask-tab');
        await page.waitForSelector('#ask-query', { state: 'visible' });
        
        // Step 7: Query for VSOM
        console.log('🔍 Querying for VSOM information...');
        await page.fill('#ask-query', 'What is VSOM?');
        
        // Submit the query
        const askButton = await page.locator('#ask-submit');
        await askButton.click();
        
        // Wait for response
        console.log('⏳ Waiting for query response...');
        await page.waitForTimeout(10000);  // Give it time to search and respond
        
        // Step 8: Check the response
        const responseElement = await page.locator('#ask-response');
        const responseText = await responseElement.textContent();
        
        console.log('📝 Query Response:', responseText);
        
        // Analyze the response
        if (responseText && responseText.toLowerCase().includes('vsom')) {
            console.log('✅ SUCCESS: Response contains VSOM information');
            console.log('✅ Document content was successfully indexed and retrieved');
        } else if (responseText && responseText.toLowerCase().includes('visual') && responseText.toLowerCase().includes('map')) {
            console.log('✅ PARTIAL SUCCESS: Response contains visual mapping concepts');
        } else {
            console.log('❌ FAILURE: Response does not contain expected VSOM information');
            console.log('Response content:', responseText);
        }
        
        // Step 9: Try additional queries to test document content
        console.log('🔍 Testing additional queries...');
        
        const additionalQueries = [
            'What algorithms are mentioned for community detection?',
            'How does personalized PageRank work?',
            'What is self-organizing maps?'
        ];
        
        for (const query of additionalQueries) {
            console.log(`🔍 Testing query: "${query}"`);
            await page.fill('#ask-query', query);
            await page.click('#ask-submit');
            await page.waitForTimeout(5000);
            
            const response = await responseElement.textContent();
            console.log(`📝 Response: ${response?.substring(0, 200)}...`);
        }
        
        // Log summary
        console.log('\n📊 Test Summary:');
        console.log(`🌐 Network requests made: ${networkRequests.length}`);
        console.log(`🖥️ Console messages: ${consoleMessages.length}`);
        console.log('\n📋 Network Requests:');
        networkRequests.forEach(req => {
            console.log(`   ${req.method} ${req.url}`);
        });
        
        console.log('\n📋 Console Messages:');
        consoleMessages.forEach(msg => {
            console.log(`   ${msg}`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Keep browser open for inspection
        console.log('\n🔍 Browser will remain open for inspection...');
        console.log('Press Ctrl+C to close');
        
        // Wait for manual close instead of auto-closing
        await new Promise(() => {}); // Keep running forever until manual interrupt
    }
}

// Run the test
testDocumentWorkflow().catch(console.error);