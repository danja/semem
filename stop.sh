#!/bin/bash

# Check if the PID file exists
if [ -f "server-pids.txt" ]; then
    echo "Stopping servers..."
    
    # Read PIDs from file
    read API_PID UI_PID < server-pids.txt
    
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
    
    # Remove PID file
    rm server-pids.txt
    echo "Servers stopped successfully"
else
    echo "No running servers found (server-pids.txt not found)"
    
    # Attempt to find and kill any running servers by name
    echo "Attempting to find and stop servers by process name..."
    pkill -f "node api-server.js" && echo "API server stopped" || echo "No API server found"
    pkill -f "node ui-server.js" && echo "UI server stopped" || echo "No UI server found"
fi