/**
 * Unified Prompt System Demo
 * 
 * This example demonstrates how to use the new unified prompt system
 * alongside existing code without breaking changes.
 */

// Import the unified system
import { 
    PromptManager, 
    PromptContext, 
    PromptTemplate, 
    PromptOptions,
    PromptTemplates, // Legacy compatibility
    quickStart 
} from '../src/prompts/index.js';

// Import existing components for comparison
import OriginalPromptTemplates from '../src/PromptTemplates.js';

async function demonstrateUnifiedSystem() {
    console.log('=== Unified Prompt System Demo ===\n');
    
    // Method 1: Using the quick start (recommended for new projects)
    console.log('1. Quick Start Method:');
    const manager = await quickStart();
    
    const context = new PromptContext({
        query: 'What is machine learning?',
        context: 'Previous discussion about AI and data science',
        model: 'qwen2:1.5b',
        temperature: 0.7
    });
    
    const options = new PromptOptions({
        format: 'chat',
        includeMetadata: true
    });
    
    const result = await manager.generatePrompt('chat-default', context, options);
    console.log('Generated prompt format:', result.format);
    console.log('Content type:', typeof result.content);
    console.log('Execution time:', result.executionTime, 'ms');
    console.log('Template used:', result.template.name);
    console.log('');
    
    // Method 2: Using legacy compatibility (for existing code)
    console.log('2. Legacy Compatibility Method:');
    
    // This works exactly like the old PromptTemplates
    const legacyTemplate = PromptTemplates.getTemplateForModel('mistral');
    const legacyResult = await legacyTemplate.chat(
        'You are a helpful assistant.',
        'Context about machine learning',
        'Explain neural networks'
    );
    
    console.log('Legacy result type:', typeof legacyResult);
    console.log('Is array (chat messages):', Array.isArray(legacyResult));
    console.log('First message role:', legacyResult[0]?.role);
    console.log('');
    
    // Method 3: Direct template usage
    console.log('3. Direct Template Usage:');
    
    const customTemplate = new PromptTemplate({
        name: 'custom-analysis',
        description: 'Custom analysis template',
        content: `Analyze the following topic: ${context.query}
        
Consider these aspects:
- Technical details
- Practical applications
- Current trends
- Future implications

Topic: \${query}
Context: \${context}`,
        format: 'structured',
        arguments: [
            { name: 'query', type: 'string', required: true },
            { name: 'context', type: 'string', required: false }
        ]
    });
    
    manager.registerTemplate(customTemplate);
    
    const customResult = await manager.generatePrompt('custom-analysis', context, options);
    console.log('Custom template result length:', customResult.content.length);
    console.log('Format:', customResult.format);
    console.log('');
    
    // Method 4: Different output formats
    console.log('4. Different Output Formats:');
    
    const formats = ['structured', 'conversational', 'json', 'markdown'];
    
    for (const format of formats) {
        const formatOptions = new PromptOptions({ format });
        const formatResult = await manager.generatePrompt('chat-default', context, formatOptions);
        console.log(`${format}: ${formatResult.content.length} characters`);
    }
    console.log('');
    
    // Method 5: Workflow templates (from MCP)
    console.log('5. Workflow Templates (MCP Integration):');
    
    const workflowContext = new PromptContext({
        workflow: 'mcp-semem-memory-qa',
        arguments: {
            question: 'What is the latest research on transformer architectures?',
            context_limit: 5,
            similarity_threshold: 0.7
        }
    });
    
    const workflowTemplate = manager.getTemplate('mcp-semem-memory-qa');
    if (workflowTemplate) {
        console.log('Workflow template found:', workflowTemplate.name);
        console.log('Description:', workflowTemplate.description);
        console.log('Is workflow:', workflowTemplate.isWorkflow);
        console.log('Arguments:', workflowTemplate.arguments.length);
    }
    console.log('');
    
    // Method 6: System health and metrics
    console.log('6. System Health and Metrics:');
    
    const health = manager.healthCheck();
    console.log('System status:', health.status);
    console.log('Total templates:', health.templates);
    console.log('Cache size:', health.cacheSize);
    console.log('Stats:', health.stats);
    console.log('');
    
    // Method 7: Template listing and discovery
    console.log('7. Template Discovery:');
    
    const templates = manager.listTemplates();
    const byCategory = {};
    
    for (const template of templates) {
        const category = template.category || 'general';
        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push(template.name);
    }
    
    for (const [category, names] of Object.entries(byCategory)) {
        console.log(`${category}: ${names.join(', ')}`);
    }
    console.log('');
    
    return {
        totalTemplates: templates.length,
        categories: Object.keys(byCategory).length,
        health: health.status
    };
}

