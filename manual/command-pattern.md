# Command Pattern Architecture

## Overview

SimpleVerbsService uses the Command Pattern to provide a clean, maintainable architecture for semantic memory operations. This document explains how to use the service and understand its internal structure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Public API Layer (SimpleVerbsService)                      │
│  - service.tell(), service.ask(), etc.                      │
│  - Convenience methods for direct verb invocation           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Command Registry (VerbCommandRegistry)                     │
│  - Dynamic dispatch to command objects                      │
│  - Replaces switch statements with polymorphism             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Command Objects (TellCommand, AskCommand, etc.)            │
│  - Single responsibility per verb                           │
│  - Strategy Pattern for complex operations                  │
└─────────────────────────────────────────────────────────────┘
```

## Basic Usage

### Initializing the Service

```javascript
import { SimpleVerbsService } from './src/mcp/tools/SimpleVerbsService.js';

const service = new SimpleVerbsService();
await service.initialize();
```

### Using the Public API Methods

The service provides 12 core verb methods that you can call directly:

#### 1. Tell - Store Content

```javascript
const result = await service.tell({
  content: 'Machine learning models require training data',
  type: 'document',  // or 'interaction', 'concept'
  metadata: { source: 'research-paper' }
});

console.log(result.success);  // true
console.log(result.concepts);  // number of concepts extracted
```

#### 2. Ask - Query with Context

```javascript
const result = await service.ask({
  question: 'What do machine learning models require?',
  mode: 'standard',  // or 'basic', 'comprehensive'
  useContext: true,
  useHyDE: false
});

console.log(result.answer);  // Generated response
console.log(result.contextCount);  // Number of context items used
```

#### 3. Augment - Process/Enhance Content

```javascript
const result = await service.augment({
  operation: 'concepts',  // or 'attributes', 'relationships'
  content: 'Artificial intelligence systems learn from data',
  options: {}
});

console.log(result.concepts);  // Extracted concepts
```

#### 4. Zoom - Navigate Granularity (ZPT)

```javascript
const result = await service.zoom({
  level: 'concept',  // or 'entity', 'document', 'community'
  query: 'machine learning',
  maxResults: 20
});

console.log(result.items);  // Items at specified granularity
```

#### 5. Pan - Navigate Direction (ZPT)

```javascript
const result = await service.pan({
  direction: 'semantic',  // or 'temporal', 'conceptual'
  domain: 'artificial-intelligence',
  maxResults: 20
});

console.log(result.results);  // Filtered results
```

#### 6. Tilt - Change Presentation (ZPT)

```javascript
const result = await service.tilt({
  style: 'summary',  // or 'keywords', 'detailed'
  query: 'neural networks',
  maxItems: 10
});

console.log(result.presentation);  // Formatted content
```

#### 7. Inspect - Examine System State

```javascript
const result = await service.inspect({
  type: 'session',  // or 'concepts', 'all'
  includeRecommendations: true
});

console.log(result.health);  // System health metrics
```

#### 8. Remember - Store in Memory Domains

```javascript
const result = await service.remember({
  content: 'Important project deadline: Dec 31',
  domain: 'project',  // or 'user', 'session', 'instruction'
  importance: 0.9
});
```

#### 9. Forget - Remove/Fade Content

```javascript
const result = await service.forget({
  target: 'old-session-data',
  fadeFactor: 0.5
});
```

#### 10. Recall - Retrieve from Domains

```javascript
const result = await service.recall({
  domains: ['project', 'user'],
  query: 'deadlines',
  maxResults: 10
});

