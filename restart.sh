#!/bin/bash

# Semem API server restart script
# Stops any running server and starts a new one
# Run with: ./restart-server.sh

echo "=== Semem API Server Restart ==="
echo "$(date)"
echo

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if there are any running server processes
echo -e "${YELLOW}Checking for running server processes...${NC}"
SERVER_PIDS=$(pgrep -f "node (api|search)-server.js")

if [ -n "$SERVER_PIDS" ]; then
    # There are running server processes
    echo -e "${YELLOW}Found running server processes with PIDs: $SERVER_PIDS${NC}"
    echo -e "${YELLOW}Stopping processes...${NC}"
    
    # Kill each process
    for PID in $SERVER_PIDS; do
        echo "Stopping process $PID..."
        kill $PID
        
        # Wait for process to terminate
        for i in {1..5}; do
            if ! ps -p $PID > /dev/null; then
                break
            fi
            echo "Waiting for process $PID to terminate... ($i/5)"
            sleep 1
        done
        
        # Force kill if still running
        if ps -p $PID > /dev/null; then
            echo -e "${RED}Process $PID still running. Force killing...${NC}"
            kill -9 $PID
            sleep 1
        fi
    done
    
    echo -e "${GREEN}All server processes stopped.${NC}"
else
    echo -e "${GREEN}No running server processes found.${NC}"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from example.env...${NC}"
    cp example.env .env
    echo -e "${GREEN}.env file created.${NC}"
fi

# Start server
echo
echo -e "${YELLOW}Starting Semem API server...${NC}"
node api-server.js 2>&1 | tee -a server.log &
SERVER_PID=$!

echo -e "${GREEN}Server started with PID: $SERVER_PID${NC}"
echo "Logs are being written to server.log"
echo
echo -e "Access the browser interface at ${GREEN}http://localhost:3000${NC}"
echo -e "API health endpoint: ${GREEN}http://localhost:3000/api/health${NC}"
echo 
echo -e "${YELLOW}Press Ctrl+C to stop the server or run this script again to restart.${NC}"

# Wait for server to initialize
sleep 3

# Check if server is still running
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}Server running successfully.${NC}"
    
    # Check API health
    echo "Checking API health..."
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
    
    if [ "$HEALTH_CHECK" == "200" ]; then
        echo -e "${GREEN}API health check passed: $HEALTH_CHECK${NC}"
    else
        echo -e "${RED}API health check failed: $HEALTH_CHECK${NC}"
        echo "Check server.log for errors"
    fi
else
    echo -e "${RED}Server failed to start. Check server.log for errors.${NC}"
fi

echo
echo "=== Restart complete ==="