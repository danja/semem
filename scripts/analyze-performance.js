import { setupDefaultLogging } from '../src/utils/LoggingConfig.js';
const loggers = await setupDefaultLogging();
const logger = loggers.system;
#!/usr/bin/env node
/**
 * Performance log analysis script
 * Analyzes ask/tell operation timing data from structured logs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CURRENT_LOG_DIR, ARCHIVE_LOG_DIR } from '../src/utils/LoggingConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Analysis configuration
const CONFIG = {
    performanceThresholds: {
        ask: { good: 1000, warn: 3000, error: 5000 },
        tell: { good: 800, warn: 2000, error: 3000 },
        embedding: { good: 1000, warn: 2500, error: 4000 },
        llm_call: { good: 2000, warn: 5000, error: 10000 },
        sparql_query: { good: 300, warn: 800, error: 2000 },
        sparql_update: { good: 500, warn: 1200, error: 3000 }
    },
    analysisOutputDir: path.join(__dirname, '../logs/analysis'),
    maxLogFiles: 10,
    percentiles: [50, 75, 90, 95, 99]
};

/**
 * Performance data analyzer
 */
class PerformanceAnalyzer {
    constructor() {
        this.performanceData = [];
        this.operationStats = {};
        this.timeSeriesData = {};
        this.errorPatterns = [];
    }

    /**
     * Read and parse log files
     */
    async loadLogData(logDirs = [CURRENT_LOG_DIR]) {
        logger.info('Loading performance data from logs...');
        
        for (const logDir of logDirs) {
            if (!fs.existsSync(logDir)) {
                logger.warn(`Log directory not found: ${logDir}`);
                continue;
            }

            const files = fs.readdirSync(logDir)
                .filter(file => file.includes('performance') && file.endsWith('.log'))
                .sort()
                .slice(-CONFIG.maxLogFiles); // Get latest files

            logger.info(`Processing ${files.length} performance log files from ${logDir}`);

            for (const file of files) {
                try {
                    await this.parseLogFile(path.join(logDir, file));
                } catch (error) {
                    logger.error(`Error parsing ${file}:`, error.message);
                }
            }
        }

        logger.info(`Loaded ${this.performanceData.length} performance entries`);
        return this.performanceData.length;
    }

