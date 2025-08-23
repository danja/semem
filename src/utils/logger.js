import log from 'loglevel';

// Create a logger with a specific namespace
export const createLogger = (namespace) => {
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

// Export log levels for reference
export const LogLevels = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent'
};

// Export a function to set log level
export const setLogLevel = (level) => {
  log.setLevel(level);
};

// Export a function to get current log level
export const getLogLevel = () => log.getLevel();

export default logger;