async function comparePerformance() {
    console.log('=== Performance Comparison ===\n');
    
    const iterations = 100;
    const query = 'What are the benefits of renewable energy?';
    const context = 'Discussion about climate change and sustainability';
    
    // Test original system
    console.log('Testing original PromptTemplates...');
    const originalStart = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        const template = OriginalPromptTemplates.getTemplateForModel('qwen2:1.5b');
        await template.chat('You are a helpful assistant.', context, query);
    }
    
    const originalTime = Date.now() - originalStart;
    console.log(`Original system: ${originalTime}ms for ${iterations} iterations`);
    
    // Test unified system
    console.log('Testing unified prompt system...');
    const unifiedStart = Date.now();
    const manager = await quickStart();
    
    for (let i = 0; i < iterations; i++) {
        const promptContext = new PromptContext({ query, context });
        const options = new PromptOptions({ format: 'chat' });
        await manager.generatePrompt('chat-default', promptContext, options);
    }
    
    const unifiedTime = Date.now() - unifiedStart;
    console.log(`Unified system: ${unifiedTime}ms for ${iterations} iterations`);
    
    const improvement = ((originalTime - unifiedTime) / originalTime * 100).toFixed(1);
    console.log(`Performance difference: ${improvement}% ${improvement > 0 ? 'improvement' : 'regression'}`);
    
    return {
        originalTime,
        unifiedTime,
        improvement: parseFloat(improvement)
    };
}

async function demonstrateGradualMigration() {
    console.log('\n=== Gradual Migration Demo ===\n');
    
    // Simulate existing code that uses PromptTemplates
    console.log('1. Existing code (unchanged):');
    
    function existingFunction(model, system, context, query) {
        // This code doesn't need to change
        const template = PromptTemplates.getTemplateForModel(model);
        return template.chat(system, context, query);
    }
    
    const existingResult = await existingFunction(
        'mistral',
        'You are a helpful assistant.',
        'Context about AI',
        'What is machine learning?'
    );
    
    console.log('Existing code still works:', Array.isArray(existingResult));
    
    // Gradually migrate to unified system
    console.log('2. Gradual migration approach:');
    
    async function migratedFunction(model, system, context, query, useUnified = false) {
        if (useUnified) {
            // Use unified system
            const { getPromptManager } = await import('../src/prompts/index.js');
            const manager = getPromptManager();
            const promptContext = new PromptContext({ query, context, model });
            const options = new PromptOptions({ format: 'chat' });
            return await manager.generatePrompt('chat-default', promptContext, options);
        } else {
            // Fall back to legacy
            const template = PromptTemplates.getTemplateForModel(model);
            return await template.chat(system, context, query);
        }
    }
    
    // Can be called either way
    const legacyCall = await migratedFunction('mistral', 'System', 'Context', 'Query', false);
    const unifiedCall = await migratedFunction('mistral', 'System', 'Context', 'Query', true);
    
    console.log('Legacy call type:', typeof legacyCall);
    console.log('Unified call type:', typeof unifiedCall);
    console.log('Both approaches work seamlessly');
    
    return true;
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        await demonstrateUnifiedSystem();
        await comparePerformance();
        await demonstrateGradualMigration();
        console.log('\n=== Demo Complete ===');
    } catch (error) {
        console.error('Demo failed:', error);
        process.exit(1);
    }
}

export default {
    demonstrateUnifiedSystem,
    comparePerformance,
    demonstrateGradualMigration
};