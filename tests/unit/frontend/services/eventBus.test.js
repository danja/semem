import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus, EVENTS, resetEventBus } from '../../../../src/frontend/js/services/eventBus';

describe('EventBus', () => {
  beforeEach(() => {
    resetEventBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit and listen to events', () => {
    const callback = vi.fn();
    const testData = { foo: 'bar' };
    
    eventBus.on(EVENTS.APP_INIT, callback);
    eventBus.emit(EVENTS.APP_INIT, testData);
    
    expect(callback).toHaveBeenCalledWith(testData);
  });

  it('should remove event listeners', () => {
    const callback = vi.fn();
    
    const removeListener = eventBus.on(EVENTS.APP_INIT, callback);
    removeListener();
    eventBus.emit(EVENTS.APP_INIT);
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle multiple event listeners', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    
    eventBus.on(EVENTS.APP_INIT, callback1);
    eventBus.on(EVENTS.APP_INIT, callback2);
    eventBus.emit(EVENTS.APP_INIT);
    
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it('should support once() with promises', async () => {
    const testData = { foo: 'bar' };
    
    setTimeout(() => {
      eventBus.emit(EVENTS.APP_INIT, testData);
    }, 10);
    
    const result = await eventBus.once(EVENTS.APP_INIT);
    expect(result).toEqual(testData);
  });

  it('should warn on unknown event types in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    eventBus.emit('UNKNOWN_EVENT', { some: 'data' });
    
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown event type: UNKNOWN_EVENT'),
      expect.any(Object)
    );
    
    consoleWarn.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
