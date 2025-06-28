/**
 * HTTP Stats API Demo
 * 
 * This example demonstrates the Statistics API endpoint for monitoring storage
 * and system statistics through HTTP requests. Shows real-time statistics display
 * with beautiful colored output and progress tracking.
 * 
 * Key features demonstrated:
 * - Storage statistics via HTTP GET /api/stats
 * - Real-time monitoring and auto-refresh
 * - Beautiful colored output with progress indicators
 * - Storage type detection and metrics
 * - SPARQL store statistics for ragno: and zpt: vocabularies
 * - Search index statistics
 * - Error handling and response validation
 * - Performance timing and metrics
 */

import fetch from 'node-fetch';
import logger from 'loglevel';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel('info');

// API Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:4100/api';
const API_KEY = process.env.SEMEM_API_KEY || 'your-api-key';

// Demo configuration
const REFRESH_INTERVAL = 10000; // 10 seconds
const MAX_REFRESHES = 6; // Run for 1 minute
let refreshCount = 0;

/**
 * Create HTTP headers for API requests
 */
function createHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    };
}

/**
 * Format numbers with thousands separators and units
 */
function formatNumber(num) {
    if (num === undefined || num === null) return chalk.gray('N/A');
    if (typeof num !== 'number') return chalk.gray(String(num));
    
    if (num >= 1000000) {
        return chalk.bold.cyan((num / 1000000).toFixed(1) + 'M');
    } else if (num >= 1000) {
        return chalk.bold.cyan((num / 1000).toFixed(1) + 'K');
    } else {
        return chalk.bold.cyan(num.toString());
    }
}

/**
 * Format storage size estimates
 */
function formatStorageSize(sizeStr) {
    if (!sizeStr || sizeStr === '-') return chalk.gray('Unknown');
    return chalk.bold.green(sizeStr);
}

/**
 * Format timestamps
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return chalk.gray('Never');
    return chalk.dim(new Date(timestamp).toLocaleString());
}

/**
 * Create a visual progress bar
 */
