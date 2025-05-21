#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start all servers using the new start-all.js script
echo "Starting all servers..."
node "$SCRIPT_DIR/servers/start-all.js" 2>&1 | tee -a "$SCRIPT_DIR/startup.log"

echo "\nServers started successfully!"
echo "- API Server:      http://localhost:4100"
echo "- UI Server:       http://localhost:4120"
echo "- Redirect Server: http://localhost:4110 -> http://localhost:4120"
echo "\nUse 'npm stop' or './stop.sh' to stop all servers"