/**
 * Manages prompt templates for different LLM models
 */
export default class PromptTemplates {
    static templates = {
        'llama2': {
            chat: (system, context, query) => {
                const messages = [{
                    role: 'system',
                    content: system
                }]

                if (context) {
                    messages.push({
                        role: 'user',
                        content: `Here is relevant information from my memory that you must use to answer the following question:

MEMORY CONTEXT:
${context}

Please base your response on this specific information. If the question relates to topics covered in the memory context, use that information as your primary source. Do not make up information that contradicts or isn't supported by the provided context.

QUESTION: ${query}`
                    })
                } else {
                    messages.push({
                        role: 'user',
                        content: query
                    })
                }

                return messages
            },
            completion: (context, query) => {
                return `[INST] ${context ? `Context:\n${context}\n\n` : ''}Query: ${query} [/INST]`
            },
            extractConcepts: (text) => {
                return `[INST] Extract key concepts from the following text and return them as a JSON array of strings only. Example: ["concept1", "concept2"]. Text: "${text}" [/INST]`
            }
        },

        'mistral': {
            chat: (system, context, query) => {
                const messages = [{
                    role: 'system',
                    content: system
                }]

                if (context) {
                    messages.push({
                        role: 'user',
                        content: `Here is relevant information from my memory that you must use to answer the following question:

MEMORY CONTEXT:
${context}

Please base your response on this specific information. If the question relates to topics covered in the memory context, use that information as your primary source. Do not make up information that contradicts or isn't supported by the provided context.

QUESTION: ${query}`
                    })
                } else {
                    messages.push({
                        role: 'user',
                        content: query
                    })
                }

                return messages
            },
            completion: (context, query) => {
                return `<s>[INST] ${context ? `${context}\n\n` : ''}${query} [/INST]`
            },
            extractConcepts: (text) => {
                return [{
                    role: 'user',
                    content: `Extract key concepts from the following text and return them as a JSON array of strings. Only return the JSON array, nothing else. 

Examples:
Text: "Machine learning algorithms analyze data patterns"
Response: ["machine learning", "algorithms", "data analysis", "patterns"]

Text: "Climate change affects global weather systems"  
Response: ["climate change", "global weather", "weather systems", "environmental impact"]

Now extract concepts from this text:
"${text}"`
                }]
            }
        }
    };

    static getTemplateForModel(modelName) {
        if (typeof modelName !== 'string') {
            throw new TypeError('Model name must be a string')
        }
        const baseModel = modelName.split(':')[0].toLowerCase()
        const modelFamily = baseModel.replace(/[\d.]/g, '')
        return this.templates[modelFamily] || this.templates['llama2']
    }

    static formatChatPrompt(modelName, system, context, query) {
        const template = this.getTemplateForModel(modelName)
        return template.chat(system, context, query)
    }

    static formatCompletionPrompt(modelName, context, query) {
        const template = this.getTemplateForModel(modelName)
        return template.completion(context, query)
    }

    static formatConceptPrompt(modelName, text) {
        const template = this.getTemplateForModel(modelName)
        return template.extractConcepts(text)
    }

    static registerTemplate(modelName, template) {
        if (!template.chat || !template.completion || !template.extractConcepts) {
            throw new Error('Template must implement chat, completion, and extractConcepts methods')
        }
        this.templates[modelName.toLowerCase()] = template
    }
}