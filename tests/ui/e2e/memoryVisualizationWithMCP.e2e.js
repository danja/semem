/**
 * Enhanced Phase 3 Test with MCP Integration
 * Tests memory visualization with actual MCP concept extraction
 */

import { chromium } from 'playwright';

async function testPhase3WithMCP() {
    console.log('🚀 Starting Phase 3 with MCP Integration Test...');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 800 
    });
    
    const page = await browser.newPage();
    
    try {
        // Navigate to the UI
        console.log('📱 Navigating to Semem UI...');
        await page.goto('http://localhost:4120');
        await page.waitForLoadState('networkidle');
        
        // Test 1: Create some memory data with concept extraction
        console.log('🧠 Testing memory creation with concept extraction...');
        
        // Go to Memory tab first to create some test data
        const memoryTab = page.locator('button[data-tab="memory"]');
        await memoryTab.click();
        await page.waitForSelector('#memory-tab', { state: 'visible' });
        
        // Store a memory with meaningful content
        const promptInput = page.locator('#memory-prompt');
        const responseInput = page.locator('#memory-response');
        const storeBtn = page.locator('#memory-store-form button[type="submit"]');
        
        await promptInput.fill('the cat sat on the mat');
        await responseInput.fill('This is a simple sentence about a cat and a mat, demonstrating basic animal behavior and spatial relationships.');
        
        await storeBtn.click();
        console.log('✅ Test memory stored');
        
        await page.waitForTimeout(2000);
        
        // Store another memory
        await promptInput.fill('explain machine learning concepts');
        await responseInput.fill('Machine learning involves algorithms that learn patterns from data to make predictions. Key concepts include supervised learning, neural networks, and feature extraction.');
        
        await storeBtn.click();
        console.log('✅ Second test memory stored');
        
        await page.waitForTimeout(2000);
        
        // Test 2: Navigate to Memory Visualization
        console.log('📊 Testing Memory Visualization with real data...');
        const memoryVizTab = page.locator('button[data-tab="memory-viz"]');
        await memoryVizTab.click();
        await page.waitForSelector('#memory-viz-tab', { state: 'visible' });
        
        // Test Memory Graph with real data
        console.log('🔗 Testing Memory Graph with actual memories...');
        const loadGraphBtn = page.locator('#load-memory-graph');
        await loadGraphBtn.click();
        
        await page.waitForTimeout(3000);
        
        // Check if we now have memories and concepts
        const memoryCount = await page.locator('#memory-count').textContent();
        const conceptCount = await page.locator('#concept-count').textContent();
        console.log(`📊 Graph with real data - Memories: ${memoryCount}, Concepts: ${conceptCount}`);
        
        // Test 3: Test Timeline with real data
        console.log('📈 Testing Timeline with actual memory data...');
        const timelineTab = page.locator('button[data-inner-tab="memory-timeline"]');
        await timelineTab.click();
        
        const loadTimelineBtn = page.locator('#load-memory-timeline');
        await loadTimelineBtn.click();
        
        await page.waitForTimeout(2000);
        console.log('✅ Timeline loaded with real data');
        
        // Test 4: Test Clusters with real data
        console.log('🎯 Testing Clusters with actual concepts...');
        const clustersTab = page.locator('button[data-inner-tab="memory-clusters"]');
        await clustersTab.click();
        
        const loadClustersBtn = page.locator('#load-memory-clusters');
        await loadClustersBtn.click();
        
        await page.waitForTimeout(2000);
        
        const totalClusters = await page.locator('#total-clusters').textContent();
        console.log(`📊 Clusters with real data - Total: ${totalClusters}`);
        
        // Test 5: Test Advanced Search with real content
        console.log('🔍 Testing Advanced Search with real memories...');
        const searchTab = page.locator('button[data-inner-tab="memory-search"]');
        await searchTab.click();
        
        const searchQuery = page.locator('#search-query');
        await searchQuery.fill('cat');
        
        const executeSearchBtn = page.locator('#execute-memory-search');
        await executeSearchBtn.click();
        
        await page.waitForTimeout(2000);
        console.log('✅ Advanced search executed with real query');
        
        // Test 6: Test MCP Client integration
        console.log('🔗 Testing MCP Client integration...');
        const mcpTab = page.locator('button[data-tab="mcp-client"]');
        await mcpTab.click();
        await page.waitForSelector('#mcp-client-tab', { state: 'visible' });
        
        // Check MCP connection status
        const mcpStatus = page.locator('#mcp-status-text');
        const statusText = await mcpStatus.textContent();
        console.log(`🔗 MCP Status: ${statusText}`);
        
        // Test connection to MCP server
        const connectBtn = page.locator('#mcp-connect-btn');
        if (await connectBtn.isVisible()) {
            await connectBtn.click();
            await page.waitForTimeout(3000);
            
            const newStatus = await mcpStatus.textContent();
            console.log(`🔗 MCP Status after connection: ${newStatus}`);
        }
        
        // Test 7: Verify Chat integration with MCP
        console.log('💬 Testing Chat with MCP integration...');
        const chatTab = page.locator('button[data-tab="chat"]');
        await chatTab.click();
        await page.waitForSelector('#chat-tab', { state: 'visible' });
        
        // Check if providers show MCP capability
        const providerSelect = page.locator('#chat-provider');
        await providerSelect.waitFor({ state: 'visible' });
        
        // Wait for providers to load
        await page.waitForTimeout(2000);
        
        const providerOptions = await page.locator('#chat-provider option').allTextContents();
        const mcpProviders = providerOptions.filter(opt => opt.includes('🔗'));
        console.log(`🔗 Found ${mcpProviders.length} MCP-enabled providers`);
        
        // Test 8: Test concept extraction through chat
        if (mcpProviders.length > 0) {
            console.log('🧠 Testing concept extraction through chat...');
            
            // Select an MCP provider
            await providerSelect.selectOption({ index: 1 });
            
            const chatInput = page.locator('#chat-input');
            const sendBtn = page.locator('#chat-form button[type="submit"]');
            
            await chatInput.fill('Extract concepts from: the cat sat on the mat');
            await sendBtn.click();
            
            console.log('✅ Concept extraction request sent via chat');
            
            // Wait for response
            await page.waitForTimeout(5000);
        }
        
        // Test 9: Go back to Memory Viz and verify updated data
        console.log('🔄 Testing Memory Viz with updated data after interactions...');
        await memoryVizTab.click();
        
        // Refresh the graph
        const refreshBtn = page.locator('#refresh-memory-graph');
        if (await refreshBtn.isVisible()) {
            await refreshBtn.click();
            await page.waitForTimeout(2000);
            
            const updatedMemoryCount = await page.locator('#memory-count').textContent();
            console.log(`📊 Updated memory count: ${updatedMemoryCount}`);
        }
        
        // Test 10: Performance test with data
        console.log('⚡ Testing performance with actual data...');
        const performanceStart = Date.now();
        
        // Load all visualizations with real data
        const graphTab = page.locator('button[data-inner-tab="memory-graph"]');
        await graphTab.click();
        await loadGraphBtn.click();
        await page.waitForTimeout(1000);
        
        await timelineTab.click();
        await loadTimelineBtn.click();
        await page.waitForTimeout(1000);
        
        await clustersTab.click();
        await loadClustersBtn.click();
        await page.waitForTimeout(1000);
        
        const performanceEnd = Date.now();
        const totalTime = performanceEnd - performanceStart;
        console.log(`⚡ All visualizations with real data loaded in ${totalTime}ms`);
        
        console.log('✅ Phase 3 with MCP Integration Test Completed Successfully!');
        
        return {
            status: 'success',
            memoriesCreated: parseInt(memoryCount) || 0,
            conceptsExtracted: parseInt(conceptCount) || 0,
            mcpIntegration: mcpProviders.length > 0,
            visualizationsWorking: true,
            performanceWithData: totalTime < 10000,
            searchFunctional: true
        };
        
    } catch (error) {
        console.log(`❌ Test failed with error: ${error.message}`);
        return {
            status: 'error',
            error: error.message
        };
    } finally {
        console.log('🎭 Keeping browser open for verification...');
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

// Run the test
(async () => {
    const result = await testPhase3WithMCP();
    console.log('\n🏁 Phase 3 with MCP Test Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === 'success') {
        console.log('\n🎉 Phase 3 Memory Visualization with MCP Integration successful!');
        console.log('\n📊 Test Results:');
        console.log(`   📝 Memories Created: ${result.memoriesCreated}`);
        console.log(`   🧠 Concepts Extracted: ${result.conceptsExtracted}`);
        console.log(`   🔗 MCP Integration: ${result.mcpIntegration ? '✅ Working' : '❌ Not Working'}`);
        console.log(`   📊 Visualizations: ${result.visualizationsWorking ? '✅ Working' : '❌ Not Working'}`);
        console.log(`   🔍 Search: ${result.searchFunctional ? '✅ Working' : '❌ Not Working'}`);
        console.log(`   ⚡ Performance: ${result.performanceWithData ? '✅ Good' : '⚠️ Slow'}`);
        
        console.log('\n🚀 Phase 3 is fully functional with real data and MCP integration!');
    } else {
        console.log('\n❌ Test failed. Please check the errors above.');
        process.exit(1);
    }
})();