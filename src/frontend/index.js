// Main entry point for the Semem API Interface
import './styles/main.css';

// Import Atuin CSS for SPARQL Browser
import './styles/atuin/main.css';
import './styles/atuin/editor.css';
import './styles/atuin/graph.css';
import './styles/atuin/settings.css';

import { initializeApp } from './js/app.js';
import { setupErrorHandling } from './js/utils/errorHandler.js';

// Import app menu initialization
import './js/app-menu-init.js';

// Setup global error handling
setupErrorHandling();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Semem API Interface');
    await initializeApp();
    
    // Log initialization complete
    console.log('Application initialization complete');
});