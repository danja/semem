#!/bin/bash
# Stop script for Semantic Memory Workbench

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Semantic Memory Workbench${NC}"
echo "========================================"

# Configuration
MCP_PORT=${MCP_PORT:-3000}
WORKBENCH_PORT=${WORKBENCH_PORT:-8081}

# Function to stop processes on port
stop_port() {
    local port=$1
    local service=$2
    
    echo -e "${YELLOW}🔍 Checking for processes on port $port...${NC}"
    
    local pids=$(lsof -ti:$port 2>/dev/null || echo "")
    
    if [[ -n "$pids" ]]; then
        echo "   Found processes: $pids"
        echo "   Stopping $service..."
        
        # Try graceful shutdown first
        for pid in $pids; do
            kill -TERM $pid 2>/dev/null || true
        done
        
        # Wait a moment for graceful shutdown
        sleep 2
        
        # Force kill if still running
        local remaining=$(lsof -ti:$port 2>/dev/null || echo "")
        if [[ -n "$remaining" ]]; then
            echo "   Force killing remaining processes..."
            for pid in $remaining; do
                kill -KILL $pid 2>/dev/null || true
            done
        fi
        
        echo -e "${GREEN}✅ Stopped $service on port $port${NC}"
    else
        echo "   No processes found on port $port"
    fi
}

# Function to clean up PID file
cleanup_pids() {
    if [[ -f "workbench.pids" ]]; then
        echo -e "${YELLOW}📝 Reading PID file...${NC}"
        
        local pids=$(cat workbench.pids 2>/dev/null || echo "")
        
        if [[ -n "$pids" ]]; then
            echo "   Found PIDs: $pids"
            echo "   Stopping processes..."
            
            for pid in $pids; do
                if kill -0 $pid 2>/dev/null; then
                    kill -TERM $pid 2>/dev/null || true
                    echo "   Sent TERM signal to PID $pid"
                fi
            done
            
            sleep 2
            
            # Force kill if needed
            for pid in $pids; do
                if kill -0 $pid 2>/dev/null; then
                    kill -KILL $pid 2>/dev/null || true
                    echo "   Force killed PID $pid"
                fi
            done
        fi
        
        rm -f workbench.pids
        echo -e "${GREEN}✅ Cleaned up PID file${NC}"
    fi
}

# Function to clean up log files (optional)
cleanup_logs() {
    local clean_logs=$1
    
    if [[ "$clean_logs" == "--clean-logs" || "$clean_logs" == "-c" ]]; then
        echo -e "${YELLOW}🧹 Cleaning up log files...${NC}"
        
        rm -f mcp-server.log workbench-server.log
        echo -e "${GREEN}✅ Log files removed${NC}"
    else
        echo -e "${BLUE}💡 Log files preserved (use --clean-logs to remove)${NC}"
        echo "   MCP Server Log: ./mcp-server.log"
        echo "   Workbench Log: ./workbench-server.log"
    fi
}

# Function to verify shutdown
verify_shutdown() {
    echo -e "${BLUE}🔍 Verifying shutdown...${NC}"
    
    local mcp_check=$(lsof -ti:$MCP_PORT 2>/dev/null || echo "")
    local workbench_check=$(lsof -ti:$WORKBENCH_PORT 2>/dev/null || echo "")
    
    if [[ -z "$mcp_check" && -z "$workbench_check" ]]; then
        echo -e "${GREEN}✅ All services stopped successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Some services may still be running${NC}"
        
        if [[ -n "$mcp_check" ]]; then
            echo "   MCP server still running on port $MCP_PORT (PIDs: $mcp_check)"
        fi
        
        if [[ -n "$workbench_check" ]]; then
            echo "   Workbench server still running on port $WORKBENCH_PORT (PIDs: $workbench_check)"
        fi
        
        return 1
    fi
}

# Main execution
main() {
    # Stop by PID file first
    cleanup_pids
    
    echo
    
    # Stop by port
    stop_port $WORKBENCH_PORT "Workbench server"
    echo
    stop_port $MCP_PORT "MCP server"
    
    echo
    
    # Clean up logs if requested
    cleanup_logs "$1"
    
    echo
    
    # Verify everything is stopped
    if verify_shutdown; then
        echo
        echo -e "${GREEN}🎉 Semantic Memory Workbench stopped successfully${NC}"
    else
        echo
        echo -e "${YELLOW}⚠️  Manual cleanup may be required${NC}"
        echo "   Use 'ps aux | grep node' to find remaining processes"
        echo "   Use 'kill -9 <PID>' to force stop specific processes"
    fi
}

# Help text
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --clean-logs, -c    Remove log files after stopping"
    echo "  --help, -h          Show this help message"
    echo
    echo "Environment Variables:"
    echo "  MCP_PORT           Port for MCP server (default: 3000)"
    echo "  WORKBENCH_PORT     Port for workbench server (default: 8081)"
    echo
    exit 0
fi

# Run main function
main "$@"