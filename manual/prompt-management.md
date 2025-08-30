# Prompt Management System

The Semem unified prompt management system provides a centralized, extensible way to handle all prompt operations across the codebase. It maintains full backward compatibility while offering modern features for template management, formatting, and workflow integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Migration Guide](#migration-guide)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

## Overview

### Architecture

The unified prompt system consists of several key components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  PromptManager  │    │ PromptTemplate  │    │ PromptContext   │
│   (Central      │◄──►│   (Template     │    │  (Execution     │
│   Coordinator)  │    │   Definition)   │    │   Context)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Compatibility   │    │   Formatters    │    │   Validators    │
│   Adapters      │    │  (Multiple      │    │  (Template &    │
│ (Legacy Support)│    │   Formats)      │    │   Context)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Benefits

1. **Unified Interface**: Single API for all prompt operations
2. **Backward Compatibility**: Existing code continues to work unchanged
3. **Multiple Formats**: Support for chat, completion, structured, JSON, markdown
4. **Template Management**: Centralized registry with discovery and validation
5. **Workflow Integration**: Seamless support for complex multi-step workflows
6. **Performance**: Template caching and efficient reuse
7. **Extensibility**: Easy to add new models, formats, and templates

## Quick Start

### Installation

The prompt management system is included in Semem core. Import it as needed:

```javascript
import { 
    PromptManager, 
    PromptContext, 
    PromptTemplate, 
    PromptOptions,
    quickStart 
} from './src/prompts/index.js';
```

### Basic Usage

#### Method 1: Quick Start (Recommended)

```javascript
// Initialize with all existing templates loaded
const manager = await quickStart();

// Create context and options
const context = new PromptContext({
    query: 'What is machine learning?',
    context: 'Previous discussion about AI',
    model: 'qwen2:1.5b',
    temperature: 0.7
});

const options = new PromptOptions({
    format: 'chat',
    includeMetadata: true
});

// Generate prompt
const result = await manager.generatePrompt('chat-default', context, options);
console.log('Generated:', result.content);
console.log('Format:', result.format);
console.log('Execution time:', result.executionTime, 'ms');
```

#### Method 2: Legacy Compatibility (No Changes Needed)

```javascript
// Existing code continues to work unchanged
import PromptTemplates from './src/PromptTemplates.js';

const template = PromptTemplates.getTemplateForModel('mistral');
const messages = await template.chat(
    'You are a helpful assistant.',
    'Context about the topic',
    'What is your question?'
);
```

#### Method 3: Manual Setup

```javascript
// Create manager manually
const manager = new PromptManager();

// Register custom template
const template = new PromptTemplate({
    name: 'custom-analysis',
    description: 'Custom analysis template',
    content: 'Analyze: ${query}',
    format: 'structured'
});

manager.registerTemplate(template);

// Use template
const context = new PromptContext({ query: 'AI trends' });
const result = await manager.generatePrompt('custom-analysis', context);
```

## Core Concepts

### PromptContext

Represents the execution context for a prompt, including content, model settings, and metadata.

```javascript
const context = new PromptContext({
    // Core content
    query: 'The main query or instruction',
    systemPrompt: 'You are a helpful assistant',
    context: 'Additional context information',
    
    // Model settings
    model: 'qwen2:1.5b',
    temperature: 0.7,
    maxTokens: 1000,
    
    // Workflow support
    workflow: 'workflow-name',
    arguments: { key: 'value' },
    
    // Metadata
    metadata: { source: 'user', priority: 'high' }
});
```

#### Context Methods

```javascript
// Clone with modifications
const newContext = context.clone({ temperature: 0.8 });

// Add memory context
context.addMemory(memoryData);

// Add workflow step result
context.addStepResult('step1', result);

// Set workflow
context.setWorkflow('research-analysis', { depth: 'deep' });

// Convert to legacy formats
const legacy = context.toLegacyFormat();
const mcp = context.toMCPFormat();
```

### PromptTemplate

Defines reusable prompt templates with metadata, validation, and model support.

```javascript
const template = new PromptTemplate({
    // Basic info
    name: 'research-summary',
    description: 'Summarize research documents',
    version: '1.0',
    category: 'research',
    
    // Template content
    content: 'Summarize the following research: ${document}',
    systemPrompt: 'You are a research analyst',
    format: 'structured',
    
    // Arguments and validation
    arguments: [
        { 
            name: 'document', 
            type: 'string', 
            required: true,
            description: 'Research document to summarize'
        }
    ],
    
    // Model support
    supportedModels: ['qwen2:1.5b', 'mistral'],
    modelVariants: {
        'mistral': { 
            content: 'Advanced summary: ${document}' 
        }
    },
    
    // Workflow support (optional)
    workflow: [
        { tool: 'extract_concepts', arguments: { text: '${document}' } },
        { tool: 'generate_summary', arguments: { concepts: '${concepts}' } }
    ]
});
```

#### Template Methods

```javascript
// Check model support
if (template.supportsModel('qwen2:1.5b')) {
    // Use template
}

// Get model-specific variant
const variant = template.getModelVariant('mistral');

// Render template with context
const rendered = template.render(context);

// Convert to legacy format
const legacy = template.toLegacyFormat();
```

### PromptOptions

Controls prompt generation behavior and output formatting.

```javascript
const options = new PromptOptions({
    // Generation options
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
    
    // Format options
    format: 'structured', // 'chat', 'completion', 'json', 'markdown'
    includeInstructions: true,
    includeMetadata: true,
    contextMarkers: false,
    
    // Execution options
    retries: 3,
    timeout: 60000,
    streaming: false,
    debug: false,
    
    // Memory options
    useMemory: true,
    contextLimit: 10,
    memoryThreshold: 0.7,
    
    // Workflow options
    workflow: 'workflow-name',
    stepByStep: false,
    validateSteps: true
});
```

#### Options Methods

```javascript
// Merge with other options
const merged = options.merge(otherOptions);

// Get format-specific options
const chatOptions = options.getFormatOptions('chat');

// Convert to legacy/MCP formats
const legacy = options.toLegacyFormat();
const mcp = options.toMCPFormat();
```

### PromptResult

Contains the generated prompt and execution metadata.

```javascript
// Result properties
console.log(result.content);        // Generated prompt content
console.log(result.format);         // Output format used
console.log(result.executionTime);  // Generation time in ms
console.log(result.tokenCount);     // Estimated token count
console.log(result.metadata);       // Additional metadata
console.log(result.template);       // Template used
console.log(result.success);        // Success status

// Result methods
if (result.isSuccess()) {
    const fullContent = result.getFullContent();
}
```

## API Reference

### PromptManager

Central coordinator for all prompt operations.

#### Constructor

```javascript
const manager = new PromptManager({
    enableLegacySupport: true,    // Enable backward compatibility
    cacheTemplates: true,         // Enable template caching
    validateTemplates: true,      // Validate templates on registration
    logLevel: 'info'             // Logging level
});
```

#### Template Management

```javascript
// Register template
manager.registerTemplate(template);

// Get template
const template = manager.getTemplate('template-name');

// List all templates
const templates = manager.listTemplates();

// Get templates by category
const templates = manager.listTemplates().filter(t => t.category === 'research');
```

#### Prompt Generation

```javascript
// Generate prompt
const result = await manager.generatePrompt(templateName, context, options);

// Execute template directly
const result = await manager.executeTemplate(template, context, options);
```

#### System Management

```javascript
// Health check
const health = manager.healthCheck();

// Get statistics
const stats = manager.getStats();

// Clear cache
manager.clearCache();

// Get legacy adapter
const adapter = manager.getLegacyAdapter('PromptTemplates');
```

### Available Formats

#### Structured Format

Optimized for LLM consumption with clear sections:

```javascript
const options = new PromptOptions({ format: 'structured' });
const result = await manager.generatePrompt('template-name', context, options);

// Output example:
// # System Instructions
// You are a helpful assistant.
// 
// ## Context
// Previous conversation context
// 
// ## Query
// What is machine learning?
```

#### Chat Format

Returns array of chat messages:

```javascript
const options = new PromptOptions({ format: 'chat' });
const result = await manager.generatePrompt('template-name', context, options);

// Output: [
//   { role: 'system', content: 'You are a helpful assistant.' },
//   { role: 'user', content: 'What is machine learning?' }
// ]
```

#### Conversational Format

Natural language format:

```javascript
const options = new PromptOptions({ format: 'conversational' });
const result = await manager.generatePrompt('template-name', context, options);

// Output: "Based on the context: ... What is machine learning?"
```

#### JSON Format

Structured JSON output:

```javascript
const options = new PromptOptions({ format: 'json' });
const result = await manager.generatePrompt('template-name', context, options);

// Output: {
//   "query": "What is machine learning?",
//   "context": "Previous context",
//   "systemPrompt": "You are a helpful assistant."
// }
```

#### Markdown Format

Markdown-formatted output:

```javascript
const options = new PromptOptions({ format: 'markdown' });
const result = await manager.generatePrompt('template-name', context, options);

// Output:
// # Prompt
// ## System
// You are a helpful assistant.
// ## Query
// What is machine learning?
```

#### Completion Format

Plain text for completion models:

```javascript
const options = new PromptOptions({ format: 'completion' });
const result = await manager.generatePrompt('template-name', context, options);

// Output: "Context: Previous context\n\nQuery: What is machine learning?"
```

## Migration Guide

### From PromptTemplates.js

The unified system provides full backward compatibility. Existing code continues to work unchanged:

```javascript
// OLD CODE (still works)
import PromptTemplates from './src/PromptTemplates.js';
const template = PromptTemplates.getTemplateForModel('mistral');
const result = await template.chat(system, context, query);

// NEW CODE (optional migration)
import { quickStart, PromptContext, PromptOptions } from './src/prompts/index.js';
const manager = await quickStart();
const context = new PromptContext({ query, context, systemPrompt: system });
const options = new PromptOptions({ format: 'chat' });
const result = await manager.generatePrompt('mistral-chat', context, options);
```

### Gradual Migration Strategy

```javascript
// Adaptive function that supports both approaches
async function generatePrompt(model, system, context, query, useUnified = false) {
    if (useUnified) {
        // Use new unified system
        const { getPromptManager } = await import('./src/prompts/index.js');
        const manager = getPromptManager();
        const promptContext = new PromptContext({ query, context, systemPrompt: system, model });
        const options = new PromptOptions({ format: 'chat' });
        const result = await manager.generatePrompt('chat-default', promptContext, options);
        return result.content;
    } else {
        // Use legacy system
        const template = PromptTemplates.getTemplateForModel(model);
        return await template.chat(system, context, query);
    }
}

// Can be called either way
const legacyResult = await generatePrompt('mistral', 'System', 'Context', 'Query', false);
const unifiedResult = await generatePrompt('mistral', 'System', 'Context', 'Query', true);
```

### Feature Flags

Use feature flags for gradual rollout:

```javascript
import { FeatureFlags } from './src/prompts/index.js';

// Configure feature flags
FeatureFlags.configure({
    useUnifiedPromptSystem: true,
    enablePromptCaching: true,
    validateTemplates: true
});

// Check flags in code
if (FeatureFlags.isEnabled('useUnifiedPromptSystem')) {
    // Use unified system
} else {
    // Use legacy system
}
```

### From MCP Prompt Registry

MCP workflows are automatically migrated:

```javascript
// OLD MCP WORKFLOW
import { promptRegistry } from './mcp/prompts/registry.js';
const prompt = promptRegistry.getPrompt('semem-memory-qa');

// NEW UNIFIED SYSTEM (automatic migration)
const manager = await quickStart(); // Automatically loads MCP workflows
const template = manager.getTemplate('mcp-semem-memory-qa');
```

## Advanced Usage

### Custom Templates

Create custom templates for specific use cases:

```javascript
const customTemplate = new PromptTemplate({
    name: 'code-review',
    description: 'Review code for quality and security',
    content: `Review the following ${language} code:

\`\`\`${language}
\${code}
\`\`\`

Focus on:
- Code quality and readability
- Security vulnerabilities
- Performance issues
- Best practices

Provide specific recommendations.`,
    format: 'structured',
    arguments: [
        { name: 'code', type: 'string', required: true },
        { name: 'language', type: 'string', required: true, default: 'javascript' }
    ],
    supportedModels: ['*'],
    category: 'development'
});

