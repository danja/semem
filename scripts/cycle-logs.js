#!/usr/bin/env node
/**
 * Manual log cycling script
 * Allows manual execution of log cycling operations
 */

import { LogCyclingManager } from '../src/utils/LogCycling.js';

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    console.log('SEMEM Log Cycling Utility');
    console.log('='.repeat(40));
    
    const manager = new LogCyclingManager({
        dryRun: args.includes('--dry-run')
    });
    
    if (args.includes('--dry-run')) {
        console.log('🔍 DRY RUN MODE - No files will be modified\n');
    }
    
    switch (command) {
        case 'cycle':
            await cycleCommand(manager);
            break;
        case 'stats':
            await statsCommand(manager);
            break;
        case 'restore':
            await restoreCommand(manager, args[1], args[2]);
            break;
        case 'help':
        case '--help':
        case '-h':
            printHelp();
            break;
        default:
            console.log('Unknown command. Use --help for usage information.');
            process.exit(1);
    }
}

async function cycleCommand(manager) {
    console.log('Starting log cycling process...\n');
    
    try {
        const result = await manager.cycleOldLogs();
        
        if (result.success) {
            console.log('✅ Log cycling completed successfully!');
            console.log(`Duration: ${result.duration}ms`);
            console.log(`Message: ${result.message}`);
            
            if (result.summary) {
                const s = result.summary;
                console.log('\nSummary:');
                console.log(`- Files processed: ${s.totalFilesProcessed}`);
                console.log(`- Successfully archived: ${s.successfulArchives}`);
                console.log(`- Failed archives: ${s.failedArchives}`);
                console.log(`- Space saved: ${(s.spaceSaved / (1024*1024)).toFixed(2)} MB`);
                console.log(`- Compression ratio: ${s.compressionRatio.toFixed(1)}%`);
                console.log(`- Runs deleted: ${s.runsDeleted}`);
            }
            
            if (result.archiveResult && result.archiveResult.files.length > 0) {
                console.log('\nArchived files:');
                result.archiveResult.files.forEach(file => {
                    const status = file.success ? '✅' : '❌';
                    const ratio = file.compressionRatio ? ` (${file.compressionRatio.toFixed(1)}% compression)` : '';
                    console.log(`  ${status} ${file.originalFile}${ratio}`);
                });
            }
        } else {
            console.error('❌ Log cycling failed:');
            console.error(result.message);
            if (result.error) {
                console.error('Error:', result.error);
            }
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Log cycling failed with exception:');
        console.error(error.message);
        process.exit(1);
    }
}

async function statsCommand(manager) {
    console.log('Gathering log statistics...\n');
    
    try {
        const stats = manager.getArchiveStats();
        
        if (stats.error) {
            console.error('❌ Failed to get stats:', stats.error);
            process.exit(1);
        }
        
        console.log('📊 LOG STATISTICS');
        console.log('='.repeat(30));
        
        // Current logs
        console.log('\nCurrent Logs:');
        console.log(`  Directory: ${stats.current.directory}`);
        console.log(`  Files: ${stats.current.filesCount}`);
        console.log(`  Total Size: ${stats.current.totalSizeMB} MB`);
        
        // Archive logs
        console.log('\nArchived Logs:');
        console.log(`  Directory: ${stats.archive.directory}`);
        console.log(`  Total Files: ${stats.archive.totalFilesCount}`);
        console.log(`  Total Size: ${stats.archive.totalSizeMB} MB`);
        console.log(`  Archive Runs: ${stats.archive.runsCount}`);
        
        if (stats.archive.runs.length > 0) {
            console.log('\nArchive Run Details:');
            stats.archive.runs.forEach(run => {
                console.log(`  📁 ${run.run}: ${run.filesCount} files, ${(run.totalSize / (1024*1024)).toFixed(2)} MB`);
            });
        }
        
        // Configuration
        console.log('\nConfiguration:');
        console.log(`  Max Archived Runs: ${stats.configuration.maxArchivedRuns}`);
        console.log(`  Max Log Age: ${stats.configuration.maxLogAgeHours} hours`);
        console.log(`  Max Log Size: ${stats.configuration.maxLogSizeMB} MB`);
        
    } catch (error) {
        console.error('❌ Failed to get statistics:');
        console.error(error.message);
        process.exit(1);
    }
}

async function restoreCommand(manager, runNumber, pattern = '*') {
    if (!runNumber) {
        console.error('❌ Run number is required for restore command');
        console.log('Usage: node cycle-logs.js restore <run-number> [file-pattern]');
        process.exit(1);
    }
    
    console.log(`Restoring files from run ${runNumber}...`);
    if (pattern !== '*') {
        console.log(`File pattern: ${pattern}`);
    }
    console.log();
    
    try {
        const result = await manager.restoreFromArchive(parseInt(runNumber), pattern);
        
        if (result.success) {
            console.log('✅ Restore completed successfully!');
            console.log(`Files restored: ${result.filesRestored}`);
            console.log(`Files failed: ${result.filesFailed}`);
            
            if (result.files.length > 0) {
                console.log('\nRestored files:');
                result.files.forEach(file => {
                    const status = file.success ? '✅' : '❌';
                    const size = file.size ? ` (${(file.size / 1024).toFixed(1)} KB)` : '';
                    const error = !file.success && file.error ? ` - ${file.error}` : '';
                    console.log(`  ${status} ${file.file}${size}${error}`);
                });
            }
        } else {
            console.error('❌ Restore failed:', result.error);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Restore failed with exception:');
        console.error(error.message);
        process.exit(1);
    }
}

function printHelp() {
    console.log(`
USAGE:
  node cycle-logs.js <command> [options]

COMMANDS:
  cycle           Cycle old log files to archive
  stats           Show log statistics and archive information
  restore <run> [pattern]  Restore files from archived run
  help            Show this help message

OPTIONS:
  --dry-run       Perform operation without making changes (cycle only)

EXAMPLES:
  node cycle-logs.js cycle                    # Cycle old logs
  node cycle-logs.js cycle --dry-run          # Preview cycling without changes
  node cycle-logs.js stats                    # Show current log statistics
  node cycle-logs.js restore 1                # Restore all files from run-1
  node cycle-logs.js restore 2 memory-manager # Restore memory-manager logs from run-2

NOTES:
  - Log cycling automatically happens on application startup
  - Only the last ${new LogCyclingManager().maxArchivedRuns} archive runs are kept
  - Archived files are compressed with gzip
  - Restored files are prefixed with 'restored-'
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}