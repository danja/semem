# Docker Installation and Deployment Guide

This guide provides instructions for running Semem using Docker. The Docker deployment works exactly like a local installation - it uses the same configuration files and .env setup, with only service hostnames changed for containerization.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Development Setup](#development-setup)
- [Service Configuration](#service-configuration)
- [Environment Variables](#environment-variables)
- [Advanced Deployments](#advanced-deployments)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Docker**: Version 20.10+ with Docker Compose V2
- **System Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 10GB free disk space (for models and data)
- **Platform**: Linux, macOS, or Windows with WSL2

### Docker Installation

**Linux (Ubuntu/Debian):**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose V2
sudo apt-get update && sudo apt-get install docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

**macOS:**
```bash
# Install Docker Desktop
brew install --cask docker
# Or download from: https://www.docker.com/products/docker-desktop/

# Start Docker Desktop and ensure it's running
```

**Windows:**
```bash
# Install Docker Desktop with WSL2 backend
# Download from: https://www.docker.com/products/docker-desktop/
# Ensure WSL2 is enabled and configured
```

### Verify Installation

```bash
# Check Docker version
docker --version
docker compose version

# Test Docker installation
docker run hello-world
```

## Port Mapping Reference

This table shows how internal container ports are mapped to external host ports:

| Service | Component | Internal Port | External Port | URL |
|---------|-----------|---------------|---------------|-----|
| Fuseki | SPARQL Database | 3030 | **4050** | http://localhost:4050 |
| Semem | API Server | 4100 | 4100 | http://localhost:4100 |
| Semem | MCP Server | 4101 | 4101 | http://localhost:4101 |
| Semem | Workbench UI | 4102 | 4102 | http://localhost:4102 |
| Nginx | Reverse Proxy | 80/443 | 80/443 | http://localhost:80 |

**Important Notes:**
- Fuseki is mapped to port **4050** externally to avoid conflicts with local Fuseki installations on port 3030
- All Semem services maintain the same port numbers both internally and externally
- Use the **External Port** column when accessing services from your host machine
- Internal ports are used for container-to-container communication

## Quick Start

### 1. Get Semem

```bash
# Clone the repository
git clone https://github.com/danja/semem.git
cd semem

# Verify Docker files
ls -la Dockerfile docker compose*.yml
```

### 2. Environment Setup

**Copy your existing .env file or create one:**
```bash
# If you have an existing local .env, use it as-is
# OR copy the example and add your API keys
cp .env.docker.example .env

# Edit with your API keys (same as local setup)
nano .env
```

### 3. Start Services

**Development:**
```bash
# Start development services
docker compose -f docker-compose.dev.yml up -d

# Monitor startup
docker compose -f docker-compose.dev.yml logs -f
```

**Production:**
```bash
# Start production services
docker compose up -d

# Monitor startup
docker compose logs -f
```

### 4. Access Semem

Once all services are running:

```bash
# Check service health
curl http://localhost:4100/health  # API Server
curl http://localhost:4102/health  # Workbench UI
curl http://localhost:4101/health  # MCP Server

# Access web interface
open http://localhost:4102  # Workbench UI
open http://localhost:4050  # Fuseki SPARQL interface
```

**That's it!** The Docker deployment works exactly like the local version, using:
- The same configuration priorities (Mistral → Claude → external Ollama if configured)
- The same .env file format and variables
- The same port assignments
- Only difference: service hostnames changed for Docker networking

**Note:** Ollama is not included in the Docker containers - if you want to use Ollama, install it separately on your host or another server and configure `OLLAMA_HOST` in your .env file.

## Production Deployment

### 1. Environment Configuration

```bash
# Use your existing .env or create from template
cp .env.docker.example .env

# Edit with your API keys (exactly like local setup)
nano .env
```

**Your .env file should look like:**
```bash
# Same format as local installation
SEMEM_API_KEY=your-api-key
NODE_ENV=production

# SPARQL Store credentials
SPARQL_USER=admin
SPARQL_PASSWORD=admin123

# LLM Provider API Keys (same priorities as config.json)
MISTRAL_API_KEY=your-mistral-key  # Priority 1
CLAUDE_API_KEY=your-claude-key    # Priority 2
OPENAI_API_KEY=your-openai-key
NOMIC_API_KEY=your-nomic-key      # Embeddings priority 1
OLLAMA_API_KEY=NO_KEY_REQUIRED    # Fallback
```

### 2. SSL Certificate Setup (Optional)

**Self-signed certificates for testing:**
```bash
mkdir -p nginx/ssl

# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/semem.key \
  -out nginx/ssl/semem.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"
```

**Let's Encrypt certificates:**
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate (replace your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/semem.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/semem.key
sudo chmod 644 nginx/ssl/semem.crt
sudo chmod 600 nginx/ssl/semem.key
```

### 3. Start Production Services

**Basic Production Deployment:**
```bash
# Start core services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f semem
```

**Production with SSL Proxy:**
```bash
# Start with nginx reverse proxy
docker compose --profile proxy up -d

# Monitor all services
docker compose --profile proxy logs -f
```

**Production with SSL:**
```bash
docker compose --profile proxy up -d

# Verify all services
docker compose ps
```

### 4. Verify Production Deployment

```bash
# Service health checks
curl https://localhost/health          # Via nginx (SSL)
curl http://localhost:4100/health      # Direct API access
curl http://localhost:4050/$/ping      # Fuseki SPARQL

# Check logs for errors
docker compose logs semem | grep -i error
docker compose logs fuseki | grep -i error
docker compose logs nginx | grep -i error
```

## Development Setup

### 1. Development Environment

The development setup includes:
- Live code reloading via volume mounts
- Debug port exposure (9229)
- Simplified configuration
- Optional external API integration

```bash
# Development with live reload
docker compose -f docker-compose.dev.yml up -d

# View development logs  
docker compose -f docker-compose.dev.yml logs -f semem-dev

# Access development container
docker compose -f docker-compose.dev.yml exec semem-dev bash
```

### 2. Development Tools

**Run Tests:**
```bash
# Run test suite in container
docker compose -f docker-compose.dev.yml exec semem-dev npm test

# Run specific test suites
docker compose -f docker-compose.dev.yml exec semem-dev npm run test:core
docker compose -f docker-compose.dev.yml exec semem-dev npm run test:sparql
```

**Debug Node.js:**
```bash
# Node.js debug port is exposed on 9229
# Configure your IDE to connect to localhost:9229
# Or use Chrome DevTools: chrome://inspect
```

**Development Utilities:**
```bash
# Start development tools container
docker compose -f docker-compose.dev.yml --profile tools up -d dev-tools

# Access tools container
docker compose -f docker-compose.dev.yml exec dev-tools bash

# Install additional development dependencies
docker compose -f docker-compose.dev.yml exec dev-tools npm install --save-dev <package>
```

### 3. Live Code Editing

Development containers mount source code as volumes:
```bash
# Changes to these directories are reflected immediately:
./src      -> /app/src      (Application source)
./mcp      -> /app/mcp      (MCP server)
./config   -> /app/config   (Configuration)
./prompts  -> /app/prompts  (Prompt templates)

# Restart only required for dependency changes
docker compose -f docker-compose.dev.yml restart semem-dev
```

## Service Configuration

### Semem Application

**Ports:**
- `4100` - API Server (HTTP REST endpoints)
- `4101` - MCP Server (Model Context Protocol)
- `4102` - Workbench UI (Web interface)
- `9229` - Debug Port (development only)

**Configuration:**
```json
{
  "servers": {
    "api": 4100,
    "workbench": 4102, 
    "mcp": 4101
  },
  "storage": {
    "type": "sparql",
    "options": {
      "query": "http://fuseki:3030/semem/query",
      "update": "http://fuseki:3030/semem/update"
    }
  }
}
```

### Fuseki SPARQL Database

**Access:**
- Web UI: `http://localhost:4050`
- Query endpoint: `http://localhost:4050/semem/query`
- Update endpoint: `http://localhost:4050/semem/update`

**Initial Setup:**
```bash
# Create dataset (automatic on first run)
curl -X POST \
  http://localhost:4050/$/datasets \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'dbName=semem&dbType=tdb2'
```

### External Ollama Service (Optional)

If you want to use Ollama, install it separately and configure the connection:

**Host Installation:**
```bash
# Install Ollama on your host machine
curl -fsSL https://ollama.ai/install.sh | sh

# Pull required models
ollama pull qwen2:1.5b
ollama pull nomic-embed-text
```

**Docker Configuration:**
```bash
# In your .env file, point to host Ollama
OLLAMA_HOST=http://host.docker.internal:11434  # On Docker Desktop
# OR
OLLAMA_HOST=http://172.17.0.1:11434            # On Linux
# OR
OLLAMA_HOST=http://your-ollama-server:11434    # External server
```

### Nginx Reverse Proxy

**Configuration:**
```nginx
# Production URLs
https://localhost/workbench/     # Workbench UI
https://localhost/api/           # API endpoints  
https://localhost/mcp/           # MCP endpoints
https://localhost/health         # Health check
```

**SSL Configuration:**
- Certificate: `nginx/ssl/semem.crt`
- Private key: `nginx/ssl/semem.key`
- Protocols: TLS 1.2, 1.3


## Environment Variables

### Core Application Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Runtime environment | `production` | Yes |
| `SEMEM_API_KEY` | API authentication key | - | Yes |
| `SPARQL_USER` | SPARQL database username | `admin` | Yes |
| `SPARQL_PASSWORD` | SPARQL database password | - | Yes |

### LLM Provider Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MISTRAL_API_KEY` | Mistral AI API key | - | No* |
| `CLAUDE_API_KEY` | Anthropic Claude API key | - | No* |
| `OPENAI_API_KEY` | OpenAI API key | - | No* |
| `GROQ_API_KEY` | Groq API key | - | No* |
| `NOMIC_API_KEY` | Nomic embedding API key | - | No* |
| `OLLAMA_HOST` | External Ollama URL | `http://host.docker.internal:11434` | No |

*At least one LLM provider should be configured

### Service Configuration Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_PORT` | API server port | `4100` | No |
| `WORKBENCH_PORT` | Workbench UI port | `4102` | No |
| `MCP_PORT` | MCP server port | `4101` | No |
| `FUSEKI_DATASET` | SPARQL dataset name | `semem` | No |
| `GRAPH_NAME` | RDF graph name | `http://hyperdata.it/content` | No |

### Performance Tuning Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CONCEPT_MAX_CONCEPTS` | Max concepts per extraction | `3` | No |
| `SEARCH_DEFAULT_LIMIT` | Default search result limit | `10` | No |
| `WIKIDATA_RATE_LIMIT` | Wikidata API rate limit | `200` | No |
| `WIKIPEDIA_RATE_LIMIT` | Wikipedia API rate limit | `100` | No |

## Advanced Deployments

### Multi-Architecture Builds

Build for multiple architectures:
```bash
# Setup buildx
docker buildx create --use

# Build for AMD64 and ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t semem:latest \
  --push .
```

### Production Scaling

**Horizontal Scaling:**
```yaml
# docker-compose.prod.yml
services:
  semem:
    deploy:
      replicas: 3
    ports:
      - "4100-4102:4100"
```

**Load Balancing:**
```nginx
# nginx.conf
upstream semem_api {
    server semem_1:4100;
    server semem_2:4100; 
    server semem_3:4100;
}
```

### External Services

**External SPARQL Endpoint:**
```bash
# Environment variables
FUSEKI_QUERY_URL=https://your-sparql-server.com/query
FUSEKI_UPDATE_URL=https://your-sparql-server.com/update
SPARQL_USER=your-username
SPARQL_PASSWORD=your-password
```

**External Ollama:**
```bash
# Point to external Ollama instance
OLLAMA_HOST=http://your-ollama-server:11434
```

### Resource Management

**Memory Limits:**
```yaml
# docker-compose.yml
services:
  semem:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'
```

**Storage Configuration:**
```yaml
volumes:
  fuseki_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/fuseki  # Custom storage location
```

## Troubleshooting

### Common Issues

**1. Container Won't Start**
```bash
# Check container logs
docker compose logs semem

# Common issues:
# - Port already in use: sudo lsof -i :4100
# - Permission denied: sudo chown -R 1001:1001 ./data
# - Out of memory: Increase Docker memory limits
```

**2. Service Connection Failures**
```bash
# Test service connectivity
docker compose exec semem curl http://fuseki:3030/$/ping

# Check network
docker network ls
docker network inspect semem_semem-network
```

**3. SPARQL Database Issues**
```bash
# Reset Fuseki database
docker compose stop fuseki
docker volume rm semem_fuseki_data
docker compose up -d fuseki

# Check Fuseki logs
docker compose logs fuseki
```

**4. External Ollama Connection Issues**
```bash
# Test external Ollama connectivity
curl http://host.docker.internal:11434/api/tags  # Docker Desktop
curl http://172.17.0.1:11434/api/tags           # Linux

# Check available space
docker system df
docker system prune  # Clean up unused data
```

**5. Performance Issues**
```bash
# Monitor resource usage
docker stats

# Check memory usage
docker compose exec semem free -h
docker compose exec semem ps aux --sort=-%mem | head

# Restart services
docker compose restart semem
```

### Debug Mode

**Enable Debug Logging:**
```bash
# Development
DEBUG=semem:* docker compose -f docker-compose.dev.yml up -d

# Production
docker compose exec semem sh -c 'DEBUG=semem:* npm start'
```

**Container Shell Access:**
```bash
# Access running container
docker compose exec semem bash

# Access with root privileges
docker compose exec --user root semem bash

# Start temporary debug container
docker run -it --rm --network semem_semem-network semem:latest bash
```

### Health Check Debugging

```bash
# Manual health checks
curl -f http://localhost:4100/health || echo "API unhealthy"
curl -f http://localhost:4102/health || echo "Workbench unhealthy" 
curl -f http://localhost:4050/$/ping || echo "Fuseki unhealthy"
curl -f http://localhost:11434/api/tags || echo "Ollama unhealthy"

# Check Docker health status
docker compose ps
docker inspect semem_semem_1 | grep -A 5 Health
```

## Maintenance

### Updates and Upgrades

**Update Semem:**
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker compose build --no-cache
docker compose up -d

# Verify update
docker compose exec semem node --version
```

**Update Base Images:**
```bash
# Pull latest images
docker compose pull

# Rebuild with latest base images
docker compose build --pull
docker compose up -d
```

### Backup and Restore

**Database Backup:**
```bash
# Backup Fuseki data
docker run --rm \
  -v semem_fuseki_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/fuseki-$(date +%Y%m%d).tar.gz /data

# Backup application data
docker run --rm \
  -v semem_semem_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/semem-data-$(date +%Y%m%d).tar.gz /data
```

**Configuration Backup:**
```bash
# Export current configuration
docker compose exec semem cat /app/config/config.json > config-backup.json

# Export environment
cp .env.docker .env.docker.backup
```

**Restore:**
```bash
# Stop services
docker compose down

# Restore data
docker run --rm \
  -v semem_fuseki_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/fuseki-20240101.tar.gz -C /

# Restart services
docker compose up -d
```

### Log Management

**Log Rotation:**
```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

**Log Analysis:**
```bash
# Follow all logs
docker compose logs -f

# Filter logs
docker compose logs semem 2>&1 | grep ERROR

# Export logs
docker compose logs --no-color > semem-logs-$(date +%Y%m%d).txt
```

### Monitoring

**Resource Monitoring:**
```bash
# Real-time stats
docker stats

# Historical data
docker compose exec semem top
docker compose exec fuseki free -h
```

**Service Monitoring:**
```bash
# Health check script
#!/bin/bash
services=("4100/health" "4102/health" "4050/$/ping" "11434/api/tags")
for service in "${services[@]}"; do
  if curl -f -s http://localhost:$service > /dev/null; then
    echo "✓ Service on port ${service%/*} is healthy"
  else
    echo "✗ Service on port ${service%/*} is unhealthy"
  fi
done
```

### Security Updates

**Regular Maintenance:**
```bash
# Update all images monthly
docker compose pull
docker compose up -d --force-recreate

# Clean unused resources
docker system prune -a

# Update SSL certificates (Let's Encrypt)
sudo certbot renew
sudo systemctl restart nginx
```

---

## Next Steps

- [Semem Configuration Guide](config.md)
- [API Reference](../api/README.md) 
- [MCP Integration Guide](mcp.md)
- [Performance Tuning Guide](performance.md)

For more help:
- [GitHub Issues](https://github.com/danja/semem/issues)
- [Documentation](https://danja.github.io/semem/)
- [Blog](https://tensegrity.it)