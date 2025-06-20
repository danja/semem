import { chromium } from 'playwright';

async function testSearchFunctionality() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('🔍 Testing search functionality...');
        
        // Navigate to the application
        await page.goto('http://localhost:4120');
        await page.waitForLoadState('networkidle');
        
        // Wait for the search form to be visible
        await page.waitForSelector('#search-form', { state: 'visible' });
        console.log('✅ Search form loaded');
        
        // Check if graph selector is visible and what graph is selected
        const graphSelector = page.locator('#graph-selector');
        const selectedGraph = await graphSelector.inputValue();
        console.log(`📊 Current selected graph: ${selectedGraph}`);
        
        // Enter a test search query
        const searchInput = page.locator('#search-input');
        await searchInput.fill('test');
        console.log('✅ Entered search query: "test"');
        
        // Monitor network requests to see what API calls are made
        const requests = [];
        page.on('request', request => {
            if (request.url().includes('/api/search')) {
                requests.push({
                    url: request.url(),
                    method: request.method()
                });
                console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
            }
        });
        
        // Monitor responses to see what comes back
        page.on('response', response => {
            if (response.url().includes('/api/search')) {
                console.log(`📡 API Response: ${response.status()} ${response.url()}`);
            }
        });
        
        // Submit the search form
        await page.locator('#search-form button[type="submit"]').click();
        console.log('✅ Submitted search form');
        
        // Wait for results or error
        await page.waitForTimeout(3000);
        
        // Check what's in the results area
        const resultsContainer = page.locator('#search-results');
        const resultsText = await resultsContainer.textContent();
        console.log(`📋 Results content: ${resultsText}`);
        
        // Check if there are actual result items
        const resultItems = await page.locator('#search-results .result-item').count();
        console.log(`📊 Number of result items: ${resultItems}`);
        
        // Check for error messages
        const errorElements = await page.locator('.error, .results-placeholder').count();
        if (errorElements > 0) {
            const errorText = await page.locator('.error, .results-placeholder').first().textContent();
            console.log(`❌ Error/placeholder message: ${errorText}`);
        }
        
        // Print network requests made
        console.log(`\n🌐 Network requests made: ${requests.length}`);
        requests.forEach((req, index) => {
            console.log(`  ${index + 1}. ${req.method} ${req.url}`);
        });
        
        // Take a screenshot for visual inspection
        await page.screenshot({ path: 'search-test-result.png', fullPage: true });
        console.log('📸 Screenshot saved as search-test-result.png');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testSearchFunctionality();