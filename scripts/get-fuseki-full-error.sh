#!/bin/bash
# Get full Fuseki error output

echo "=== Getting Full Fuseki Error Output ==="
echo ""

# Stop the restart loop temporarily
echo "1. Stopping containers to break restart loop..."
docker compose down
echo ""

# Get recent logs before we start again
echo "2. Previous logs (if any):"
docker compose logs fuseki 2>&1 | tail -50
echo ""

# Start with detailed logging
echo "3. Starting Fuseki and capturing full output..."
docker compose up fuseki 2>&1 | head -100 &
DOCKER_PID=$!

# Wait a few seconds
sleep 10

# Kill the docker compose up
kill $DOCKER_PID 2>/dev/null

echo ""
echo "4. Check what sed is actually trying to do:"
docker compose logs fuseki 2>&1 | grep -B 20 "sed"
echo ""

echo "5. Full entrypoint execution:"
docker compose logs fuseki 2>&1
echo ""

echo "=== DONE ==="
