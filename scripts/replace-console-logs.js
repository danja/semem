#!/usr/bin/env node
/**
 * Console.log replacement script
 * Systematically replaces console.log statements with proper logging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Files that should not be processed
const EXCLUDED_PATTERNS = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    /logs/,
    /scripts\/replace-console-logs\.js$/,
    /test.*\.js$/,
    /spec.*\.js$/,
    /\.test\.js$/,
    /\.spec\.js$/,
    /\/_.+\.js$/,  // Exclude files beginning with underscore (to be deleted)
    /examples\//   // Exclude all files under examples directory
];

// Component mapping for different directories
const COMPONENT_MAPPING = {
    'src/servers': 'server',
    'src/api': 'api',
    'src/handlers': 'llm',
    'src/connectors': 'llm',
    'src/stores': 'storage',
    'src/services/memory': 'memory',
    'src/services/embedding': 'embedding',
    'src/services/search': 'search',
    'src/services/enhancement': 'api',
    'src/ragno': 'ragno',
    'src/zpt': 'zpt',
    'src/utils': 'system',
    'src/migration': 'system',
    'src/prompts': 'system',
    'mcp': 'mcp',
    'examples': 'system',
    'src': 'system' // fallback
};

/**
 * Console.log replacement manager
 */
class ConsoleLogReplacer {
    constructor(options = {}) {
        this.dryRun = options.dryRun || false;
        this.batchSize = options.batchSize || 5;
        this.processedFiles = [];
        this.errors = [];
        this.stats = {
            filesScanned: 0,
            filesProcessed: 0,
            replacements: 0,
            errors: 0
        };
    }

