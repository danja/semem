/**
 * VSOM Utilities
 * Helper functions for the VSOM standalone application
 */

export default class VSOMUtils {
    /**
     * Format duration in human-readable format
     */
    static formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const days = Math.floor(totalHours / 24);
        
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (totalHours > 0) {
            return `${totalHours}h ${minutes}m`;
        } else if (totalMinutes > 0) {
            return `${totalMinutes}m ${seconds}s`;
        } else {
            return `${totalSeconds}s`;
        }
    }
    
    /**
     * Format relative time (e.g., "2 minutes ago")
     */
    static formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) {
            return 'Just now';
        } else if (diffMin < 60) {
            return `${diffMin}m ago`;
        } else if (diffHour < 24) {
            return `${diffHour}h ago`;
        } else if (diffDay < 7) {
            return `${diffDay}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    /**
     * Debounce function to limit function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Throttle function to limit function calls
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Show toast notification
     */
    static showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;
        
        // Add click handler for close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            VSOMUtils.removeToast(toast);
        });
        
        container.appendChild(toast);
        
        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                VSOMUtils.removeToast(toast);
            }, duration);
        }
        
        return toast;
    }
    
    /**
     * Remove toast notification
     */
    static removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    /**
     * Show tooltip
     */
    static showTooltip(data, event) {
        VSOMUtils.hideTooltip(); // Remove any existing tooltip
        
        const tooltip = document.createElement('div');
        tooltip.className = 'vsom-tooltip';
        tooltip.id = 'vsom-tooltip';
        
        const content = VSOMUtils.formatTooltipContent(data);
        tooltip.innerHTML = content;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = tooltip.getBoundingClientRect();
        const x = event.clientX - rect.width / 2;
        const y = event.clientY - rect.height - 10;
        
        tooltip.style.left = `${Math.max(10, Math.min(x, window.innerWidth - rect.width - 10))}px`;
        tooltip.style.top = `${Math.max(10, y)}px`;
    }
    
    /**
     * Hide tooltip
     */
    static hideTooltip() {
        const tooltip = document.getElementById('vsom-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    /**
     * Format tooltip content for VSOM nodes
     */
    static formatTooltipContent(data) {
        const content = data.content || data.summary || 'No content available';
        const conceptCount = Array.isArray(data.concepts) ? data.concepts.length : (typeof data.concepts === 'number' ? data.concepts : 0);

        return `
            <div class="tooltip-title">${(data.type || 'interaction').toUpperCase()} Node</div>
            <div class="tooltip-content">
                <div class="tooltip-section">
                    <strong>Content:</strong><br>
                    <span class="content-preview">${VSOMUtils.truncateText(content, 120)}</span>
                </div>
                ${conceptCount > 0 ?
                    `<div class="tooltip-section">
                        <strong>Concepts:</strong> ${conceptCount}
                        ${Array.isArray(data.concepts) && data.concepts.length > 0 ?
                            `<br><span class="concepts-list">${data.concepts.slice(0, 3).join(', ')}${data.concepts.length > 3 ? '...' : ''}</span>` :
                            ''
                        }
                    </div>` :
                    '<div class="tooltip-section"><strong>Concepts:</strong> None</div>'
                }
                ${data.timestamp ?
                    `<div class="tooltip-section"><strong>Time:</strong> ${VSOMUtils.formatRelativeTime(new Date(data.timestamp))}</div>` :
                    ''
                }
                <div class="tooltip-section">
                    <strong>Type:</strong> ${data.type || 'interaction'}<br>
                    <strong>ID:</strong> ${data.interactionId || data.id || 'unknown'}
                </div>
            </div>
        `;
    }
    
    /**
     * Truncate text to specified length
     */
    static truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Calculate distance between two points
     */
    static distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Calculate cosine similarity between two vectors
     */
    static cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
    
    /**
     * Generate color based on string hash
     */
    static stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    /**
     * Interpolate between two colors
     */
    static interpolateColor(color1, color2, factor) {
        const rgb1 = VSOMUtils.hexToRgb(color1);
        const rgb2 = VSOMUtils.hexToRgb(color2);
        
        if (!rgb1 || !rgb2) return color1;
        
        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    /**
     * Convert hex color to RGB
     */
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    /**
     * Scale value from one range to another
     */
    static scale(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }
    
    /**
     * Clamp value between min and max
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    /**
     * Generate unique ID
     */
    static generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Deep clone object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => VSOMUtils.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = VSOMUtils.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
    }
    
    /**
     * Check if object is empty
     */
    static isEmpty(obj) {
        if (obj == null) return true;
        if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    }
    
    /**
     * Create SVG element with attributes
     */
    static createSVGElement(tag, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        
        return element;
    }
    
    /**
     * Set multiple attributes on an element
     */
    static setAttributes(element, attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
    }
    
    /**
     * Add CSS class if not present
     */
    static addClass(element, className) {
        if (element && !element.classList.contains(className)) {
            element.classList.add(className);
        }
    }
    
    /**
     * Remove CSS class if present
     */
    static removeClass(element, className) {
        if (element && element.classList.contains(className)) {
            element.classList.remove(className);
        }
    }
    
    /**
     * Toggle CSS class
     */
    static toggleClass(element, className) {
        if (element) {
            element.classList.toggle(className);
        }
    }
    
    /**
     * Wait for specified time
     */
    static async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Format number with appropriate suffix (K, M, B)
     */
    static formatNumber(num) {
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    /**
     * Calculate viewport dimensions
     */
    static getViewportDimensions() {
        return {
            width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
            height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
        };
    }
    
    /**
     * Check if element is in viewport
     */
    static isInViewport(element) {
        const rect = element.getBoundingClientRect();
        const viewport = VSOMUtils.getViewportDimensions();
        
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= viewport.height &&
            rect.right <= viewport.width
        );
    }
    
    /**
     * Smooth scroll to element
     */
    static scrollToElement(element, behavior = 'smooth') {
        if (element) {
            element.scrollIntoView({ behavior, block: 'center' });
        }
    }
}