import log from 'loglevel';
import { EventEmitter } from 'events';

export default class APILogger extends EventEmitter {
    constructor(options = {}) {
        super();
        this.name = options.name || 'API';
        this.level = options.level || 'info';
        this.maxEntries = options.maxEntries || 1000;
        this.logEntries = [];
        
        this.logger = log.getLogger(this.name);
        this.logger.setLevel(this.level);
        
        this.setupMethods();
    }

    setupMethods() {
        const levels = ['trace', 'debug', 'info', 'warn', 'error'];
        
        levels.forEach(level => {
            this[level] = (...args) => {
                const entry = this.createLogEntry(level, ...args);
                this.logEntries.push(entry);
                
                if (this.logEntries.length > this.maxEntries) {
                    this.logEntries.shift();
                }
                
                this.emit('log', entry);
                this.logger[level](...args);
                
                return entry;
            };
        });
    }

    createLogEntry(level, ...args) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            metadata: {
                pid: process.pid,
                hostname: require('os').hostname()
            }
        };

        // Extract error details if present
        const error = args.find(arg => arg instanceof Error);
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }

        return entry;
    }

    getEntries(options = {}) {
        let entries = [...this.logEntries];
        
        if (options.level) {
            entries = entries.filter(entry => entry.level === options.level);
        }
        
        if (options.since) {
            entries = entries.filter(entry => 
                new Date(entry.timestamp) >= new Date(options.since)
            );
        }
        
        if (options.until) {
            entries = entries.filter(entry => 
                new Date(entry.timestamp) <= new Date(options.until)
            );
        }
        
        if (options.limit) {
            entries = entries.slice(-options.limit);
        }
        
        return entries;
    }

    clearEntries() {
        this.logEntries = [];
    }

    setLevel(level) {
        this.level = level;
        this.logger.setLevel(level);
    }

    getLevel() {
        return this.level;
    }

    createChild(name, options = {}) {
        return new APILogger({
            ...options,
            name: `${this.name}:${name}`,
            level: options.level || this.level
        });
    }

    dispose() {
        this.removeAllListeners();
        this.clearEntries();
    }
}
