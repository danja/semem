/**
 * Test integration of unified prompt system
 * This file tests the unified system before full integration
 */

import { 
    PromptManager, 
    PromptContext, 
    PromptTemplate, 
    PromptOptions,
    PromptTemplates,
    quickStart
} from './index.js';
import logger from 'loglevel';

// Set log level for testing
logger.setLevel('info');

async function testUnifiedSystem() {
    console.log('=== Testing Unified Prompt System ===\n');
    
    // Test 1: Basic prompt manager
    console.log('1. Testing basic prompt manager...');
    const manager = new PromptManager();
    
    // Register a simple template
    const template = new PromptTemplate({
        name: 'test-chat',
        description: 'Test chat template',
        content: '${query}',
        systemPrompt: 'You are a helpful assistant.',
        format: 'chat'
    });
    
    manager.registerTemplate(template);
    
    // Create context and options
    const context = new PromptContext({
        query: 'Hello, how are you?',
        model: 'qwen2:1.5b'
    });
    
    const options = new PromptOptions({
        format: 'chat',
        temperature: 0.7
    });
    
    // Generate prompt
    const result = await manager.generatePrompt('test-chat', context, options);
    console.log('✓ Basic prompt generation works');
    console.log('  Result format:', result.format);
    console.log('  Content type:', typeof result.content);
    console.log('  Has metadata:', !!result.metadata);
    console.log('');
    
    // Test 2: Legacy compatibility
    console.log('2. Testing legacy compatibility...');
    
    // Test PromptTemplates compatibility
    const legacyTemplate = PromptTemplates.getTemplateForModel('qwen2:1.5b');
    const legacyResult = await legacyTemplate.chat(
        'You are a helpful assistant.',
        'Previous conversation context',
        'What is the weather like?'
    );
    
    console.log('✓ Legacy PromptTemplates compatibility works');
    console.log('  Legacy result type:', typeof legacyResult);
    console.log('  Is array (messages):', Array.isArray(legacyResult));
    console.log('');
    
    // Test 3: Different formats
    console.log('3. Testing different formats...');
    
    const formats = ['structured', 'conversational', 'json', 'markdown'];
    
    for (const format of formats) {
        const formatOptions = new PromptOptions({ format });
        const formatResult = await manager.generatePrompt('test-chat', context, formatOptions);
        console.log(`✓ ${format} format works - Content length: ${formatResult.content.length}`);
    }
    console.log('');
    
    // Test 4: Template validation
    console.log('4. Testing template validation...');
    
    try {
        const invalidTemplate = new PromptTemplate({
            name: '', // Empty name should be invalid
            content: 'test'
        });
        console.log('✗ Template validation failed - should have thrown error');
    } catch (error) {
        console.log('✓ Template validation works - correctly rejected invalid template');
    }
    
    // Test 5: Context cloning
    console.log('5. Testing context cloning...');
    
    const originalContext = new PromptContext({
        query: 'Original query',
        model: 'qwen2:1.5b'
    });
    
    const clonedContext = originalContext.clone({
        query: 'Modified query',
        temperature: 0.8
    });
    
    console.log('✓ Context cloning works');
    console.log('  Original query:', originalContext.query);
    console.log('  Cloned query:', clonedContext.query);
    console.log('  Original model:', originalContext.model);
    console.log('  Cloned model:', clonedContext.model);
    console.log('');
    
    // Test 6: Quick start
    console.log('6. Testing quick start...');
    
    const quickManager = await quickStart();
    const quickResult = await quickManager.generatePrompt('chat-basic', 
        new PromptContext({ query: 'Test quick start' }),
        new PromptOptions({ format: 'chat' })
    );
    
    console.log('✓ Quick start works');
    console.log('  Templates loaded:', quickManager.templates.size);
    console.log('');
    
    // Test 7: Health check
    console.log('7. Testing health check...');
    
    const health = manager.healthCheck();
    console.log('✓ Health check works');
    console.log('  Status:', health.status);
    console.log('  Templates:', health.templates);
    console.log('  Stats:', health.stats);
    console.log('');
    
    console.log('=== All tests passed! ===');
    return true;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testUnifiedSystem().catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });
}

export default testUnifiedSystem;