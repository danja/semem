#!/bin/bash

# Start the API server
echo "Starting API server..."
node api-server.js > api-server.log 2>&1 &
API_PID=$!
echo "API server started with PID: $API_PID"

# Start the UI server
echo "Starting UI server..."
node ui-server.js > ui-server.log 2>&1 &
UI_PID=$!
echo "UI server started with PID: $UI_PID"

# Start the redirect server
echo "Starting redirect server..."
node redirect-server.js > redirect-server.log 2>&1 &
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