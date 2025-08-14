#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read port configuration from config.json
CONFIG_FILE="$SCRIPT_DIR/config/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found at $CONFIG_FILE"
    exit 1
fi

# Extract port numbers from config.json
API_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.api")
WORKBENCH_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.workbench")
MCP_PORT=$(node -pe "JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf8')).servers.mcp")

echo "Starting servers with configured ports..."
echo "- API Server port: $API_PORT"
echo "- Workbench UI port: $WORKBENCH_PORT" 
echo "- MCP Server port: $MCP_PORT"

# Start all servers using the new start-all.js script
node "$SCRIPT_DIR/src/servers/start-all.js" 2>&1 | tee -a "$SCRIPT_DIR/startup.log" &
START_ALL_PID=$!

# Wait a moment for servers to start
sleep 3

# Get PIDs of running servers on configured ports
API_PID=$(lsof -ti :$API_PORT 2>/dev/null || echo "")
WORKBENCH_PID=$(lsof -ti :$WORKBENCH_PORT 2>/dev/null || echo "")
MCP_PID=$(lsof -ti :$MCP_PORT 2>/dev/null || echo "")

# Save PIDs to file including the start-all.js PID
echo "$START_ALL_PID $API_PID $WORKBENCH_PID $MCP_PID" > "$SCRIPT_DIR/server-pids.txt"

echo ""
echo "Servers started successfully!"
echo "- API Server:         http://localhost:$API_PORT"
echo "- Workbench UI:       http://localhost:$WORKBENCH_PORT"
echo "- MCP Server:         http://localhost:$MCP_PORT"
echo ""
echo "Use './stop.sh' to stop all servers"