console.log(result.memories);  // Retrieved memories
```

#### 11. Project Context - Manage Project Contexts

```javascript
const result = await service.project_context({
  projectId: 'proj-123',
  action: 'load'  // or 'save', 'clear'
});
```

#### 12. Fade Memory - Apply Memory Decay

```javascript
const result = await service.fade_memory({
  fadeFactor: 0.8,
  preserveInstructions: true
});
```

## Advanced Usage

### Using the Execute Method Directly

If you need dynamic verb execution, you can use the lower-level `execute()` method:

```javascript
const verbName = 'tell';  // Dynamic verb selection
const result = await service.execute(verbName, {
  content: 'Dynamic content'
});
```

### Checking Service Health

```javascript
const health = service.getHealthStatus();
console.log(health.initialized);  // true/false
console.log(health.extractedCommands);  // List of all available commands
```

### Understanding the Response Format

All commands return a standardized response:

```javascript
{
  success: true,         // Operation status
  verb: 'tell',         // The verb that was executed
  // ... verb-specific fields
  timestamp: '2025-09-30T...',
  performance: {
    totalDuration: 1234,
    phases: [...],
    performanceLevel: 'warn'
  }
}
```

## Internal Architecture

### Command Pattern Implementation

The refactored architecture eliminates the 2,646-line monolithic service with switch statements:

**Before (Monolithic):**
```javascript
async execute(verb, params) {
  switch(verb) {
    case 'tell':
      // 200 lines of tell logic
      break;
    case 'ask':
      // 300 lines of ask logic
      break;
    // ... 10 more cases
  }
}
```

**After (Command Pattern):**
```javascript
async execute(verb, params) {
  return await this.registry.execute(verb, params);
}
```

### Command Classes

Each verb has its own command class in `src/mcp/tools/verbs/commands/`:

- **BaseVerbCommand.js** - Abstract base class
- **TellCommand.js** - Content storage logic
- **AskCommand.js** - Query and retrieval logic
- **AugmentCommand.js** - Content processing logic
- **ZoomCommand.js** - Granularity navigation (ZPT)
- **PanCommand.js** - Direction navigation (ZPT)
- **TiltCommand.js** - Presentation changes (ZPT)
- **InspectCommand.js** - System introspection
- **RememberCommand.js** - Domain-specific storage
- **ForgetCommand.js** - Content removal/fading
- **RecallCommand.js** - Domain-specific retrieval
- **ProjectContextCommand.js** - Project context management
- **FadeMemoryCommand.js** - Memory decay operations

### Strategy Pattern

Complex commands use the Strategy Pattern for different operational modes:

**TellCommand Strategies:**
- InteractionTellStrategy
- DocumentTellStrategy
- ConceptTellStrategy
- LazyTellStrategy

**AugmentCommand Strategies:**
- ConceptsStrategy
- AttributesStrategy
- RelationshipsStrategy
- ProcessLazyStrategy
- ChunkDocumentsStrategy
- LegacyOperationsStrategy
- AutoStrategy

### VerbCommandRegistry

The registry manages command lifecycle and dispatch:

```javascript
class VerbCommandRegistry {
  async initialize() {
    // Register all commands
    await this.registerCommand('tell', new TellCommand(), sharedContext);
    await this.registerCommand('ask', new AskCommand(), sharedContext);
    // ... register all 12 commands
  }

  async execute(verb, params) {
    const command = this.commands.get(verb);
    return await command.execute(params);
  }
}
```

## Benefits of This Architecture

### 1. Single Responsibility
Each command class handles one verb's logic (100-200 lines vs. 2,646 in one file).

### 2. Open/Closed Principle
Add new verbs by creating new command classes without modifying existing code.

### 3. Testability
Each command can be tested independently with focused unit tests.

### 4. Maintainability
Clear separation of concerns makes the codebase easier to understand and modify.

### 5. Eliminating Code Smells
Replaced multiple switch statements (a code smell) with polymorphic command objects.

## File Structure

```
src/mcp/tools/
├── SimpleVerbsService.js           # Public API (247 lines)
└── verbs/
    ├── commands/                    # 13 command classes
    │   ├── BaseVerbCommand.js
    │   ├── TellCommand.js
    │   ├── AskCommand.js
    │   └── ...
    ├── strategies/                  # 14 strategy classes
    │   ├── tell/
    │   ├── augment/
    │   └── ...
    ├── services/
    │   └── VerbContextService.js    # Dependency injection
    └── VerbCommandRegistry.js       # Command registry
```

## Migration from Old Code

If you have existing code using the old monolithic service, no changes are needed! The public API remains identical:

```javascript
// Old code works unchanged
const result = await service.tell({ content: 'data' });
const answer = await service.ask({ question: 'query' });
```

The refactoring is completely transparent to existing users.

## Performance

The Command Pattern introduces minimal overhead:
- Command lookup: O(1) via Map
- Delegation: Single method call
- Overall impact: < 1ms per operation

Performance is tracked in the response:

```javascript
{
  performance: {
    totalDuration: 1234,  // milliseconds
    phases: [...],
    performanceLevel: 'good'  // 'good', 'warn', or 'critical'
  }
}
```

## Error Handling

All commands include comprehensive error handling:

```javascript
try {
  const result = await service.tell({ content: 'data' });
  if (!result.success) {
    console.error(result.error);
  }
} catch (error) {
  console.error('Command execution failed:', error.message);
}
```

## Further Reading

- [MCP List](./mcp-list.md) - Complete list of MCP verbs
- [MCP Tutorial](./mcp-tutorial.md) - MCP integration guide
- [Infrastructure](./infrastructure.md) - Development patterns
- [Refactoring.guru - Switch Statements](https://refactoring.guru/smells/switch-statements) - Code smell explanation

## Summary

The Command Pattern architecture provides:
- ✅ Clean, maintainable code structure
- ✅ Easy-to-use public API
- ✅ Extensible design for new verbs
- ✅ Full backward compatibility
- ✅ Comprehensive error handling
- ✅ Performance tracking
- ✅ ~90% reduction in main file size

Use the public API methods (`service.tell()`, `service.ask()`, etc.) for all normal operations. The internal command structure is transparent to users but provides significant benefits for maintainability and extensibility.