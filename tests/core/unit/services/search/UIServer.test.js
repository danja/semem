import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UIServer from '../../../../../src/services/search/UIServer.js';
import { EventEmitter } from 'events';

// Mock logger to suppress test output
vi.mock('loglevel', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn()
  },
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  setLevel: vi.fn()
}));

// Import logger after mock is set up
import logger from 'loglevel';

// Mock express
vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return { close: vi.fn() };
    })
  };
  
  const express = vi.fn(() => mockApp);
  express.json = vi.fn();
  express.urlencoded = vi.fn();
  express.static = vi.fn();
  
  return {
    default: express,
    ...express
  };
});

describe('UIServer', () => {
  let uiServer;
  const mockProviders = [
    {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      chatModel: 'test-model',
      priority: 1
    }
  ];

  beforeEach(() => {
    // Create a new UIServer instance before each test
    uiServer = new UIServer({
      port: 4100,
      graphName: 'http://test-graph',
      llmProviders: [...mockProviders]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleListProviders', () => {
    it('should return a list of available providers', async () => {
      // Mock request and response objects
      const req = {};
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      // Call the method
      await uiServer.handleListProviders(req, res);

      // Verify the response
      expect(res.json).toHaveBeenCalledWith({
        providers: expect.arrayContaining([
          expect.objectContaining({
            type: 'ollama',
            model: 'test-model',
            name: 'ollama'
          })
        ])
      });
    });

    it('should handle missing providers array by using defaults', async () => {
      // Create a new instance without providers
      const serverWithDefaults = new UIServer({
        port: 4100,
        graphName: 'http://test-graph'
      });
      
      // Mock request and response objects
      const req = {};
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      // Call the method
      await serverWithDefaults.handleListProviders(req, res);

      // Should return default providers when none specified
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('providers');
      expect(Array.isArray(response.providers)).toBe(true);
      expect(response.providers.length).toBeGreaterThan(0);
    });
  });

  describe('Provider Loading in UI', () => {
    it('should initialize with providers from config', () => {
      // The server is initialized in beforeEach with mockProviders
      expect(uiServer.llmProviders).toHaveLength(1);
      expect(uiServer.llmProviders[0].type).toBe('ollama');
    });

    it('should provide a valid response structure', async () => {
      const req = {};
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      await uiServer.handleListProviders(req, res);
      
      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('providers');
      expect(Array.isArray(response.providers)).toBe(true);
      
      if (response.providers.length > 0) {
        const provider = response.providers[0];
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('type');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('model');
        expect(provider).toHaveProperty('capabilities');
      }
    });
  });
});
