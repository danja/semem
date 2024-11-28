# Quick Start Guide

## Basic Setup
```javascript
import { MemoryManager, JSONStorage } from 'semem';

// Initialize with minimal configuration
const manager = new MemoryManager({
    apiKey: process.env.OPENAI_API_KEY,
    storage: new JSONStorage('memory.json')
});

// Simple interaction
async function basicExample() {
    const prompt = "What's the weather like?";
    const response = await manager.generateResponse(prompt);
    console.log(response);
}

// Advanced interaction with memory retrieval
async function advancedExample() {
    const prompt = "Remember our discussion about AI?";
    
    // Get relevant past interactions
    const relevantMemories = await manager.retrieveRelevantInteractions(prompt);
    
    // Generate contextual response
    const response = await manager.generateResponse(prompt, [], relevantMemories);
    
    // Store interaction
    const embedding = await manager.getEmbedding(`${prompt} ${response}`);
    const concepts = await manager.extractConcepts(`${prompt} ${response}`);
    await manager.addInteraction(prompt, response, embedding, concepts);
}
```

## Using with Ollama
```javascript
const manager = new MemoryManager({
    chatModel: 'ollama',
    chatModelName: 'llama2',
    embeddingModel: 'ollama',
    embeddingModelName: 'nomic-embed-text'
});
```

## Using Remote Storage
```javascript
import { RemoteStorage } from 'semem';

const manager = new MemoryManager({
    apiKey: process.env.OPENAI_API_KEY,
    storage: new RemoteStorage({
        endpoint: 'https://api.example.com/memory',
        apiKey: process.env.STORAGE_API_KEY
    })
});
```
