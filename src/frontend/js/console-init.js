import Console from '@/js/components/Console';

// Initialize the console when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create and initialize the console
  const consoleElement = document.getElementById('console-root');
  
  if (consoleElement) {
    const appConsole = new Console({
      initialLogLevel: 'debug',
      maxLogs: 1000
    });
    
    // Make console instance globally available for debugging
    window.appConsole = appConsole;
    
    // Log initialization message
    appConsole.log('Application console initialized', 'info');
  } else {
    console.error('Could not find console root element');
  }
});
