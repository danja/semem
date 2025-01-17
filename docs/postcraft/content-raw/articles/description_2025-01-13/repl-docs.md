# Semem REPL Environment

## Overview
The Semem REPL provides an interactive shell environment with support for both natural language chat and RDF query modes. It offers command history, auto-completion, and integrated help.

## Quick Start
```bash
# Start REPL
semem repl

# Basic commands
help           # Show available commands
mode chat      # Switch to chat mode
mode rdf       # Switch to RDF mode
clear          # Clear screen
exit           # Exit REPL
```

## Features

### Chat Mode
```javascript
// Default chat mode
semem> Hello, how do you work?

// Switch models
semem> /model llama2

// View context
semem> /context

// Clear conversation
semem> /clear
```

### RDF Mode
```sparql
// Basic SPARQL query
semem> SELECT * WHERE { ?s ?p ?o } LIMIT 5

// Store triple
semem> INSERT DATA { 
  <http://example.org/subject> <http://example.org/predicate> "object" 
}

// Define prefix
semem> @prefix ex: <http://example.org/>
```

### Command History
- Up/Down arrows for history navigation
- `history` command to view recent commands
- History persistence between sessions
- `!n` to repeat nth command

### Auto-completion
- Tab completion for commands
- Prefix completion for SPARQL keywords
- URI completion for known namespaces
- Command parameter hints

### Help System
```bash
# General help
semem> help

# Command-specific help
semem> help mode
semem> help query

# Examples
semem> examples chat
semem> examples sparql
```

### Context Management
```bash
# View current context
semem> /context

# Clear context
semem> /context clear

# Save context
semem> /context save workspace1

# Load context
semem> /context load workspace1
```

## Keyboard Shortcuts
- `Ctrl+C`: Cancel current input
- `Ctrl+D`: Exit REPL
- `Ctrl+L`: Clear screen
- `Ctrl+R`: Reverse history search
- `Ctrl+U`: Clear current line

## Configuration
The REPL can be customized through:
- `.sememrc` configuration file
- Environment variables
- Runtime commands

Example configuration:
```json
{
  "repl": {
    "prompt": "semem λ",
    "historySize": 1000,
    "mode": "chat",
    "autoSave": true
  }
}
```