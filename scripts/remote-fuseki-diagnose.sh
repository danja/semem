#!/bin/bash
# Remote Fuseki Diagnostic Script

echo "=== Fuseki Remote Diagnostic ==="
echo ""

echo "1. Check docker-compose.yml for chmod fix:"
grep -A 2 "chmod 664" docker-compose.yml
echo ""

echo "2. Check fuseki-init logs:"
docker compose logs fuseki-init
echo ""

echo "3. Check fuseki logs for sed errors:"
docker compose logs fuseki 2>&1 | grep -iE "sed|write error" | tail -20
echo ""

echo "4. Check file permissions in fuseki-base:"
ls -la docker-data/fuseki-base/ | grep -E "shiro|assembler"
echo ""

echo "5. Check permissions inside running fuseki container:"
docker compose exec fuseki ls -la /fuseki-base/shiro.ini 2>/dev/null || echo "Container not running"
docker compose exec fuseki ls -la /fuseki-base/configuration/assembler.ttl 2>/dev/null || echo "Container not running"
echo ""

echo "6. Check fuseki user ID inside container:"
docker compose exec fuseki id 2>/dev/null || echo "Container not running"
echo ""

echo "7. Test file writability:"
docker compose exec fuseki sh -c 'echo "test" > /tmp/test.txt && rm /tmp/test.txt && echo "✓ Can write to /tmp"' 2>/dev/null || echo "✗ Cannot write"
docker compose exec fuseki sh -c 'echo "test" >> /fuseki-base/shiro.ini.test && rm /fuseki-base/shiro.ini.test && echo "✓ Can write to /fuseki-base"' 2>/dev/null || echo "✗ Cannot write to /fuseki-base"
echo ""

echo "=== Diagnostic Complete ==="
