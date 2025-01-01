# Troubleshooting Guide

## Common Issues and Solutions

### Embedding Generation
- Error: "Embedding dimension mismatch"
  - Verify model configuration
  - Check embedding model availability
  - Ensure consistent dimensions across storage

### Storage Issues
- SPARQL Connection Failures
  - Verify endpoint configuration
  - Check authentication credentials
  - Confirm graph exists and permissions

### Memory Management
- High Memory Usage
  - Adjust cache size settings
  - Enable automatic cleanup
  - Use appropriate storage backend

### Performance
- Slow Retrieval
  - Enable caching for SPARQL
  - Optimize similarity threshold
  - Adjust context window size

### Integration
- LLM Provider Issues
  - Verify Ollama/OpenAI setup
  - Check API credentials
  - Confirm model availability

## Debugging Steps
1. Enable debug logging
2. Check configuration
3. Verify storage health
4. Test LLM connectivity
5. Validate embeddings
6. Monitor memory usage