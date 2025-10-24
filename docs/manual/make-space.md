# Making Space - Disk Cleanup Guide

## Overview

This guide explains how to free up disk space when running Semem, particularly when encountering `sed: write error` or other disk-full issues.

## Common Disk Space Issues

### Symptom: Fuseki sed Write Error

```
semem-fuseki  | sed: write error
semem-fuseki exited with code 4
```

This error typically occurs when:
- Disk is full or nearly full
- sed cannot create temporary files for in-place editing
- Docker volumes have consumed all available space

## Quick Diagnosis

### Check Disk Usage

```bash
# Check overall disk space
df -h

# Check Docker disk usage
docker system df

# Check project data
du -sh docker-data/*

# Check specific directories
du -sh docker-data/fuseki-base/databases/
```

### Find Large Files

```bash
# Find files larger than 100MB
find docker-data/ -type f -size +100M -exec ls -lh {} \;

# Check what's using the most space
du -sh docker-data/fuseki-base/databases/tdb2/*
```

## Cleaning Fuseki Database Files

### What Are These Files?

Files in `docker-data/fuseki-base/databases/tdb2/`:
- `GOSP.dat`, `GPOS.dat`, etc. - RDF triple indexes
- `OSP.dat`, `POS.dat`, etc. - Additional indexes
- `node*.dat` - RDF node data

These are the **actual SPARQL triple store data** containing:
- All stored memories (from tell operations)
- All concepts and relationships
- All semantic search data
- All graph data

### Safe Deletion Steps

**⚠️ Warning: This deletes all stored semantic memory!**

```bash
# 1. Navigate to project directory
cd /path/to/semem

# 2. Stop all containers first
docker compose down

# 3. Check how much space will be freed
du -sh docker-data/fuseki-base/databases/

# 4. Delete the database files
rm -rf docker-data/fuseki-base/databases/tdb2/*

# Or delete entire databases directory:
rm -rf docker-data/fuseki-base/databases/*

# 5. Verify deletion
ls -la docker-data/fuseki-base/databases/

# 6. Restart with clean database
docker compose up -d

# 7. Verify Fuseki starts cleanly
docker compose logs fuseki --tail=30

# 8. Check disk space now
df -h
```

### Optional: Backup Before Deletion

If you might need the data later:

```bash
# Create timestamped backup
tar -czf fuseki-backup-$(date +%Y%m%d-%H%M%S).tar.gz docker-data/fuseki-base/databases/

# Verify backup was created
ls -lh fuseki-backup-*.tar.gz

# Then delete
rm -rf docker-data/fuseki-base/databases/tdb2/*
```

### What Happens After Deletion

After deletion, you'll have:
- ✅ Empty database ready for new data
- ✅ Much more disk space
- ✅ No "disk full" errors
- ✅ Fuseki will start successfully
- ✅ Fresh triple store (automatically recreated on startup)

## Docker System Cleanup

### Comprehensive Cleanup

```bash
# Remove everything unused (containers, images, volumes)
docker system prune -a --volumes -f

# This removes:
# - All stopped containers
# - All unused networks
# - All unused images
# - All unused volumes
# - All build cache
```

### Selective Cleanup

```bash
# Remove stopped containers only
docker container prune -f

# Remove unused images
docker image prune -a -f

# Remove unused volumes
docker volume prune -f

# Remove build cache
docker builder prune -a -f
```

### Check What Will Be Removed

```bash
# See what will be pruned (dry run)
docker system df

# Detailed view
docker system df -v
```

## Additional Cleanup Options

### Clean Log Files

```bash
# Remove Fuseki logs
rm -rf docker-data/fuseki-base/logs/*

# Remove Semem logs
rm -rf docker-data/semem/logs/*

# Keep directory structure
mkdir -p docker-data/fuseki-base/logs
mkdir -p docker-data/semem/logs
```

### Clean Old Backups

```bash
# Find old backup files
find docker-data/ -name "*.tar.gz" -mtime +30

# Remove backups older than 30 days
find docker-data/ -name "*.tar.gz" -mtime +30 -delete
```

### Rotate Large Log Files

