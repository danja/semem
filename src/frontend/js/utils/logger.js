import log from 'loglevel';

// Create a logger with a specific namespace
const createLogger = (namespace) => {
  const logger = log.getLogger(namespace);
  
  // Set default log level based on environment
  if (process.env.NODE_ENV === 'production') {
    logger.setLevel('warn');
  } else {
    logger.setLevel('info');
  }
  
  return logger;
};

// Export a default logger instance
export const logger = createLogger('app');

// Export the createLogger function for module-specific loggers
export { createLogger };

// This function will be used to replace console.log calls
export const replaceConsole = () => {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    trace: console.trace,
  };
  
  // Override console methods to use loglevel
  console.log = (...args) => {
    originalConsole.log(...args);
    logger.info(...args);
  };
  
  console.info = (...args) => {
    originalConsole.info(...args);
    logger.info(...args);
  };
  
  console.warn = (...args) => {
    originalConsole.warn(...args);
    logger.warn(...args);
  };
  
  console.error = (...args) => {
    originalConsole.error(...args);
    logger.error(...args);
  };
  
  console.debug = (...args) => {
    originalConsole.debug(...args);
    logger.debug(...args);
  };
  
  console.trace = (...args) => {
    originalConsole.trace(...args);
    logger.trace(...args);
  };
  
  // Return a function to restore original console methods
  return () => {
    Object.assign(console, originalConsole);
  };
};

// Export a function to set log level
export const setLogLevel = (level) => {
  log.setLevel(level);
};

// Export log levels for reference
export const LogLevels = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent'
};

// Export a function to get current log level
export const getLogLevel = () => log.getLevel();
