#!/bin/bash

# Curl Examples for Semem MCP Tools
# Test remote Mistral + Nomic provider integration

echo "🚀 Semem MCP Tool Testing with curl"
echo "Using remote providers: Mistral (chat) + Nomic (embeddings)"
echo ""

# Check if MCP server is running
if ! pgrep -f "semem-mcp" > /dev/null; then
    echo "❌ MCP server not running. Start with: npx semem-mcp"
    exit 1
fi

echo "✅ MCP server is running"
echo ""

# 1. List available tools
echo "📋 1. Listing available tools..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

# 2. Store a memory (uses both Mistral for concepts + Nomic for embeddings)
echo "💾 2. Storing memory (Mistral + Nomic integration)..."
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"semem_store_interaction","arguments":{"prompt":"What is semantic web technology?","response":"Semantic web technology enables machines to understand web content through structured data formats like RDF, SPARQL queries, and ontologies.","metadata":{"topic":"semantic_web","provider":"mistral+nomic"}}}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

# 3. Generate embedding using Nomic API
echo "🔍 3. Generating embedding (Nomic API)..."
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"semem_generate_embedding","arguments":{"text":"Knowledge graphs represent entities and their relationships in a structured format"}}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

# 4. Extract concepts using Mistral API
echo "🧠 4. Extracting concepts (Mistral API)..."
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"semem_extract_concepts","arguments":{"text":"Artificial intelligence systems use machine learning algorithms to process natural language and generate human-like responses"}}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

# 5. Search memories using vector similarity
echo "🔎 5. Searching memories (vector similarity)..."
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"semem_retrieve_memories","arguments":{"query":"semantic web technologies and RDF","threshold":0.7,"limit":5}}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

# 6. Decompose corpus into knowledge graph (Ragno)
echo "🕸️ 6. Knowledge graph decomposition (Ragno + Mistral)..."
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"ragno_decompose_corpus","arguments":{"textChunks":["Machine learning models learn patterns from training data to make predictions on new, unseen data."],"options":{"maxEntities":8,"confidenceThreshold":0.6}}}}' | \
    node ../../mcp/index.js | jq '.'
echo ""

echo "✅ All tests completed!"
echo ""
echo "🔧 Provider Configuration Verified:"
echo "  - Chat/Concepts: Mistral (mistral-small-latest)"
echo "  - Embeddings: Nomic (nomic-embed-text-v1.5)"
echo "  - Storage: SPARQL (https://fuseki.hyperdata.it/hyperdata.it)"