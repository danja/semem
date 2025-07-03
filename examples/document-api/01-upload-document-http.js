#!/usr/bin/env node

/**
 * Document API Showcase Stage 1: Upload Document via HTTP
 * 
 * This script demonstrates uploading a PDF document using the HTTP API
 * instead of direct function calls. It showcases the complete upload pipeline:
 * upload → convert → chunk → ingest.
 * 
 * Usage: 
 *   From project root: node examples/document-api/01-upload-document-http.js
 *   From examples/document-api: node 01-upload-document-http.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import chalk from 'chalk';
import log from 'loglevel';

// Configure logging
log.setLevel('info');
const logger = log.getLogger('DocumentAPI-Upload');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4100/api';
const API_KEY = process.env.API_KEY || 'your-api-key'; // Match .env file

// Get project paths - handle both direct execution and running from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// If running from project root, __dirname will be the actual script directory
const projectRoot = __dirname.endsWith('examples/document-api') ? 
    path.resolve(__dirname, '../..') : 
    process.cwd();
const documentPath = path.join(projectRoot, 'docs/paper/references/nodeRAG.pdf');

/**
 * Display styled header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + chalk.bold.white('           📄 DOCUMENT API SHOWCASE: HTTP UPLOAD             ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + chalk.gray('        Upload nodeRAG.pdf via HTTP API endpoints            ') + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Check if API server is running
 */
async function checkAPIServer() {
    logger.info(chalk.blue('🔍 Checking API server availability...'));
    
    try {
        const response = await fetch(`${API_BASE_URL}/services`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });
        
        if (response.ok) {
            const services = await response.json();
            const documentAPI = services.services?.basic?.document;
            
            if (documentAPI && documentAPI.status === 'healthy') {
                logger.info(chalk.green('✅ Document API is available and healthy'));
                logger.info(chalk.gray(`   Status: ${documentAPI.status}`));
                logger.info(chalk.gray(`   Description: ${documentAPI.description}`));
                return true;
            } else {
                logger.error(chalk.red('❌ Document API is not available'));
                logger.info(chalk.yellow('💡 Start the API server with: npm run start:api'));
                return false;
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        logger.error(chalk.red('❌ Failed to connect to API server:'), error.message);
        logger.info(chalk.yellow('💡 Make sure the API server is running on port 4100'));
        return false;
    }
}

/**
 * Check if document exists
 */
async function checkDocument() {
    logger.info(chalk.blue('📋 Checking source document...'));
    
    try {
        const stats = await fs.promises.stat(documentPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        logger.info(chalk.green('✅ Document found:'));
        logger.info(chalk.gray(`   Path: ${documentPath}`));
        logger.info(chalk.gray(`   Size: ${sizeInMB} MB`));
        logger.info(chalk.gray(`   Type: PDF`));
        
        return true;
    } catch (error) {
        logger.error(chalk.red('❌ Document not found:'), documentPath);
        return false;
    }
}

/**
 * Upload document via HTTP API
 */
async function uploadDocument() {
    logger.info(chalk.blue('🚀 Starting document upload via HTTP API...'));
    
    try {
        // Create form data with file
        const form = new FormData();
        const fileStream = fs.createReadStream(documentPath);
        form.append('file', fileStream, {
            filename: 'nodeRAG.pdf',
            contentType: 'application/pdf'
        });
        
        // Add processing options - use simpler chunking for large documents
        form.append('options', JSON.stringify({
            convert: true,
            chunk: true,
            ingest: true, // Enable ingestion now that chunking works
            namespace: 'http://example.org/noderag/',
            chunkingOptions: {
                strategy: 'simple', // Use simpler chunking strategy
                maxChunkSize: 2000,  // Smaller chunks for faster processing
                overlap: 100
            }
        }));
        
        logger.info(chalk.yellow('📤 Uploading nodeRAG.pdf with full processing pipeline...'));
        logger.info(chalk.gray('   Options: convert ✓, chunk ✓ (simple strategy), ingest ✓'));
        logger.info(chalk.gray('   Namespace: http://example.org/noderag/'));
        logger.info(chalk.gray('   Strategy: Complete processing with optimized chunking'));
        logger.info(chalk.gray('   ⏳ This may take several minutes for large documents...'));
        
        const startTime = Date.now();
        
        // Add progress tracking
        const progressInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            logger.info(chalk.cyan(`   ⏱️  Processing... ${elapsed}s elapsed`));
        }, 10000); // Update every 10 seconds
        
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            logger.error(chalk.red('⏰ Upload timed out after 5 minutes'));
        }, 300000); // 5 minute timeout
        
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY
            },
            body: form,
            signal: controller.signal
        });
        
        clearInterval(progressInterval);
        clearTimeout(timeout);
        
        const duration = Date.now() - startTime;
        
        if (response.ok) {
            const result = await response.json();
            
            logger.info(chalk.green('✅ Document upload completed successfully!'));
            logger.info(chalk.gray(`   Duration: ${duration}ms`));
            logger.info(chalk.gray(`   Document ID: ${result.documentId}`));
            logger.info(chalk.gray(`   Filename: ${result.filename}`));
            logger.info(chalk.gray(`   Status: ${result.status}`));
            
            // Display conversion results
            if (result.conversion) {
                logger.info(chalk.cyan('📝 Conversion Results:'));
                logger.info(chalk.gray(`   Content Length: ${result.conversion.contentLength} characters`));
                logger.info(chalk.gray(`   Format: ${result.conversion.format}`));
                
                if (result.conversion.metadata) {
                    logger.info(chalk.gray(`   Metadata: ${Object.keys(result.conversion.metadata).length} fields`));
                }
            }
            
            // Display chunking results
            if (result.chunking) {
                logger.info(chalk.cyan('🧩 Chunking Results:'));
                logger.info(chalk.gray(`   Chunks Created: ${result.chunking.chunkCount}`));
                logger.info(chalk.gray(`   Average Chunk Size: ${Math.round(result.conversion.contentLength / result.chunking.chunkCount)} characters`));
            }
            
            // Display ingestion results
            if (result.ingestion) {
                logger.info(chalk.cyan('🗄️  Ingestion Results:'));
                logger.info(chalk.gray(`   Chunks Ingested: ${result.ingestion.chunksIngested}`));
                logger.info(chalk.gray(`   Triples Created: ${result.ingestion.triplesCreated}`));
                logger.info(chalk.gray(`   Graph URI: ${result.ingestion.graphUri}`));
            }
            
            return result;
        } else {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.error(chalk.red('❌ Document upload timed out after 5 minutes'));
            logger.info(chalk.yellow('💡 The server may still be processing. Check document list later.'));
        } else {
            logger.error(chalk.red('❌ Document upload failed:'), error.message);
        }
        throw error;
    }
}

