#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start all servers using the new start-all.js script
echo "Starting servers..."
node "$SCRIPT_DIR/src/servers/start-all.js" 2>&1 | tee -a "$SCRIPT_DIR/startup.log"

# Get PIDs of running servers
API_PID=$(lsof -ti :4100)
WORKBENCH_PID=$(lsof -ti :3000)
MCP_PID=$(lsof -ti :4101)

# Save PIDs to file
echo "$API_PID $WORKBENCH_PID $MCP_PID" > "$SCRIPT_DIR/server-pids.txt"

echo "\nServers started successfully!"
echo "- API Server:         http://localhost:4100"
echo "- Workbench UI:       http://localhost:3000"
echo "- MCP Server:         http://localhost:4101"
echo "\nUse './stop.sh' to stop all servers"