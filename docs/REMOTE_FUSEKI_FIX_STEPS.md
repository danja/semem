# Remote Server: Fuseki sed Write Error Fix

## Problem
```
fuseki-init-1  | Permissions fixed for Fuseki directories
semem-fuseki   | sed: write error
semem-fuseki exited with code 4
```

## Root Cause
Fuseki's entrypoint script cannot modify configuration files because they lack write permissions for the fuseki user (UID 9008).

## Fix Procedure (Manual Steps)

### On the Remote Server:

#### 1. Navigate to Project Directory
```bash
cd /path/to/semem
```

#### 2. Pull Latest Changes
```bash
git pull origin main
```

#### 3. Verify the Fix is in docker-compose.yml
```bash
grep "chmod 664" docker-compose.yml
```

Expected output:
```
chmod 664 /fuseki-base/shiro.ini /fuseki-base/configuration/assembler.ttl &&
```

If you don't see this, the fix isn't in your code. Run `git pull origin main` again.

#### 4. Stop All Containers
```bash
docker compose down
```

#### 5. Remove Old Config Files (IMPORTANT!)
The old files have wrong permissions and must be deleted:

```bash
# Check current permissions
ls -la docker-data/fuseki-base/shiro.ini
# Probably shows: -rwxr-xr-x 1 9008 root

# Remove the files (they will be recreated with correct permissions)
rm -f docker-data/fuseki-base/shiro.ini
rm -f docker-data/fuseki-base/configuration/assembler.ttl

# Verify they're gone
ls -la docker-data/fuseki-base/ | grep -E "shiro|assembler"
# Should show nothing
```

#### 6. Start Services
```bash
docker compose up -d
```

#### 7. Wait and Monitor Init
```bash
# Wait for init containers to complete (10-15 seconds)
sleep 15

# Check init logs
docker compose logs fuseki-init

# Should show:
# "Permissions fixed for Fuseki directories"
```

#### 8. Verify New Permissions
```bash
ls -la docker-data/fuseki-base/shiro.ini
```

Expected output:
```
-rw-rw-r-- 1 9008 9008 959 [date] shiro.ini
```

Key points:
- ✓ Permissions: `664` (rw-rw-r--)
- ✓ Owner: `9008:9008` (not `9008:root`)

#### 9. Check Fuseki Status
```bash
docker compose ps
```

Expected output:
```
NAME           STATUS
semem-fuseki   Up [time] (healthy)
semem-app      Up [time] (healthy)
```

#### 10. Verify No Errors
```bash
docker compose logs fuseki | grep -i "error\|sed"
```

Should show NO output (no sed errors).

#### 11. Test Fuseki Endpoint
```bash
curl http://localhost:4050/$/ping
```

Should return a timestamp like: `2025-10-24T12:34:56.789+00:00`

## Alternative: Using the Fix Script

```bash
# Make script executable
chmod +x scripts/remote-fuseki-fix.sh

# Run the fix script
bash scripts/remote-fuseki-fix.sh
```

## Troubleshooting

### If Still Getting sed Error

**Check 1: Verify docker-compose.yml was updated**
```bash
cat docker-compose.yml | grep -A 10 "fuseki-init"
```

Should include:
```yaml
chmod 664 /fuseki-base/shiro.ini /fuseki-base/configuration/assembler.ttl &&
```

**Check 2: Verify old files were deleted**
```bash
ls -la docker-data/fuseki-base/
```

If `shiro.ini` still shows `9008:root`, delete it:
```bash
docker compose down
rm -f docker-data/fuseki-base/shiro.ini
rm -f docker-data/fuseki-base/configuration/assembler.ttl
docker compose up -d
```

**Check 3: Check filesystem permissions**
```bash
# Check if directory is writable
ls -la docker-data/
```

The `fuseki-base` directory should be writable by your user.

**Check 4: SELinux/AppArmor Issues (if on Linux)**
```bash
# Check if SELinux is enforcing
getenforce

# If it returns "Enforcing", try:
sudo setenforce 0  # Temporary - for testing only
docker compose restart fuseki
```

### If Container Keeps Restarting

Check full logs:
```bash
docker compose logs fuseki --tail=100
```

Look for the actual error message after "sed: write error".

### Nuclear Option: Complete Reset

If nothing works, completely reset:
```bash
# Stop everything
docker compose down

# Remove all fuseki data
rm -rf docker-data/fuseki-base/*
rm -rf docker-data/fuseki/*

# Pull latest code
git pull origin main

# Rebuild everything
docker compose build --no-cache

# Start fresh
docker compose up -d
```

## Verification Checklist

After applying the fix:
- [ ] `git pull origin main` completed successfully
- [ ] `docker-compose.yml` contains `chmod 664` line
- [ ] Old config files deleted before restart
- [ ] fuseki-init logs show "Permissions fixed"
- [ ] `shiro.ini` has `664` permissions with `9008:9008` ownership
- [ ] No "sed: write error" in fuseki logs
- [ ] `docker compose ps` shows fuseki as "healthy"
- [ ] Fuseki ping endpoint returns timestamp
- [ ] Semem app is also healthy and accessible

## Quick Diagnostic

Run this one-liner to see current status:
```bash
echo "=== Docker Status ===" && \
docker compose ps && \
echo -e "\n=== File Permissions ===" && \
ls -la docker-data/fuseki-base/shiro.ini 2>/dev/null || echo "shiro.ini not found" && \
echo -e "\n=== Recent Errors ===" && \
docker compose logs fuseki 2>&1 | grep -i "error\|sed" | tail -10 || echo "No errors found"
```

## Success Indicators

When fixed correctly, you'll see:
1. No "sed: write error" in logs
2. Fuseki shows as "(healthy)" in `docker compose ps`
3. `shiro.ini` has `9008:9008` ownership
4. Fuseki responds to queries normally
5. Semem app connects to Fuseki successfully

---
Last Updated: 2025-10-24