manager.registerTemplate(customTemplate);

// Use custom template
const context = new PromptContext({
    arguments: {
        code: 'function add(a, b) { return a + b; }',
        language: 'javascript'
    }
});

const result = await manager.generatePrompt('code-review', context);
```

### Workflow Templates

Create complex multi-step workflows:

```javascript
const workflowTemplate = new PromptTemplate({
    name: 'research-pipeline',
    description: 'Complete research analysis pipeline',
    isWorkflow: true,
    workflow: [
        {
            tool: 'extract_concepts',
            arguments: { text: '${document}' },
            description: 'Extract key concepts from document'
        },
        {
            tool: 'search_related',
            arguments: { concepts: '${step_0.concepts}' },
            description: 'Search for related information'
        },
        {
            tool: 'synthesize_analysis',
            arguments: { 
                original: '${document}',
                related: '${step_1.results}',
                concepts: '${step_0.concepts}'
            },
            description: 'Synthesize comprehensive analysis'
        }
    ],
    arguments: [
        { name: 'document', type: 'string', required: true },
        { name: 'depth', type: 'string', default: 'standard' }
    ]
});
```

### Model-Specific Variants

Create templates that adapt to different models:

```javascript
const adaptiveTemplate = new PromptTemplate({
    name: 'adaptive-chat',
    description: 'Chat template that adapts to model capabilities',
    content: '${query}',
    format: 'chat',
    modelVariants: {
        'llama2': {
            content: '[INST] ${context ? `${context}\n\n` : \'\'}${query} [/INST]',
            format: 'completion'
        },
        'mistral': {
            content: '<s>[INST] ${query} [/INST]',
            format: 'completion'
        },
        'qwen2': {
            content: '${query}',
            format: 'chat'
        }
    }
});
```

### Custom Formatters

Add custom output formats:

```javascript
class CustomPromptManager extends PromptManager {
    initializeFormatters() {
        super.initializeFormatters();
        
        // Add custom XML format
        this.formatters.set('xml', this.formatXML.bind(this));
    }
    
