import { augmentWithAttributes } from './src/ragno/augmentWithAttributes.js';
import LLMHandler from './src/handlers/LLMHandler.js';

import OllamaConnector from './src/connectors/OllamaConnector.js';

// Create a wrapper that implements the LLMProvider interface expected by LLMHandler
class OllamaProviderWrapper {
  constructor() {
    this.connector = new OllamaConnector();
  }

  async generateChat(model, messages, options = {}) {
    // Convert messages to the format expected by Ollama
    const prompt = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    
    const response = await this.connector.client.chat.completions.create({
      model: model || 'qwen2:1.5b',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.3,
      top_p: options.top_p,
      top_k: options.top_k
    });
    
    return response.choices[0].message.content;
  }

  async generateCompletion(model, prompt, options = {}) {
    const response = await this.connector.client.completions.create({
      model: model || 'qwen2:1.5b',
      prompt: prompt,
      temperature: options.temperature || 0.3,
      top_p: options.top_p,
      top_k: options.top_k
    });
    
    return response.choices[0].text;
  }

  async generateEmbedding(model, text) {
    return this.connector.generateEmbedding(model || 'nomic-embed-text', text);
  }
}

// Create LLM handler with the Ollama provider wrapper
const llmHandler = new LLMHandler(new OllamaProviderWrapper(), 'qwen2:1.5b', 0.3);

// Sample graph data with more context
const sampleGraph = {
  entities: [
    { name: 'Artificial Intelligence', type: 'Concept' },
    { name: 'Machine Learning', type: 'Concept' },
    { name: 'Neural Networks', type: 'Concept' }
  ],
  units: [
    { 
      id: 'unit1', 
      text: 'Artificial Intelligence is the simulation of human intelligence processes by machines, especially computer systems. Specific applications of AI include expert systems, natural language processing, speech recognition and machine vision.',
      entities: ['Artificial Intelligence']
    },
    { 
      id: 'unit2', 
      text: 'Machine Learning is a subset of AI that enables systems to learn from data, identify patterns and make decisions with minimal human intervention. It focuses on the development of computer programs that can access data and use it to learn for themselves.',
      entities: ['Machine Learning', 'Artificial Intelligence']
    },
    { 
      id: 'unit3', 
      text: 'Neural Networks are computing systems inspired by the biological neural networks that constitute animal brains. They are a subset of machine learning and are at the heart of deep learning algorithms.',
      entities: ['Neural Networks', 'Machine Learning']
    }
  ],
  relationships: [
    { 
      source: 'Machine Learning', 
      target: 'Artificial Intelligence',
      type: 'subClassOf',
      description: 'Machine Learning is a subfield of Artificial Intelligence that focuses on building systems that learn from data.'
    },
    { 
      source: 'Neural Networks', 
      target: 'Machine Learning',
      type: 'subClassOf',
      description: 'Neural Networks are a type of Machine Learning model inspired by the human brain.'
    }
  ]
};

// Test the attribute generation with real LLM
async function testRealAttributeGeneration() {
  try {
    console.log('Testing attribute generation with real LLM...');
    console.log('This may take a moment as it calls the Ollama service...\n');
    
    const startTime = Date.now();
    const result = await augmentWithAttributes(sampleGraph, llmHandler, { topK: 2 });
    const endTime = Date.now();
    
    console.log(`\nAttribute generation completed in ${(endTime - startTime) / 1000} seconds`);
    console.log('\nGenerated attributes:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during attribute generation:', error);
  }
}

testRealAttributeGeneration();
