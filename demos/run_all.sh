#!/bin/bash

# Run All Semem Demos
# Path: ./demos/run-all.sh
# Usage: chmod +x demos/run-all.sh && ./demos/run-all.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Demo configurations
declare -a DEMOS=(
    "01-memory-basic.js:Basic Memory Storage:Basic memory functionality with storage and retrieval"
    "02-sparql-integration.js:SPARQL Integration:RDF/SPARQL storage backend (requires SPARQL endpoint)"
    "03-http-api.js:HTTP API:REST API endpoints (requires API server running)"
    "04-llm-providers.js:LLM Providers:Multiple LLM provider integration"
    "05-semantic-search.js:Semantic Search:Vector similarity search and content retrieval"
    "06-mcp-server.js:MCP Server:Model Context Protocol server (requires MCP server running)"
    "07-context-management.js:Context Management:Context window processing and management"
)

# Results tracking
declare -a RESULTS=()
TOTAL_DEMOS=${#DEMOS[@]}
SUCCESSFUL=0
FAILED=0
SKIPPED=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}        SEMEM FUNCTIONALITY DEMOS       ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Running $TOTAL_DEMOS demos to test Semem's claimed functionality..."
echo ""

# Create data directory
mkdir -p demos/data
echo -e "${GREEN}✓${NC} Created demos/data directory"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ $NODE_VERSION == "not found" ]]; then
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
else
    echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"
fi

# Check Ollama
OLLAMA_STATUS=$(curl -s http://localhost:11434/api/version 2>/dev/null || echo "unavailable")
if [[ $OLLAMA_STATUS == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} Ollama not running (some demos may fail)"
else
    echo -e "${GREEN}✓${NC} Ollama is running"
fi

# Check API server
API_STATUS=$(curl -s http://localhost:4100/api/health 2>/dev/null || echo "unavailable")
if [[ $API_STATUS == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} API server not running (HTTP API demo will fail)"
else
    echo -e "${GREEN}✓${NC} API server is running"
fi

# Check MCP server
MCP_STATUS=$(curl -s http://localhost:4040/mcp 2>/dev/null || echo "unavailable")
if [[ $MCP_STATUS == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} MCP server not running (MCP demo will fail)"
else
    echo -e "${GREEN}✓${NC} MCP server is running"
fi

# Check SPARQL endpoint
SPARQL_STATUS=$(curl -s http://localhost:4030/semem/query 2>/dev/null || echo "unavailable")
if [[ $SPARQL_STATUS == "unavailable" ]]; then
    SPARQL_STATUS=$(curl -s http://localhost:3030/semem/query 2>/dev/null || echo "unavailable")
fi
if [[ $SPARQL_STATUS == "unavailable" ]]; then
    echo -e "${YELLOW}⚠${NC} SPARQL endpoint not running (SPARQL demo will skip tests)"
else
    echo -e "${GREEN}✓${NC} SPARQL endpoint is available"
fi

echo ""

# Function to run a single demo
run_demo() {
    local demo_file=$1
    local demo_name=$2
    local demo_description=$3
    
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}Running: $demo_name${NC}"
    echo -e "${BLUE}File: $demo_file${NC}"
    echo -e "${BLUE}Description: $demo_description${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
    
    # Run the demo with timeout
    local start_time=$(date +%s)
    
    if timeout 300 node "demos/$demo_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo ""
        echo -e "${GREEN}✅ $demo_name completed successfully${NC} (${duration}s)"
        RESULTS+=("✅ $demo_name - SUCCESS (${duration}s)")
        ((SUCCESSFUL++))
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [ $exit_code -eq 124 ]; then
            echo ""
            echo -e "${RED}❌ $demo_name timed out${NC} (300s limit)"
            RESULTS+=("❌ $demo_name - TIMEOUT (300s)")
        else
            echo ""
            echo -e "${RED}❌ $demo_name failed${NC} (${duration}s)"
            RESULTS+=("❌ $demo_name - FAILED (${duration}s)")
        fi
        ((FAILED++))
    fi
    
    echo ""
    echo -e "${BLUE}Press Enter to continue to next demo, or Ctrl+C to stop...${NC}"
    read -r
}

# Run each demo
for i in "${!DEMOS[@]}"; do
    IFS=':' read -r demo_file demo_name demo_description <<< "${DEMOS[$i]}"
    
    echo -e "${BLUE}Demo $((i+1))/$TOTAL_DEMOS${NC}"
    run_demo "$demo_file" "$demo_name" "$demo_description"
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           DEMO SUMMARY                 ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo "Results:"
for result in "${RESULTS[@]}"; do
    echo -e "  $result"
done

echo ""
echo -e "${BLUE}Statistics:${NC}"
echo -e "  Total demos: $TOTAL_DEMOS"
echo -e "  ${GREEN}Successful: $SUCCESSFUL${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"

# Calculate success rate
SUCCESS_RATE=$((SUCCESSFUL * 100 / TOTAL_DEMOS))

echo -e "  Success rate: ${SUCCESS_RATE}%"

echo ""

# Overall assessment
if [ $SUCCESSFUL -eq $TOTAL_DEMOS ]; then
    echo -e "${GREEN}🎉 ALL DEMOS PASSED!${NC}"
    echo -e "${GREEN}Semem functionality is working as claimed.${NC}"
elif [ $SUCCESSFUL -gt $((TOTAL_DEMOS / 2)) ]; then
    echo -e "${YELLOW}✅ MOSTLY WORKING${NC}"
    echo -e "${YELLOW}Most of Semem's functionality is working correctly.${NC}"
    echo -e "${YELLOW}Some features may require additional setup or services.${NC}"
else
    echo -e "${RED}❌ SIGNIFICANT ISSUES${NC}"
    echo -e "${RED}Many demos failed. Check prerequisites and troubleshooting guide.${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review failed demos for specific issues"
echo "2. Check troubleshooting section in demos/README.md"
echo "3. Ensure all required services are running"
echo "4. Verify API keys and configuration"

# Clean up data directory prompt
echo ""
echo -e "${BLUE}Clean up demo data? (y/N):${NC}"
read -r cleanup
if [[ $cleanup =~ ^[Yy]$ ]]; then
    rm -rf demos/data/*
    echo -e "${GREEN}✓${NC} Demo data cleaned up"
fi

echo ""
echo -e "${BLUE}Demo run completed.${NC}"