    async formatXML(rendered, context, options) {
        const content = `<?xml version="1.0" encoding="UTF-8"?>
<prompt>
    <system>${rendered.systemPrompt || ''}</system>
    <context>${context.context || ''}</context>
    <query>${rendered.content}</query>
    <metadata>
        <model>${context.model}</model>
        <temperature>${context.temperature}</temperature>
    </metadata>
</prompt>`;
        
        return {
            content,
            format: 'xml',
            metadata: rendered.metadata
        };
    }
}
```

### Caching Strategies

Optimize performance with caching:

```javascript
const manager = new PromptManager({
    cacheTemplates: true,
    cacheOptions: {
        maxSize: 10000,
        ttl: 3600000 // 1 hour
    }
});

// Cache will automatically store and retrieve results
const result1 = await manager.generatePrompt('template', context, options);
const result2 = await manager.generatePrompt('template', context, options); // Cache hit
```

### Monitoring and Metrics

Track system performance:

```javascript
import { PromptMetrics } from './src/prompts/index.js';

// Get metrics
const metrics = PromptMetrics.getReport();
console.log('Legacy calls:', metrics.legacyCallsTotal);
console.log('Unified calls:', metrics.unifiedCallsTotal);
console.log('Migration progress:', metrics.migrationProgress + '%');

