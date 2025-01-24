import logger from 'loglevel'

export default class CacheManager {
    constructor({ maxSize = 1000, ttl = 3600000 }) {
        this.maxSize = maxSize
        this.ttl = ttl
        this.cache = new Map()
        this.timestamps = new Map()

        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            ttl / 2
        )
    }

    get(key) {
        const value = this.cache.get(key)
        if (value) {
            this.timestamps.set(key, Date.now())
            return value
        }
        return null
    }

    set(key, value) {
        this.cache.set(key, value)
        this.timestamps.set(key, Date.now())

        if (this.cache.size > this.maxSize) {
            this.cleanup()
        }
    }

    cleanup() {
        const now = Date.now()
        let removed = 0

        // Remove expired entries
        for (const [key, timestamp] of this.timestamps.entries()) {
            if (now - timestamp > this.ttl) {
                this.cache.delete(key)
                this.timestamps.delete(key)
                removed++
            }
        }

        // Remove oldest entries if still over size
        while (this.cache.size > this.maxSize) {
            const oldestKey = this.getOldestKey()
            if (oldestKey) {
                this.cache.delete(oldestKey)
                this.timestamps.delete(oldestKey)
                removed++
            }
        }

        if (removed > 0) {
            logger.debug(`Cache cleanup: removed ${removed} entries`)
        }
    }

    getOldestKey() {
        let oldestKey = null
        let oldestTime = Infinity

        for (const [key, timestamp] of this.timestamps.entries()) {
            if (timestamp < oldestTime) {
                oldestTime = timestamp
                oldestKey = key
            }
        }

        return oldestKey
    }

    clear() {
        this.cache.clear()
        this.timestamps.clear()
    }

    dispose() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }
        this.clear()
    }
}