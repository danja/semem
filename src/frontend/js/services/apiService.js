/**
 * API service for health checks and core functionality
 */
import { apiConfig, fetchWithTimeout } from '../utils/api.js';

/**
 * Check API health
 */
export async function checkAPIHealth() {
    try {
        const response = await fetchWithTimeout(`${apiConfig.baseUrl}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (response.ok) {
            const data = await response.json();
            if (statusIndicator) statusIndicator.className = 'status-indicator active';
            if (statusText) statusText.textContent = 'API is healthy';
            console.log('API Health:', data);
        } else {
            throw new Error('API is not healthy');
        }
    } catch (error) {
        console.error('API health check failed:', error);
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        if (statusIndicator) statusIndicator.className = 'status-indicator error';
        if (statusText) statusText.textContent = 'API connection failed';
    }
}