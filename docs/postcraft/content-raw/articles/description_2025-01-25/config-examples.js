// config/default.js - Default Configuration
export default {
    server: {
        port: 3000,
        host: 'localhost',
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }
    },
    auth: {
        type: 'basic',
        credentials: {
            username: process.env.API_USER || 'admin',
            password: process.env.API_PASS || 'admin123'
        },
        rateLimits: {
            window: 15 * 60 * 1000, // 15 minutes
            max: 100
        }
    },
    websocket: {
        path: '/ws',
        queue: {
            maxSize: 1000,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        },
        pingInterval: 30000,
        pingTimeout: 5000
    },
    storage: {
        type: 'sparql',
        endpoint: process.env.SPARQL_ENDPOINT || 'http://localhost:4030',
        graphName: process.env.GRAPH_NAME || 'http://example.org/mcp/memory',
        auth: {
            username: process.env.SPARQL_USER || 'admin',
            password: process.env.SPARQL_PASS || 'admin123'
        }
    },
    metrics: {
        enabled: true,
        interval: 60000,
        retention: 7 * 24 * 60 * 60 * 1000, // 7 days
        openTelemetry: {
            endpoint: process.env.OTEL_ENDPOINT,
            serviceName: 'semem-api'
        }
    }
};

// Example Usage:
import Config from './Config.js';
import HTTPServer from './api/http/server/HTTPServer.js';

async function startServer() {
    // Production configuration
    const config = new Config({
        server: {
            port: process.env.PORT || 3000,
            host: '0.0.0.0',
            cors: {
                origin: ['https://api.example.com'],
                credentials: true
            }
        },
        auth: {
            type: 'basic',
            credentials: {
                username: process.env.API_USER,
                password: process.env.API_PASS
            },
            rateLimits: {
                window: 5 * 60 * 1000, // 5 minutes
                max: 50 // Stricter limits
            }
        },
        websocket: {
            queue: {
                maxSize: 5000, // Larger queue
                maxAge: 12 * 60 * 60 * 1000 // 12 hours
            }
        }
    });

    const server = new HTTPServer(config);
    await server.initialize();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM, starting graceful shutdown...');
        await server.shutdown();
        process.exit(0);
    });
}

// Docker Compose Example:
/*
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_USER=admin
      - API_PASS=${API_PASSWORD}
      - SPARQL_ENDPOINT=http://fuseki:3030
      - GRAPH_NAME=http://example.org/mcp/memory
      - SPARQL_USER=admin
      - SPARQL_PASS=${SPARQL_PASSWORD}
      - OTEL_ENDPOINT=http://collector:4318
    depends_on:
      - fuseki
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
*/

// Environment Variables (.env):
/*
# API Authentication
API_USER=admin
API_PASS=secure_password_here

# SPARQL Connection
SPARQL_ENDPOINT=http://localhost:4030
GRAPH_NAME=http://example.org/mcp/memory
SPARQL_USER=admin
SPARQL_PASS=sparql_password_here

# Monitoring
OTEL_ENDPOINT=http://localhost:4318
*/