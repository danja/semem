import logger from 'loglevel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root (go up from src/utils to project root)
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Detect STDIO mode to suppress console output that interferes with Inspector JSON protocol
const isSTDIOMode = process.stdin.isTTY !== true ||
                   process.argv.some(arg => arg.includes('mcp/index.js')) ||
                   process.env.MCP_INSPECTOR_MODE === 'true';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Get current date for log file naming
function getDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Cleanup old log files, keeping only the last 2 runs
function cleanupOldLogs(logDir, namePrefix) {
    try {
        const files = fs.readdirSync(logDir)
            .filter(file => file.startsWith(namePrefix) && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(logDir, file),
                stat: fs.statSync(path.join(logDir, file))
            }))
            .sort((a, b) => b.stat.mtime - a.stat.mtime); // Sort by modification time, newest first

        // Keep only the 2 most recent files for each prefix
        const filesToDelete = files.slice(2);
        filesToDelete.forEach(file => {
            try {
                fs.unlinkSync(file.path);
            } catch (err) {
                // Silent failure - don't log in STDIO mode
            }
        });
    } catch (err) {
        // Silent failure - don't log in STDIO mode
    }
}

// Enhanced STDIO-aware logging configuration with file output
class STDIOAwareFileLogger {
    constructor(name = 'default') {
        this.name = name;
        this.logFile = path.join(LOG_DIR, `${name}-${getDateString()}.log`);
        this.errorFile = path.join(LOG_DIR, `${name}-error-${getDateString()}.log`);
        this.originalLogger = logger.getLogger(name);

        // Cleanup old logs on creation
        cleanupOldLogs(LOG_DIR, name);

        // Store original methods
        this.originalMethods = {
            trace: this.originalLogger.trace.bind(this.originalLogger),
            debug: this.originalLogger.debug.bind(this.originalLogger),
            info: this.originalLogger.info.bind(this.originalLogger),
            warn: this.originalLogger.warn.bind(this.originalLogger),
            error: this.originalLogger.error.bind(this.originalLogger)
        };

        // Override methods to include file logging with STDIO awareness
        this.setupSTDIOAwareLogging();
    }
    
    setupSTDIOAwareLogging() {
        const levels = ['trace', 'debug', 'info', 'warn', 'error'];

        levels.forEach(level => {
            this.originalLogger[level] = (...args) => {
                const timestamp = new Date().toISOString();
                const levelUpper = level.toUpperCase();
                const message = this.formatMessage(levelUpper, timestamp, args);

                // Only call original logger for console output if NOT in STDIO mode
                if (!isSTDIOMode) {
                    this.originalMethods[level](...args);
                }

                // Always write to file
                const logFile = (level === 'error') ? this.errorFile : this.logFile;
                this.writeToFile(logFile, message);

                // Also write errors to the main log file
                if (level === 'error') {
                    this.writeToFile(this.logFile, message);
                }
            };
        });
    }
    
    formatMessage(level, timestamp, args) {
        const formattedArgs = args.map(arg => {
            if (typeof arg === 'object') {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        }).join(' ');
        
        return `[${timestamp}] [${level}] [${this.name}] ${formattedArgs}\n`;
    }
    
    writeToFile(filePath, message) {
        try {
            fs.appendFileSync(filePath, message);
        } catch (error) {
            // Silent failure in STDIO mode to avoid JSON protocol interference
            if (!isSTDIOMode) {
                console.error('Failed to write to log file:', error.message);
            }
        }
    }
}

// Centralized STDIO-aware logging configuration
export function configureLogging(componentName = 'semem', level = 'info') {
    const fileLogger = new STDIOAwareFileLogger(componentName);

    // Set log level
    logger.setLevel(level);

    // Create component-specific logger
    const componentLogger = logger.getLogger(componentName);

    // Add convenient method to get logger with different component names
    componentLogger.getComponentLogger = (name) => {
        return new STDIOAwareFileLogger(`${componentName}-${name}`).originalLogger;
    };

    return componentLogger;
}

// Default STDIO-aware configuration for the main application
export function setupDefaultLogging() {
    const mainLogger = configureLogging('semem-main', 'info');

    // Set up specific loggers for different components
    const loggers = {
        server: configureLogging('api-server', 'info'),
        memory: configureLogging('memory-manager', 'info'),
        api: configureLogging('api-handlers', 'info'),
        embedding: configureLogging('embeddings', 'info'),
        llm: configureLogging('llm-handlers', 'info'),
        storage: configureLogging('storage', 'info'),
        ragno: configureLogging('ragno', 'info'),
        zpt: configureLogging('zpt', 'info'),
        search: configureLogging('search', 'info')
    };

    // Log the startup information (only to file in STDIO mode)
    mainLogger.info('='.repeat(80));
    mainLogger.info('SEMEM APPLICATION STARTUP');
    mainLogger.info('='.repeat(80));
    mainLogger.info(`Log directory: ${LOG_DIR}`);
    mainLogger.info(`Log level: info`);
    mainLogger.info(`STDIO mode: ${isSTDIOMode}`);
    mainLogger.info(`Available loggers: ${Object.keys(loggers).join(', ')}`);
    mainLogger.info('='.repeat(80));

    return { mainLogger, ...loggers };
}

// Convenience function to create unified STDIO-aware logger for any module
export function createUnifiedLogger(name = 'default') {
    return new STDIOAwareFileLogger(name).originalLogger;
}

// Export log directory path and STDIO detection for other modules
export { LOG_DIR, isSTDIOMode };

export default configureLogging;