import fs from 'fs/promises';
import path from 'path';

export class QueryCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.fileStats = new Map();
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 3600000; // 1 hour default TTL
        this.checkInterval = options.checkInterval || 60000; // 1 minute check interval
        this.enableFileWatch = options.enableFileWatch !== false;
        
        if (this.enableFileWatch) {
            this.startFileWatcher();
        }
    }

    async get(key, filePath) {
        const cacheEntry = this.cache.get(key);
        
        if (!cacheEntry) {
            return null;
        }

        // Check TTL
        if (Date.now() - cacheEntry.timestamp > this.ttl) {
            this.cache.delete(key);
            if (cacheEntry.filePath) {
                this.fileStats.delete(cacheEntry.filePath);
            }
            return null;
        }

        // Check file modification if path provided
        if (filePath && this.enableFileWatch) {
            const isModified = await this.isFileModified(filePath);
            if (isModified) {
                this.cache.delete(key);
                if (filePath) {
                    this.fileStats.delete(filePath);
                }
                return null;
            }
        }

        // Update access time for LRU
        cacheEntry.lastAccessed = Date.now();
        return cacheEntry.value;
    }

    async set(key, value, filePath) {
        const cacheEntry = {
            value,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            filePath
        };

        // Enforce max size with LRU eviction (check after updating/adding)
        if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, cacheEntry);

        // Store file stats if path provided
        if (filePath) {
            try {
                const stats = await fs.stat(filePath);
                this.fileStats.set(filePath, {
                    mtime: stats.mtime.getTime(),
                    size: stats.size
                });
            } catch (error) {
                console.warn(`Could not stat file ${filePath}: ${error.message}`);
            }
        }
    }

    async isFileModified(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const cachedStats = this.fileStats.get(filePath);
            
            if (!cachedStats) {
                return true;
            }

            return stats.mtime.getTime() !== cachedStats.mtime || 
                   stats.size !== cachedStats.size;
        } catch (error) {
            // If we can't stat the file, assume it's modified
            return true;
        }
    }

    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            const entry = this.cache.get(oldestKey);
            this.cache.delete(oldestKey);
            if (entry.filePath) {
                this.fileStats.delete(entry.filePath);
            }
        }
    }

    startFileWatcher() {
        this.watcherInterval = setInterval(() => {
            this.checkFileModifications();
        }, this.checkInterval);
    }

    async checkFileModifications() {
        const modifiedFiles = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.filePath) {
                const isModified = await this.isFileModified(entry.filePath);
                if (isModified) {
                    modifiedFiles.push({ key, filePath: entry.filePath });
                }
            }
        }

        // Remove modified files from cache
        for (const { key, filePath } of modifiedFiles) {
            this.cache.delete(key);
            this.fileStats.delete(filePath);
        }

        if (modifiedFiles.length > 0) {
            console.log(`QueryCache: Invalidated ${modifiedFiles.length} cached queries due to file modifications`);
        }
    }

    clear() {
        this.cache.clear();
        this.fileStats.clear();
    }

    delete(key) {
        const entry = this.cache.get(key);
        if (entry && entry.filePath) {
            this.fileStats.delete(entry.filePath);
        }
        return this.cache.delete(key);
    }

    size() {
        return this.cache.size;
    }

    keys() {
        return Array.from(this.cache.keys());
    }

    getStats() {
        const now = Date.now();
        let totalSize = 0;
        let expiredCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            totalSize += JSON.stringify(entry.value).length;
            if (now - entry.timestamp > this.ttl) {
                expiredCount++;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalSizeBytes: totalSize,
            expiredCount,
            fileWatchEnabled: this.enableFileWatch,
            ttlMs: this.ttl
        };
    }

    cleanup() {
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = undefined;
        }
        this.clear();
    }
}

export default QueryCache;