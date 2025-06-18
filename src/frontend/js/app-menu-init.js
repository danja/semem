import AppMenu from './components/AppMenu/AppMenu.js';

console.log('AppMenu: Script loaded, waiting for DOM...');

// Initialize the app menu when the DOM is fully loaded
const initAppMenu = () => {
    try {
        console.log('AppMenu: DOM loaded, initializing menu...');
        
        // Create and initialize the app menu
        const appMenu = new AppMenu();
        
        // Make the menu instance globally available for debugging
        window.appMenu = appMenu;
        
        console.log('AppMenu: Menu initialized successfully');
        return appMenu;
    } catch (error) {
        console.error('AppMenu: Failed to initialize:', error);
        // Try to show error in the UI
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.background = 'red';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '10px';
        errorDiv.style.zIndex = '9999';
        errorDiv.textContent = `Menu Error: ${error.message}`;
        document.body.appendChild(errorDiv);
        return null;
    }
};

// Check if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppMenu);
} else {
    // DOM already loaded, initialize immediately
    initAppMenu();
}
