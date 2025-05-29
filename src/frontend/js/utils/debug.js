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
}