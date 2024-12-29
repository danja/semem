# Monitoring Documentation

## System Metrics

### Memory Usage Monitoring
```javascript
import { EventEmitter } from 'events';
import { logger } from './utils.js';

class MemoryMonitor extends EventEmitter {
    constructor(memoryManager) {
        super();
        this.memoryManager = memoryManager;
        this.stats = {
            shortTermCount: 0,
            longTermCount: 0,
            embeddingSize: 0,
            lastAccessed: new Date()
        };
    }

    collectMetrics() {
        this.stats = {
            shortTermCount: this.memoryManager.memoryStore.shortTermMemory.length,
            longTermCount: this.memoryManager.memoryStore.longTermMemory.length,
            embeddingSize: this.memoryManager.memoryStore.embeddings.reduce((acc, curr) => 
                acc + curr.byteLength, 0),
            lastAccessed: new Date()
        };
        this.emit('metrics', this.stats);
        logger.debug('Memory metrics:', this.stats);
    }
}
```

### Performance Metrics
```javascript
const performanceMetrics = {
    responseTime: new Map(),
    embeddingTime: new Map(),
    storageOperations: new Map(),
    
    track(operation, duration) {
        const metrics = this.responseTime.get(operation) || {
            count: 0,
            totalTime: 0,
            avgTime: 0
        };
        metrics.count++;
        metrics.totalTime += duration;
        metrics.avgTime = metrics.totalTime / metrics.count;
        this.responseTime.set(operation, metrics);
    }
};
```

## Integration with Monitoring Services

### Prometheus Integration
```javascript
import prometheus from 'prom-client';

const memoryGauge = new prometheus.Gauge({
    name: 'semem_memory_usage_bytes',
    help: 'Memory usage of SeMeM'
});

const responseHistogram = new prometheus.Histogram({
    name: 'semem_response_time_seconds',
    help: 'Response time of memory operations'
});
```

### Health Checks
```javascript
class HealthCheck {
    constructor(memoryManager) {
        this.memoryManager = memoryManager;
    }

    async check() {
        try {
            const status = {
                storage: await this.checkStorage(),
                embeddings: await this.checkEmbeddings(),
                llm: await this.checkLLM(),
                timestamp: new Date()
            };
            return status;
        } catch (error) {
            logger.error('Health check failed:', error);
            throw error;
        }
    }

    async checkStorage() {
        const startTime = Date.now();
        await this.memoryManager.storage.loadHistory();
        return {
            status: 'ok',
            latency: Date.now() - startTime
        };
    }
}
```

## Usage Monitoring

### Rate Limiting
```javascript
class RateLimiter {
    constructor(limit = 100, window = 60000) {
        this.limit = limit;
        this.window = window;
        this.requests = new Map();
    }

    async checkLimit(key) {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        const windowStart = now - this.window;
        
        // Clean old requests
        const recent = requests.filter(time => time > windowStart);
        this.requests.set(key, recent);
        
        return recent.length < this.limit;
    }
}
```

### Error Tracking
```javascript
class ErrorTracker {
    constructor() {
        this.errors = new Map();
    }

    track(error, context) {
        const key = error.message;
        const entry = this.errors.get(key) || {
            count: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            contexts: new Set()
        };
        
        entry.count++;
        entry.lastSeen = new Date();
        entry.contexts.add(JSON.stringify(context));
        
        this.errors.set(key, entry);
        logger.error('Error tracked:', { error, context });
    }
}
```

## Implementation Example
```javascript
import { MemoryManager } from './memoryManager.js';

const manager = new MemoryManager({...});
const monitor = new MemoryMonitor(manager);
const health = new HealthCheck(manager);
const errors = new ErrorTracker();

// Setup periodic monitoring
setInterval(() => {
    monitor.collectMetrics();
    health.check().catch(error => 
        errors.track(error, { component: 'health_check' }));
}, 60000);

// Track performance
monitor.on('metrics', async (stats) => {
    memoryGauge.set(stats.embeddingSize);
    
    try {
        const healthStatus = await health.check();
        logger.info('Health status:', healthStatus);
    } catch (error) {
        errors.track(error, { component: 'monitoring' });
    }
});
```

This monitoring system provides:
1. Memory usage tracking
2. Performance metrics
3. Health checks
4. Error tracking
5. Rate limiting
6. Prometheus integration

Q1: Would you like to see example Grafana dashboards?
Q2: Should I add alerting configuration?
Q3: Would you like to see logging best practices?
Q4: Should I include scaling metrics?