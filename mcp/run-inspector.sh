#!/bin/bash

# Script to run MCP Inspector with Semem MCP Server
# This provides a web UI for testing and debugging the MCP server

echo "🔍 Starting MCP Inspector with Semem MCP Server"
echo "================================================"

# Set debugging environment variables
export MCP_DEBUG=true
export MCP_DEBUG_LEVEL=debug
export NODE_ENV=development

# Check if MCP Inspector is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Navigate to the correct directory
cd "$(dirname "$0")/.."

echo "📁 Working directory: $(pwd)"
echo "🚀 Starting MCP Inspector..."
echo ""
echo "This will:"
echo "  1. Start the MCP Inspector UI (usually at http://localhost:6274)"
echo "  2. Launch the Semem MCP server with debugging enabled"
echo "  3. Allow you to test tools and inspect protocol messages"
echo ""
echo "🌐 The Inspector UI should open in your browser automatically"
echo "📋 Available tools to test:"
echo "   - mcp_debug_params (diagnostic tool)"
echo "   - semem_store_interaction"
echo "   - semem_retrieve_memories"  
echo "   - semem_generate_embedding"
echo "   - semem_generate_response"
echo "   - semem_extract_concepts"
echo ""
echo "⏹️  Press Ctrl+C to stop the inspector and server"
echo ""

# Run MCP Inspector with our server
npx @modelcontextprotocol/inspector node mcp/index.js