// tests/unit/Config.vitest.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Config from '../../src/Config.js';
import { setupTestEnvironment } from '../helpers/testSetup.js';
import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Config', () => {
  // Set up test environment utilities
  const utils = setupTestEnvironment();

  // Store original env to restore after tests
  let originalEnv;
  let tempConfigFiles = [];

  // Sample valid config matching Config.defaults
  const validConfig = {
    storage: {
      type: 'sparql',
      options: {
        update: 'http://localhost:4030/test-mem/update',
        query: 'http://localhost:4030/test-mem/query',
        user: 'admin',
        password: 'admin123'
      }
    },
    models: {
      chat: {
        provider: 'mistral',
        model: 'mistral-small-latest',
        options: {}
      },
      embedding: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        options: {}
      }
    },
    memory: {
      dimension: 1536,
      similarityThreshold: 40,
      contextWindow: 3,
      decayRate: 0.0001
    },
    sparqlEndpoints: [{
      label: "test-mem",
      user: "admin",
      password: "admin123",
      urlBase: "http://localhost:4030",
      dataset: "test-mem",
      query: "/test-mem",
      update: "/test-mem",
      upload: "/test-mem/upload",
      gspRead: "/test-mem/data",
      gspWrite: "/test-mem/data"
    }]
  };

  beforeEach(() => {
    // Save the original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should initialize with defaults when no config provided', async () => {
      const config = new Config();
      await config.init();
      expect(config.get('storage.type')).toBe('sparql');
      expect(config.get('models.chat.model')).toBe('mistral-small-latest');
    });

  });

  describe('Configuration Access', () => {
    it('should retrieve nested values', async () => {
      const config = new Config();
      await config.init();
      expect(config.get('models.chat.provider')).toBe('mistral');
      expect(config.get('sparqlEndpoints.0.label')).toBe('Hyperdata Fuseki'); // Uses default config
    });

    it('should handle missing paths', async () => {
      const config = new Config(validConfig);
      await config.init();
      expect(config.get('invalid.path')).toBeUndefined();
      expect(config.get('storage.invalid')).toBeUndefined();
    });

  });

  describe('Static Factory', () => {
    it('should create and initialize in one step', async () => {
      const config = new Config(validConfig);
      await config.init();
      expect(config.initialized).toBe(true);
      expect(config.get('storage.type')).toBe('sparql');
    });

  });

  describe('Schema Validation', () => {

      await expect(config.init()).rejects.toThrow(/Invalid storage type/);
    });



      await expect(config.init()).rejects.toThrow(/Invalid SPARQL endpoint configuration/);
    });
  });

  describe('Security Handling', () => {
    it('should preserve credentials in memory', async () => {
      const config = new Config(validConfig);
      await config.init();
      expect(config.get('sparqlEndpoints.0.password')).toBe('admin123');
    });
  });
});