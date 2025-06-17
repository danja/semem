import { eventBus as evb, EVENTS as BASE_EVENTS } from 'evb';

// Extend base events
export const EVENTS = {
  ...BASE_EVENTS,
  // Application events
  APP_INIT: 'app:init',
  APP_ERROR: 'app:error',
  // Console events
  CONSOLE_LOG: 'console:log',
  CONSOLE_INFO: 'console:info',
  CONSOLE_WARN: 'console:warn',
  CONSOLE_ERROR: 'console:error',
  CONSOLE_DEBUG: 'console:debug',
  // SPARQL events
  SPARQL_QUERY_EXECUTED: 'sparql:query:executed',
  SPARQL_ENDPOINT_CHANGED: 'sparql:endpoint:changed',
  // Graph events
  GRAPH_UPDATED: 'graph:updated',
  GRAPH_LOADING: 'graph:loading',
  // Editor events
  EDITOR_INITIALIZED: 'editor:initialized',
  EDITOR_CONTENT_CHANGED: 'editor:content:changed'
};

// Enhanced event bus with type checking
export const eventBus = {
  ...evb,
  
  // Initialize if evb doesn't have listeners
  get listeners() {
    if (!evb.listeners) {
      evb.listeners = {};
    }
    return evb.listeners;
  },
  
  // Type-safe event emission
  emit(event, data) {
    if (!Object.values(EVENTS).includes(event)) {
      console.warn(`Unknown event type: ${event}`, data);
    }
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  },
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  },
  
  // Promise-based event handling
  once(event) {
    return new Promise((resolve) => {
      const handler = (data) => {
        this.off(event, handler);
        resolve(data);
      };
      this.on(event, handler);
    });
  }
};

// For testing
export const resetEventBus = () => {
  if (eventBus.listeners) {
    Object.keys(eventBus.listeners).forEach(event => {
      delete eventBus.listeners[event];
    });
  }
};

// Make event bus globally available
if (typeof window !== 'undefined') {
  window.eventBus = eventBus;
}

export default eventBus;
