#!/bin/bash
# Docker diagnostic script for Semem deployment issues

echo "=== Docker Semem Diagnostics ==="
echo ""

echo "1. Container Status:"
docker compose ps
echo ""

echo "2. Environment Variables in Container:"
docker compose exec semem env | grep -E "SPARQL|MISTRAL|CLAUDE|GROQ|NODE_ENV" | sort
echo ""

echo "3. Config File Check:"
docker compose exec semem cat /app/config/config.json | grep -A 5 "storage"
echo ""

echo "4. SPARQL Endpoint Connectivity from Container:"
echo "   Testing query endpoint..."
docker compose exec semem curl -s -o /dev/null -w "HTTP %{http_code}\n" http://fuseki:3030/semem/sparql
echo ""

echo "5. Recent Semem Logs (last 50 lines):"
docker compose logs --tail=50 semem
echo ""

echo "6. Fuseki Health:"
docker compose exec fuseki wget -q -O- http://localhost:3030/$/ping
echo ""

echo "=== Diagnostic Complete ==="