    /**
     * Find all JS files that need processing
     */
    findJSFiles() {
        console.log('Scanning for JavaScript files...');
        const files = [];
        
        const scanDirectory = (dir, relativePath = '') => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relPath = path.join(relativePath, entry.name);
                    
                    // Check exclusion patterns
                    if (EXCLUDED_PATTERNS.some(pattern => pattern.test(relPath))) {
                        continue;
                    }
                    
                    if (entry.isDirectory()) {
                        scanDirectory(fullPath, relPath);
                    } else if (entry.isFile() && entry.name.endsWith('.js')) {
                        files.push({
                            fullPath,
                            relativePath: relPath,
                            component: this.getComponentForFile(relPath)
                        });
                    }
                }
            } catch (error) {
                console.warn(`Warning: Could not scan directory ${dir}: ${error.message}`);
            }
        };
        
        scanDirectory(PROJECT_ROOT);
        
        console.log(`Found ${files.length} JavaScript files to scan`);
        return files;
    }

    /**
     * Determine component logger for a file based on its path
     */
    getComponentForFile(filePath) {
        for (const [pathPattern, component] of Object.entries(COMPONENT_MAPPING)) {
            if (filePath.startsWith(pathPattern)) {
                return component;
            }
        }
        return 'system'; // default fallback
    }

    /**
     * Analyze console usage in files
     */
    analyzeConsoleUsage(files) {
        console.log('Analyzing console.log usage...');
        const results = [];
        
        for (const file of files) {
            try {
                const content = fs.readFileSync(file.fullPath, 'utf8');
                const consoleMatches = this.findConsoleStatements(content);
                
                if (consoleMatches.length > 0) {
                    results.push({
                        ...file,
                        consoleStatements: consoleMatches,
                        hasExistingLogger: this.hasExistingLogger(content)
                    });
                }
                
                this.stats.filesScanned++;
            } catch (error) {
                console.error(`Error reading ${file.relativePath}: ${error.message}`);
                this.stats.errors++;
            }
        }
        
        // Sort by number of console statements (most first)
        results.sort((a, b) => b.consoleStatements.length - a.consoleStatements.length);
        
        console.log(`Found ${results.length} files with console statements`);
        return results;
    }

    /**
     * Find console statements in code
     */
    findConsoleStatements(content) {
        const patterns = [
            /console\.log\s*\(/g,
            /console\.error\s*\(/g,
            /console\.warn\s*\(/g,
            /console\.info\s*\(/g,
            /console\.debug\s*\(/g
        ];
        
        const matches = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const pattern of patterns) {
                pattern.lastIndex = 0; // Reset regex
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    matches.push({
                        line: i + 1,
                        column: match.index,
                        type: match[0].replace(/\s*\($/, '').replace('console.', ''),
                        content: line.trim()
                    });
                }
            }
        }
        
        return matches;
    }

    /**
     * Check if file already has logger import
     */
    hasExistingLogger(content) {
        const loggerPatterns = [
            /import.*loglevel/,
            /import.*logger.*from/i,
            /import.*Logger.*from/i,
            /import.*setupDefaultLogging/,
            /import.*configureLogging/
        ];
        
        return loggerPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Process a batch of files
     */
    processBatch(files) {
        console.log(`\nProcessing batch of ${files.length} files...`);
        const processed = [];
        
        for (const file of files) {
            try {
                const result = this.processFile(file);
                if (result.modified) {
                    processed.push(result);
                    this.stats.filesProcessed++;
                    this.stats.replacements += result.replacements;
                }
            } catch (error) {
                console.error(`Error processing ${file.relativePath}: ${error.message}`);
                this.errors.push({ file: file.relativePath, error: error.message });
                this.stats.errors++;
            }
        }
        
        return processed;
    }

    /**
     * Process a single file
     */
    processFile(file) {
        let content = fs.readFileSync(file.fullPath, 'utf8');
        let modified = false;
        let replacements = 0;
        
        // Add logger import if not present
        if (!file.hasExistingLogger) {
            const importStatement = this.generateImportStatement(file.component, file.fullPath);
            content = importStatement + '\n' + content;
            modified = true;
        }

        // Replace console statements
        const consoleReplacements = [
            { from: /console\.log\s*\(/g, to: `logger.info(` },
            { from: /console\.error\s*\(/g, to: `logger.error(` },
            { from: /console\.warn\s*\(/g, to: `logger.warn(` },
            { from: /console\.info\s*\(/g, to: `logger.info(` },
            { from: /console\.debug\s*\(/g, to: `logger.debug(` }
        ];

        for (const replacement of consoleReplacements) {
            const matches = content.match(replacement.from);
            if (matches) {
                content = content.replace(replacement.from, replacement.to);
                replacements += matches.length;
                modified = true;
            }
        }

        // Write file if modified
        if (modified && !this.dryRun) {
            fs.writeFileSync(file.fullPath, content, 'utf8');
        }

        return {
            file: file.relativePath,
            modified,
            replacements,
            hasLogger: file.hasExistingLogger || modified
        };
    }

    /**
     * Generate appropriate import statement for component
     */
    generateImportStatement(component, filePath) {
        // Calculate relative path from file location to src/utils/LoggingConfig.js
        const fileDir = path.dirname(filePath);
        const loggingConfigPath = path.join(PROJECT_ROOT, 'src/utils/LoggingConfig.js');
        const relativePath = path.relative(fileDir, loggingConfigPath);
        const importPath = relativePath.replace(/\\/g, '/'); // Ensure forward slashes for imports
        
        return `import { configureLogging } from '${importPath}';\nconst logger = configureLogging('${component}');`;
    }

    /**
     * Run the replacement process in batches
     */
    async run() {
        console.log('SEMEM Console.log Replacement Tool');
        console.log('='.repeat(40));
        
        if (this.dryRun) {
            console.log('🔍 DRY RUN MODE - No files will be modified\n');
        }

        // Find and analyze files
        const jsFiles = this.findJSFiles();
        const filesWithConsole = this.analyzeConsoleUsage(jsFiles);
        
        if (filesWithConsole.length === 0) {
            console.log('✅ No console statements found!');
            return;
        }

        // Show summary
        console.log('\n📊 ANALYSIS SUMMARY:');
        console.log(`Files with console statements: ${filesWithConsole.length}`);
        const totalStatements = filesWithConsole.reduce((sum, f) => sum + f.consoleStatements.length, 0);
        console.log(`Total console statements: ${totalStatements}`);
        
        // Show top files
        console.log('\nTop files by console usage:');
        filesWithConsole.slice(0, 10).forEach(file => {
            console.log(`  ${file.relativePath}: ${file.consoleStatements.length} statements (${file.component} logger)`);
        });

        // Process in batches
        const batches = [];
        for (let i = 0; i < filesWithConsole.length; i += this.batchSize) {
            batches.push(filesWithConsole.slice(i, i + this.batchSize));
        }

        console.log(`\nProcessing ${batches.length} batches of ${this.batchSize} files each...\n`);

        for (let i = 0; i < batches.length; i++) {
            console.log(`--- BATCH ${i + 1}/${batches.length} ---`);
            const processed = this.processBatch(batches[i]);
            
            if (processed.length > 0) {
                console.log('Modified files:');
                processed.forEach(result => {
                    console.log(`  ✅ ${result.file}: ${result.replacements} replacements`);
                });
            }

            // Pause between batches for testing (except on last batch)
            if (i < batches.length - 1 && !this.dryRun) {
                console.log('\n⏸️  Batch complete. Press Enter to continue to next batch...');
                await this.waitForInput();
            }
        }

        // Final summary
        this.printSummary();
    }

    /**
     * Wait for user input
     */
    waitForInput() {
        return new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });
    }

    /**
     * Print final summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(40));
        console.log('REPLACEMENT COMPLETE');
        console.log('='.repeat(40));
        console.log(`Files scanned: ${this.stats.filesScanned}`);
        console.log(`Files processed: ${this.stats.filesProcessed}`);
        console.log(`Console statements replaced: ${this.stats.replacements}`);
        console.log(`Errors: ${this.stats.errors}`);
        
        if (this.errors.length > 0) {
            console.log('\nErrors encountered:');
            this.errors.forEach(error => {
                console.log(`  ❌ ${error.file}: ${error.error}`);
            });
        }
        
        if (this.dryRun) {
            console.log('\n🔍 This was a dry run - no files were modified');
        } else {
            console.log('\n✅ All console.log statements have been replaced with proper logging!');
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 5
    };

    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    const replacer = new ConsoleLogReplacer(options);
    await replacer.run();
}

function printHelp() {
    console.log(`
USAGE:
  node replace-console-logs.js [options]

OPTIONS:
  --dry-run           Preview changes without modifying files
  --batch-size=N      Process N files per batch (default: 5)
  --help, -h          Show this help message

EXAMPLES:
  node replace-console-logs.js --dry-run      # Preview changes
  node replace-console-logs.js --batch-size=3 # Process 3 files per batch
  node replace-console-logs.js               # Replace all console statements

NOTES:
  - Processes files in batches to allow testing between batches
  - Automatically adds appropriate logger imports
  - Maps file paths to appropriate component loggers
  - Preserves original console statements in excluded directories
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { ConsoleLogReplacer };