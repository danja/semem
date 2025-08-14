import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};

vi.stubGlobal('localStorage', localStorageMock);

// Mock Config module
vi.mock('../../../../src/Config.js', () => ({
  default: {
    get: vi.fn(() => ({})),
    set: vi.fn(),
    has: vi.fn(() => false),
    getDefaults: vi.fn(() => ({
      llmProviders: [
        { name: 'ollama', priority: 2, chatModel: 'qwen2:1.5b' },
        { name: 'mistral', priority: 1, chatModel: 'mistral-small-latest' }
      ],
      embeddingProviders: [
        { name: 'ollama', embeddingModel: 'nomic-embed-text' }
      ],
      sparqlEndpoints: [
        { name: 'Local', urlBase: 'http://localhost:3030/', query: 'sparql' }
      ]
    }))
  }
}));

import { SettingsManager } from '../../../../src/frontend/workbench/js/managers/SettingsManager.js';

describe('SettingsManager', () => {
  let settingsManager;
  let mockStateManager;
  let mockApiService;
  let eventSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    
    mockStateManager = {
      recordPerformance: vi.fn(),
      on: vi.fn(),
      emit: vi.fn()
    };
    
    mockApiService = {
      testConnection: vi.fn()
    };
    
    settingsManager = new SettingsManager(mockStateManager, mockApiService);
    eventSpy = vi.fn();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(settingsManager.stateManager).toBe(mockStateManager);
      expect(settingsManager.apiService).toBe(mockApiService);
      expect(settingsManager.isInitialized).toBe(false);
      expect(settingsManager.settings).toEqual({});
    });
  });

  describe('initialize', () => {
    it('should load backend configuration and user settings', async () => {
      await settingsManager.initialize();
      
      expect(settingsManager.isInitialized).toBe(true);
      expect(settingsManager.settings).toBeDefined();
    });

    it('should emit initialization event', async () => {
      settingsManager.on('initialized', eventSpy);
      
      await settingsManager.initialize();
      
      expect(eventSpy).toHaveBeenCalledWith({
        timestamp: expect.any(Number)
      });
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should retrieve setting values by path', () => {
      settingsManager.settings = {
        models: { chat: { provider: 'ollama' } },
        ui: { theme: 'dark' }
      };
      
      expect(settingsManager.get('models.chat.provider')).toBe('ollama');
      expect(settingsManager.get('ui.theme')).toBe('dark');
    });

    it('should return undefined for non-existent paths', () => {
      expect(settingsManager.get('non.existent.path')).toBeUndefined();
    });

    it('should return default value when specified', () => {
      expect(settingsManager.get('non.existent.path', 'default')).toBe('default');
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should set values and emit change events', () => {
      settingsManager.on('settingChanged', eventSpy);
      
      settingsManager.set('ui.theme', 'dark');
      
      expect(settingsManager.get('ui.theme')).toBe('dark');
      expect(eventSpy).toHaveBeenCalledWith({
        path: 'ui.theme',
        value: 'dark',
        timestamp: expect.any(Number)
      });
    });

    it('should validate setting values', () => {
      // Test valid values
      expect(() => settingsManager.set('models.chat.provider', 'ollama')).not.toThrow();
      expect(() => settingsManager.set('ui.autoSave', true)).not.toThrow();
      
      // Test invalid values should still work (validation warnings only)
      expect(() => settingsManager.set('models.chat.provider', 'invalid')).not.toThrow();
    });

    it('should persist settings to localStorage', () => {
      settingsManager.set('ui.theme', 'dark');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'semem-workbench-settings',
        expect.stringContaining('"theme":"dark"')
      );
    });
  });

  describe('validateSetting', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should validate model provider settings', () => {
      const result1 = settingsManager.validateSetting('models.chat.provider', 'ollama');
      expect(result1.isValid).toBe(true);
      
      const result2 = settingsManager.validateSetting('models.chat.provider', 'invalid');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Invalid chat provider: invalid');
    });

    it('should validate boolean settings', () => {
      const result1 = settingsManager.validateSetting('ui.autoSave', true);
      expect(result1.isValid).toBe(true);
      
      const result2 = settingsManager.validateSetting('ui.autoSave', 'not-boolean');
      expect(result2.isValid).toBe(false);
    });

    it('should validate URL settings', () => {
      const result1 = settingsManager.validateSetting('sparqlEndpoints.0.urlBase', 'http://localhost:3030/');
      expect(result1.isValid).toBe(true);
      
      const result2 = settingsManager.validateSetting('sparqlEndpoints.0.urlBase', 'invalid-url');
      expect(result2.isValid).toBe(false);
    });
  });

  describe('export and import', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should export settings configuration', () => {
      settingsManager.settings = {
        models: { chat: { provider: 'ollama' } },
        ui: { theme: 'dark' }
      };
      
      const exported = settingsManager.export();
      
      expect(exported).toEqual({
        version: '1.0.0',
        timestamp: expect.any(String),
        settings: {
          models: { chat: { provider: 'ollama' } },
          ui: { theme: 'dark' }
        }
      });
    });

    it('should import settings configuration', () => {
      settingsManager.on('settingsImported', eventSpy);
      
      const importData = {
        version: '1.0.0',
        settings: {
          ui: { theme: 'light', autoSave: false }
        }
      };
      
      const result = settingsManager.import(importData);
      
      expect(result.success).toBe(true);
      expect(settingsManager.get('ui.theme')).toBe('light');
      expect(settingsManager.get('ui.autoSave')).toBe(false);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should validate import data', () => {
      const invalidData = { invalid: 'data' };
      
      const result = settingsManager.import(invalidData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid import format');
    });
  });

  describe('model configuration', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should get available providers', () => {
      const chatProviders = settingsManager.getAvailableProviders('chat');
      expect(chatProviders).toContain('ollama');
      expect(chatProviders).toContain('mistral');
      expect(chatProviders).toContain('claude');
      
      const embeddingProviders = settingsManager.getAvailableProviders('embedding');
      expect(embeddingProviders).toContain('ollama');
      expect(embeddingProviders).toContain('nomic');
    });

    it('should get models for provider', () => {
      const ollamaModels = settingsManager.getModelsForProvider('ollama', 'chat');
      expect(ollamaModels).toContain('qwen2:1.5b');
      expect(ollamaModels).toContain('llama3:8b');
      
      const mistralModels = settingsManager.getModelsForProvider('mistral', 'chat');
      expect(mistralModels).toContain('mistral-small-latest');
      expect(mistralModels).toContain('mistral-large-latest');
    });

    it('should get current model configuration', () => {
      settingsManager.settings = {
        models: {
          chat: { provider: 'ollama', model: 'qwen2:1.5b' },
          embedding: { provider: 'ollama', model: 'nomic-embed-text' }
        }
      };
      
      const config = settingsManager.getCurrentModelConfig();
      
      expect(config).toEqual({
        chat: { provider: 'ollama', model: 'qwen2:1.5b' },
        embedding: { provider: 'ollama', model: 'nomic-embed-text' }
      });
    });
  });

  describe('SPARQL endpoints', () => {
    beforeEach(async () => {
      await settingsManager.initialize();
    });

    it('should get SPARQL endpoints', () => {
      settingsManager.settings = {
        sparqlEndpoints: [
          { name: 'Local', urlBase: 'http://localhost:3030/', query: 'sparql' },
          { name: 'DBpedia', urlBase: 'https://dbpedia.org/', query: 'sparql' }
        ]
      };
      
      const endpoints = settingsManager.getSparqlEndpoints();
      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].name).toBe('Local');
      expect(endpoints[1].name).toBe('DBpedia');
    });

    it('should add SPARQL endpoint', () => {
      const newEndpoint = {
        name: 'Wikidata',
        urlBase: 'https://query.wikidata.org/',
        query: 'sparql'
      };
      
      settingsManager.addSparqlEndpoint(newEndpoint);
      
      const endpoints = settingsManager.getSparqlEndpoints();
      expect(endpoints).toContainEqual(newEndpoint);
    });

    it('should remove SPARQL endpoint', () => {
      settingsManager.settings = {
        sparqlEndpoints: [
          { name: 'Local', urlBase: 'http://localhost:3030/', query: 'sparql' },
          { name: 'DBpedia', urlBase: 'https://dbpedia.org/', query: 'sparql' }
        ]
      };
      
      settingsManager.removeSparqlEndpoint(0);
      
      const endpoints = settingsManager.getSparqlEndpoints();
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].name).toBe('DBpedia');
    });
  });

  describe('event system', () => {
    it('should register and trigger event listeners', () => {
      settingsManager.on('test-event', eventSpy);
      
      settingsManager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners', () => {
      settingsManager.on('test-event', eventSpy);
      settingsManager.off('test-event', eventSpy);
      
      settingsManager.emit('test-event', { data: 'test' });
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw
      expect(() => {
        settingsManager.set('ui.theme', 'dark');
      }).not.toThrow();
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      // Should initialize with defaults instead of crashing
      expect(() => {
        new SettingsManager(mockStateManager, mockApiService);
      }).not.toThrow();
    });
  });
});