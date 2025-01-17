// src/promptTemplates.js
export default class PromptTemplates {
    static templates = {
        'llama2': {
            chat: (system, context, query) => {
                const messages = [{
                    role: 'system',
                    content: system
                }];

                if (context) {
                    messages.push({
                        role: 'user',
                        content: context
                    });
                    messages.push({
                        role: 'assistant',
                        content: 'I understand the context provided. How can I help with your query?'
                    });
                }

                messages.push({
                    role: 'user',
                    content: query
                });

                return messages;
            },
            completion: (context, query) => {
                return `[INST] ${context ? `Context:\n${context}\n\n` : ''}Query: ${query} [/INST]`;
            },
            extractConcepts: (text) => {
                return `[INST] Extract key concepts from the following text and return them as a JSON array of strings only. Example: ["concept1", "concept2"]. Text: "${text}" [/INST]`;
            }
        },

        'mistral': {
            chat: (system, context, query) => {
                const messages = [{
                    role: 'system',
                    content: system
                }];

                if (context) {
                    messages.push({
                        role: 'user',
                        content: `Previous Context:\n${context}`
                    });
                    messages.push({
                        role: 'assistant',
                        content: 'Context received. What would you like to know?'
                    });
                }

                messages.push({
                    role: 'user',
                    content: query
                });

                return messages;
            },
            completion: (context, query) => {
                return `<s>[INST] ${context ? `${context}\n\n` : ''}${query} [/INST]`;
            },
            extractConcepts: (text) => {
                return `<s>[INST] Extract and return only a JSON array of key concepts from: "${text}" [/INST]`;
            }
        }
    };

    static getTemplateForModel(modelName) {
        // Handle model name variants
        const baseModel = modelName.split(':')[0].toLowerCase();
        const modelFamily = baseModel.replace(/[\d.]/g, ''); // Remove version numbers
        return this.templates[modelFamily] || this.templates['llama2'];
    }

    static formatChatPrompt(modelName, system, context, query) {
        const template = this.getTemplateForModel(modelName);
        return template.chat(system, context, query);
    }

    static formatCompletionPrompt(modelName, context, query) {
        const template = this.getTemplateForModel(modelName);
        return template.completion(context, query);
    }

    static formatConceptPrompt(modelName, text) {
        const template = this.getTemplateForModel(modelName);
        return template.extractConcepts(text);
    }

    static registerTemplate(modelName, template) {
        if (!template.chat || !template.completion || !template.extractConcepts) {
            throw new Error('Template must implement chat, completion, and extractConcepts methods');
        }
        this.templates[modelName.toLowerCase()] = template;
    }
}
