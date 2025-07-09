/**
 * Migration script to integrate existing prompt templates
 * 
 * This script safely migrates existing PromptTemplates, MCP registry,
 * and other prompt systems to the unified system.
 */

import { getPromptManager } from './compatibility.js';
import { PromptTemplate } from './interfaces.js';
import logger from 'loglevel';

/**
 * Migrate existing PromptTemplates.js to unified system
 */
export async function migratePromptTemplates(quiet = false) {
    if (!quiet) console.log('=== Migrating PromptTemplates.js ===');
    
    const manager = getPromptManager();
    
    // Define model-specific templates based on existing structure
    const templateDefinitions = {
        'llama2': {
            chat: {
                name: 'llama2-chat',
                description: 'Llama2 chat template with memory context support',
                content: '${query}',
                systemPrompt: '${system}',
                format: 'chat',
                modelVariants: {
                    'llama2': {
                        formatWithContext: true,
                        contextTemplate: `Here is relevant information from my memory that you must use to answer the following question:

MEMORY CONTEXT:
\${context}

Please base your response on this specific information. If the question relates to topics covered in the memory context, use that information as your primary source. Do not make up information that contradicts or isn't supported by the provided context.

QUESTION: \${query}`
                    }
                }
            },
            completion: {
                name: 'llama2-completion',
                description: 'Llama2 completion template with INST formatting',
                content: '[INST] ${context ? `Context:\n${context}\n\n` : \'\'}Query: ${query} [/INST]',
                format: 'completion'
            },
            extractConcepts: {
                name: 'llama2-concepts',
                description: 'Llama2 concept extraction template',
                content: '[INST] Extract key concepts from the following text and return them as a JSON array of strings only. Example: ["concept1", "concept2"]. Text: "${text}" [/INST]',
                format: 'completion',
                arguments: [
                    { name: 'text', type: 'string', required: true, description: 'Text to extract concepts from' }
                ]
            }
        },
        'mistral': {
            chat: {
                name: 'mistral-chat',
                description: 'Mistral chat template with memory context support',
                content: '${query}',
                systemPrompt: '${system}',
                format: 'chat',
                modelVariants: {
                    'mistral': {
                        formatWithContext: true,
                        contextTemplate: `Here is relevant information from my memory that you must use to answer the following question:

MEMORY CONTEXT:
\${context}

Please base your response on this specific information. If the question relates to topics covered in the memory context, use that information as your primary source. Do not make up information that contradicts or isn't supported by the provided context.

QUESTION: \${query}`
                    }
                }
            },
            completion: {
                name: 'mistral-completion',
                description: 'Mistral completion template with special formatting',
                content: '<s>[INST] ${context ? `${context}\n\n` : \'\'}${query} [/INST]',
                format: 'completion'
            },
            extractConcepts: {
                name: 'mistral-concepts',
                description: 'Mistral concept extraction template',
                content: `Extract key concepts from the following text and return them as a JSON array of strings. Only return the JSON array, nothing else. 

Examples:
Text: "Machine learning algorithms analyze data patterns"
Response: ["machine learning", "algorithms", "data analysis", "patterns"]

Text: "Climate change affects global weather systems"  
Response: ["climate change", "global weather", "weather systems", "environmental impact"]

Now extract concepts from this text:
"\${text}"`,
                format: 'chat',
                arguments: [
                    { name: 'text', type: 'string', required: true, description: 'Text to extract concepts from' }
                ]
            }
        }
    };
    
    // Register all templates
    let registered = 0;
    for (const [modelName, templates] of Object.entries(templateDefinitions)) {
        if (!quiet) console.log(`\nMigrating ${modelName} templates...`);
        
        for (const [templateType, templateDef] of Object.entries(templates)) {
            try {
                const template = new PromptTemplate({
                    ...templateDef,
                    supportedModels: [modelName],
                    category: 'legacy-migrated',
                    metadata: {
                        originalModel: modelName,
                        originalType: templateType,
                        migratedAt: new Date().toISOString()
                    }
                });
                
                manager.registerTemplate(template);
                registered++;
                if (!quiet) console.log(`  ✓ ${templateDef.name}`);
                
            } catch (error) {
                if (!quiet) console.log(`  ✗ Failed to migrate ${templateDef.name}: ${error.message}`);
            }
        }
    }
    
    if (!quiet) console.log(`\n✓ Migration complete: ${registered} templates registered`);
    return registered;
}

/**
 * Migrate MCP prompt registry
 */
