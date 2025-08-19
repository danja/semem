// Simplified test for workbench document upload workflow
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function testWorkbenchUpload() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
        console.log('📂 Testing workbench document upload...');
        
        // Monitor network activity
        const networkRequests = [];
        const networkResponses = [];
        
        page.on('request', req => {
            if (req.url().includes('/api/')) {
                networkRequests.push({
                    url: req.url(),
                    method: req.method(),
                    timestamp: Date.now()
                });
                console.log(`🌐 [REQUEST] ${req.method()} ${req.url()}`);
            }
        });
        
        page.on('response', async resp => {
            if (resp.url().includes('/api/')) {
                const respInfo = {
                    url: resp.url(),
                    status: resp.status(),
                    timestamp: Date.now()
                };
                networkResponses.push(respInfo);
                console.log(`📡 [RESPONSE] ${resp.status()} ${resp.url()}`);
                
                // Log response body for upload requests
                if (resp.url().includes('upload') || resp.url().includes('tell')) {
                    try {
                        const body = await resp.text();
                        console.log(`📝 [RESPONSE BODY] ${body.substring(0, 300)}...`);
                    } catch (err) {
                        console.log(`❌ [RESPONSE BODY ERROR] ${err.message}`);
                    }
                }
            }
        });
        
        // Navigate to workbench
        console.log('🌐 Navigating to workbench...');
        await page.goto('http://localhost:8086', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        
        // Find Tell section (no tabs, it's a column layout)
        console.log('📤 Locating Tell section...');
        await page.waitForSelector('#tell-content', { state: 'visible' });
        
        // Select document type
        console.log('📋 Selecting document type...');
        await page.selectOption('#tell-type', 'document');
        await page.waitForSelector('#document-upload-section', { state: 'visible' });
        
        // Upload file
        const filePath = path.resolve('/flow/hyperdata/semem/docs/manual/algorithms.md');
        console.log(`📄 Uploading file: ${filePath}`);
        console.log(`📄 File size: ${fs.statSync(filePath).size} bytes`);
        
        await page.setInputFiles('#document-file', filePath);
        await page.waitForTimeout(1000);
        
        // Submit document
        console.log('⬆️ Submitting document...');
        const uploadStartTime = Date.now();
        
        await page.click('#tell-submit');
        
        // Wait for completion (either success or error)
        console.log('⏳ Waiting for upload to complete...');
        
        try {
            await page.waitForSelector('.toast-container .toast, #tell-results .result-item', { 
                timeout: 30000 
            });
            const uploadDuration = Date.now() - uploadStartTime;
            console.log(`✅ Upload process completed in ${uploadDuration}ms`);
        } catch (timeoutError) {
            const uploadDuration = Date.now() - uploadStartTime;
            console.log(`⚠️ Upload timeout after ${uploadDuration}ms`);
        }
        
        // Check for success/error indicators
        const successToasts = await page.locator('.toast.success').allTextContents();
        const errorToasts = await page.locator('.toast.error').allTextContents();
        const tellResults = await page.locator('#tell-results .result-item').allTextContents();
        
        console.log('🎯 Success toasts:', successToasts);
        console.log('❌ Error toasts:', errorToasts);  
        console.log('📊 Tell results:', tellResults);
        
        // Test Ask workflow
        console.log('\n❓ Testing Ask workflow...');
        await page.waitForSelector('#ask-question', { state: 'visible' });
        
        await page.fill('#ask-question', 'What is VSOM?');
        
        const queryStartTime = Date.now();
        await page.click('#ask-submit');
        
        try {
            await page.waitForSelector('#ask-results .result-item', { timeout: 30000 });
            const queryDuration = Date.now() - queryStartTime;
            console.log(`✅ Query completed in ${queryDuration}ms`);
        } catch (timeoutError) {
            const queryDuration = Date.now() - queryStartTime;
            console.log(`⚠️ Query timeout after ${queryDuration}ms`);
        }
        
        // Check query response
        const askResults = await page.locator('#ask-results .result-content').allTextContents();
        const responseText = askResults.join(' ');
        
        console.log('📝 Query response length:', responseText.length);
        console.log('📝 Query response (first 300 chars):', responseText.substring(0, 300));
        
        if (responseText.toLowerCase().includes('vsom')) {
            console.log('✅ SUCCESS: Query found VSOM information');
        } else {
            console.log('❌ FAILURE: Query did not find VSOM information');
        }
        
        // Summary
        console.log('\n📊 Summary:');
        console.log(`🌐 Requests: ${networkRequests.length}`);
        console.log(`📡 Responses: ${networkResponses.length}`);
        
        networkRequests.forEach(req => {
            console.log(`   ${req.method} ${req.url}`);
        });
        
        networkResponses.forEach(resp => {
            console.log(`   ${resp.status} ${resp.url}`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
        console.log('🔍 Test complete.');
    }
}

testWorkbenchUpload().catch(console.error);