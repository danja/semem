import { setupDefaultLogging } from 'LoggingConfig.js';
const loggers = await setupDefaultLogging();
const logger = loggers.system;
/**
 * Dedicated log cycling and archive management utilities
 * Handles automated log rotation, compression, and cleanup
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { LOG_DIR, CURRENT_LOG_DIR, ARCHIVE_LOG_DIR } from './LoggingConfig.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Configuration constants
const MAX_ARCHIVED_RUNS = 3;
const MAX_LOG_AGE_HOURS = 24;
const MAX_LOG_SIZE_MB = 100;
const COMPRESSION_LEVEL = 6;

/**
 * Log cycling and management utilities
 */
export class LogCyclingManager {
    constructor(options = {}) {
        this.maxArchivedRuns = options.maxArchivedRuns || MAX_ARCHIVED_RUNS;
        this.maxLogAgeHours = options.maxLogAgeHours || MAX_LOG_AGE_HOURS;
        this.maxLogSizeMB = options.maxLogSizeMB || MAX_LOG_SIZE_MB;
        this.compressionLevel = options.compressionLevel || COMPRESSION_LEVEL;
        this.dryRun = options.dryRun || false;
    }

    /**
     * Get current date string for log file identification
     */
    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Get timestamp for archive naming
     */
    getTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }

    /**
     * Get file stats safely
     */
    getFileStats(filePath) {
        try {
            return fs.statSync(filePath);
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if a file should be archived based on age or size
     */
    shouldArchiveFile(filePath) {
        const stats = this.getFileStats(filePath);
        if (!stats) return false;

        const fileName = path.basename(filePath);
        const today = this.getDateString();
        
        // Always archive files not from today
        if (!fileName.includes(today)) {
            return true;
        }

        // Archive if file is too large
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > this.maxLogSizeMB) {
            return true;
        }

        // Archive if file is too old
        const fileAgeHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (fileAgeHours > this.maxLogAgeHours) {
            return true;
        }

        return false;
    }

    /**
     * Get all log files that should be archived
     */
    getFilesToArchive() {
        try {
            const files = fs.readdirSync(CURRENT_LOG_DIR);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            return logFiles
                .map(file => path.join(CURRENT_LOG_DIR, file))
                .filter(filePath => this.shouldArchiveFile(filePath))
                .map(filePath => {
                    const stats = this.getFileStats(filePath);
                    return {
                        path: filePath,
                        name: path.basename(filePath),
                        size: stats ? stats.size : 0,
                        mtime: stats ? stats.mtime : new Date()
                    };
                })
                .sort((a, b) => a.mtime - b.mtime); // Oldest first
        } catch (error) {
            logger.error('Error getting files to archive:', error);
            return [];
        }
    }

    /**
     * Compress a file using gzip
     */
    async compressFile(sourceFile, targetFile) {
        try {
            const sourceBuffer = fs.readFileSync(sourceFile);
            const compressed = await gzip(sourceBuffer, { level: this.compressionLevel });
            
            if (!this.dryRun) {
                fs.writeFileSync(targetFile, compressed);
            }
            
            return {
                originalSize: sourceBuffer.length,
                compressedSize: compressed.length,
                compressionRatio: (1 - compressed.length / sourceBuffer.length) * 100
            };
        } catch (error) {
            throw new Error(`Failed to compress ${sourceFile}: ${error.message}`);
        }
    }

    /**
     * Decompress a gzipped file
     */
    async decompressFile(sourceFile, targetFile) {
        try {
            const compressedBuffer = fs.readFileSync(sourceFile);
            const decompressed = await gunzip(compressedBuffer);
            
            if (!this.dryRun) {
                fs.writeFileSync(targetFile, decompressed);
            }
            
            return {
                compressedSize: compressedBuffer.length,
                decompressedSize: decompressed.length
            };
        } catch (error) {
            throw new Error(`Failed to decompress ${sourceFile}: ${error.message}`);
        }
    }

    /**
     * Create new archive run directory
     */
    createArchiveRun() {
        try {
            const existingRuns = fs.readdirSync(ARCHIVE_LOG_DIR)
                .filter(dir => dir.startsWith('run-'))
                .map(dir => parseInt(dir.split('-')[1]))
                .filter(num => !isNaN(num))
                .sort((a, b) => b - a); // Descending order

            const newRunNumber = existingRuns.length > 0 ? existingRuns[0] + 1 : 1;
            const runDir = path.join(ARCHIVE_LOG_DIR, `run-${newRunNumber}`);
            
            if (!this.dryRun) {
                fs.mkdirSync(runDir, { recursive: true });
            }
            
            return {
                runNumber: newRunNumber,
                runDir: runDir,
                previousRuns: existingRuns
            };
        } catch (error) {
            throw new Error(`Failed to create archive run: ${error.message}`);
        }
    }

    /**
     * Archive files to a run directory
     */
    async archiveFiles(files, runDir) {
        const results = [];
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;
        
        for (const file of files) {
            try {
                const compressedName = `${file.name}.gz`;
                const targetPath = path.join(runDir, compressedName);
                
                const compressionResult = await this.compressFile(file.path, targetPath);
                
                if (!this.dryRun) {
                    fs.unlinkSync(file.path); // Remove original
                }
                
                results.push({
                    originalFile: file.name,
                    archivedFile: compressedName,
                    originalSize: compressionResult.originalSize,
                    compressedSize: compressionResult.compressedSize,
                    compressionRatio: compressionResult.compressionRatio,
                    success: true
                });
                
                totalOriginalSize += compressionResult.originalSize;
                totalCompressedSize += compressionResult.compressedSize;
                
            } catch (error) {
                results.push({
                    originalFile: file.name,
                    error: error.message,
                    success: false
                });
            }
        }
        
        return {
            files: results,
            summary: {
                totalFiles: files.length,
                successfulFiles: results.filter(r => r.success).length,
                failedFiles: results.filter(r => !r.success).length,
                totalOriginalSize,
                totalCompressedSize,
                totalCompressionRatio: totalOriginalSize > 0 ? 
                    (1 - totalCompressedSize / totalOriginalSize) * 100 : 0
            }
        };
    }

    /**
     * Clean up old archive runs
     */
    cleanupOldRuns() {
        try {
            const runDirs = fs.readdirSync(ARCHIVE_LOG_DIR)
                .filter(dir => dir.startsWith('run-'))
                .map(dir => ({
                    name: dir,
                    number: parseInt(dir.split('-')[1]),
                    path: path.join(ARCHIVE_LOG_DIR, dir)
                }))
                .filter(run => !isNaN(run.number))
                .sort((a, b) => b.number - a.number); // Newest first

            const runsToDelete = runDirs.slice(this.maxArchivedRuns);
            const deletedRuns = [];
            
            for (const run of runsToDelete) {
                try {
                    const runStats = this.getDirectorySize(run.path);
                    
                    if (!this.dryRun) {
                        fs.rmSync(run.path, { recursive: true, force: true });
                    }
                    
                    deletedRuns.push({
                        runName: run.name,
                        runNumber: run.number,
                        filesCount: runStats.filesCount,
                        totalSize: runStats.totalSize,
                        success: true
                    });
                } catch (error) {
                    deletedRuns.push({
                        runName: run.name,
                        runNumber: run.number,
                        error: error.message,
                        success: false
                    });
                }
            }
            
            return {
                keptRuns: runDirs.slice(0, this.maxArchivedRuns).map(r => r.name),
                deletedRuns: deletedRuns,
                summary: {
                    totalRuns: runDirs.length,
                    keptRuns: Math.min(runDirs.length, this.maxArchivedRuns),
                    deletedRuns: deletedRuns.length,
                    successfulDeletions: deletedRuns.filter(r => r.success).length,
                    failedDeletions: deletedRuns.filter(r => !r.success).length
                }
            };
        } catch (error) {
            throw new Error(`Failed to cleanup old runs: ${error.message}`);
        }
    }

    /**
     * Get directory size and file count
     */
    getDirectorySize(dirPath) {
        try {
            let totalSize = 0;
            let filesCount = 0;
            
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const file of files) {
                const filePath = path.join(dirPath, file.name);
                
                if (file.isFile()) {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    filesCount++;
                } else if (file.isDirectory()) {
                    const subDirStats = this.getDirectorySize(filePath);
                    totalSize += subDirStats.totalSize;
                    filesCount += subDirStats.filesCount;
                }
            }
            
            return { totalSize, filesCount };
        } catch (error) {
            return { totalSize: 0, filesCount: 0 };
        }
    }

    /**
     * Main cycling operation
     */
    async cycleOldLogs() {
        try {
            const startTime = Date.now();
            
            // Get files to archive
            const filesToArchive = this.getFilesToArchive();
            
            if (filesToArchive.length === 0) {
                return {
                    success: true,
                    message: 'No files need to be archived',
                    duration: Date.now() - startTime,
                    dryRun: this.dryRun
                };
            }

            // Create new archive run
            const archiveRun = this.createArchiveRun();
            
            // Archive files
            const archiveResult = await this.archiveFiles(filesToArchive, archiveRun.runDir);
            
            // Clean up old runs
            const cleanupResult = this.cleanupOldRuns();
            
            const endTime = Date.now();
            
            return {
                success: true,
                message: `Successfully cycled ${archiveResult.summary.successfulFiles} log files to run-${archiveRun.runNumber}`,
                duration: endTime - startTime,
                dryRun: this.dryRun,
                archiveRun: {
                    runNumber: archiveRun.runNumber,
                    runDir: archiveRun.runDir
                },
                archiveResult: archiveResult,
                cleanupResult: cleanupResult,
                summary: {
                    totalFilesProcessed: filesToArchive.length,
                    successfulArchives: archiveResult.summary.successfulFiles,
                    failedArchives: archiveResult.summary.failedFiles,
                    spaceSaved: archiveResult.summary.totalOriginalSize - archiveResult.summary.totalCompressedSize,
                    compressionRatio: archiveResult.summary.totalCompressionRatio,
                    runsDeleted: cleanupResult.summary.deletedRuns
                }
            };
            
        } catch (error) {
            return {
                success: false,
                message: `Failed to cycle logs: ${error.message}`,
                error: error.message,
                duration: Date.now() - Date.now(),
                dryRun: this.dryRun
            };
        }
    }

    /**
     * Get archive statistics
     */
    getArchiveStats() {
        try {
            const currentStats = this.getDirectorySize(CURRENT_LOG_DIR);
            const archiveStats = this.getDirectorySize(ARCHIVE_LOG_DIR);
            
            const runDirs = fs.readdirSync(ARCHIVE_LOG_DIR)
                .filter(dir => dir.startsWith('run-'))
                .map(dir => {
                    const runPath = path.join(ARCHIVE_LOG_DIR, dir);
                    const runStats = this.getDirectorySize(runPath);
                    return {
                        run: dir,
                        filesCount: runStats.filesCount,
                        totalSize: runStats.totalSize
                    };
                });

            return {
                current: {
                    directory: CURRENT_LOG_DIR,
                    filesCount: currentStats.filesCount,
                    totalSize: currentStats.totalSize,
                    totalSizeMB: (currentStats.totalSize / (1024 * 1024)).toFixed(2)
                },
                archive: {
                    directory: ARCHIVE_LOG_DIR,
                    totalFilesCount: archiveStats.filesCount,
                    totalSize: archiveStats.totalSize,
                    totalSizeMB: (archiveStats.totalSize / (1024 * 1024)).toFixed(2),
                    runsCount: runDirs.length,
                    runs: runDirs
                },
                configuration: {
                    maxArchivedRuns: this.maxArchivedRuns,
                    maxLogAgeHours: this.maxLogAgeHours,
                    maxLogSizeMB: this.maxLogSizeMB
                }
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }

    /**
     * Restore logs from an archive run
     */
    async restoreFromArchive(runNumber, filePattern = '*') {
        try {
            const runDir = path.join(ARCHIVE_LOG_DIR, `run-${runNumber}`);
            
            if (!fs.existsSync(runDir)) {
                throw new Error(`Archive run ${runNumber} not found`);
            }
            
            const files = fs.readdirSync(runDir)
                .filter(file => file.endsWith('.gz'))
                .filter(file => filePattern === '*' || file.includes(filePattern));
            
            const restored = [];
            
            for (const file of files) {
                const sourcePath = path.join(runDir, file);
                const originalName = file.replace('.gz', '');
                const targetPath = path.join(CURRENT_LOG_DIR, `restored-${originalName}`);
                
                try {
                    const decompressResult = await this.decompressFile(sourcePath, targetPath);
                    restored.push({
                        file: originalName,
                        success: true,
                        size: decompressResult.decompressedSize,
                        path: targetPath
                    });
                } catch (error) {
                    restored.push({
                        file: originalName,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            return {
                success: true,
                runNumber: runNumber,
                filesRestored: restored.filter(f => f.success).length,
                filesFailed: restored.filter(f => !f.success).length,
                files: restored
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export a default instance for convenience
export const defaultLogCycling = new LogCyclingManager();

// Export utility functions
export const cycleLogsNow = () => defaultLogCycling.cycleOldLogs();
export const getArchiveStats = () => defaultLogCycling.getArchiveStats();
export const restoreFromArchive = (runNumber, pattern) => 
    defaultLogCycling.restoreFromArchive(runNumber, pattern);

export default LogCyclingManager;