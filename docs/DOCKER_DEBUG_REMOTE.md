# Docker Remote Debugging Guide

## Issue: Silent Process Exit with Code 1

When the semem container loops with no error output between:
```
semem-app  | 🔑 GROQ_API_KEY loaded: YES
semem-app  | [timestamp] [API Server] Process exited with code 1 and signal null
```

## Root Cause

Unhandled errors during initialization were not being logged properly, causing silent failures.

## Fixes Applied

### 1. Enhanced Error Handling in server-manager.js
- Unhandled promise rejections now log full stack trace and exit
- Prevents silent failures in child processes

### 2. Global Error Handlers in api-server.js
- Added uncaughtException and unhandledRejection handlers at module top
- Catches errors during ES module loading and initialization

### 3. Fixed SPARQL Endpoint Configuration
- Corrected `/semem/query` → `/semem/sparql` in config.json
- Matches Fuseki assembler configuration

## Deployment Steps for Remote Server

```bash
# 1. Navigate to project directory
cd /path/to/semem

# 2. Pull latest changes
git pull origin main

# 3. Stop existing containers
docker compose down

# 4. Rebuild the image
docker compose build --no-cache

# 5. Start containers and watch logs
docker compose up -d
docker compose logs -f semem
```

## Expected Output

With the fixes, you should now see **detailed error messages** if initialization fails:

```
💥 UNCAUGHT EXCEPTION during api-server.js initialization:
Error: [actual error message]
Stack: [full stack trace]
```

OR

```
💥 UNHANDLED REJECTION during api-server.js initialization:
Reason: [actual error details]
Stack: [full stack trace]
```

## Common Issues and Solutions

### Issue 1: SPARQL Connection Failed
**Symptom**: Error about HTTP 405 or connection refused to Fuseki

**Solution**:
```bash
# Check Fuseki is running and healthy
docker compose ps
docker compose logs fuseki

# Verify network connectivity
docker compose exec semem ping fuseki
docker compose exec semem curl http://fuseki:3030/$/ping
```

### Issue 2: Config Variable Substitution
**Symptom**: Errors about invalid URLs or missing configuration

**Solution**:
```bash
# Check environment variables in container
docker compose exec semem env | grep SPARQL

# Should show:
# SPARQL_HOST=fuseki
# SPARQL_PORT=3030
```

If not set, verify docker-compose.yml has:
```yaml
services:
  semem:
    environment:
      - SPARQL_HOST=fuseki
      - SPARQL_PORT=3030
```

### Issue 3: Missing Dependencies
**Symptom**: Module not found errors

**Solution**:
```bash
# Rebuild with clean slate
docker compose build --no-cache semem
```

### Issue 4: Permission Issues
**Symptom**: EACCES or permission denied errors

**Solution**:
```bash
# Check volume permissions
ls -la docker-data/semem/
ls -la docker-data/fuseki/

# Should be owned by UID 1001 (semem user) or 9008 (fuseki user)
# If not, the init containers should fix this on startup
```

## Diagnostic Script

Run the diagnostic script for comprehensive checks:

```bash
chmod +x scripts/docker-diagnose.sh
./scripts/docker-diagnose.sh
```

## Still No Error Output?

If you still see no error output between the log lines, check:

1. **Docker logs are complete**: `docker compose logs --tail=200 semem`
2. **Check stderr separately**: `docker compose logs semem 2>&1 | grep -E "Error|error|ERROR"`
3. **Inspect container directly**: `docker compose exec semem bash` then manually run `node src/servers/api-server.js`

## Contact Information

If the issue persists after these fixes, provide:
1. Full docker compose logs: `docker compose logs > full-logs.txt`
2. Container environment: `docker compose exec semem env > container-env.txt`
3. Config file (with secrets redacted): `docker compose exec semem cat /app/config/config.json`
