# Source File Analysis

## Config.js
**Purpose**: Central configuration management system supporting environment overrides and validation.

Key Methods:
- `init()`: Initializes configuration with defaults and environment overrides
- `get(path)`: Retrieves nested configuration values using dot notation
- `set(path, value)`: Updates configuration values with validation
- `applyEnvironmentOverrides()`: Handles environment variable configuration
- `validateConfig()`: Ensures required configuration is present and valid

## ContextManager.js
**Purpose**: Manages contextual information for LLM interactions, handling memory retrieval and text processing.

Key Methods:
- `addToContext(interaction, similarity)`: Adds interactions to context buffer
- `buildContext(currentPrompt, retrievals, recentInteractions)`: Constructs prompt context
- `pruneContext()`: Removes old or irrelevant context entries
- `summarizeContext(interactions)`: Creates concise summary grouped by concept

## ContextWindowManager.js
**Purpose**: Handles text window management for context processing, ensuring content fits within model limits.

Key Methods:
- `estimateTokens(text)`: Estimates token count for text
- `calculateWindowSize(input)`: Determines appropriate window size
- `createWindows(text, windowSize)`: Segments text into overlapping windows
- `mergeOverlappingContent(windows)`: Reconstructs text from windows

## MemoryManager.js
**Purpose**: Central coordinator for memory operations, managing interactions between LLMs and storage.

Key Methods:
- `addInteraction(prompt, output, embedding, concepts)`: Stores new interactions
- `retrieveRelevantInteractions(query)`: Finds similar past interactions
- `generateResponse(prompt, lastInteractions, retrievals)`: Coordinates response generation
- `generateEmbedding(text)`: Creates vector embeddings for text
- `extractConcepts(text)`: Identifies key concepts in text

## PromptTemplates.js
**Purpose**: Manages prompt formatting for different LLM models, ensuring consistent interaction.

Key Methods:
- `formatChatPrompt(modelName, system, context, query)`: Formats chat messages
- `formatCompletionPrompt(modelName, context, query)`: Formats completion prompts
- `formatConceptPrompt(modelName, text)`: Formats concept extraction prompts
- `registerTemplate(modelName, template)`: Adds new model templates

## Utils.js
**Purpose**: Provides utility functions for logging and vector operations.

Key Methods:
- `logger`: Logging utility with different levels
- `vectorOps.normalize(vector)`: Normalizes embedding vectors
- `vectorOps.cosineSimilarity(vec1, vec2)`: Calculates vector similarity

## index.js
**Purpose**: Application entry point, initializes core components and configuration.

Key Methods:
- `init()`: Bootstraps the application
- Error handling for uncaught exceptions