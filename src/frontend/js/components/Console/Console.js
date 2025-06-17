import { h, Component } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import log from 'loglevel';
import './styles/console.css';

// Log levels for the dropdown
const LOG_LEVELS = [
  { value: 'trace', label: 'Trace' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'silent', label: 'Silent' },
];

/**
 * Console component that displays application logs with filtering and controls
 */
const Console = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('info');
  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const logEndRef = useRef(null);
  const logsRef = useRef([]);

  // Initialize console and set up log capturing
  useEffect(() => {
    // Store the original console methods
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      trace: console.trace,
    };

    // Override console methods to capture logs
    const captureLog = (level, originalMethod) => {
      return (...args) => {
        // Call the original method
        originalMethod.apply(console, args);
        
        if (!isPaused) {
          const timestamp = new Date().toISOString();
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          
          const newLog = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            timestamp,
            level,
            message,
          };
          
          logsRef.current = [...logsRef.current, newLog];
          setLogs(prevLogs => [...prevLogs, newLog].slice(-1000)); // Keep last 1000 logs
        }
      };
    };

    // Apply the overrides
    console.log = captureLog('info', originalConsole.log);
    console.info = captureLog('info', originalConsole.info);
    console.warn = captureLog('warn', originalConsole.warn);
    console.error = captureLog('error', originalConsole.error);
    console.debug = captureLog('debug', originalConsole.debug);
    console.trace = captureLog('trace', originalConsole.trace);

    // Set up loglevel
    log.setLevel(logLevel);

    // Clean up
    return () => {
      // Restore original console methods
      Object.assign(console, originalConsole);
    };
  }, [isPaused, logLevel]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logEndRef.current && !isPaused) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  // Filter logs based on level and search term
  const filteredLogs = logs.filter(log => {
    const levelMatch = log.level === 'error' || 
                     log.level === 'warn' || 
                     logLevel === 'trace' ||
                     (logLevel === 'debug' && log.level !== 'trace') ||
                     (logLevel === 'info' && (log.level === 'info' || log.level === 'warn' || log.level === 'error'));
    
    const searchMatch = searchTerm === '' || 
                      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    return levelMatch && searchMatch;
  });

  // Toggle console visibility
  const toggleConsole = () => {
    setIsOpen(!isOpen);
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
    logsRef.current = [];
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      // Show success message
      console.info('Logs copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy logs:', err);
    });
  };

  return (
    <div className={`console-container ${isOpen ? 'open' : ''}`}>
      <button className="console-toggle" onClick={toggleConsole}>
        {isOpen ? '×' : 'Console'}
      </button>
      
      {isOpen && (
        <div className="console-panel">
          <div className="console-header">
            <h3>Console</h3>
            <div className="console-controls">
              <select 
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="log-level-select"
              >
                {LOG_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="log-search"
              />
              <button onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={clearLogs}>Clear</button>
              <button onClick={copyLogs}>Copy</button>
            </div>
          </div>
          
          <div className="log-viewer">
            {filteredLogs.length === 0 ? (
              <div className="no-logs">No logs to display</div>
            ) : (
              <div className="log-entries">
                {filteredLogs.map((log) => (
                  <div key={log.id} className={`log-entry log-${log.level}`}>
                    <span className="log-timestamp">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`log-level log-level-${log.level}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Console;
