import { augmentWithAttributes } from './src/ragno/augmentWithAttributes.js';
import LLMHandler from './src/handlers/LLMHandler.js';

// Mock LLM provider that returns a simple response
const mockLLMProvider = {
  async generateChat(model, messages, options) {
    // Extract the prompt from the last user message
    const userMessage = messages.find(m => m.role === 'user');
    const prompt = userMessage.content;
    
    // Simple mock response based on the prompt
    if (prompt.includes('Summarize the key attributes')) {
      const entity = prompt.match(/entity '([^']+)'/)[1];
      return `The entity '${entity}' is a central concept with multiple relationships and properties.`;
    }
    return 'Mock LLM response';
  }
};

// Create LLM handler with mock provider
const llmHandler = new LLMHandler(mockLLMProvider, 'mock-model');

// Sample graph data
const sampleGraph = {
  entities: [
    { name: 'Artificial Intelligence', type: 'Concept' },
    { name: 'Machine Learning', type: 'Concept' },
    { name: 'Neural Networks', type: 'Concept' }
  ],
  units: [
    { 
      id: 'unit1', 
      text: 'Artificial Intelligence is the simulation of human intelligence processes by machines.',
      entities: ['Artificial Intelligence']
    },
    { 
      id: 'unit2', 
      text: 'Machine Learning is a subset of AI that enables systems to learn from data.',
      entities: ['Machine Learning', 'Artificial Intelligence']
    },
    { 
      id: 'unit3', 
      text: 'Neural Networks are computing systems inspired by biological neural networks.',
      entities: ['Neural Networks']
    }
  ],
  relationships: [
    { 
      source: 'Machine Learning', 
      target: 'Artificial Intelligence',
      type: 'subClassOf',
      description: 'Machine Learning is a subfield of Artificial Intelligence.'
    },
    { 
      source: 'Neural Networks', 
      target: 'Machine Learning',
      type: 'subClassOf',
      description: 'Neural Networks are a type of Machine Learning model.'
    }
  ]
};

// Test the attribute generation
async function testAttributeGeneration() {
  try {
    console.log('Testing attribute generation...');
    const result = await augmentWithAttributes(sampleGraph, llmHandler, { topK: 2 });
    console.log('Generated attributes:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during attribute generation:', error);
  }
}

testAttributeGeneration();
