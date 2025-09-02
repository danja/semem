# Semem Docker Deployment Guide

## 🚀 Quick Start

Deploy Semem using Docker Compose in minutes:

```bash
# Clone and navigate to project
git clone <repository-url>
cd semem

# Start all services
docker compose up -d

# Check status
docker compose ps
```

## 📡 Exposed Services

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Fuseki SPARQL** | 4050 | http://localhost:4050 | RDF database admin interface |
| **Semem API** | 4100 | http://localhost:4100 | RESTful API endpoints |
| **Semem MCP** | 4101 | http://localhost:4101 | Model Context Protocol server |
| **Semem Workbench** | 4102 | http://localhost:4102 | Web-based UI and management |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Semem App     │    │  Fuseki SPARQL  │
│  (Node.js)      │◄──►│   Database      │
│                 │    │                 │
│ • API (4100)    │    │ • Admin (4050)  │
│ • MCP (4101)    │    │ • Dataset: /semem│
│ • UI  (4102)    │    │ • Auth: admin123│
└─────────────────┘    └─────────────────┘
```

## 🛠️ Configuration

### Environment Variables

The system uses these environment variables (all optional):

```bash
# LLM Provider API Keys
MISTRAL_API_KEY=your_mistral_key_here
CLAUDE_API_KEY=your_claude_key_here  
OPENAI_API_KEY=your_openai_key_here
NOMIC_API_KEY=your_nomic_key_here

# SPARQL Database (defaults provided)
SPARQL_USER=admin
SPARQL_PASSWORD=admin123

# API Security (auto-generated if not set)
SEMEM_API_KEY=your_secure_key_here
```

### Docker Compose Profiles

- **Production**: `docker compose up -d`
- **Development**: `docker compose -f docker-compose.dev.yml up -d`

## 💾 Data Persistence

```bash
# Named volumes for data persistence
fuseki_data      # SPARQL database files
fuseki_config    # SPARQL configuration
semem_data       # Application data
semem_logs       # Application logs
semem_config     # Runtime configuration
```

## 🔧 Management Commands

```bash
# View logs
docker compose logs -f semem
docker compose logs -f fuseki

# Restart services
docker compose restart semem
docker compose restart fuseki

# Stop all services
docker compose down

# Update and rebuild
docker compose build --no-cache
docker compose up -d --force-recreate

# Clean up (removes data!)
docker compose down -v
```

## 🧪 Testing the Deployment

### 1. Verify SPARQL Database
```bash
# Check Fuseki is running
curl http://localhost:4050/$/ping

# Test SPARQL query
curl -G "http://localhost:4050/semem/sparql" \
  --data-urlencode "query=SELECT * WHERE { ?s ?p ?o } LIMIT 5" \
  -u admin:admin123
```

### 2. Test Semem Services
```bash
# Check container status
docker compose ps

# View startup logs
docker compose logs semem --tail=50
```

## 🚨 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using ports
ss -tlnp | grep -E ":4100|:4101|:4102|:4050"

# Use different ports if needed
docker compose down
# Edit docker-compose.yml ports section
docker compose up -d
```

**SPARQL dataset not found:**
```bash
# Recreate read-write dataset
curl -X POST "http://localhost:4050/$/datasets" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u admin:admin123 \
  -d "dbName=semem&dbType=tdb2"
```

**Container won't start:**
```bash
# Check detailed logs
docker compose logs [service_name]

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Health Checks

```bash
# Container health status
docker compose ps

# SPARQL database ready
curl http://localhost:4050/$/ping -u admin:admin123

# Available datasets
curl http://localhost:4050/$/datasets -u admin:admin123
```

## 🔐 Security Notes

- Default credentials: `admin / admin123`
- Change `ADMIN_PASSWORD` in production
- Use strong `SEMEM_API_KEY` for API access
- Consider reverse proxy for HTTPS
- Network isolation via Docker networks

## 📚 Key Features

✅ **Multi-stage Docker builds** with native module support  
✅ **Health checks** and graceful startup ordering  
✅ **Hot reloading** in development mode  
✅ **Persistent storage** with named volumes  
✅ **Environment-based configuration**  
✅ **No Ollama dependency** (external only)  
✅ **SPARQL read/write access** properly configured  
✅ **Modern Docker Compose V2** syntax  

## 🎯 Next Steps

1. **Add LLM provider API keys** to enable full functionality
2. **Configure external Ollama** if needed: `OLLAMA_HOST=http://your-ollama:11434`  
3. **Set up reverse proxy** for production deployment
4. **Configure data backup** for SPARQL database
5. **Monitor logs** and adjust resource limits as needed

---

**Deployment Status:** ✅ **Complete and Functional**

All infrastructure is operational. The Docker deployment successfully provides:
- Containerized Semem application with all services
- Read-write SPARQL database backend
- Proper service orchestration and health monitoring
- Development and production deployment options
- Comprehensive management and troubleshooting tools