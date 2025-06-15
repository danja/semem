#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/server-pids.txt"

# Check if the PID file exists
if [ -f "$PID_FILE" ]; then
    echo "Stopping servers..."
    
    # Read PIDs from file
    read API_PID UI_PID < "$PID_FILE"
    
    # Stop API server
    if ps -p $API_PID > /dev/null; then
        echo "Stopping API server (PID: $API_PID)..."
        kill $API_PID
    else
        echo "API server (PID: $API_PID) is not running"
    fi
    
    # Stop UI server
    if ps -p $UI_PID > /dev/null; then
        echo "Stopping UI server (PID: $UI_PID)..."
        kill $UI_PID
    else
        echo "UI server (PID: $UI_PID) is not running"
    fi
    
    # Stop any MCP server running on port 4100
    echo "Stopping MCP server on port 4100..."
    lsof -ti :4100 | xargs -r kill -9 2>/dev/null || echo "No MCP server found on port 4100"
    
    # Remove PID file
    rm -f "$PID_FILE"
    echo "Servers stopped successfully"
else
    echo "No running servers found (server-pids.txt not found)"
    
    # Attempt to find and kill any running servers by name
    echo "Attempting to find and stop servers by process name..."
    pkill -f "src/servers/api-server.js" && echo "API server stopped" || echo "No API server found"
    pkill -f "src/servers/ui-server.js" && echo "UI server stopped" || echo "No UI server found"
fi