    /**
     * Parse a single log file
     */
    async parseLogFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                
                if (logEntry.type === 'performance' && logEntry.duration !== undefined) {
                    this.performanceData.push(logEntry);
                    this.processPerformanceEntry(logEntry);
                }
            } catch (error) {
                // Skip invalid JSON lines
                continue;
            }
        }
    }

    /**
     * Process individual performance entry
     */
    processPerformanceEntry(entry) {
        const operationType = entry.operationType || 'unknown';
        const duration = entry.duration || 0;
        const timestamp = new Date(entry.timestamp || entry['@timestamp']).getTime();

        // Initialize operation stats
        if (!this.operationStats[operationType]) {
            this.operationStats[operationType] = {
                count: 0,
                totalDuration: 0,
                durations: [],
                errors: 0,
                phases: {},
                memoryUsage: []
            };
        }

        const stats = this.operationStats[operationType];
        stats.count++;
        stats.totalDuration += duration;
        stats.durations.push(duration);

        // Track memory usage if available
        if (entry.memoryDelta) {
            stats.memoryUsage.push(entry.memoryDelta.heapUsed || 0);
        }

        // Track phase information
        if (entry.phases && Array.isArray(entry.phases)) {
            for (const phase of entry.phases) {
                const phaseName = phase.operationName || 'unknown_phase';
                if (!stats.phases[phaseName]) {
                    stats.phases[phaseName] = {
                        count: 0,
                        totalDuration: 0,
                        durations: []
                    };
                }
                stats.phases[phaseName].count++;
                stats.phases[phaseName].totalDuration += (phase.duration || 0);
                stats.phases[phaseName].durations.push(phase.duration || 0);
            }
        }

        // Track errors
        if (entry.metadata?.success === false || entry.error) {
            stats.errors++;
            this.errorPatterns.push({
                operationType,
                timestamp,
                duration,
                error: entry.error || entry.metadata?.error,
                phases: entry.phases?.map(p => p.operationName) || []
            });
        }

        // Time series data (by hour)
        const hourKey = new Date(timestamp).toISOString().substring(0, 13); // YYYY-MM-DDTHH
        if (!this.timeSeriesData[hourKey]) {
            this.timeSeriesData[hourKey] = {};
        }
        if (!this.timeSeriesData[hourKey][operationType]) {
            this.timeSeriesData[hourKey][operationType] = {
                count: 0,
                totalDuration: 0,
                errors: 0
            };
        }
        
        const hourStats = this.timeSeriesData[hourKey][operationType];
        hourStats.count++;
        hourStats.totalDuration += duration;
        if (entry.metadata?.success === false) {
            hourStats.errors++;
        }
    }

    /**
     * Calculate percentiles for an array of numbers
     */
    calculatePercentiles(values, percentiles = CONFIG.percentiles) {
        if (values.length === 0) return {};
        
        const sorted = values.slice().sort((a, b) => a - b);
        const result = {};
        
        for (const p of percentiles) {
            const index = Math.ceil((p / 100) * sorted.length) - 1;
            result[`p${p}`] = sorted[Math.max(0, index)];
        }
        
        return result;
    }

    /**
     * Analyze performance patterns
     */
    analyzePerformance() {
        logger.info('Analyzing performance patterns...');
        
        const analysis = {
            summary: {
                totalOperations: this.performanceData.length,
                totalErrors: this.errorPatterns.length,
                errorRate: this.performanceData.length > 0 ? 
                    (this.errorPatterns.length / this.performanceData.length * 100).toFixed(2) + '%' : '0%',
                operationTypes: Object.keys(this.operationStats),
                analysisTimestamp: new Date().toISOString()
            },
            operationAnalysis: {},
            performanceAlerts: [],
            trends: this.analyzeTrends(),
            recommendations: []
        };

        // Analyze each operation type
        for (const [operationType, stats] of Object.entries(this.operationStats)) {
            const durations = stats.durations;
            const avgDuration = stats.totalDuration / stats.count;
            const percentiles = this.calculatePercentiles(durations);
            const errorRate = (stats.errors / stats.count * 100).toFixed(2);
            
            const thresholds = CONFIG.performanceThresholds[operationType] || 
                             { good: 1000, warn: 2000, error: 5000 };

            // Categorize performance
            const performanceLevel = avgDuration <= thresholds.good ? 'good' :
                                   avgDuration <= thresholds.warn ? 'warn' : 'error';

            const operationAnalysis = {
                operationType,
                count: stats.count,
                averageDuration: Math.round(avgDuration),
                performanceLevel,
                errorRate: errorRate + '%',
                percentiles,
                memoryStats: this.analyzeMemoryUsage(stats.memoryUsage),
                phaseBreakdown: this.analyzePhases(stats.phases),
                thresholds
            };

            analysis.operationAnalysis[operationType] = operationAnalysis;

            // Generate alerts
            if (performanceLevel === 'error') {
                analysis.performanceAlerts.push({
                    type: 'SLOW_OPERATION',
                    severity: 'high',
                    operationType,
                    message: `${operationType} operations averaging ${Math.round(avgDuration)}ms (threshold: ${thresholds.error}ms)`,
                    avgDuration: Math.round(avgDuration),
                    threshold: thresholds.error
                });
            }

            if (parseFloat(errorRate) > 5) {
                analysis.performanceAlerts.push({
                    type: 'HIGH_ERROR_RATE',
                    severity: 'high',
                    operationType,
                    message: `${operationType} operations have ${errorRate}% error rate`,
                    errorRate: parseFloat(errorRate)
                });
            }

            // Generate recommendations
            if (percentiles.p95 > thresholds.warn) {
                analysis.recommendations.push({
                    operationType,
                    issue: 'High P95 latency',
                    recommendation: `Consider optimizing ${operationType} operations - 95% of requests exceed ${thresholds.warn}ms`,
                    priority: 'medium'
                });
            }
        }

        return analysis;
    }

    /**
     * Analyze memory usage patterns
     */
    analyzeMemoryUsage(memoryData) {
        if (memoryData.length === 0) {
            return { available: false };
        }

        const avgMemoryDelta = memoryData.reduce((sum, val) => sum + val, 0) / memoryData.length;
        const maxMemoryDelta = Math.max(...memoryData);
        const minMemoryDelta = Math.min(...memoryData);

        return {
            available: true,
            averageDeltaMB: (avgMemoryDelta / (1024 * 1024)).toFixed(2),
            maxDeltaMB: (maxMemoryDelta / (1024 * 1024)).toFixed(2),
            minDeltaMB: (minMemoryDelta / (1024 * 1024)).toFixed(2),
            samples: memoryData.length
        };
    }

    /**
     * Analyze phase breakdown
     */
    analyzePhases(phases) {
        const phaseAnalysis = {};
        
        for (const [phaseName, phaseStats] of Object.entries(phases)) {
            const avgDuration = phaseStats.totalDuration / phaseStats.count;
            const percentiles = this.calculatePercentiles(phaseStats.durations);
            
            phaseAnalysis[phaseName] = {
                count: phaseStats.count,
                averageDuration: Math.round(avgDuration),
                percentiles
            };
        }
        
        return phaseAnalysis;
    }

    /**
     * Analyze performance trends over time
     */
    analyzeTrends() {
        const trends = {
            hourlyPerformance: {},
            degradationAlerts: []
        };

        const hours = Object.keys(this.timeSeriesData).sort();
        
        for (const hour of hours) {
            const hourData = this.timeSeriesData[hour];
            trends.hourlyPerformance[hour] = {};
            
            for (const [operationType, stats] of Object.entries(hourData)) {
                const avgDuration = stats.totalDuration / stats.count;
                const errorRate = (stats.errors / stats.count * 100).toFixed(2);
                
                trends.hourlyPerformance[hour][operationType] = {
                    count: stats.count,
                    averageDuration: Math.round(avgDuration),
                    errorRate: errorRate + '%'
                };
            }
        }

        // Look for degradation patterns (simplified)
        if (hours.length >= 3) {
            const recentHours = hours.slice(-3);
            for (const operationType of Object.keys(CONFIG.performanceThresholds)) {
                const recentAvgs = recentHours.map(hour => {
                    const hourData = this.timeSeriesData[hour]?.[operationType];
                    return hourData ? hourData.totalDuration / hourData.count : null;
                }).filter(val => val !== null);

                if (recentAvgs.length >= 2) {
                    const trend = recentAvgs[recentAvgs.length - 1] - recentAvgs[0];
                    if (trend > 500) { // 500ms degradation
                        trends.degradationAlerts.push({
                            operationType,
                            degradation: Math.round(trend) + 'ms',
                            message: `${operationType} performance degraded by ${Math.round(trend)}ms over last ${recentAvgs.length} hours`
                        });
                    }
                }
            }
        }

        return trends;
    }

    /**
     * Generate analysis report
     */
    async generateReport() {
        const analysis = this.analyzePerformance();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Ensure analysis directory exists
        if (!fs.existsSync(CONFIG.analysisOutputDir)) {
            fs.mkdirSync(CONFIG.analysisOutputDir, { recursive: true });
        }

        // Write detailed JSON report
        const reportFile = path.join(CONFIG.analysisOutputDir, `performance-analysis-${timestamp}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(analysis, null, 2));

        // Generate summary report
        const summaryFile = path.join(CONFIG.analysisOutputDir, `performance-summary-${timestamp}.txt`);
        const summary = this.generateSummaryReport(analysis);
        fs.writeFileSync(summaryFile, summary);

        logger.info(`Analysis complete! Reports saved:`);
        logger.info(`- Detailed: ${reportFile}`);
        logger.info(`- Summary: ${summaryFile}`);

        return { analysis, reportFile, summaryFile };
    }

    /**
     * Generate human-readable summary report
     */
    generateSummaryReport(analysis) {
        const lines = [];
        
        lines.push('SEMEM PERFORMANCE ANALYSIS REPORT');
        lines.push('='.repeat(50));
        lines.push(`Generated: ${analysis.summary.analysisTimestamp}`);
        lines.push(`Total Operations: ${analysis.summary.totalOperations}`);
        lines.push(`Total Errors: ${analysis.summary.totalErrors}`);
        lines.push(`Error Rate: ${analysis.summary.errorRate}`);
        lines.push('');

        // Performance alerts
        if (analysis.performanceAlerts.length > 0) {
            lines.push('PERFORMANCE ALERTS:');
            lines.push('-'.repeat(30));
            for (const alert of analysis.performanceAlerts) {
                lines.push(`[${alert.severity.toUpperCase()}] ${alert.message}`);
            }
            lines.push('');
        }

        // Operation analysis
        lines.push('OPERATION PERFORMANCE:');
        lines.push('-'.repeat(30));
        for (const [operationType, stats] of Object.entries(analysis.operationAnalysis)) {
            const status = stats.performanceLevel === 'good' ? '✓' : 
                          stats.performanceLevel === 'warn' ? '⚠' : '✗';
            lines.push(`${status} ${operationType.toUpperCase()}: ${stats.averageDuration}ms avg, ${stats.errorRate} errors (${stats.count} ops)`);
            
            if (stats.percentiles.p95) {
                lines.push(`    P95: ${stats.percentiles.p95}ms, P99: ${stats.percentiles.p99 || 'N/A'}ms`);
            }
        }
        lines.push('');

        // Recommendations
        if (analysis.recommendations.length > 0) {
            lines.push('RECOMMENDATIONS:');
            lines.push('-'.repeat(30));
            for (const rec of analysis.recommendations) {
                lines.push(`• [${rec.priority.toUpperCase()}] ${rec.recommendation}`);
            }
            lines.push('');
        }

        // Trends
        if (analysis.trends.degradationAlerts.length > 0) {
            lines.push('PERFORMANCE TRENDS:');
            lines.push('-'.repeat(30));
            for (const alert of analysis.trends.degradationAlerts) {
                lines.push(`⚠ ${alert.message}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Print quick summary to console
     */
    printQuickSummary() {
        const analysis = this.analyzePerformance();
        
        logger.info('\n=== PERFORMANCE SUMMARY ===');
        logger.info(`Total Operations: ${analysis.summary.totalOperations}`);
        logger.info(`Error Rate: ${analysis.summary.errorRate}`);
        
        logger.info('\nOperation Performance:');
        for (const [operationType, stats] of Object.entries(analysis.operationAnalysis)) {
            const status = stats.performanceLevel === 'good' ? '✓' : 
                          stats.performanceLevel === 'warn' ? '⚠' : '✗';
            logger.info(`  ${status} ${operationType}: ${stats.averageDuration}ms avg (${stats.count} ops)`);
        }

        if (analysis.performanceAlerts.length > 0) {
            logger.info('\nAlerts:');
            for (const alert of analysis.performanceAlerts) {
                logger.info(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
            }
        }
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options = {
        includeArchive: args.includes('--include-archive'),
        quickSummary: args.includes('--quick'),
        generateReport: !args.includes('--no-report')
    };

    const analyzer = new PerformanceAnalyzer();
    
    const logDirs = [CURRENT_LOG_DIR];
    if (options.includeArchive) {
        // Add latest archive runs
        try {
            const archiveRuns = fs.readdirSync(ARCHIVE_LOG_DIR)
                .filter(dir => dir.startsWith('run-'))
                .sort()
                .slice(-2); // Latest 2 archive runs
            
            for (const run of archiveRuns) {
                logDirs.push(path.join(ARCHIVE_LOG_DIR, run));
            }
        } catch (error) {
            logger.warn('Could not access archive logs:', error.message);
        }
    }

    const entriesLoaded = await analyzer.loadLogData(logDirs);
    
    if (entriesLoaded === 0) {
        logger.info('No performance data found in logs');
        process.exit(1);
    }

    if (options.quickSummary) {
        analyzer.printQuickSummary();
    }

    if (options.generateReport) {
        await analyzer.generateReport();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { PerformanceAnalyzer };