```bash
# Find large log files
find docker-data/ -name "*.log" -type f -size +100M

# Archive and compress large logs
find docker-data/ -name "*.log" -type f -size +100M \
  -exec gzip {} \;
```

## Disk Space Requirements

### Minimum Requirements

- **Development**: 10GB free space
- **Production**: 20GB+ free space
- **Heavy usage**: 50GB+ recommended

### Monitoring Disk Usage

```bash
# Add to cron for daily monitoring
df -h | mail -s "Disk Space Report" admin@example.com

# Or create alert when < 10% free
df -h | awk '$5 > 90 {print "WARNING: " $0}'
```

## Preventing Disk Issues

### 1. Regular Cleanup Schedule

```bash
# Weekly cleanup script
#!/bin/bash
cd /path/to/semem
docker system prune -f
docker image prune -a -f
```

### 2. Limit Log File Growth

Configure log rotation in `docker-compose.yml`:

```yaml
services:
  fuseki:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 3. Monitor Database Growth

```bash
# Check database size daily
du -sh docker-data/fuseki-base/databases/tdb2/ | \
  mail -s "Fuseki DB Size" admin@example.com
```

### 4. Archive Old Data

```bash
# Monthly backup and cleanup
tar -czf archive/fuseki-$(date +%Y%m).tar.gz \
  docker-data/fuseki-base/databases/
rm -rf docker-data/fuseki-base/databases/tdb2/*
docker compose restart fuseki
```

## Troubleshooting

### Still Getting Disk Full Errors?

```bash
# 1. Check Docker directory
sudo du -sh /var/lib/docker/*

# 2. Check for hidden files
du -sh .[!.]* *

# 3. Check system journals
sudo journalctl --disk-usage
sudo journalctl --vacuum-size=100M

# 4. Check tmp directories
du -sh /tmp/*
du -sh /var/tmp/*
```

### Fuseki Won't Start After Cleanup?

```bash
# 1. Verify databases directory exists
mkdir -p docker-data/fuseki-base/databases/tdb2

# 2. Fix permissions
sudo chown -R 9008:9008 docker-data/fuseki-base/databases/

# 3. Restart
docker compose restart fuseki

# 4. Check logs
docker compose logs fuseki
```

### Database Corruption After Cleanup?

If you partially deleted files:

```bash
# Complete cleanup and reset
docker compose down
rm -rf docker-data/fuseki-base/databases/*
docker compose up -d
```

## Quick Reference

### Emergency Cleanup (One-liner)

```bash
docker compose down && \
rm -rf docker-data/fuseki-base/databases/tdb2/* && \
docker system prune -a --volumes -f && \
docker compose up -d
```

### Check Space Before/After

```bash
# Before cleanup
df -h > before.txt
du -sh docker-data/ >> before.txt

# After cleanup
df -h > after.txt
du -sh docker-data/ >> after.txt

# Compare
diff before.txt after.txt
```

### Safe Cleanup Script

Create `scripts/safe-cleanup.sh`:

```bash
#!/bin/bash
set -e

echo "=== Safe Cleanup Script ==="
echo "Current disk usage:"
df -h | grep -E '^Filesystem|/$'
echo ""

read -p "Stop containers and clean database? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

docker compose down
echo "✓ Containers stopped"

du -sh docker-data/fuseki-base/databases/
rm -rf docker-data/fuseki-base/databases/tdb2/*
echo "✓ Database cleaned"

docker system prune -f
echo "✓ Docker pruned"

docker compose up -d
echo "✓ Containers restarted"

echo ""
echo "Disk usage after cleanup:"
df -h | grep -E '^Filesystem|/$'
```

## Summary

| Action | Disk Saved | Risk | Command |
|--------|------------|------|---------|
| Delete Fuseki DB | High (GBs) | High (data loss) | `rm -rf docker-data/fuseki-base/databases/*` |
| Docker prune | Medium (100MB-GBs) | Low | `docker system prune -a --volumes -f` |
| Clean logs | Low-Medium | None | `rm -rf docker-data/*/logs/*` |
| Remove old images | Medium | None | `docker image prune -a -f` |

Always backup important data before cleanup!

---
Last Updated: 2025-10-24