// Health monitoring
const health = manager.healthCheck();
if (health.status !== 'healthy') {
    console.warn('Prompt system health issue:', health);
}
```

## Troubleshooting

### Common Issues

#### Template Not Found

```javascript
// Problem: Template not registered
const result = await manager.generatePrompt('unknown-template', context);
// Error: Template not found: unknown-template

// Solution: Check available templates
const templates = manager.listTemplates();
console.log('Available templates:', templates.map(t => t.name));

// Or register the template
manager.registerTemplate(new PromptTemplate({
    name: 'unknown-template',
    content: 'Your template content'
}));
```

#### Model Not Supported

```javascript
// Problem: Template doesn't support model
const template = manager.getTemplate('specialized-template');
if (!template.supportsModel('unsupported-model')) {
    // Use fallback model or different template
    context.model = 'qwen2:1.5b'; // Fallback model
    // Or use generic template
    const result = await manager.generatePrompt('chat-default', context);
}
```

#### Invalid Arguments

```javascript
// Problem: Required arguments missing
try {
    const result = await manager.generatePrompt('template-with-args', context);
} catch (error) {
    if (error.message.includes('Required argument')) {
        // Add missing arguments
        context.arguments = { requiredArg: 'value' };
        const result = await manager.generatePrompt('template-with-args', context);
    }
}
```

#### Legacy Compatibility Issues

```javascript
// Problem: Legacy code not working
// Check if compatibility layer is enabled
const manager = new PromptManager({
    enableLegacySupport: true  // Make sure this is true
});

