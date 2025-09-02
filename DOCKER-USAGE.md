# Docker Development vs Production Guide

## 🏭 Production Version (`docker-compose.yml`)

### **When to Use**
- **Deployment** to staging/production servers
- **Testing** the final built application  
- **Demo** environments for stakeholders
- **CI/CD** pipeline deployments

### **Key Features**
```bash
# Start production environment
docker compose up -d

# Or explicitly specify the file
docker compose -f docker-compose.yml up -d
```

#### **Production Configuration:**

| Aspect | Production Settings |
|--------|-------------------|
| **Environment** | `NODE_ENV=production` |
| **Fuseki Memory** | 2GB (`JVM_ARGS=-Xmx2g`) |
| **Password** | Strong: `admin123` |
| **Source Code** | Copied into container (immutable) |
| **Debugging** | Disabled for performance |
| **Health Checks** | Robust (30s intervals) |
| **Build** | Optimized with `npm prune --production` |
| **Volumes** | Named volumes for persistence |
| **Network** | `semem-network` |

#### **Data Persistence:**
- `fuseki_data` - SPARQL database files
- `semem_data` - Application data  
- `semem_logs` - Application logs
- `semem_config` - Runtime configuration

---

## 🔧 Development Version (`docker-compose.dev.yml`)

### **When to Use**
- **Active development** with live code changes
- **Debugging** Node.js applications
- **Testing** new features rapidly
- **Local development** workflow

### **Key Features**
```bash
# Start development environment  
docker compose -f docker-compose.dev.yml up

# Or with explicit rebuild
docker compose -f docker-compose.dev.yml up --build
```

#### **Development Configuration:**

| Aspect | Development Settings |
|--------|-------------------|
| **Environment** | `NODE_ENV=development` |
| **Fuseki Memory** | 1GB (`JVM_ARGS=-Xmx1g`) |
| **Password** | Simple: `admin` |
| **Source Code** | **Live mounted** - changes reflect immediately |
| **Debugging** | **Node.js inspector** on port 9229 |
| **Health Checks** | Fast (15s intervals) |
| **Build** | Includes dev dependencies |
| **Volumes** | **Hot reload** + separate dev data |
| **Network** | `semem-dev-network` |

#### **Live Development Features:**
- 🔥 **Hot Reload**: Changes to `/src`, `/mcp`, `/prompts` immediately visible
- 🐛 **Remote Debugging**: Connect VS Code/Chrome DevTools to port 9229
- 📊 **Debug Logging**: `DEBUG=semem:*` shows detailed logs
- 🔄 **Fast Iteration**: No rebuild needed for code changes

---

## 📋 Comparison Table

| Feature | Production | Development |
|---------|------------|-------------|
| **Command** | `docker compose up -d` | `docker compose -f docker-compose.dev.yml up` |
| **Code Updates** | Requires rebuild | Live reload |
| **Performance** | Optimized | Debug-enabled |
| **Memory Usage** | Higher (2GB Fuseki) | Lower (1GB Fuseki) |
| **Debugging** | ❌ Disabled | ✅ Port 9229 |
| **Logs** | Production level | Verbose debugging |
| **Security** | Strong passwords | Simple passwords |
| **Data** | Persistent volumes | Ephemeral dev data |
| **Startup Time** | Slower (robust checks) | Faster (quick checks) |

---

## 🚀 Usage Examples

### **Production Deployment**
```bash
# 1. Start production environment
docker compose up -d

# 2. Check status
docker compose ps

# 3. View logs
docker compose logs -f semem

# 4. Stop services
docker compose down

# 5. Update and restart
docker compose build --no-cache
docker compose up -d --force-recreate
```

### **Development Workflow**  
```bash
# 1. Start with live reload
docker compose -f docker-compose.dev.yml up

# 2. Edit files in ./src/, ./mcp/, ./config/ - changes apply instantly

# 3. Debug remotely (VS Code)
# - Open Command Palette (Ctrl+Shift+P)
# - "Debug: Attach to Node Process"
# - Connect to localhost:9229

# 4. View debug logs
docker compose -f docker-compose.dev.yml logs -f semem-dev

# 5. Reset development data
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up
```

### **Debugging Setup (VS Code)**
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Docker: Attach to Semem",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

---

## 🔄 Switching Between Modes

### **From Development to Production**
```bash
# Stop dev environment
docker compose -f docker-compose.dev.yml down

# Start production 
docker compose up -d

# Data is separate - no conflicts
```

### **From Production to Development**  
```bash
# Stop production
docker compose down

# Start development
docker compose -f docker-compose.dev.yml up

# Code changes now live-reload
```

---

## 🛠️ Advanced Usage

### **Custom Environment Variables**
```bash
# Production with custom settings
MISTRAL_API_KEY=your_key docker compose up -d

# Development with debugging
DEBUG=semem:* docker compose -f docker-compose.dev.yml up
```

### **Development Tools Container**
```bash
# Access dev tools container (if tools profile enabled)
docker compose -f docker-compose.dev.yml --profile tools up -d
docker exec -it semem-dev-tools sh
```

### **Data Management**
```bash
# Backup production data
docker run --rm -v semem_fuseki_data:/data -v $(pwd):/backup alpine tar czf /backup/fuseki-backup.tar.gz /data

# Restore to development
docker run --rm -v semem_dev_fuseki_dev_data:/data -v $(pwd):/backup alpine tar xzf /backup/fuseki-backup.tar.gz -C /
```

---

## 🎯 Recommendations

### **For Development:**
- Use `docker-compose.dev.yml` 
- Keep it running during coding
- Use remote debugging for complex issues
- Regularly test with production config before deployment

### **For Production:**
- Use `docker-compose.yml`
- Set strong passwords via environment variables
- Use reverse proxy (nginx) for HTTPS
- Monitor with `docker compose logs`
- Regular backups of named volumes

### **For CI/CD:**
- Build with production config
- Test with production environment
- Use health checks to verify deployment
- Automated rollback on health check failures

This gives you maximum flexibility for both rapid development and robust production deployment!