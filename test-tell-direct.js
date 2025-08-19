// Direct test of Tell operation with algorithms.md content
import fs from 'fs';

async function testTellDirect() {
    try {
        console.log('📄 Reading algorithms.md content...');
        const filePath = '/flow/hyperdata/semem/docs/manual/algorithms.md';
        const content = fs.readFileSync(filePath, 'utf-8');
        
        console.log('📏 Content length:', content.length, 'characters');
        console.log('📝 First 200 characters:', content.substring(0, 200));
        
        console.log('\n📤 Testing Tell API directly...');
        
        // Test the Tell operation via HTTP API
        const tellPayload = {
            content: content,
            type: 'document',
            metadata: {
                filename: 'algorithms.md',
                source: 'test'
            }
        };
        
        console.log('🌐 Making Tell request to MCP server...');
        const response = await fetch('http://localhost:4107/tell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tellPayload)
        });
        
        console.log('📡 Response status:', response.status);
        const responseText = await response.text();
        console.log('📝 Response:', responseText);
        
        if (response.ok) {
            console.log('✅ Tell operation succeeded');
            
            // Now test Ask operation
            console.log('\n❓ Testing Ask operation...');
            const askPayload = {
                question: 'What is VSOM?',
                useContext: true
            };
            
            const askResponse = await fetch('http://localhost:4107/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(askPayload)
            });
            
            console.log('📡 Ask response status:', askResponse.status);
            const askResponseText = await askResponse.text();
            console.log('📝 Ask response:', askResponseText);
            
            if (askResponseText && askResponseText.toLowerCase().includes('vsom')) {
                console.log('✅ SUCCESS: Ask operation found VSOM information');
            } else {
                console.log('❌ FAILURE: Ask operation did not find VSOM information');
            }
        } else {
            console.log('❌ Tell operation failed');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testTellDirect();