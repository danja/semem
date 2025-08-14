#!/bin/bash
# Startup script for Semantic Memory Workbench

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧠 Starting Semantic Memory Workbench${NC}"
echo "========================================"

# Check if we're in the correct directory
if [[ ! -f "mcp/http-server.js" ]]; then
    echo -e "${RED}❌ Error: This script must be run from the semem project root${NC}"
    echo "   Expected to find: mcp/http-server.js"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Configuration
MCP_PORT=${MCP_PORT:-3000}
WORKBENCH_PORT=${WORKBENCH_PORT:-8081}
MCP_SERVER_URL="http://localhost:${MCP_PORT}"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   MCP Server Port: $MCP_PORT"
echo "   Workbench Port: $WORKBENCH_PORT"
echo "   MCP Server URL: $MCP_SERVER_URL"
echo

# Function to check if port is available
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $port is already in use (may be from previous $service instance)${NC}"
        echo "   Attempting to free port..."
        fuser -k ${port}/tcp 2>/dev/null || true
        sleep 2
    fi
}

# Function to start MCP server
start_mcp_server() {
    echo -e "${BLUE}🚀 Starting MCP HTTP Server...${NC}"
    check_port $MCP_PORT "MCP server"
    
    # Start MCP server in background
    MCP_PORT=$MCP_PORT node mcp/http-server.js > mcp-server.log 2>&1 &
    MCP_PID=$!
    
    # Wait for MCP server to start
    echo "   Waiting for MCP server to initialize..."
    local retries=0
    local max_retries=10
    
    while ! curl -s http://localhost:$MCP_PORT/health >/dev/null 2>&1; do
        if [[ $retries -ge $max_retries ]]; then
            echo -e "${RED}❌ MCP server failed to start within 10 seconds${NC}"
            kill $MCP_PID 2>/dev/null || true
            exit 1
        fi
        
        sleep 1
        retries=$((retries + 1))
    done
    
    echo -e "${GREEN}✅ MCP server started successfully (PID: $MCP_PID)${NC}"
    echo "   Health check: http://localhost:$MCP_PORT/health"
    echo "   Inspector: http://localhost:$MCP_PORT/inspector"
}

# Function to start workbench server
start_workbench_server() {
    echo -e "${BLUE}🚀 Starting Workbench Server...${NC}"
    check_port $WORKBENCH_PORT "workbench server"
    
    # Start workbench server in background
    cd src/frontend/workbench
    PORT=$WORKBENCH_PORT MCP_SERVER=$MCP_SERVER_URL node server.js > ../../../workbench-server.log 2>&1 &
    WORKBENCH_PID=$!
    cd - >/dev/null
    
    # Wait for workbench server to start
    echo "   Waiting for workbench server to initialize..."
    local retries=0
    local max_retries=5
    
    while ! curl -s http://localhost:$WORKBENCH_PORT/health >/dev/null 2>&1; do
        if [[ $retries -ge $max_retries ]]; then
            echo -e "${RED}❌ Workbench server failed to start within 5 seconds${NC}"
            kill $WORKBENCH_PID 2>/dev/null || true
            exit 1
        fi
        
        sleep 1
        retries=$((retries + 1))
    done
    
    echo -e "${GREEN}✅ Workbench server started successfully (PID: $WORKBENCH_PID)${NC}"
    echo "   Health check: http://localhost:$WORKBENCH_PORT/health"
}

# Function to test API connectivity
test_api_connectivity() {
    echo -e "${BLUE}🔍 Testing API connectivity...${NC}"
    
    # Test workbench health
    if curl -s http://localhost:$WORKBENCH_PORT/health >/dev/null; then
        echo -e "${GREEN}✅ Workbench server responding${NC}"
    else
        echo -e "${RED}❌ Workbench server not responding${NC}"
        return 1
    fi
    
    # Test MCP proxy
    if curl -s http://localhost:$WORKBENCH_PORT/api/health >/dev/null; then
        echo -e "${GREEN}✅ MCP API proxy working${NC}"
    else
        echo -e "${RED}❌ MCP API proxy not working${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All services are healthy${NC}"
}

# Function to display final status
show_final_status() {
    echo
    echo -e "${GREEN}🎉 Semantic Memory Workbench is ready!${NC}"
    echo "========================================"
    echo -e "${YELLOW}📍 Access URLs:${NC}"
    echo "   🧠 Workbench UI:    http://localhost:$WORKBENCH_PORT"
    echo "   🔍 MCP Inspector:   http://localhost:$MCP_PORT/inspector"
    echo "   ❤️  Health Checks:"
    echo "      Workbench:       http://localhost:$WORKBENCH_PORT/health"
    echo "      MCP Server:      http://localhost:$MCP_PORT/health"
    echo
    echo -e "${YELLOW}📊 Process Information:${NC}"
    echo "   MCP Server PID:     $MCP_PID"
    echo "   Workbench PID:      $WORKBENCH_PID"
    echo
    echo -e "${YELLOW}📝 Log Files:${NC}"
    echo "   MCP Server:         ./mcp-server.log"
    echo "   Workbench:          ./workbench-server.log"
    echo
    echo -e "${YELLOW}💡 Usage:${NC}"
    echo "   - Open http://localhost:$WORKBENCH_PORT in your browser"
    echo "   - Use the 7 Simple Verbs interface: Tell, Ask, Navigate, Augment, Inspect"
    echo "   - Monitor logs with: tail -f mcp-server.log workbench-server.log"
    echo "   - Stop services with: kill $MCP_PID $WORKBENCH_PID"
    echo
}

# Function to handle cleanup on exit
cleanup() {
    echo
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    
    if [[ -n "$WORKBENCH_PID" ]]; then
        kill $WORKBENCH_PID 2>/dev/null || true
        echo "   Stopped workbench server"
    fi
    
    if [[ -n "$MCP_PID" ]]; then
        kill $MCP_PID 2>/dev/null || true
        echo "   Stopped MCP server"
    fi
    
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution flow
main() {
    start_mcp_server
    echo
    start_workbench_server
    echo
    
    if test_api_connectivity; then
        show_final_status
        
        # Keep script running and handle signals
        echo -e "${BLUE}🔄 Services running... Press Ctrl+C to stop${NC}"
        
        # Write PID file for external process management
        echo "$MCP_PID $WORKBENCH_PID" > workbench.pids
        
        # Wait for signals
        wait
    else
        echo -e "${RED}❌ API connectivity test failed${NC}"
        cleanup
        exit 1
    fi
}

# Run main function
main "$@"