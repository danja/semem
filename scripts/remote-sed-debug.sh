#!/bin/bash
# Remote Fuseki sed Write Error - Deep Diagnostic

echo "=== FUSEKI SED WRITE ERROR DIAGNOSTIC ==="
echo ""

echo "1. Check if old files still exist with wrong permissions:"
ls -la docker-data/fuseki-base/shiro.ini 2>/dev/null || echo "shiro.ini does not exist"
ls -la docker-data/fuseki-base/configuration/assembler.ttl 2>/dev/null || echo "assembler.ttl does not exist"
echo ""

echo "2. Check docker-compose.yml has the fix:"
if grep -q "chmod 664 /fuseki-base/shiro.ini" docker-compose.yml; then
    echo "✓ docker-compose.yml has chmod 664 fix"
else
    echo "✗ MISSING chmod 664 in docker-compose.yml!"
    echo "Run: git pull origin main"
fi
echo ""

echo "3. Check Fuseki container user:"
docker compose exec fuseki id 2>/dev/null || echo "Fuseki not running"
echo ""

echo "4. Check file permissions inside container:"
docker compose exec fuseki ls -la /fuseki-base/shiro.ini 2>/dev/null || echo "File not found"
echo ""

echo "5. Test if Fuseki can write to the directory:"
docker compose exec fuseki sh -c 'touch /fuseki-base/test-write-check && rm /fuseki-base/test-write-check && echo "✓ Can write to directory"' 2>&1 || echo "✗ Cannot write to directory"
echo ""

echo "6. Test if sed works on shiro.ini:"
docker compose exec fuseki sh -c 'sed -i "s/admin=test/admin=test/" /fuseki-base/shiro.ini && echo "✓ sed works"' 2>&1 || echo "✗ sed fails"
echo ""

echo "7. Check for filesystem issues (NFS, read-only, etc):"
docker compose exec fuseki mount | grep fuseki-base || echo "No special mount"
echo ""

echo "8. Check for SELinux issues:"
if command -v getenforce &> /dev/null; then
    echo "SELinux status: $(getenforce)"
else
    echo "SELinux not present"
fi
echo ""

echo "9. Get FULL Fuseki error output:"
docker compose logs fuseki 2>&1 | grep -A 10 -B 10 "sed\|write error" | tail -30
echo ""

echo "10. Check if using cached old image:"
docker images | grep fuseki
echo ""

echo "=== DIAGNOSTIC COMPLETE ==="
echo ""
echo "RECOMMENDED FIXES:"
echo ""
echo "If shiro.ini has wrong owner (9008:root instead of 9008:9008):"
echo "  docker compose down"
echo "  rm -f docker-data/fuseki-base/shiro.ini"
echo "  rm -f docker-data/fuseki-base/configuration/assembler.ttl"
echo "  docker compose up -d"
echo ""
echo "If docker-compose.yml missing chmod fix:"
echo "  git pull origin main"
echo "  docker compose down"
echo "  docker compose up -d"
echo ""
echo "If filesystem is NFS or special mount:"
echo "  Check NFS export options (need rw, no_root_squash)"
echo ""
echo "If SELinux is Enforcing:"
echo "  sudo setenforce 0  # Temporary test"
echo "  docker compose restart fuseki"
echo ""