function createProgressBar(current, total, width = 20) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${chalk.bold.white(percentage + '%')}`;
}

/**
 * Display a beautiful header
 */
function displayHeader() {
    console.log('\n' + chalk.bold.blue('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('                  📊 SEMEM STATS API DEMO                 ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('                 Real-time Storage Statistics             ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Display API connection info
 */
function displayConnectionInfo() {
    console.log(chalk.bold.yellow('🔗 Connection Details:'));
    console.log(`   ${chalk.cyan('API Endpoint:')} ${chalk.white(API_BASE + '/stats')}`);
    console.log(`   ${chalk.cyan('Refresh Rate:')} ${chalk.white(REFRESH_INTERVAL / 1000 + 's')}`);
    console.log(`   ${chalk.cyan('Max Refreshes:')} ${chalk.white(MAX_REFRESHES)}`);
    console.log('');
}

/**
 * Fetch statistics from the API
 */
async function fetchStatistics() {
    const startTime = Date.now();
    
    try {
        logger.info(chalk.blue('📡 Fetching statistics...'));
        
        const response = await fetch(`${API_BASE}/stats`, {
            method: 'GET',
            headers: createHeaders()
        });

        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'API returned unsuccessful response');
        }

        logger.info(chalk.green(`✅ Statistics fetched successfully (${responseTime}ms)`));
        return { data: result.data, responseTime };

    } catch (error) {
        logger.error(chalk.red(`❌ Failed to fetch statistics: ${error.message}`));
        return { error: error.message, responseTime: Date.now() - startTime };
    }
}

/**
 * Display general statistics
 */
function displayGeneralStats(data) {
    console.log(chalk.bold.white('📋 General Information:'));
    console.log(`   ${chalk.cyan('Storage Type:')} ${data.storage?.type ? chalk.bold.green(data.storage.type.toUpperCase()) : chalk.gray('Unknown')}`);
    console.log(`   ${chalk.cyan('Last Updated:')} ${formatTimestamp(data.lastUpdated)}`);
    console.log(`   ${chalk.cyan('Timestamp:')} ${formatTimestamp(data.timestamp)}`);
    console.log('');
}

/**
 * Display SPARQL statistics
 */
function displaySPARQLStats(sparqlData) {
    if (!sparqlData) {
        console.log(chalk.yellow('⚠️  SPARQL statistics not available (using different storage backend)'));
        console.log('');
        return;
    }

    console.log(chalk.bold.white('🗄️  SPARQL Store Statistics:'));
    
    // RDF Data
    console.log(`   ${chalk.cyan('Total Triples:')} ${formatNumber(sparqlData.totalTriples)}`);
    console.log(`   ${chalk.cyan('Named Graphs:')} ${formatNumber(sparqlData.namedGraphs)}`);
    
    // Ragno Entities
    console.log(`   ${chalk.cyan('Ragno Entities:')} ${formatNumber(sparqlData.ragnoEntities)}`);
    console.log(`   ${chalk.cyan('Ragno Relationships:')} ${formatNumber(sparqlData.ragnoRelationships)}`);
    
    // Memory Items
    console.log(`   ${chalk.cyan('Memory Items:')} ${formatNumber(sparqlData.memoryItems)}`);
    console.log(`   ${chalk.cyan('With Embeddings:')} ${formatNumber(sparqlData.resourcesWithEmbeddings)}`);
    
    // ZPT Resources
    if (sparqlData.zptResources !== undefined) {
        console.log(`   ${chalk.cyan('ZPT Resources:')} ${formatNumber(sparqlData.zptResources)}`);
    }
    
    console.log('');
}

/**
 * Display search index statistics
 */
function displaySearchStats(searchData) {
    if (!searchData || !searchData.indexedItems) {
        console.log(chalk.yellow('⚠️  Search index not available or empty'));
        console.log('');
        return;
    }

    console.log(chalk.bold.white('🔍 Search Index Statistics:'));
    console.log(`   ${chalk.cyan('Indexed Items:')} ${formatNumber(searchData.indexedItems)}`);
    console.log(`   ${chalk.cyan('Vector Dimension:')} ${formatNumber(searchData.dimension)}`);
    console.log(`   ${chalk.cyan('Index Type:')} ${searchData.indexType ? chalk.bold.green(searchData.indexType.toUpperCase()) : chalk.gray('Unknown')}`);
    console.log('');
}

/**
 * Calculate and display totals
 */
function displayTotals(data) {
    let totalItems = 0;
    
    if (data.sparql) {
        totalItems += (data.sparql.ragnoEntities || 0);
        totalItems += (data.sparql.ragnoRelationships || 0);
        totalItems += (data.sparql.memoryItems || 0);
        totalItems += (data.sparql.zptResources || 0);
    }
    
    if (data.search && data.search.indexedItems) {
        // Don't double count if search items overlap with SPARQL items
        if (!data.sparql) {
            totalItems += data.search.indexedItems;
        }
    }

    console.log(chalk.bold.white('📊 Summary Totals:'));
    console.log(`   ${chalk.cyan('Total Items:')} ${formatNumber(totalItems)}`);
    
    // Estimate storage size
    const estimatedSize = totalItems * 2; // Rough estimate: 2KB per item
    let sizeStr = 'Unknown';
    if (estimatedSize > 1024 * 1024) {
        sizeStr = (estimatedSize / (1024 * 1024)).toFixed(1) + ' MB';
    } else if (estimatedSize > 1024) {
        sizeStr = (estimatedSize / 1024).toFixed(1) + ' KB';
    } else if (estimatedSize > 0) {
        sizeStr = estimatedSize + ' bytes';
    }
    
    console.log(`   ${chalk.cyan('Est. Storage:')} ${formatStorageSize(sizeStr)}`);
    console.log('');
}

/**
 * Display performance metrics
 */
function displayPerformanceMetrics(responseTime, refreshCount, maxRefreshes) {
    console.log(chalk.bold.white('⚡ Performance Metrics:'));
    console.log(`   ${chalk.cyan('Response Time:')} ${responseTime < 100 ? chalk.green(responseTime + 'ms') : responseTime < 500 ? chalk.yellow(responseTime + 'ms') : chalk.red(responseTime + 'ms')}`);
    console.log(`   ${chalk.cyan('Refresh Progress:')} ${createProgressBar(refreshCount, maxRefreshes)}`);
    console.log(`   ${chalk.cyan('Remaining:')} ${chalk.white((maxRefreshes - refreshCount) + ' updates')}`);
    console.log('');
}

/**
 * Display statistics in a beautiful format
 */
function displayStatistics(data, responseTime) {
    // Clear screen and show header
    console.clear();
    displayHeader();
    
    console.log(chalk.bold.green(`✨ Statistics Update #${refreshCount + 1}`));
    console.log(chalk.dim(`Fetched at ${new Date().toLocaleTimeString()}`));
    console.log('');
    
    // Display sections
    displayGeneralStats(data);
    displaySPARQLStats(data.sparql);
    displaySearchStats(data.search);
    displayTotals(data);
    displayPerformanceMetrics(responseTime, refreshCount + 1, MAX_REFRESHES);
    
    // Show progress bar
    const progress = createProgressBar(refreshCount + 1, MAX_REFRESHES, 40);
    console.log(chalk.bold.white('📈 Demo Progress: ') + progress);
    
    if (refreshCount < MAX_REFRESHES - 1) {
        console.log(chalk.dim(`Next update in ${REFRESH_INTERVAL / 1000} seconds...`));
    } else {
        console.log(chalk.bold.green('🎉 Demo completed! Check out the Stats tab in the web UI at http://localhost:4100'));
    }
}

