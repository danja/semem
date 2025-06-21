# Semem MCP Prompts Guide

## Overview

MCP Prompts in Semem provide powerful workflow templates that combine multiple tools into sophisticated, reusable operations. These prompts enable complex multi-step processes for semantic memory management, knowledge graph construction, and 3D navigation with simple, guided interfaces.

## Available Prompt Categories

### 1. Memory Workflows (`memory/`)

**`semem-research-analysis`** - Research document analysis with memory context
- **Purpose**: Analyze research documents by storing them in semantic memory, extracting concepts, and retrieving relevant context
- **Arguments**:
  - `document_text` (required): Text content to analyze
  - `analysis_depth` (optional): Depth of analysis - "shallow", "medium", "deep" (default: "medium")
  - `context_threshold` (optional): Similarity threshold for context retrieval (default: 0.7)
- **Workflow**: Store → Extract concepts → Retrieve similar → Generate insights

**`semem-memory-qa`** - Q&A with semantic memory retrieval
- **Purpose**: Answer questions using stored semantic memory and context
- **Arguments**:
  - `question` (required): Question to answer using memory
  - `context_limit` (optional): Maximum number of context memories (default: 5)
  - `similarity_threshold` (optional): Minimum similarity for memory inclusion (default: 0.6)
- **Workflow**: Query embedding → Memory search → Context assembly → Response generation

**`semem-concept-exploration`** - Deep concept exploration using stored knowledge
- **Purpose**: Explore concepts deeply by traversing semantic memory relationships
- **Arguments**:
  - `concept` (required): Concept to explore
  - `exploration_depth` (optional): Depth of exploration (default: 3)
  - `include_relationships` (optional): Include concept relationships (default: true)
- **Workflow**: Concept extraction → Memory traversal → Relationship mapping → Summary

### 2. Knowledge Graph Construction (`ragno/`)

**`ragno-corpus-to-graph`** - Transform text corpus to RDF knowledge graph
- **Purpose**: Convert text documents into structured RDF knowledge graphs
- **Arguments**:
  - `corpus_chunks` (required): Array of text chunks to process
  - `entity_confidence` (optional): Minimum confidence for entity extraction (default: 0.7)
  - `extract_relationships` (optional): Extract entity relationships (default: true)
- **Workflow**: Decompose → Extract entities → Build relationships → Export RDF

**`ragno-entity-analysis`** - Analyze and enrich entities with context
- **Purpose**: Deep analysis of specific entities within knowledge graphs
- **Arguments**:
  - `entity_name` (required): Name of entity to analyze
  - `context_radius` (optional): Relationship hops to include (default: 2)
  - `include_embeddings` (optional): Include entity embeddings (default: false)
- **Workflow**: Entity lookup → Relationship discovery → Context enrichment → Analysis report

### 3. 3D Navigation (`zpt/`)

**`zpt-navigate-explore`** - Interactive 3D knowledge navigation
- **Purpose**: Navigate and explore content in 3D spatial environments
- **Arguments**:
  - `query` (required): Navigation query or target
  - `zoom_level` (optional): Initial zoom level 1-10 (default: 5)
  - `tilt_style` (optional): Camera tilt style (default: "auto")
  - `filters` (optional): Content filters to apply (default: {})
- **Workflow**: Parameter validation → Navigation → Content assembly → Spatial analysis

### 4. Integrated Workflows (`integrated/`)

**`semem-full-pipeline`** - Complete memory → graph → navigation workflow
- **Purpose**: End-to-end processing through all Semem systems
- **Arguments**:
  - `input_data` (required): Input data to process
  - `pipeline_stages` (optional): Stages to include - ["memory", "graph", "navigation"] (default: all)
  - `output_formats` (optional): Desired output formats (default: ["json", "rdf"])
- **Workflow**: Memory storage → Graph construction → Navigation setup → Comprehensive analysis

**`research-workflow`** - Academic research processing pipeline
- **Purpose**: Process academic research documents through semantic analysis and knowledge graph construction
- **Arguments**:
  - `research_documents` (required): Array of research documents
  - `domain_focus` (optional): Research domain focus (default: "general")
  - `analysis_goals` (optional): Analysis objectives (default: ["concept_extraction", "relationship_mapping"])
- **Workflow**: Document ingestion → Concept extraction → Graph building → Insight navigation

