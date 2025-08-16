/**
 * DOM Utilities for Semantic Memory Workbench
 * Helper functions for DOM manipulation, event handling, and UI interactions
 */

export class DomUtils {
  
  // ===== ELEMENT SELECTION AND CREATION =====

  /**
   * Safe element selector with error handling
   */
  static $(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  /**
   * Select all elements with error handling
   */
  static $$(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return [];
    }
  }

  /**
   * Create element with attributes and content
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });
    
    // Set content
    if (content) {
      if (typeof content === 'string') {
        element.textContent = content;
      } else if (content instanceof HTMLElement) {
        element.appendChild(content);
      } else if (Array.isArray(content)) {
        content.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
      }
    }
    
    return element;
  }

  // ===== EVENT HANDLING =====

  /**
   * Add event listener with automatic cleanup
   */
  static addListener(element, event, handler, options = {}) {
    if (!element || typeof handler !== 'function') return null;
    
    element.addEventListener(event, handler, options);
    
    // Return cleanup function
    return () => element.removeEventListener(event, handler, options);
  }

  /**
   * Add event delegation
   */
  static delegate(container, selector, event, handler) {
    if (!container || !selector || typeof handler !== 'function') return null;
    
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    };
    
    container.addEventListener(event, delegatedHandler);
    
