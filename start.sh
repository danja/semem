#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start the API server
echo "Starting API server..."
node "$SCRIPT_DIR/servers/api-server.js" > "$SCRIPT_DIR/api-server.log" 2>&1 &
API_PID=$!
echo "API server started with PID: $API_PID"

# Start the UI server
echo "Starting UI server..."
node "$SCRIPT_DIR/servers/ui-server.js" > "$SCRIPT_DIR/ui-server.log" 2>&1 &
UI_PID=$!
echo "UI server started with PID: $UI_PID"

# Start the redirect server
echo "Starting redirect server..."
node "$SCRIPT_DIR/servers/redirect-server.js" > "$SCRIPT_DIR/redirect-server.log" 2>&1 &
REDIRECT_PID=$!
echo "Redirect server started with PID: $REDIRECT_PID"

# Save PIDs to file for later cleanup
echo "$API_PID $UI_PID $REDIRECT_PID" > server-pids.txt

echo "Servers started successfully."
echo "API server logs: api-server.log"
echo "UI server logs: ui-server.log"
echo "Redirect server logs: redirect-server.log"
echo "Access UI at: http://localhost:3000 or http://localhost:4100"
echo "Use './stop.sh' to stop all servers"