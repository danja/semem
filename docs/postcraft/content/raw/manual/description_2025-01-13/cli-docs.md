# Semem Command Line Interface

## Overview
The Semem CLI provides command-line access to the semantic memory system with colorized output and intuitive commands. It's built using yargs for command parsing and chalk for output formatting.

## Quick Start
```bash
# Install globally
npm install -g semem

# Basic chat interaction
semem chat --prompt "What is semantic memory?"

# Store data
semem store --data "Important information" --format text

# Query stored data
semem query --text "information" --limit 10

# View system metrics
semem metrics --format json
```

## Features

### Chat Operations
```bash
# Basic chat
semem chat -p "Hello" -m qwen2:1.5b

# With specific model
semem chat --prompt "Complex query" --model llama2
```

### Storage Operations
```bash
# Store text
semem store -d "Data to store" -f text

# Store RDF
semem store --data "@prefix ex: <http://example.org/> ." --format turtle

# Batch storage
semem store --file data.jsonl
```

### Query Operations
```bash
# Text search
semem query -q "search term" -l 5

# Semantic search
semem query --semantic "concept" --similarity 0.7

# SPARQL query
semem query --sparql "SELECT * WHERE { ?s ?p ?o }"
```

### Monitoring
```bash
# Basic metrics
semem metrics

# Detailed JSON output
semem metrics --format json --detail high

# Watch mode
semem metrics --watch --interval 5000
```

### Global Options
- `--color`: Enable/disable colored output
- `--verbose`: Enable detailed logging
- `--config`: Specify config file location
- `--output`: Control output format (text/json)

## Configuration
The CLI can be configured via:
- Command line arguments
- Environment variables
- Configuration file (~/.sememrc)

Example configuration:
```json
{
  "storage": {
    "type": "sparql",
    "endpoint": "http://localhost:3030/semem"
  },
  "models": {
    "default": "qwen2:1.5b"
  }
}
```