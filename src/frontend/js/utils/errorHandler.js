/**
 * Error handling utilities
 */

/**
 * Display an error message in the specified container
 * @param {string} message - The error message to display
 * @param {HTMLElement} [container] - Optional container to show the error in (defaults to document body)
 */
export function displayError(message, container) {
    console.error('Displaying error:', message);
    
    // Use provided container or default to body
    const targetContainer = container || document.body;
    
    // Create error element if it doesn't exist
    let errorElement = targetContainer.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.style.color = 'red';
        errorElement.style.margin = '10px 0';
        errorElement.style.padding = '10px';
        errorElement.style.border = '1px solid #ff9999';
        errorElement.style.borderRadius = '4px';
        errorElement.style.backgroundColor = '#fff0f0';
        targetContainer.prepend(errorElement);
    }
    
    // Set error message
    errorElement.textContent = message;
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorElement.remove();
    }, 10000);
}

/**
 * Setup global error handling
 */
export function setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', function (event) {
        console.error('Global error caught:', event.error || event.message);
        // Always hide loading indicator if there's an error
        let loadingElement = document.getElementById('loading-indicator');
        if (loadingElement) {
            loadingElement.style.display = 'none';
            console.error('Loading indicator hidden due to global error');
        }
    });
}