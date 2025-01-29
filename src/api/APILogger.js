// src/api/APILogger.js
import log from 'loglevel'
import { EventEmitter } from 'events'

/**
 * Enhanced logging system with entry management and event emission
 */
export default class APILogger extends EventEmitter {
    constructor(options = {}) {
        super()
        this.name = options.name || 'API'
        this.level = options.level || 'info'
        this.maxEntries = options.maxEntries || 1000
        this.logEntries = []

        this.logger = log.getLogger(this.name)
        this.logger.setLevel(this.level)

        this.setupMethods()
    }

    setupMethods() {
        const levels = ['trace', 'debug', 'info', 'warn', 'error']

        levels.forEach(level => {
            this[level] = (...args) => {
                const entry = this.createLogEntry(level, ...args)
                this.addEntry(entry)

                this.emit('log', entry)
                this.logger[level](...args)

                return entry
            }
        })
    }

    createLogEntry(level, ...args) {
        const entry = {
            timestamp: Date.now(),
            level,
            message: this.formatMessage(args),
            metadata: {
                pid: process.pid,
                hostname: process.platform
            }
        }

        const error = args.find(arg => arg instanceof Error)
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack,
                details: error.details
            }
        }

        return entry
    }

    formatMessage(args) {
        return args.map(arg => {
            if (arg instanceof Error) {
                return arg.message
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg)
                } catch {
                    return '[Circular]'
                }
            }
            return String(arg)
        }).join(' ')
    }

    addEntry(entry) {
        this.logEntries.push(entry)
        if (this.logEntries.length > this.maxEntries) {
            this.logEntries.shift()
        }
    }

    getEntries(options = {}) {
        let entries = [...this.logEntries]

        if (options.level) {
            entries = entries.filter(entry => entry.level === options.level)
        }

        if (options.since) {
            entries = entries.filter(entry =>
                entry.timestamp >= new Date(options.since).getTime()
            )
        }

        if (options.until) {
            entries = entries.filter(entry =>
                entry.timestamp <= new Date(options.until).getTime()
            )
        }

        if (options.limit) {
            entries = entries.slice(-options.limit)
        }

        return entries
    }

    clearEntries() {
        this.logEntries = []
    }

    setLevel(level) {
        this.level = level
        this.logger.setLevel(level)
    }

    getLevel() {
        return this.level
    }

    createChild(name, options = {}) {
        return new APILogger({
            ...options,
            name: `${this.name}:${name}`,
            level: options.level || this.level,
            maxEntries: options.maxEntries || this.maxEntries
        })
    }

    dispose() {
        this.clearEntries()
        this.removeAllListeners()
    }
}