#!/bin/bash
# Remote Fuseki Fix Script
# Run this on the remote server to fix the sed write error

set -e  # Exit on error

echo "=== Fuseki Remote Fix Procedure ==="
echo ""

# Step 1: Stop everything
echo "Step 1: Stopping all containers..."
docker compose down
echo "✓ Containers stopped"
echo ""

# Step 2: Check current file permissions
echo "Step 2: Current fuseki-base permissions:"
ls -la docker-data/fuseki-base/ | grep -E "shiro|assembler" || echo "Files don't exist yet"
echo ""

# Step 3: Remove old fuseki-base files to force clean init
echo "Step 3: Cleaning fuseki-base directory..."
read -p "Remove fuseki-base files for clean init? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf docker-data/fuseki-base/shiro.ini
    rm -rf docker-data/fuseki-base/configuration/assembler.ttl
    echo "✓ Config files removed (will be recreated with correct permissions)"
else
    echo "Skipping cleanup"
fi
echo ""

# Step 4: Verify docker-compose.yml has the fix
echo "Step 4: Verifying docker-compose.yml has chmod fix..."
if grep -q "chmod 664 /fuseki-base/shiro.ini" docker-compose.yml; then
    echo "✓ docker-compose.yml has chmod 664 fix"
else
    echo "✗ docker-compose.yml missing chmod fix!"
    echo "Please run: git pull origin main"
    exit 1
fi
echo ""

# Step 5: Start services
echo "Step 5: Starting services with init containers..."
docker compose up -d
echo ""

# Step 6: Wait for init to complete
echo "Step 6: Waiting for init containers to complete..."
sleep 5
docker compose logs fuseki-init | tail -10
echo ""

# Step 7: Check permissions after init
echo "Step 7: Checking file permissions after init..."
ls -la docker-data/fuseki-base/shiro.ini
ls -la docker-data/fuseki-base/configuration/assembler.ttl
echo ""

# Step 8: Check fuseki status
echo "Step 8: Checking Fuseki status..."
sleep 10
if docker compose ps fuseki | grep -q "healthy"; then
    echo "✓ Fuseki is healthy!"
else
    echo "⚠ Fuseki may still be starting or has issues"
    echo "Check logs with: docker compose logs fuseki"
fi
echo ""

echo "=== Fix Complete ==="
echo ""
echo "Run diagnostics with: bash scripts/remote-fuseki-diagnose.sh"