/**
 * Display error in a beautiful format
 */
function displayError(error, responseTime) {
    console.clear();
    displayHeader();
    
    console.log(chalk.bold.red(`❌ Error in Update #${refreshCount + 1}`));
    console.log(chalk.dim(`Attempted at ${new Date().toLocaleTimeString()}`));
    console.log('');
    
    console.log(chalk.bold.white('🚨 Error Details:'));
    console.log(`   ${chalk.cyan('Message:')} ${chalk.red(error)}`);
    console.log(`   ${chalk.cyan('Response Time:')} ${chalk.red(responseTime + 'ms')}`);
    console.log('');
    
    console.log(chalk.bold.white('💡 Troubleshooting Tips:'));
    console.log(`   • Ensure the API server is running: ${chalk.cyan('npm run start:api')}`);
    console.log(`   • Check the API endpoint: ${chalk.cyan(API_BASE)}`);
    console.log(`   • Verify network connectivity`);
    console.log(`   • Check server logs for errors`);
    console.log('');
    
    displayPerformanceMetrics(responseTime, refreshCount + 1, MAX_REFRESHES);
    
    if (refreshCount < MAX_REFRESHES - 1) {
        console.log(chalk.yellow(`⏰ Retrying in ${REFRESH_INTERVAL / 1000} seconds...`));
    } else {
        console.log(chalk.bold.red('🛑 Demo ended due to persistent errors.'));
    }
}

/**
 * Run a single statistics update
 */
async function runStatisticsUpdate() {
    const result = await fetchStatistics();
    
    if (result.error) {
        displayError(result.error, result.responseTime);
    } else {
        displayStatistics(result.data, result.responseTime);
    }
    
    refreshCount++;
}

/**
 * Main demo function
 */
async function runStatsDemo() {
    console.clear();
    displayHeader();
    displayConnectionInfo();
    
    console.log(chalk.bold.yellow('🚀 Starting Stats API monitoring...'));
    console.log(chalk.dim('Press Ctrl+C to stop the demo\n'));
    
    // Initial update
    await runStatisticsUpdate();
    
    // Set up interval for subsequent updates
    const interval = setInterval(async () => {
        if (refreshCount >= MAX_REFRESHES) {
            clearInterval(interval);
            return;
        }
        
        await runStatisticsUpdate();
    }, REFRESH_INTERVAL);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\n👋 Demo interrupted by user'));
        console.log(chalk.bold.green('🎯 Stats API Demo Summary:'));
        console.log(`   • Updates completed: ${chalk.cyan(refreshCount)}`);
        console.log(`   • API endpoint tested: ${chalk.cyan(API_BASE + '/stats')}`);
        console.log(`   • Try the web UI: ${chalk.cyan('http://localhost:4100/#stats')}`);
        clearInterval(interval);
        process.exit(0);
    });
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runStatsDemo().catch(error => {
        logger.error(chalk.red('Demo failed:', error.message));
        process.exit(1);
    });
}

export { runStatsDemo, fetchStatistics, displayStatistics };