## Using MCP Prompts

### Via MCP Client (Claude Desktop, etc.)

1. **List Available Prompts**:
   ```json
   {
     "method": "prompts/list",
     "params": {}
   }
   ```

2. **Get Prompt Details**:
   ```json
   {
     "method": "prompts/get",
     "params": {
       "name": "semem-research-analysis"
     }
   }
   ```

3. **Execute a Prompt**:
   ```json
   {
     "method": "prompts/execute",
     "params": {
       "name": "semem-research-analysis",
       "arguments": {
         "document_text": "Your research document text here...",
         "analysis_depth": "deep",
         "context_threshold": 0.8
       }
     }
   }
   ```

### Via HTTP API

For the HTTP MCP server, prompts are accessible through the standard MCP endpoint:

```bash
# List prompts
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "prompts/list", "params": {}}'

# Execute prompt
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "prompts/execute",
    "params": {
      "name": "semem-memory-qa",
      "arguments": {
        "question": "What are the main themes in my research documents?",
        "context_limit": 10
      }
    }
  }'
```

## Prompt Execution Results

Each prompt execution returns a structured result:

```json
{
  "success": true,
  "promptName": "semem-research-analysis",
  "executionId": "exec_1703123456789_abc123def",
  "results": [
    {
      "step": 1,
      "tool": "semem_store_interaction",
      "arguments": {...},
      "result": {...},
      "timestamp": "2023-12-21T10:30:45.123Z"
    }
  ],
  "summary": {
    "totalSteps": 4,
    "successfulSteps": 4,
    "toolsUsed": ["semem_store_interaction", "semem_extract_concepts", "semem_retrieve_memories"],
    "executionTime": 2500
  }
}
```

## Best Practices

### 1. Argument Preparation
- **Required Arguments**: Always provide all required arguments
- **Default Values**: Leverage default values for optional arguments when appropriate
- **Data Types**: Ensure arguments match expected types (string, number, boolean, array, object)

### 2. Error Handling
- **Prerequisites**: Prompts will validate that required tools are available before execution
- **Partial Failures**: If a step fails, the prompt will return partial results with error information
- **Retry Logic**: Failed prompts can be retried with adjusted parameters

### 3. Performance Optimization
- **Context Limits**: Use appropriate context limits for memory retrieval to balance relevance and performance
- **Similarity Thresholds**: Adjust similarity thresholds based on your data quality and requirements
- **Pipeline Stages**: For integrated workflows, specify only the stages you need

### 4. Result Interpretation
- **Step Results**: Each step's result is available for inspection and debugging
- **Summary Metrics**: Use summary metrics to understand execution performance
- **Tool Usage**: Review which tools were used to understand the workflow path

## Advanced Usage

### Conditional Execution
Some prompts support conditional steps based on arguments:

```json
{
  "name": "semem-full-pipeline",
  "arguments": {
    "input_data": "Your data...",
    "pipeline_stages": ["memory", "graph"]
  }
}
```

This will skip the navigation stage and only execute memory and graph processing.

### Custom Workflows
While the provided prompts cover common use cases, you can also:

1. **Chain Prompts**: Execute multiple prompts in sequence
2. **Custom Arguments**: Experiment with different argument combinations
3. **Result Processing**: Use prompt results as inputs to other operations

## Troubleshooting

### Common Issues

1. **Tool Not Available**: Ensure all required MCP tools are loaded
2. **Invalid Arguments**: Check argument types and required fields
3. **Memory Initialization**: Verify that memory services are properly initialized
4. **Network Timeouts**: Some workflows may take time; be patient with complex operations

### Debugging

- **Execution ID**: Use execution IDs to track and correlate prompt runs
- **Step-by-Step Results**: Examine individual step results to identify issues
- **Log Output**: Check server logs for detailed execution information

## Future Enhancements

The prompt system is designed to be extensible. Future versions may include:

- **Custom Prompt Creation**: User-defined prompt templates
- **Workflow Versioning**: Version control for prompt templates
- **Collaborative Prompts**: Shared prompt libraries
- **AI-Assisted Generation**: Automatic prompt creation based on usage patterns

---

This guide provides a comprehensive overview of the Semem MCP prompt system. For specific implementation details or advanced customization, refer to the source code and API documentation.