/**
 * List processed documents
 */
async function listDocuments() {
    logger.info(chalk.blue('📋 Retrieving document list via HTTP API...'));
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents?limit=10&status=ingested`, {
            headers: {
                'X-API-Key': API_KEY
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            logger.info(chalk.green('✅ Document list retrieved:'));
            logger.info(chalk.gray(`   Total Documents: ${result.pagination.total}`));
            logger.info(chalk.gray(`   Showing: ${result.documents.length} documents`));
            
            result.documents.forEach((doc, index) => {
                logger.info(chalk.cyan(`   ${index + 1}. ${doc.filename}`));
                logger.info(chalk.gray(`      ID: ${doc.id}`));
                logger.info(chalk.gray(`      Status: ${doc.status}`));
                logger.info(chalk.gray(`      Operations: ${doc.operations?.join(', ') || 'N/A'}`));
                logger.info(chalk.gray(`      Uploaded: ${new Date(doc.uploadedAt).toLocaleString()}`));
            });
            
            return result;
        } else {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }
    } catch (error) {
        logger.error(chalk.red('❌ Failed to list documents:'), error.message);
        throw error;
    }
}

/**
 * Main execution function
 */
async function main() {
    displayHeader();
    
    try {
        // Pre-flight checks
        logger.info(chalk.bold.blue('🔄 Running pre-flight checks...'));
        
        const serverOK = await checkAPIServer();
        if (!serverOK) {
            process.exit(1);
        }
        
        const documentOK = await checkDocument();
        if (!documentOK) {
            process.exit(1);
        }
        
        console.log('');
        logger.info(chalk.bold.green('✅ Pre-flight checks complete. Starting upload...'));
        console.log('');
        
        // Upload document
        const uploadResult = await uploadDocument();
        console.log('');
        
        // List documents to confirm
        await listDocuments();
        console.log('');
        
        logger.info(chalk.bold.green('🎉 Document API showcase completed successfully!'));
        logger.info(chalk.yellow('💡 Next: Run 02-query-noderag-http.js to query the ingested content'));
        
    } catch (error) {
        console.log('');
        logger.error(chalk.bold.red('💥 Showcase failed:'), error.message);
        process.exit(1);
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        logger.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    });
}

export { main as uploadDocumentHTTP };