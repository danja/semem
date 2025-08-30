# Context Window Management

The Semem library provides sophisticated context management capabilities through two complementary classes: `ContextWindowManager` and `ContextManager`. These classes work together to handle large text processing, context buffering, and intelligent context building for LLM interactions.

## Overview

Context management is essential for:
- Breaking large text into manageable chunks that fit within LLM token limits
- Maintaining relevant historical context across conversations
- Optimizing memory usage while preserving important information
- Handling edge cases with varying text sizes and formats

## ContextWindowManager

Located in `src/ContextWindowManager.js`, this class handles low-level text chunking and window processing.

### Key Features

- **Text Chunking**: Breaks large text into overlapping windows
- **Token Estimation**: Estimates token count using character-to-token ratio (default 4 chars per token)
- **Smart Splitting**: Respects word boundaries when creating windows
- **Overlap Handling**: Creates overlapping windows to preserve context continuity
- **Content Merging**: Intelligently merges overlapping content back together

### Configuration Options

```javascript
const windowManager = new ContextWindowManager({
    minWindowSize: 1024,      // Minimum window size in characters
    maxWindowSize: 8192,      // Maximum window size in characters
    overlapRatio: 0.1,        // Overlap ratio between windows (10%)
    avgTokenLength: 4         // Average characters per token
});
```

### Core Methods

#### `estimateTokens(text)`
Estimates the number of tokens in a text string based on character count.

#### `calculateWindowSize(input)`
Calculates optimal window size for given input, bounded by min/max limits.

#### `createWindows(text, windowSize)`
Creates overlapping text windows with smart word boundary detection.

#### `processContext(context, options)`
Processes context into windows with optional metadata inclusion.

#### `mergeOverlappingContent(windows)`
Merges overlapping windows back into coherent text.

## ContextManager

Located in `src/ContextManager.js`, this class provides high-level context management and integration with memory systems.

### Key Features

- **Context Buffer Management**: Maintains a buffer of recent interactions with similarity scores
- **Context Pruning**: Removes old/irrelevant interactions based on time and relevance thresholds
- **Context Summarization**: Groups interactions by concept and creates concise summaries
- **Integration**: Works with ContextWindowManager for large context handling
- **Context Building**: Combines current prompt with relevant historical context

### Configuration Options

```javascript
const contextManager = new ContextManager({
    maxTokens: 8192,                    // Maximum tokens for context
    maxTimeWindow: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    relevanceThreshold: 0.7,            // Minimum similarity score
    maxContextSize: 5,                  // Maximum context items
    overlapRatio: 0.1                   // Passed to ContextWindowManager
});
```

### Core Methods

#### `addToContext(interaction, similarity)`
Adds an interaction to the context buffer with similarity score.

#### `pruneContext()`
Removes old or low-relevance items from the context buffer.

#### `summarizeContext(interactions)`
Creates concise summaries of interactions grouped by concept.

#### `buildContext(currentPrompt, retrievals, recentInteractions, options)`
Builds complete context including history and current prompt.

## Usage Examples

### Basic Window Management

```javascript
import ContextWindowManager from './src/ContextWindowManager.js';

const windowManager = new ContextWindowManager({
    minWindowSize: 512,
    maxWindowSize: 2048,
    overlapRatio: 0.1
});

const longText = "Your long text here...";
const windows = windowManager.createWindows(longText, 1024);
console.log(`Created ${windows.length} windows`);

// Merge back together
const merged = windowManager.mergeOverlappingContent(windows);
```

### Context Management with Memory

```javascript
import ContextManager from './src/ContextManager.js';

const contextManager = new ContextManager({
    maxTokens: 4096,
    maxContextSize: 5,
    relevanceThreshold: 0.7
});

// Add interactions
contextManager.addToContext({
    prompt: "What is machine learning?",
    output: "Machine learning is...",
    concepts: ["machine learning", "AI"]
}, 0.9);

// Build context for new query
const context = contextManager.buildContext(
    "How do neural networks work?",
    retrievals,
    recentInteractions,
    { systemContext: "You are an AI assistant..." }
);
```

## Integration with Memory Systems

The context management system integrates seamlessly with Semem's memory components:

```javascript
import MemoryManager from './src/MemoryManager.js';
import ContextManager from './src/ContextManager.js';

const memoryManager = new MemoryManager({
    // ... memory configuration
    contextOptions: {
        maxTokens: 2048,
        overlapRatio: 0.15
    }
});

// Memory manager automatically uses context management
const response = await memoryManager.generateResponse(
    query, 
    [], 
    relevantMemories
);
```

## Production Usage

The context management system is actively used in several production scenarios:

### BeerQA Example
In `examples/beerqa/GetResult.js`, ContextManager builds augmented context for LLM question answering:

```javascript
const contextManager = new ContextManager({
    maxTokens: runtimeConfig.maxContextTokens,
    maxContextSize: runtimeConfig.maxContextSize,
    relevanceThreshold: 0.3
});

const context = contextManager.buildContext(
    question.questionText,
    retrievals,
    [],
    { systemContext: "Answer based on the provided context..." }
);
```

### Context Management Example
`examples/basic/ContextManagement.js` provides comprehensive testing of both classes with:
- Text chunking and window processing
- Context buffer management
- Memory integration testing
- Edge case handling

## Edge Cases and Error Handling

The system handles various edge cases:

- **Short Text**: Gracefully handles text shorter than minimum window size
- **No Spaces**: Manages text without word boundaries
- **Empty Input**: Safely processes empty or null inputs
- **Very Large Text**: Efficiently chunks extremely large content
- **Memory Limits**: Respects token limits and memory constraints

## Best Practices

1. **Configure Appropriately**: Set window sizes based on your LLM's token limits
2. **Monitor Performance**: Large texts may require significant processing time
3. **Tune Parameters**: Adjust overlap ratios and relevance thresholds based on use case
4. **Handle Errors**: Implement proper error handling for edge cases
5. **Resource Management**: Dispose of MemoryManager instances when finished

## Troubleshooting

Common issues and solutions:

- **Token Limit Exceeded**: Reduce `maxTokens` or increase `overlapRatio`
- **Poor Context Quality**: Adjust `relevanceThreshold` or `maxContextSize`
- **Memory Issues**: Use smaller window sizes for very large texts
- **Slow Performance**: Consider caching or reducing context size
- **Missing Context**: Check similarity scores and time windows

## Configuration Integration

Context management integrates with Semem's configuration system:

```json
{
  "context": {
    "maxTokens": 8192,
    "maxTimeWindow": 86400000,
    "relevanceThreshold": 0.7,
    "maxContextSize": 5,
    "overlapRatio": 0.1
  }
}
```

This system ensures efficient memory usage while maintaining high-quality context for LLM interactions across the entire Semem ecosystem.