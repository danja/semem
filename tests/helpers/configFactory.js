/**
 * Configuration factory for generating test configurations dynamically
 */
import { Config } from '../../src/Config.js';
import fs from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export class ConfigFactory {
  static tempConfigFiles = [];

  static createTestConfig(overrides = {}) {
    const baseConfig = {
      storage: {
        type: 'memory',
        options: {}
      },
      models: {
        chat: {
          provider: 'ollama',
          model: 'qwen2:1.5b',
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
        similarityThreshold: 0.7,
        contextWindow: 3,
        decayRate: 0.0001
      },
      sparqlEndpoints: [{
        label: 'Test SPARQL',
        user: 'admin',
        password: 'admin123',
        urlBase: 'http://localhost:3030',
        dataset: 'test',
        query: '/test/query',
        update: '/test/update',
        upload: '/test/upload',
        gspRead: '/test/data',
        gspWrite: '/test/data'
      }],
      llmProviders: [{
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        chatModel: 'qwen2:1.5b',
        embeddingModel: 'nomic-embed-text',
        priority: 1,
        capabilities: ['embedding', 'chat'],
        description: 'Test Ollama provider'
      }]
    };

    return this.mergeDeep(baseConfig, overrides);
  }

  static createSPARQLConfig(overrides = {}) {
    return this.createTestConfig({
      storage: {
        type: 'sparql',
        options: {
          update: 'http://localhost:3030/test/update',
          query: 'http://localhost:3030/test/query',
          user: 'admin',
          password: 'admin123'
        }
      },
      ...overrides
    });
  }

  static createLLMConfig(provider = 'ollama', overrides = {}) {
    const configs = {
      ollama: {
        llmProviders: [{
          type: 'ollama',
          baseUrl: 'http://localhost:11434',
          chatModel: 'qwen2:1.5b',
          embeddingModel: 'nomic-embed-text',
          priority: 1,
          capabilities: ['embedding', 'chat']
        }]
      },
      mistral: {
        llmProviders: [{
          type: 'mistral',
          apiKey: process.env.MISTRAL_API_KEY || 'test-key',
          chatModel: 'mistral-small-latest',
          priority: 1,
          capabilities: ['chat']
        }]
      }
    };

    return this.createTestConfig(this.mergeDeep(configs[provider] || configs.ollama, overrides));
  }

  static createTempConfigFile(config) {
    const tempPath = join(tmpdir(), `test-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`);
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
    this.tempConfigFiles.push(tempPath);
    return tempPath;
  }

  static cleanupTempFiles() {
    for (const file of this.tempConfigFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.tempConfigFiles = [];
  }

  static mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target))
            Object.assign(output, { [key]: source[key] });
          else
            output[key] = this.mergeDeep(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

export default ConfigFactory;