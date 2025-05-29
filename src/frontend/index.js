// Main entry point for the Semem API Interface
import './styles/main.css';
import { initializeApp } from './js/app.js';
import { setupErrorHandling } from './js/utils/errorHandler.js';

// Setup global error handling
setupErrorHandling();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Semem API Interface');
    initializeApp();
});