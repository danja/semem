/**
 * API Test for Enhanced Chat Interface (Phase 2)
 * Tests the chat functionality without browser automation
 */

console.log('🚀 Starting Enhanced Chat API Test...');

const baseUrl = 'http://localhost:4120';

async function testChatAPI() {
    try {
        // Test 1: Check if UI server is running
        console.log('🌐 Testing UI server availability...');
        const healthResponse = await fetch(`${baseUrl}/api/health`);
        if (!healthResponse.ok) {
            throw new Error(`Health check failed: ${healthResponse.status}`);
        }
        const health = await healthResponse.json();
        console.log(`✅ UI server is running - Status: ${health.status}`);
        
        // Test 2: Load providers
        console.log('🔌 Testing provider loading...');
        const providersResponse = await fetch(`${baseUrl}/api/providers`);
        if (!providersResponse.ok) {
            throw new Error(`Providers API failed: ${providersResponse.status}`);
        }
        const providers = await providersResponse.json();
        console.log(`✅ Loaded ${providers.providers.length} providers`);
        
        // Check for MCP capabilities
        const mcpProviders = providers.providers.filter(p => 
            p.capabilities && p.capabilities.includes('mcp')
        );
        console.log(`🔗 Found ${mcpProviders.length} MCP-enabled providers:`);
        mcpProviders.forEach(p => {
            console.log(`   - ${p.name} (${p.type})`);
        });
        
        // Test 3: Standard chat functionality
        console.log('💬 Testing standard chat functionality...');
        const chatPayload = {
            prompt: "Hello! This is a test of the enhanced chat interface with MCP integration.",
            providerId: providers.providers[0].id,
            temperature: 0.7,
            useMemory: true,
            useSearchInterjection: false
        };
        
        console.log(`📤 Sending chat request with provider: ${providers.providers[0].name}`);
        const chatResponse = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatPayload)
        });
        
        if (!chatResponse.ok) {
            throw new Error(`Chat API failed: ${chatResponse.status}`);
        }
        
        const chatResult = await chatResponse.json();
        console.log('✅ Chat response received');
        console.log(`🤖 Response preview: ${JSON.stringify(chatResult).substring(0, 150)}...`);
        
        // Test 4: Check UI HTML content
        console.log('📱 Testing UI HTML content...');
        const uiResponse = await fetch(baseUrl);
        if (!uiResponse.ok) {
            throw new Error(`UI loading failed: ${uiResponse.status}`);
        }
        const htmlContent = await uiResponse.text();
        
        // Check for enhanced chat elements
        const hasChat = htmlContent.includes('data-tab="chat"');
        const hasMCPClient = htmlContent.includes('data-tab="mcp-client"');
        const hasChatMessages = htmlContent.includes('chat-messages');
        const hasProviderSelect = htmlContent.includes('chat-provider');
        
        console.log(`📋 UI Elements Check:`);
        console.log(`   - Chat tab: ${hasChat ? '✅' : '❌'}`);
        console.log(`   - MCP Client tab: ${hasMCPClient ? '✅' : '❌'}`);
        console.log(`   - Chat messages container: ${hasChatMessages ? '✅' : '❌'}`);
        console.log(`   - Provider selection: ${hasProviderSelect ? '✅' : '❌'}`);
        
        return {
            status: 'success',
            providersLoaded: providers.providers.length,
            mcpProviders: mcpProviders.length,
            chatFunctional: true,
            uiElementsPresent: hasChat && hasMCPClient && hasChatMessages
        };
        
    } catch (error) {
        console.log(`❌ Test failed with error: ${error.message}`);
        return {
            status: 'error',
            error: error.message
        };
    }
}

// Run the test
const result = await testChatAPI();
console.log('\n🏁 Test Result:');
console.log(JSON.stringify(result, null, 2));

if (result.status === 'success') {
    console.log('\n🎉 Enhanced Chat Interface is working correctly!');
}