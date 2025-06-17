import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { store } from '../../../../src/frontend/js/stores/useStore';
import { eventBus, EVENTS } from '../../../../src/frontend/js/services/eventBus';

describe('useStore', () => {
  let initialState;

  beforeEach(() => {
    // Save initial state
    initialState = { ...store.getState() };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset store to initial state
    store.setState(initialState);
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const state = store.getState();
    expect(state).toMatchObject({
      currentEndpoint: null,
      endpoints: [],
      queryResults: null,
      isLoading: false,
      error: null,
      editorContent: '',
      graphData: null
    });
  });

  it('should update state with setState', () => {
    const newState = { currentEndpoint: 'http://example.org/sparql' };
    store.setState(newState);
    
    const state = store.getState();
    expect(state.currentEndpoint).toBe('http://example.org/sparql');
  });

  it('should update state with function updater', () => {
    store.setState(prev => ({
      ...prev,
      currentEndpoint: 'http://example.org/sparql',
      isLoading: true
    }));
    
    const state = store.getState();
    expect(state.currentEndpoint).toBe('http://example.org/sparql');
    expect(state.isLoading).toBe(true);
  });

  it('should notify subscribers on state change', () => {
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);
    
    store.setState({ currentEndpoint: 'http://example.org/sparql' });
    
    expect(subscriber).toHaveBeenCalledWith(expect.objectContaining({
      currentEndpoint: 'http://example.org/sparql'
    }));
    
    // Cleanup
    unsubscribe();
  });

  it('should handle errors through event bus', () => {
    const error = new Error('Test error');
    
    // Mock console.error to avoid test output pollution
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Trigger error event
    eventBus.emit(EVENTS.APP_ERROR, error);
    
    const state = store.getState();
    expect(state.error).toBe('Test error');
    expect(state.isLoading).toBe(false);
    
    consoleError.mockRestore();
  });

  it('should not notify subscribers if state did not change', () => {
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);
    
    // First change
    store.setState({ currentEndpoint: 'http://example.org/sparql' });
    subscriber.mockClear();
    
    // Same state, should not notify
    store.setState({ currentEndpoint: 'http://example.org/sparql' });
    
    expect(subscriber).not.toHaveBeenCalled();
    
    unsubscribe();
  });
});
