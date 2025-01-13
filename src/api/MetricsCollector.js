import { EventEmitter } from 'events';
import { logger } from '../Utils.js';

export default class MetricsCollector extends EventEmitter {
    constructor(options = {}) {
        super();
        this.metrics = new Map();
        this.interval = options.interval || 60000;
        this.maxHistory = options.maxHistory || 1000;
        this.startTime = Date.now();
        this.setupCleanup();
    }

    setupCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.pruneMetrics();
        }, this.interval);
    }

    collect(name, value, labels = {}) {
        const timestamp = Date.now();
        const key = this.generateKey(name, labels);
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        
        const series = this.metrics.get(key);
        series.push({ timestamp, value });
        
        this.emit('metric', { name, value, timestamp, labels });
        
        if (series.length > this.maxHistory) {
            series.shift();
        }
    }

    generateKey(name, labels) {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return labelStr ? `${name}{${labelStr}}` : name;
    }

    getMetric(name, labels = {}) {
        const key = this.generateKey(name, labels);
        return this.metrics.get(key) || [];
    }

    getSummary(name, labels = {}) {
        const series = this.getMetric(name, labels);
        if (series.length === 0) return null;

        const values = series.map(point => point.value);
        return {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            last: values[values.length - 1]
        };
    }

    pruneMetrics() {
        const cutoff = Date.now() - this.interval;
        
        for (const [key, series] of this.metrics.entries()) {
            const filtered = series.filter(point => point.timestamp >= cutoff);
            if (filtered.length === 0) {
                this.metrics.delete(key);
            } else {
                this.metrics.set(key, filtered);
            }
        }
    }

    getSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            uptime: Date.now() - this.startTime,
            metrics: {}
        };

        for (const [key, series] of this.metrics.entries()) {
            snapshot.metrics[key] = this.getSummary(key);
        }

        return snapshot;
    }

    reset() {
        this.metrics.clear();
        this.startTime = Date.now();
    }

    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.removeAllListeners();
        this.metrics.clear();
    }
}
