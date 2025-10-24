#!/usr/bin/env node

/**
 * Manual Documentation Ingestion CLI Tool
 *
 * Provides command-line interface for ingesting markdown documentation files
 * into the Semem semantic memory system via HTTP API.
 */

import { parseArgs } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ManualIngestCLI {
    constructor() {
        this.statistics = {
            filesFound: 0,
            filesIngested: 0,
            filesSkipped: 0,
            errors: 0
        };
        this.errors = [];
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const options = {
            host: {
                type: 'string',
                description: 'Semem MCP server host URL (default: http://localhost:4101)'
            },
            dir: {
                type: 'string',
                description: 'Root directory to crawl for .md files (default: docs/manual)'
            },
            'dry-run': {
                type: 'boolean',
                short: 'd',
                description: 'Preview files without ingesting them'
            },
            verbose: {
                type: 'boolean',
                short: 'v',
                description: 'Enable verbose logging'
            },
            help: {
                type: 'boolean',
                short: 'h',
                description: 'Show help message'
            }
        };

        try {
            const { values } = parseArgs({
                options,
                allowPositionals: false
            });

            return values;
        } catch (error) {
            console.error('Error parsing arguments:', error.message);
            this.showHelp();
            process.exit(1);
        }
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log(`
📚 Manual Documentation Ingestion Tool

USAGE:
  node IngestManual.js [OPTIONS]

EXAMPLES:
  # Preview files (dry run)
  node IngestManual.js --dry-run

  # Ingest from default directory (docs/manual)
  node IngestManual.js

  # Ingest from custom directory
  node IngestManual.js --dir docs/custom --host http://localhost:4101

  # Verbose output
  node IngestManual.js --verbose

OPTIONS:
      --host <url>         Semem MCP server host URL
                           (default: http://localhost:4101)
      --dir <path>         Root directory to crawl for .md files
                           (default: docs/manual)
  -d, --dry-run            Preview files without ingesting
  -v, --verbose            Enable verbose logging
  -h, --help               Show this help message

DESCRIPTION:
  Recursively walks a directory tree, finds all markdown (.md) files,
  and ingests them into the Semem system via HTTP POST to /tell endpoint.

  Each file is stored with metadata including filename, filepath, title
  (extracted from first # header), and ingestion timestamp.
`);
    }

    /**
     * Recursively find all markdown files in a directory
     */
    async findMarkdownFiles(dir) {
        const markdownFiles = [];

        async function walk(currentPath) {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    if (entry.isDirectory()) {
                        // Recursively walk subdirectories
                        await walk(fullPath);
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        // Add markdown files
                        markdownFiles.push(fullPath);
                    }
                }
            } catch (error) {
                console.error(`❌ Error reading directory ${currentPath}:`, error.message);
            }
        }

        await walk(dir);
        return markdownFiles.sort();
    }

    /**
     * Extract title from markdown content (first # header)
     */
    extractTitle(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^#\s+(.+)$/);
            if (match) {
                return match[1].trim();
            }
        }
        return null;
    }

    /**
     * Ingest a single file via HTTP POST to /tell endpoint
     * Includes retry logic with exponential backoff
     */
    async ingestFile(filepath, host, verbose = false) {
        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Read file content
                const content = await fs.readFile(filepath, 'utf-8');

                // Extract title and metadata
                const title = this.extractTitle(content);
                const filename = path.basename(filepath);
                const relativePath = path.relative(process.cwd(), filepath);

                // Prepare payload
                const payload = {
                    content,
                    type: 'document',
                    metadata: {
                        source: 'manual-ingestion',
                        filename,
                        filepath: relativePath,
                        format: 'markdown',
                        title: title || filename.replace('.md', ''),
                        ingestionDate: new Date().toISOString()
                    }
                };

                // Make HTTP POST request
                const url = `${host}/tell`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const result = await response.json();

                if (verbose) {
                    console.log(`   Response:`, JSON.stringify(result, null, 2));
                }

                return {
                    success: true,
                    filepath: relativePath,
                    title: title || filename,
                    result
                };

            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    if (verbose) {
                        console.log(`   ⚠️  Retry ${attempt}/${maxRetries} after ${delay}ms...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Max retries reached
                    return {
                        success: false,
                        filepath: path.relative(process.cwd(), filepath),
                        error: lastError.message
                    };
                }
            }
        }

        // Should never reach here, but just in case
        return {
            success: false,
            filepath: path.relative(process.cwd(), filepath),
            error: lastError?.message || 'Unknown error'
        };
    }

    /**
     * Execute the ingestion process
     */
    async executeIngestion(options) {
        const {
            host = 'http://localhost:4101',
            dir = 'docs/manual',
            dryRun = false,
            verbose = false
        } = options;

        try {
            console.log(`\n📚 Manual Documentation Ingestion`);
            console.log(`=================================`);
            console.log(`📁 Directory: ${dir}`);
            console.log(`📡 Host: ${host}`);
            console.log(`⚡ Mode: ${dryRun ? 'Dry Run' : 'Live Ingestion'}`);

            // Resolve directory path
            const resolvedDir = path.resolve(process.cwd(), dir);

            // Check if directory exists
            try {
                await fs.access(resolvedDir);
            } catch (error) {
                throw new Error(`Directory not found: ${resolvedDir}`);
            }

            // Find all markdown files
            console.log(`\n🔍 Discovering markdown files...`);
            const files = await this.findMarkdownFiles(resolvedDir);
            this.statistics.filesFound = files.length;

            console.log(`✅ Found ${files.length} markdown files\n`);

            if (files.length === 0) {
                console.log('No markdown files found. Exiting.');
                return;
            }

            if (dryRun) {
                // Dry run - just list files
                console.log('📋 Files to be ingested:\n');
                files.forEach((file, index) => {
                    const relativePath = path.relative(process.cwd(), file);
                    console.log(`   ${index + 1}. ${relativePath}`);
                });
                console.log(`\n✅ Dry run complete. ${files.length} files would be ingested.`);
                return;
            }

            // Live ingestion
            console.log('🚀 Starting ingestion...\n');

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const relativePath = path.relative(process.cwd(), file);
                const progress = `[${i + 1}/${files.length}]`;

                console.log(`${progress} ${relativePath}`);

                const result = await this.ingestFile(file, host, verbose);

                if (result.success) {
                    this.statistics.filesIngested++;
                    console.log(`   ✅ Ingested: ${result.title || result.filepath}`);
                } else {
                    this.statistics.errors++;
                    this.errors.push(result);
                    console.log(`   ❌ Failed: ${result.error}`);
                }
            }

            // Display summary
            console.log(`\n📊 INGESTION COMPLETE`);
            console.log(`====================`);
            console.log(`📁 Files Found: ${this.statistics.filesFound}`);
            console.log(`✅ Files Ingested: ${this.statistics.filesIngested}`);
            console.log(`❌ Errors: ${this.statistics.errors}`);

            if (this.statistics.errors > 0) {
                console.log(`\n❌ Error Details:`);
                this.errors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.filepath}: ${error.error}`);
                });
            }

            if (this.statistics.filesIngested > 0) {
                console.log(`\n✨ Successfully ingested ${this.statistics.filesIngested} documentation files into Semem!`);
            }

        } catch (error) {
            console.error(`\n💥 Ingestion failed: ${error.message}`);
            if (verbose) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    /**
     * Main execution function
     */
    async run() {
        const args = this.parseArguments();

        // Show help
        if (args.help) {
            this.showHelp();
            return;
        }

        try {
            await this.executeIngestion({
                host: args.host,
                dir: args.dir,
                dryRun: args['dry-run'] || false,
                verbose: args.verbose || false
            });

        } catch (error) {
            console.error(`\n💥 CLI execution failed: ${error.message}`);
            if (args.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }
}

// Execute CLI if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new ManualIngestCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

export default ManualIngestCLI;
