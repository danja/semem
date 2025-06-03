#!/bin/bash

# Setup Semem Demos
# Path: ./demos/setup.sh
# Usage: chmod +x demos/setup.sh && ./demos/setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         SEMEM DEMO SETUP               ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create demos directory structure
echo -e "${BLUE}Setting up demo environment...${NC}"

# Create directories
mkdir -p demos/data
mkdir -p demos/logs

echo -e "${GREEN}✓${NC} Created demos/data directory"
echo -e "${GREEN}✓${NC} Created demos/logs directory"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in Semem project root directory${NC}"
    echo "Please run this script from the Semem project root."
    exit 1
fi

echo -e "${GREEN}✓${NC} Confirmed in Semem project root"

# Check Node.js
echo -e "${BLUE}Checking prerequisites...${NC}"

NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ $NODE_VERSION == "not found" ]]; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Please install Node.js 20.11.0+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version too old: $NODE_VERSION${NC}"
    echo "Please upgrade to Node.js 20.11.0+"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠${NC} Node modules not installed"
    echo "Installing dependencies..."
    npm install
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# Check environment file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC} .env file not found"
    if [ -f "example.env" ]; then
        cp example.env .env
        echo -e "${GREEN}✓${NC} Created .env from example.env"
        echo -e "${YELLOW}⚠${NC} Please edit .env to add your API keys"
    else
        echo -e "${RED}❌ example.env not found${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

# Test Ollama connection
echo -e "${BLUE}Testing service connectivity...${NC}"

OLLAMA_VERSION=$(curl -s http://localhost:11434/api/version 2>/dev/null || echo "unavailable")
if [[ $OLLAMA_VERSION == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} Ollama not running"
    echo "  To start Ollama: ollama serve"
    echo "  To install models: ollama pull qwen2:1.5b && ollama pull nomic-embed-text"
else
    echo -e "${GREEN}✓${NC} Ollama is running"
    
    # Check if required models are installed
    QWEN_STATUS=$(ollama list | grep "qwen2:1.5b" || echo "missing")
    NOMIC_STATUS=$(ollama list | grep "nomic-embed-text" || echo "missing")
    
    if [[ $QWEN_STATUS == "missing" ]]; then
        echo -e "${YELLOW}⚠${NC} qwen2:1.5b model not installed"
        echo "  Install with: ollama pull qwen2:1.5b"
    else
        echo -e "${GREEN}✓${NC} qwen2:1.5b model available"
    fi
    
    if [[ $NOMIC_STATUS == "missing" ]]; then
        echo -e "${YELLOW}⚠${NC} nomic-embed-text model not installed"
        echo "  Install with: ollama pull nomic-embed-text"
    else
        echo -e "${GREEN}✓${NC} nomic-embed-text model available"
    fi
fi

# Test API server
API_HEALTH=$(curl -s http://localhost:4100/api/health 2>/dev/null || echo "unavailable")
if [[ $API_HEALTH == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} API server not running"
    echo "  To start: node servers/api-server.js"
else
    echo -e "${GREEN}✓${NC} API server is running"
fi

# Test MCP server
MCP_INFO=$(curl -s http://localhost:4040/mcp 2>/dev/null || echo "unavailable")
if [[ $MCP_INFO == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} MCP server not running"
    echo "  To start: node mcp-server.js"
else
    echo -e "${GREEN}✓${NC} MCP server is running"
fi

# Test SPARQL endpoints
SPARQL_4030=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4030/semem/query 2>/dev/null || echo "000")
SPARQL_3030=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3030/semem/query 2>/dev/null || echo "000")

if [[ $SPARQL_4030 == "200" ]] || [[ $SPARQL_4030 == "401" ]]; then
    echo -e "${GREEN}✓${NC} SPARQL endpoint available on port 4030"
elif [[ $SPARQL_3030 == "200" ]] || [[ $SPARQL_3030 == "401" ]]; then
    echo -e "${GREEN}✓${NC} SPARQL endpoint available on port 3030"
else
    echo -e "${YELLOW}⚠${NC} SPARQL endpoint not running"
    echo "  Example using Docker: docker run -p 3030:3030 stain/jena-fuseki"
fi

# Make scripts executable
echo -e "${BLUE}Making scripts executable...${NC}"

chmod +x demos/run-all.sh 2>/dev/null || echo -e "${YELLOW}⚠${NC} Could not make run-all.sh executable"

# Create a quick test script
cat > demos/quick-test.js << 'EOF'
#!/usr/bin/env node

// Quick connectivity test
import fetch from 'node-fetch';

console.log('Quick connectivity test...\n');

const tests = [
    {
        name: 'Ollama',
        url: 'http://localhost:11434/api/version',
        expected: 'Ollama version info'
    },
    {
        name: 'API Server',
        url: 'http://localhost:4100/api/health',
        expected: 'Health status'
    },
    {
        name: 'MCP Server',
        url: 'http://localhost:4040/mcp',
        expected: 'MCP server info'
    }
];

for (const test of tests) {
    try {
        const response = await fetch(test.url);
        if (response.ok) {
            console.log(`✅ ${test.name}: Available`);
        } else {
            console.log(`⚠️  ${test.name}: HTTP ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ ${test.name}: Not reachable`);
    }
}

console.log('\nUse `node demos/01-memory-basic.js` to run the first demo.');
EOF

chmod +x demos/quick-test.js

echo -e "${GREEN}✓${NC} Created quick connectivity test script"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           SETUP COMPLETE               ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Demo environment is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Start required services (if not already running):"
echo "   - Ollama: ollama serve"
echo "   - API Server: node servers/api-server.js"
echo "   - MCP Server: node mcp-server.js (optional)"
echo ""
echo "2. Run a quick test:"
echo "   node demos/quick-test.js"
echo ""
echo "3. Run individual demos:"
echo "   node demos/01-memory-basic.js"
echo ""
echo "4. Run all demos:"
echo "   ./demos/run-all.sh"
echo ""
echo "5. Read the demo guide:"
echo "   cat demos/README.md"
echo ""
echo -e "${BLUE}Happy testing!${NC}"