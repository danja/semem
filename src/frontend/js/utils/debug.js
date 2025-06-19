/**
 * Debug utilities
 */

/**
 * Debug message display
 */
export function setupDebug() {
    window.showDebug = function (message) {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            const timestamp = new Date().toLocaleTimeString();
            debugInfo.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            console.log(`[DEBUG] ${message}`);
        }
    };
    
    // Add toggle function for debug visibility
    window.toggleDebug = function() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
            console.log(`Debug info ${debugInfo.style.display === 'none' ? 'hidden' : 'shown'}`);
        }
    };
    
    // Add clear debug function
    window.clearDebug = function() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = '';
            console.log('Debug info cleared');
        }
    };
}