// Or use direct legacy adapter
const adapter = manager.getLegacyAdapter('PromptTemplates');
const result = adapter.formatChatPrompt(model, system, context, query);
```

### Performance Issues

#### Template Cache Optimization

```javascript
// Check cache performance
const stats = manager.getStats();
console.log('Cache hit rate:', stats.cacheHits / stats.promptsGenerated);

// Adjust cache settings if needed
manager.options.cacheTemplates = true;
manager.clearCache(); // Reset if corrupted
```

#### Memory Usage

```javascript
// Monitor memory usage
const health = manager.healthCheck();
console.log('Cache size:', health.cacheSize);

// Clear cache periodically
setInterval(() => {
    if (manager.templateCache.size > 1000) {
        manager.clearCache();
    }
}, 300000); // Every 5 minutes
```

### Debugging

#### Enable Debug Mode

```javascript
const options = new PromptOptions({
    debug: true
});

const result = await manager.generatePrompt('template', context, options);
// Will log detailed execution information
```

#### Template Validation

```javascript
try {
    const template = new PromptTemplate({
        name: 'test-template',
        content: 'Test content'
    });
} catch (error) {
    console.error('Template validation failed:', error.message);
    // Fix template definition
}
```

#### Context Inspection

```javascript
// Inspect context before generation
console.log('Context:', JSON.stringify(context, null, 2));

// Check legacy format conversion
console.log('Legacy format:', context.toLegacyFormat());
console.log('MCP format:', context.toMCPFormat());
```

### Getting Help

1. **Check System Health**: Use `manager.healthCheck()` to identify issues
2. **Review Logs**: Enable debug mode for detailed logging
3. **Validate Templates**: Ensure templates are properly formatted
4. **Test Legacy Compatibility**: Verify backward compatibility is working
5. **Check Documentation**: Review this guide and inline code documentation

For additional support, refer to the implementation files in `src/prompts/` or run the demo in `examples/unified-prompt-demo.js` to see working examples.