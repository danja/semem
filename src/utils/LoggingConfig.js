import logger from 'loglevel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root (go up from src/utils to project root)
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Get current date for log file naming
function getDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Enhanced logging configuration with file output
class FileLogger {
    constructor(name = 'default') {
        this.name = name;
        this.logFile = path.join(LOG_DIR, `${name}-${getDateString()}.log`);
        this.errorFile = path.join(LOG_DIR, `${name}-error-${getDateString()}.log`);
        this.originalLogger = logger.getLogger(name);
        
        // Store original methods
        this.originalMethods = {
            trace: this.originalLogger.trace.bind(this.originalLogger),
            debug: this.originalLogger.debug.bind(this.originalLogger),
            info: this.originalLogger.info.bind(this.originalLogger),
            warn: this.originalLogger.warn.bind(this.originalLogger),
            error: this.originalLogger.error.bind(this.originalLogger)
        };
        
        // Override methods to include file logging
        this.setupFileLogging();
    }
    
    setupFileLogging() {
        const levels = ['trace', 'debug', 'info', 'warn', 'error'];
        
        levels.forEach(level => {
            this.originalLogger[level] = (...args) => {
                const timestamp = new Date().toISOString();
                const levelUpper = level.toUpperCase();
                const message = this.formatMessage(levelUpper, timestamp, args);
                
                // Always call original logger for console output
                this.originalMethods[level](...args);
                
                // Write to appropriate log file
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
            // Fallback to console if file writing fails
            console.error('Failed to write to log file:', error.message);
        }
    }
}

// Centralized logging configuration
export function configureLogging(componentName = 'semem', level = 'info') {
    const fileLogger = new FileLogger(componentName);
    
    // Set log level
    logger.setLevel(level);
    
    // Create component-specific logger
    const componentLogger = logger.getLogger(componentName);
    
    // Add convenient method to get logger with different component names
    componentLogger.getComponentLogger = (name) => {
        return new FileLogger(`${componentName}-${name}`).originalLogger;
    };
    
    return componentLogger;
}

// Default configuration for the main application
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
    
    // Log the startup information
    mainLogger.info('='.repeat(80));
    mainLogger.info('SEMEM APPLICATION STARTUP');
    mainLogger.info('='.repeat(80));
    mainLogger.info(`Log directory: ${LOG_DIR}`);
    mainLogger.info(`Log level: info`);
    mainLogger.info(`Available loggers: ${Object.keys(loggers).join(', ')}`);
    mainLogger.info('='.repeat(80));
    
    return { mainLogger, ...loggers };
}

// Export log directory path for other modules
export { LOG_DIR };

export default configureLogging;