    // Return cleanup function
    return () => container.removeEventListener(event, delegatedHandler);
  }

  /**
   * Debounce event handler
   */
  static debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle event handler
   */
  static throttle(func, limit = 100) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ===== FORM UTILITIES =====

  /**
   * Get form data as object
   */
  static getFormData(form) {
    if (!form) return {};
    
    const formData = new FormData(form);
    const data = {};
    
    // First, get all form elements to handle unchecked checkboxes
    const formElements = form.querySelectorAll('input, select, textarea');
    
    // Initialize all checkbox values to false
    formElements.forEach(element => {
      if (element.type === 'checkbox') {
        data[element.name] = false;
      }
    });
    
    // Then process FormData (this will override checkbox values for checked ones)
    for (const [key, value] of formData.entries()) {
      // Handle checkboxes explicitly
      if (form.querySelector(`input[name="${key}"][type="checkbox"]`)) {
        data[key] = true; // If it's in FormData, the checkbox is checked
      }
      // Handle multiple values (multi-select, etc.)
      else if (data.hasOwnProperty(key) && data[key] !== false) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }
    
    return data;
  }

  /**
   * Set form data from object
   */
  static setFormData(form, data) {
    if (!form || !data) return;
    
    Object.entries(data).forEach(([key, value]) => {
      const elements = form.elements[key];
      if (!elements) return;
      
      if (elements.length > 1) {
        // Multiple elements (radio buttons, checkboxes)
        Array.from(elements).forEach(element => {
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = Array.isArray(value) ? value.includes(element.value) : element.value === value;
          } else {
            element.value = value;
          }
        });
      } else {
        // Single element
        const element = elements;
        if (element.type === 'checkbox') {
          element.checked = Boolean(value);
        } else {
          element.value = value || '';
        }
      }
    });
  }

  /**
   * Reset form with custom values
   */
  static resetForm(form, defaults = {}) {
    if (!form) return;
    
    form.reset();
    if (Object.keys(defaults).length > 0) {
      this.setFormData(form, defaults);
    }
  }

  // ===== VISIBILITY AND ANIMATION =====

  /**
   * Show element with optional animation
   */
  static show(element, animation = 'fadeIn') {
    if (!element) return;
    
    element.style.display = '';
    
    if (animation && CSS.supports('animation', animation)) {
      element.style.animation = `${animation} 0.3s ease-out`;
      element.addEventListener('animationend', () => {
        element.style.animation = '';
      }, { once: true });
    }
  }

  /**
   * Hide element with optional animation
   */
  static hide(element, animation = 'fadeOut') {
    if (!element) return;
    
    if (animation && CSS.supports('animation', animation)) {
      element.style.animation = `${animation} 0.3s ease-out`;
      element.addEventListener('animationend', () => {
        element.style.display = 'none';
        element.style.animation = '';
      }, { once: true });
    } else {
      element.style.display = 'none';
    }
  }

  /**
   * Toggle element visibility
   */
  static toggle(element, force) {
    if (!element) return;
    
    const isHidden = element.style.display === 'none' || !element.offsetParent;
    
    if (force !== undefined) {
      force ? this.show(element) : this.hide(element);
    } else {
      isHidden ? this.show(element) : this.hide(element);
    }
  }

  /**
   * Smooth scroll to element
   */
  static scrollToElement(element, options = {}) {
    if (!element) return;
    
    const defaultOptions = {
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    };
    
    element.scrollIntoView({ ...defaultOptions, ...options });
  }

  // ===== CSS UTILITIES =====

  /**
   * Add CSS class with optional timeout
   */
  static addClass(element, className, timeout) {
    if (!element || !className) return;
    
    element.classList.add(className);
    
    if (timeout) {
      setTimeout(() => element.classList.remove(className), timeout);
    }
  }

  /**
   * Remove CSS class
   */
  static removeClass(element, className) {
    if (!element || !className) return;
    element.classList.remove(className);
  }

  /**
   * Toggle CSS class
   */
  static toggleClass(element, className, force) {
    if (!element || !className) return;
    return element.classList.toggle(className, force);
  }

  /**
   * Check if element has class
   */
  static hasClass(element, className) {
    if (!element || !className) return false;
    return element.classList.contains(className);
  }

  // ===== LOADING AND STATES =====

  /**
   * Set loading state on button
   */
  static setButtonLoading(button, loading) {
    if (!button) return;
    
    const textElement = button.querySelector('.button-text');
    const loaderElement = button.querySelector('.button-loader');
    
    button.disabled = loading;
    
    if (textElement) {
      textElement.style.display = loading ? 'none' : '';
    }
    
    if (loaderElement) {
      loaderElement.style.display = loading ? '' : 'none';
    }
  }

  /**
   * Show loading overlay
   */
  static showLoading(message = 'Loading...') {
    const overlay = this.$('#loading-overlay');
    if (!overlay) return;
    
    const textElement = overlay.querySelector('.loading-text');
    if (textElement && message) {
      textElement.textContent = message;
    }
    
    this.show(overlay);
    return overlay;
  }

  /**
   * Hide loading overlay
   */
  static hideLoading() {
    const overlay = this.$('#loading-overlay');
    if (overlay) {
      this.hide(overlay);
    }
  }

  // ===== TOAST NOTIFICATIONS =====

  /**
   * Show toast notification
   */
  static showToast(message, type = 'info', duration = 5000) {
    const container = this.$('#toast-container');
    if (!container) return;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const toast = this.createElement('div', {
      className: `toast ${type}`
    }, [
      this.createElement('span', { className: 'toast-icon' }, icons[type] || icons.info),
      this.createElement('span', { className: 'toast-message' }, message),
      this.createElement('button', { 
        className: 'toast-close',
        type: 'button'
      }, '×')
    ]);
    
    // Add close handler
    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => toast.remove());
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, duration);
    }
    
    container.appendChild(toast);
    return toast;
  }

  // ===== MESSAGE DISPLAY =====

  /**
   * Show message in a container
   */
  static showMessage(container, message, type = 'info') {
    if (!container) return;
    
    const messageElement = this.createElement('div', {
      className: `message ${type}`
    }, [
      this.createElement('div', { className: 'message-content' }, message)
    ]);
    
    // Clear previous messages
    container.innerHTML = '';
    container.appendChild(messageElement);
    this.show(container);
    
    return messageElement;
  }

  // ===== ACCESSIBILITY =====

  /**
   * Set ARIA attributes
   */
  static setAriaAttributes(element, attributes) {
    if (!element || !attributes) return;
    
    Object.entries(attributes).forEach(([key, value]) => {
      const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
      element.setAttribute(ariaKey, value);
    });
  }

  /**
   * Announce to screen readers
   */
  static announce(message, priority = 'polite') {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    
    document.body.appendChild(announcer);
    
    // Remove after announcement
    setTimeout(() => announcer.remove(), 1000);
  }

  // ===== DATA FORMATTING =====

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format duration to human readable
   */
  static formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Escape HTML content
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }
}

// Export static class
export default DomUtils;