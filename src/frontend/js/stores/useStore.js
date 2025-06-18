import { eventBus, EVENTS } from '../services/eventBus.js';

const createStore = (initialState = {}) => {
  let state = { ...initialState };
  const subscribers = new Set();

  const getState = () => ({ ...state });

  const setState = (updater) => {
    const prevState = state;
    state = typeof updater === 'function' 
      ? { ...state, ...updater(state) } 
      : { ...state, ...updater };
    
    // Only notify if state actually changed
    if (JSON.stringify(prevState) !== JSON.stringify(state)) {
      subscribers.forEach(callback => callback(getState()));
    }
    return getState();
  };

  const subscribe = (callback) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  const connectToEventBus = () => {
    // Log all events in development
    if (process.env.NODE_ENV === 'development') {
      Object.values(EVENTS).forEach(event => {
        eventBus.on(event, (data) => {
          console.debug(`[Event] ${event}`, data);
        });
      });
    }

    // Handle errors
    eventBus.on(EVENTS.APP_ERROR, (error) => {
      console.error('Store caught error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error.message || 'An error occurred',
        isLoading: false 
      }));
    });
  };

  return { 
    getState, 
    setState, 
    subscribe,
    connectToEventBus
  };
};

// Create store with initial state
export const store = createStore({
  // SPARQL Browser state
  currentEndpoint: null,
  endpoints: [],
  queryResults: null,
  isLoading: false,
  error: null,
  // Editor state
  editorContent: '',
  // Graph state
  graphData: null,
  // Add more state as needed
});

// Initialize event bus connections
store.connectToEventBus();

// For debugging
if (typeof window !== 'undefined') {
  window.__store = store;
}

export default store;
