# Semem Deployment Configurations

## Development Environment
```javascript
// config/development.js
export default {
  storage: {
    type: 'memory',
    options: { persist: false }
  },
  server: {
    port: 3000,
    cors: true
  },
  models: {
    provider: 'ollama',
    endpoint: 'http://localhost:11434'
  },
  logging: {
    level: 'debug',
    format: 'detailed'
  }
}
```

## Production Environment
```javascript
// config/production.js
export default {
  storage: {
    type: 'sparql',
    endpoint: process.env.SPARQL_ENDPOINT,
    credentials: {
      user: process.env.SPARQL_USER,
      password: process.env.SPARQL_PASS
    }
  },
  server: {
    port: 80,
    ssl: {
      cert: '/etc/ssl/cert.pem',
      key: '/etc/ssl/key.pem'
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  },
  cache: {
    type: 'redis',
    url: process.env.REDIS_URL
  }
}
```

## Docker Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  semem:
    build: .
    environment:
      - NODE_ENV=production
      - SPARQL_ENDPOINT=http://fuseki:3030
    ports:
      - "3000:3000"
    depends_on:
      - fuseki
      - redis

  fuseki:
    image: stain/jena-fuseki
    environment:
      - ADMIN_PASSWORD=admin123
    volumes:
      - fuseki-data:/fuseki

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data

volumes:
  fuseki-data:
  redis-data:
```

## Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: semem-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: semem
        image: semem:latest
        env:
        - name: NODE_ENV
          value: production
        - name: SPARQL_ENDPOINT
          valueFrom:
            configMapKeyRef:
              name: semem-config
              key: sparql-endpoint
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
```

## Cloud Functions
```javascript
// serverless.js
export async function handleRequest(req, context) {
  const config = {
    storage: {
      type: 'cloud-store',
      projectId: process.env.CLOUD_PROJECT
    },
    timeoutMs: 300000,
    maxRetries: 3
  };
  
  const semem = new SememServer(config);
  return await semem.handleRequest(req);
}
```