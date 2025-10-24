# Remote Server Deployment Fix

## Issue
On the remote server, Fuseki was failing with:
```
semem-fuseki  | sed: write error
semem-fuseki exited with code 4
```

## Root Cause
The Fuseki Docker entrypoint script uses `sed -i` to substitute environment variables in configuration files (`shiro.ini` and `assembler.ttl`). However, these files had incorrect permissions (644 with group ownership as `root`), preventing the Fuseki process (running as UID 9008) from writing to them.

## Solution Applied
Updated `docker-compose.yml` to set proper permissions on Fuseki configuration files:
- Changed file permissions from `644` to `664` (rw-rw-r--)
- Ensures both owner (9008) and group (9008) have write access
- Allows Fuseki's entrypoint script to successfully modify configuration files

## Files Modified
1. **docker-compose.yml**: Added `chmod 664` for config files in fuseki-init
2. **config/config.json**: Fixed SPARQL endpoint (query → sparql)
3. **src/servers/server-manager.js**: Enhanced error handling
4. **src/servers/api-server.js**: Added global error handlers
5. **src/frontend/workbench/public/index.html**: Moved Show Verbs button
6. **src/frontend/workbench/public/styles/workbench.css**: Updated button styles

## Deployment Steps for Remote Server

### 1. Pull Latest Changes
```bash
cd /path/to/semem
git pull origin main
```

### 2. Stop Existing Containers
```bash
docker compose down
```

### 3. Clean Up Old Volumes (if needed)
```bash
# Only if you want to start fresh
rm -rf docker-data/fuseki-base/*
rm -rf docker-data/fuseki/*
```

### 4. Rebuild Images
```bash
docker compose build --no-cache
```

### 5. Start Services
```bash
docker compose up -d
```

### 6. Verify Deployment
```bash
# Check all containers are running
docker compose ps

# Should show:
# semem-app      healthy
# semem-fuseki   healthy

# Check logs for errors
docker compose logs fuseki | grep -iE "sed|error|exit"
# Should show NO output (no errors)

# Test Fuseki health
curl http://localhost:4050/$/ping
# Should return timestamp

# Test Semem API
curl http://localhost:4100/health
# Should return {"status":"ok"}
```

### 7. Check Permissions
```bash
# Verify config file permissions in container
docker compose exec fuseki ls -la /fuseki-base/shiro.ini
# Should show: -rw-rw-r-- 1 9008 9008

docker compose exec fuseki ls -la /fuseki-base/configuration/assembler.ttl
# Should show: -rw-rw-r-- 1 9008 9008
```

## Verification Checklist
- [ ] All containers show `healthy` status
- [ ] No "sed: write error" in fuseki logs
- [ ] Fuseki ping endpoint returns timestamp
- [ ] API health endpoint returns success
- [ ] Config files have `664` permissions with `9008:9008` ownership
- [ ] Workbench UI accessible at https://semem.tensegrity.it/
- [ ] MCP server responding at https://mcp.tensegrity.it/

## Troubleshooting

### If Fuseki Still Fails
```bash
# Check fuseki logs
docker compose logs fuseki --tail=100

# Check init container logs
docker compose logs fuseki-init

# Manually verify permissions
docker compose exec fuseki ls -la /fuseki-base/
```

### If Semem App Crashes
```bash
# Check for actual error with enhanced logging
docker compose logs semem --tail=200

# Look for error messages between:
# "GROQ_API_KEY loaded: YES"
# and
# "Process exited with code 1"

# Should now see detailed error output like:
# "💥 UNCAUGHT EXCEPTION during api-server.js initialization:"
# or
# "💥 UNHANDLED REJECTION during api-server.js initialization:"
```

### Common Issues

**Issue 1: Permission Denied**
```bash
# Fix ownership
cd /path/to/semem
sudo chown -R $USER:$USER docker-data/
```

**Issue 2: Port Already in Use**
```bash
# Check what's using the ports
sudo lsof -i :4100
sudo lsof -i :4101
sudo lsof -i :4102
sudo lsof -i :4050
```

**Issue 3: Network Issues**
```bash
# Recreate network
docker compose down
docker network prune
docker compose up -d
```

## Rollback Plan
If deployment fails:
```bash
# Stop new version
docker compose down

# Revert to previous commit
git log --oneline -5  # Find previous commit hash
git checkout <previous-commit-hash>

# Rebuild and restart
docker compose build
docker compose up -d
```

## Expected Behavior After Fix

### Startup Sequence
1. `fuseki-init` runs → Sets permissions → Exits (success)
2. `semem-init` runs → Sets permissions → Exits (success)
3. `fuseki` starts → Modifies config files with sed → Runs successfully
4. `semem` starts → All 3 servers (API, Workbench, MCP) start → Healthy

### Logs Should Show
```
fuseki-init-1  | Permissions fixed for Fuseki directories
semem-init-1   | Permissions fixed for Semem directories
semem-fuseki   | Starting Fuseki...
semem-fuseki   | INFO  Server :: Started...
semem-app      | --- All servers started successfully! ---
semem-app      | - API Server:      http://localhost:4100
semem-app      | - Workbench UI:    http://localhost:4102
semem-app      | - MCP Server:      http://localhost:4101
```

## Testing After Deployment

```bash
# 1. Test Fuseki SPARQL endpoint
curl -X POST http://localhost:4050/semem/sparql \
  -H "Content-Type: application/sparql-query" \
  -d "ASK WHERE { ?s ?p ?o }"

# 2. Test MCP tell endpoint
curl -X POST http://localhost:4101/tell \
  -H "Content-Type: application/json" \
  -d '{"content": "Test deployment successful"}'

# 3. Test MCP ask endpoint
curl -X POST http://localhost:4101/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is semem?"}'

# 4. Test Workbench UI
curl -I https://semem.tensegrity.it/
# Should return 200 OK
```

## Success Criteria
✅ No "sed: write error" in logs
✅ All containers healthy within 60 seconds
✅ All health checks passing
✅ Workbench UI loads correctly
✅ Can successfully perform tell/ask operations
✅ No repeated restart loops

## Support
If issues persist after following this guide:
1. Collect full logs: `docker compose logs > deployment-logs.txt`
2. Check container environment: `docker compose exec semem env > container-env.txt`
3. Verify disk space: `df -h`
4. Check system resources: `docker stats --no-stream`
5. Review for any custom modifications to config files

---
Last Updated: 2025-10-24
Fix Version: Post-deployment diagnostic enhancements
