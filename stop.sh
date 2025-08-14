#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/server-pids.txt"

# Read port configuration from config.json
CONFIG_FILE="$SCRIPT_DIR/config/config.json"
if [ -f "$CONFIG_FILE" ]; then
    API_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.api" 2>/dev/null || echo "4100")
    WORKBENCH_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.workbench" 2>/dev/null || echo "3000") 
    MCP_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.mcp" 2>/dev/null || echo "4101")
else
    # Fallback to default ports
    API_PORT=4100
    WORKBENCH_PORT=3000
    MCP_PORT=4101
fi

echo "Stopping servers on configured ports..."
echo "- API Server port: $API_PORT"
echo "- Workbench UI port: $WORKBENCH_PORT"
echo "- MCP Server port: $MCP_PORT"

# Function to gracefully stop a process
stop_process() {
    local pid=$1
    local name=$2
    local timeout=5
    
    if [ -n "$pid" ] && ps -p $pid > /dev/null 2>&1; then
        echo "Stopping $name (PID: $pid)..."
        
        # Try graceful shutdown first
        kill -TERM $pid 2>/dev/null || true
        
        # Wait for graceful shutdown
        local count=0
        while [ $count -lt $timeout ] && ps -p $pid > /dev/null 2>&1; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            echo "Force killing $name (PID: $pid)..."
            kill -KILL $pid 2>/dev/null || true
        fi
        
        return 0
    fi
    return 1
}

# Function to stop processes on a specific port
stop_port() {
    local port=$1
    local service_name=$2
    
    local pids=$(lsof -ti :$port 2>/dev/null || echo "")
    if [ -n "$pids" ]; then
        echo "Found process(es) on port $port: $pids"
        for pid in $pids; do
            # Get process command to verify it's one of our services
            local cmd=$(ps -p $pid -o comm= 2>/dev/null || echo "")
            local args=$(ps -p $pid -o args= 2>/dev/null || echo "")
            
            # Only kill Node.js processes that appear to be our services
            if echo "$cmd $args" | grep -q "node"; then
                if echo "$args" | grep -E "(start-all|api-server|workbench|mcp)" > /dev/null; then
                    echo "Stopping $service_name process (PID: $pid): $args"
                    stop_process $pid "$service_name"
                else
                    echo "Skipping non-semem Node.js process (PID: $pid): $args"
                fi
            else
                echo "Skipping non-Node.js process on port $port (PID: $pid): $cmd"
            fi
        done
    else
        echo "No processes found on port $port"
    fi
}

# Check if the PID file exists and try to stop using recorded PIDs first
if [ -f "$PID_FILE" ]; then
    echo "Found PID file. Attempting to stop recorded processes..."
    
    # Read PIDs from file (now includes start-all.js PID as first entry)
    read START_ALL_PID API_PID WORKBENCH_PID MCP_PID < "$PID_FILE"
    
    # Stop the main start-all.js process first (this should trigger ServerManager cleanup)
    if stop_process "$START_ALL_PID" "start-all.js"; then
        echo "Stopped main process. Waiting for graceful shutdown..."
        sleep 2
    fi
    
    # Stop individual server processes if they're still running
    stop_process "$API_PID" "API server"
    stop_process "$WORKBENCH_PID" "Workbench UI" 
    stop_process "$MCP_PID" "MCP server"
    
    # Remove PID file
    rm -f "$PID_FILE"
else
    echo "No PID file found. Searching for processes by port..."
fi

# Clean up any remaining processes on the configured ports
echo ""
echo "Checking for remaining processes on configured ports..."
stop_port $API_PORT "API server"
stop_port $WORKBENCH_PORT "Workbench UI"
stop_port $MCP_PORT "MCP server"

# Final verification
echo ""
echo "Verifying shutdown..."
api_check=$(lsof -ti :$API_PORT 2>/dev/null || echo "")
workbench_check=$(lsof -ti :$WORKBENCH_PORT 2>/dev/null || echo "")
mcp_check=$(lsof -ti :$MCP_PORT 2>/dev/null || echo "")

if [ -z "$api_check" ] && [ -z "$workbench_check" ] && [ -z "$mcp_check" ]; then
    echo "✅ All servers stopped successfully"
else
    echo "⚠️  Some processes may still be running:"
    [ -n "$api_check" ] && echo "   API server on port $API_PORT: $api_check"
    [ -n "$workbench_check" ] && echo "   Workbench UI on port $WORKBENCH_PORT: $workbench_check" 
    [ -n "$mcp_check" ] && echo "   MCP server on port $MCP_PORT: $mcp_check"
    echo "   Use 'ps aux | grep node' to inspect remaining processes manually"
fi