#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/server-pids.txt"

# Check if the PID file exists
if [ -f "$PID_FILE" ]; then
    echo "Stopping servers..."
    
    # Read PIDs from file
    read API_PID WORKBENCH_PID MCP_PID < "$PID_FILE"
    
    # Stop API server
    if [ -n "$API_PID" ] && ps -p $API_PID > /dev/null; then
        echo "Stopping API server (PID: $API_PID)..."
        kill $API_PID
    else
        echo "API server is not running"
    fi
    
    # Stop Workbench UI server
    if [ -n "$WORKBENCH_PID" ] && ps -p $WORKBENCH_PID > /dev/null; then
        echo "Stopping Workbench UI (PID: $WORKBENCH_PID)..."
        kill $WORKBENCH_PID
    else
        echo "Workbench UI is not running"
    fi
    
    # Stop MCP server
    if [ -n "$MCP_PID" ] && ps -p $MCP_PID > /dev/null; then
        echo "Stopping MCP server (PID: $MCP_PID)..."
        kill $MCP_PID
    else
        echo "MCP server is not running"
    fi
    
    # Clean up any remaining processes by port
    for port in 3000 4100 4101; do
        # Try to find PIDs using lsof
        PIDS=$(lsof -ti :$port)
        if [ -n "$PIDS" ]; then
            echo "Stopping process(es) on port $port (PIDs: $PIDS)..."
            # Try graceful shutdown first
            kill $PIDS 2>/dev/null || true
            # Wait a bit for graceful shutdown
            sleep 1
            # Force kill if still running
            if lsof -ti :$port >/dev/null; then
                echo "Force killing process(es) on port $port..."
                kill -9 $PIDS 2>/dev/null || true
            fi
        fi
        
        # Additional check using fuser if available
        if command -v fuser &> /dev/null; then
            fuser -k $port/tcp 2>/dev/null || true
        fi
    done
    
    # Remove PID file
    rm -f "$PID_FILE"
    echo "Servers stopped successfully"
else
    echo "No running servers found (server-pids.txt not found)"
    
    # Attempt to find and kill any running servers by port
    echo "Attempting to find and stop servers by port..."
    for port in 3000 4100 4101; do
        # Try to find PIDs using lsof
        PIDS=$(lsof -ti :$port)
        if [ -n "$PIDS" ]; then
            echo "Stopping process(es) on port $port (PIDs: $PIDS)..."
            # Try graceful shutdown first
            kill $PIDS 2>/dev/null || true
            # Wait a bit for graceful shutdown
            sleep 1
            # Force kill if still running
            if lsof -ti :$port >/dev/null; then
                echo "Force killing process(es) on port $port..."
                kill -9 $PIDS 2>/dev/null || true
            fi
        fi
        
        # Additional check using fuser if available
        if command -v fuser &> /dev/null; then
            fuser -k $port/tcp 2>/dev/null || true
        fi
    done
    
    # Additional cleanup for any remaining processes by name pattern
    echo "Performing additional cleanup by process name..."
    for pattern in "node.*src/servers/api-server.js" "node.*src/frontend/workbench" "node.*mcp/http-server.js" "node.*next" "node.*webpack"; do
        PIDS=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "Stopping process matching '$pattern' (PIDs: $PIDS)..."
            kill $PIDS 2>/dev/null || true
            sleep 0.5
            if pgrep -f "$pattern" >/dev/null; then
                kill -9 $PIDS 2>/dev/null || true
            fi
        fi
    done
    
    # Final check for any remaining node processes
    if pgrep -f "node" >/dev/null; then
        echo "Warning: Some Node.js processes are still running. Trying to stop them..."
        pkill -f "node" 2>/dev/null || true
        sleep 0.5
        pkill -9 -f "node" 2>/dev/null || true
    fi
fi