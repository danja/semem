#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start all servers using the new start-all.js script
echo "Starting all servers..."
node "$SCRIPT_DIR/src/servers/start-all.js" 2>&1 | tee -a "$SCRIPT_DIR/startup.log"

# Start the Semantic Memory Workbench server
echo "Starting Semantic Memory Workbench..."
cd "$SCRIPT_DIR/src/frontend/workbench"
PORT=8081 node server.cjs > "$SCRIPT_DIR/workbench.log" 2>&1 &
WORKBENCH_PID=$!
echo $WORKBENCH_PID > "$SCRIPT_DIR/workbench.pid"

echo "\nServers started successfully!"
echo "- API Server:      http://localhost:4100"
echo "- UI Server:       http://localhost:4120"
echo "- Redirect Server: http://localhost:4110 -> http://localhost:4120"
echo "- Workbench:       http://localhost:8081"
echo "\nUse 'npm stop' or './stop.sh' to stop all servers"