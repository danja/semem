import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { QueryCache } from '../../../../src/services/sparql/QueryCache.js';

describe('QueryCache', () => {
    let cache;
    let tempFile;

    beforeEach(async () => {
        cache = new QueryCache({
            maxSize: 3,
            ttl: 1000, // 1 second for testing
            checkInterval: 100, // 100ms for testing
            enableFileWatch: true
        });

        // Create temporary test file
        tempFile = path.join(process.cwd(), `test-cache-${Date.now()}.txt`);
        await fs.writeFile(tempFile, 'test content');
    });

    afterEach(async () => {
        cache.cleanup();
        
        // Clean up temp file
        try {
            await fs.unlink(tempFile);
        } catch (error) {
            // File may not exist, ignore
        }
    });

    describe('Basic Cache Operations', () => {
        it('should store and retrieve values', async () => {
            await cache.set('key1', 'value1');
            const value = await cache.get('key1');
            expect(value).toBe('value1');
        });

        it('should return null for non-existent keys', async () => {
            const value = await cache.get('nonexistent');
            expect(value).toBeNull();
        });

        it('should track cache size', async () => {
            expect(cache.size()).toBe(0);
            
            await cache.set('key1', 'value1');
            expect(cache.size()).toBe(1);
            
            await cache.set('key2', 'value2');
            expect(cache.size()).toBe(2);
        });

        it('should delete entries', async () => {
            await cache.set('key1', 'value1');
            expect(cache.size()).toBe(1);
            
            const deleted = cache.delete('key1');
            expect(deleted).toBe(true);
            expect(cache.size()).toBe(0);
            
            const notDeleted = cache.delete('nonexistent');
            expect(notDeleted).toBe(false);
        });

        it('should clear all entries', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            expect(cache.size()).toBe(2);
            
            cache.clear();
            expect(cache.size()).toBe(0);
        });

        it('should list keys', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            
            const keys = cache.keys();
            expect(keys).toContain('key1');
            expect(keys).toContain('key2');
            expect(keys.length).toBe(2);
        });
    });

    describe('TTL (Time To Live)', () => {
        it('should expire entries after TTL', async () => {
            await cache.set('key1', 'value1');
            expect(await cache.get('key1')).toBe('value1');
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const value = await cache.get('key1');
            expect(value).toBeNull();
            expect(cache.size()).toBe(0);
        });

        it('should update access time on get', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            
            // Access key1 to update its lastAccessed time
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(await cache.get('key1')).toBe('value1');
            
            // Verify that lastAccessed was updated (this affects LRU, not TTL)
            const entry = cache.cache.get('key1');
            expect(entry.lastAccessed).toBeGreaterThan(entry.timestamp);
        });
    });

    describe('LRU Eviction', () => {
        it('should evict least recently used entries when max size reached', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            await cache.set('key3', 'value3');
            expect(cache.size()).toBe(3);
            
            // This should evict key1 (least recently used)
            await cache.set('key4', 'value4');
            expect(cache.size()).toBe(3);
            expect(await cache.get('key1')).toBeNull();
            expect(await cache.get('key2')).toBe('value2');
            expect(await cache.get('key3')).toBe('value3');
            expect(await cache.get('key4')).toBe('value4');
        });

        it('should update LRU order on access', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            await cache.set('key3', 'value3');
            
            // Access key1 to make it most recently used
            await cache.get('key1');
            
            // This should evict key2 (now least recently used)
            await cache.set('key4', 'value4');
            expect(await cache.get('key1')).toBe('value1');
            expect(await cache.get('key2')).toBeNull();
            expect(await cache.get('key3')).toBe('value3');
            expect(await cache.get('key4')).toBe('value4');
        });
    });

    describe('File Watching', () => {
        it('should store and retrieve file stats', async () => {
            await cache.set('key1', 'value1', tempFile);
            
            const isModified = await cache.isFileModified(tempFile);
            expect(isModified).toBe(false);
        });

        it('should detect file modifications', async () => {
            await cache.set('key1', 'value1', tempFile);
            expect(await cache.isFileModified(tempFile)).toBe(false);
            
            // Modify the file
            await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different mtime
            await fs.writeFile(tempFile, 'modified content');
            
            expect(await cache.isFileModified(tempFile)).toBe(true);
        });

        it('should invalidate cache when file is modified', async () => {
            await cache.set('key1', 'value1', tempFile);
            expect(await cache.get('key1', tempFile)).toBe('value1');
            
            // Modify the file
            await new Promise(resolve => setTimeout(resolve, 10));
            await fs.writeFile(tempFile, 'modified content');
            
            // Should return null due to file modification
            expect(await cache.get('key1', tempFile)).toBeNull();
            expect(cache.size()).toBe(0);
        });

        it('should handle missing files gracefully', async () => {
            const nonExistentFile = path.join(process.cwd(), `nonexistent-${Date.now()}.txt`);
            
            // Mock console.warn to prevent stderr output during test
            const originalWarn = console.warn;
            console.warn = vi.fn();
            
            try {
                await cache.set('key1', 'value1', nonExistentFile);
                
                // Should return null due to missing file
                expect(await cache.get('key1', nonExistentFile)).toBeNull();
                
                // Should have logged a warning about the missing file
                expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Could not stat file'));
            } finally {
                console.warn = originalWarn;
            }
        });

        it('should clean up file stats when entries are deleted', async () => {
            await cache.set('key1', 'value1', tempFile);
            expect(cache.fileStats.has(tempFile)).toBe(true);
            
            cache.delete('key1');
            expect(cache.fileStats.has(tempFile)).toBe(false);
        });
    });

    describe('Statistics', () => {
        it('should provide cache statistics', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            
            const stats = cache.getStats();
            expect(stats).toHaveProperty('size', 2);
            expect(stats).toHaveProperty('maxSize', 3);
            expect(stats).toHaveProperty('totalSizeBytes');
            expect(stats).toHaveProperty('expiredCount');
            expect(stats).toHaveProperty('fileWatchEnabled', true);
            expect(stats).toHaveProperty('ttlMs', 1000);
            expect(stats.totalSizeBytes).toBeGreaterThan(0);
        });

        it('should count expired entries in stats', async () => {
            await cache.set('key1', 'value1');
            
            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const stats = cache.getStats();
            expect(stats.expiredCount).toBe(1);
        });
    });

    describe('Configuration Options', () => {
        it('should use default options', () => {
            const defaultCache = new QueryCache();
            const stats = defaultCache.getStats();
            
            expect(stats.maxSize).toBe(100);
            expect(stats.ttlMs).toBe(3600000); // 1 hour
            expect(stats.fileWatchEnabled).toBe(true);
            
            defaultCache.cleanup();
        });

        it('should respect custom options', () => {
            const customCache = new QueryCache({
                maxSize: 50,
                ttl: 2000,
                enableFileWatch: false
            });
            
            const stats = customCache.getStats();
            expect(stats.maxSize).toBe(50);
            expect(stats.ttlMs).toBe(2000);
            expect(stats.fileWatchEnabled).toBe(false);
            
            customCache.cleanup();
        });

        it('should disable file watching when configured', async () => {
            const noWatchCache = new QueryCache({
                enableFileWatch: false
            });
            
            await noWatchCache.set('key1', 'value1', tempFile);
            
            // Modify file
            await new Promise(resolve => setTimeout(resolve, 10));
            await fs.writeFile(tempFile, 'modified content');
            
            // Should still return value since file watching is disabled
            expect(await noWatchCache.get('key1', tempFile)).toBe('value1');
            
            noWatchCache.cleanup();
        });
    });

    describe('Cleanup', () => {
        it('should stop file watcher on cleanup', () => {
            const watcherCache = new QueryCache();
            expect(watcherCache.watcherInterval).toBeDefined();
            
            watcherCache.cleanup();
            expect(watcherCache.watcherInterval).toBeUndefined();
        });

        it('should clear cache on cleanup', async () => {
            await cache.set('key1', 'value1');
            expect(cache.size()).toBe(1);
            
            cache.cleanup();
            expect(cache.size()).toBe(0);
        });
    });
});