export async function migrateMCPRegistry(quiet = false) {
    if (!quiet) console.log('=== Migrating MCP Prompt Registry ===');
    
    const manager = getPromptManager();
    
    // Try to import MCP registry
    try {
        const { promptRegistry } = await import('../../mcp/prompts/registry.js');
        await promptRegistry.initialize();
        
        const mcpPrompts = promptRegistry.listPrompts();
        if (!quiet) console.log(`Found ${mcpPrompts.length} MCP prompts to migrate`);
        
        let registered = 0;
        for (const mcpPrompt of mcpPrompts) {
            try {
                const template = new PromptTemplate({
                    name: `mcp-${mcpPrompt.name}`,
                    description: mcpPrompt.description,
                    workflow: mcpPrompt.workflow,
                    arguments: mcpPrompt.arguments,
                    isWorkflow: true,
                    category: 'mcp-migrated',
                    metadata: {
                        originalPrompt: mcpPrompt.name,
                        mcpVersion: mcpPrompt.version,
                        migratedAt: new Date().toISOString()
                    }
                });
                
                manager.registerTemplate(template);
                registered++;
                if (!quiet) console.log(`  ✓ ${mcpPrompt.name}`);
                
            } catch (error) {
                if (!quiet) console.log(`  ✗ Failed to migrate ${mcpPrompt.name}: ${error.message}`);
            }
        }
        
        if (!quiet) console.log(`\n✓ MCP migration complete: ${registered} templates registered`);
        return registered;
        
    } catch (error) {
        if (!quiet) console.log(`✗ Could not load MCP registry: ${error.message}`);
        return 0;
    }
}

/**
 * Create compatibility mappings for smooth transition
 */
export async function createCompatibilityMappings(quiet = false) {
    if (!quiet) console.log('=== Creating Compatibility Mappings ===');
    
    const manager = getPromptManager();
    
    // Create generic templates that map to model-specific ones
    const genericTemplates = [
        {
            name: 'chat-default',
            description: 'Default chat template (automatically selects best model)',
            content: '${query}',
            systemPrompt: '${system}',
            format: 'chat',
            supportedModels: ['*'],
            metadata: { isGeneric: true }
        },
        {
            name: 'completion-default',
            description: 'Default completion template (automatically selects best model)',
            content: '${context ? `Context: ${context}\n\n` : \'\'}Query: ${query}',
            format: 'completion',
            supportedModels: ['*'],
            metadata: { isGeneric: true }
        },
        {
            name: 'concepts-default',
            description: 'Default concept extraction template',
            content: 'Extract key concepts from the following text and return them as a JSON array: "${text}"',
            format: 'completion',
            supportedModels: ['*'],
            arguments: [
                { name: 'text', type: 'string', required: true, description: 'Text to extract concepts from' }
            ],
            metadata: { isGeneric: true }
        }
    ];
    
    let registered = 0;
    for (const template of genericTemplates) {
        try {
            manager.registerTemplate(new PromptTemplate(template));
            registered++;
            if (!quiet) console.log(`  ✓ ${template.name}`);
        } catch (error) {
            if (!quiet) console.log(`  ✗ Failed to register ${template.name}: ${error.message}`);
        }
    }
    
    if (!quiet) console.log(`\n✓ Compatibility mappings created: ${registered} templates`);
    return registered;
}

/**
 * Validate migration results
 */
export async function validateMigration(quiet = false) {
    if (!quiet) console.log('=== Validating Migration ===');
    
    const manager = getPromptManager();
    const health = manager.healthCheck();
    
    if (!quiet) {
        console.log(`Health status: ${health.status}`);
        console.log(`Total templates: ${health.templates}`);
        console.log(`Cache size: ${health.cacheSize}`);
    }
    
    // Test key templates
    const testTemplates = [
        'llama2-chat',
        'mistral-chat',
        'chat-default',
        'concepts-default'
    ];
    
    let working = 0;
    for (const templateName of testTemplates) {
        const template = manager.getTemplate(templateName);
        if (template) {
            if (!quiet) console.log(`  ✓ ${templateName} - available`);
            working++;
        } else {
            if (!quiet) console.log(`  ✗ ${templateName} - missing`);
        }
    }
    
    if (!quiet) console.log(`\n✓ Validation complete: ${working}/${testTemplates.length} core templates working`);
    
    return {
        health,
        workingTemplates: working,
        totalTemplates: testTemplates.length
    };
}

/**
 * Full migration process
 */
export async function runFullMigration(quiet = false) {
    if (!quiet) console.log('=== Starting Full Migration Process ===\n');
    
    const results = {
        promptTemplates: 0,
        mcpRegistry: 0,
        compatibility: 0,
        errors: []
    };
    
    try {
        // Step 1: Migrate PromptTemplates
        results.promptTemplates = await migratePromptTemplates(quiet);
        
        // Step 2: Migrate MCP Registry
        results.mcpRegistry = await migrateMCPRegistry(quiet);
        
        // Step 3: Create compatibility mappings
        results.compatibility = await createCompatibilityMappings(quiet);
        
        // Step 4: Validate migration
        const validation = await validateMigration(quiet);
        results.validation = validation;
        
        if (!quiet) {
            console.log('\n=== Migration Summary ===');
            console.log(`PromptTemplates migrated: ${results.promptTemplates}`);
            console.log(`MCP templates migrated: ${results.mcpRegistry}`);
            console.log(`Compatibility templates: ${results.compatibility}`);
            console.log(`Total templates: ${results.promptTemplates + results.mcpRegistry + results.compatibility}`);
            console.log(`Validation passed: ${validation.workingTemplates}/${validation.totalTemplates}`);
        }
        
        return results;
        
    } catch (error) {
        if (!quiet) console.error('Migration failed:', error);
        results.errors.push(error.message);
        return results;
    }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runFullMigration().catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}

export default {
    migratePromptTemplates,
    migrateMCPRegistry,
    createCompatibilityMappings,
    validateMigration,
    runFullMigration
};