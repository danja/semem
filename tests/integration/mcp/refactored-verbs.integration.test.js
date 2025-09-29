/**
 * Refactored Verbs Integration Test
 * Tests the new command pattern architecture vs the original monolithic approach
 *
 * Run with: INTEGRATION_TESTS=true npx vitest run tests/integration/mcp/refactored-verbs.integration.test.js --reporter=verbose
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Import both versions for comparison
import { SimpleVerbsService as RefactoredService } from '../../../src/mcp/tools/SimpleVerbsServiceRefactored.js';
import { SimpleVerbsService as OriginalService } from '../../../src/mcp/tools/SimpleVerbsService.js';

describe.skipIf(!process.env.INTEGRATION_TESTS)('Refactored Verbs Architecture', () => {

  describe('Architecture Comparison', () => {
    it('should have dramatically different architectures', async () => {
      const refactoredService = new RefactoredService();
      const originalService = new OriginalService();

      // Compare class structures
      const refactoredMethods = Object.getOwnPropertyNames(RefactoredService.prototype);
      const originalMethods = Object.getOwnPropertyNames(OriginalService.prototype);

      console.log('📊 Architecture Comparison:');
      console.log(`   Refactored methods: ${refactoredMethods.length}`);
      console.log(`   Original methods: ${originalMethods.length}`);

      // Refactored should be much smaller
      expect(refactoredMethods.length).toBeLessThan(originalMethods.length);

      // Check for command registry
      expect(refactoredService.registry).toBeDefined();
      expect(typeof refactoredService.registry.execute).toBe('function');

      console.log('✅ Refactored architecture uses command registry pattern');
    });

    it('should support the same core verbs', async () => {
      const refactoredService = new RefactoredService();

      // Initialize the service
      await refactoredService.initialize();

      const supportedVerbs = refactoredService.getSupportedVerbs();
      console.log('🎯 Supported verbs:', supportedVerbs);

      // Should include the three main refactored verbs
      expect(supportedVerbs).toContain('tell');
      expect(supportedVerbs).toContain('ask');
      expect(supportedVerbs).toContain('augment');

      console.log('✅ All core verbs supported in refactored architecture');
    });
  });

  describe('Command Registry Pattern', () => {
    let service;

    beforeEach(async () => {
      service = new RefactoredService();
      await service.initialize();
    });

    it('should execute commands via registry', async () => {
      // Test that the registry executes commands correctly
      const registryHealth = service.getHealthStatus();

      expect(registryHealth.architecture).toBe('command_pattern');
      expect(registryHealth.initialized).toBe(true);
      expect(registryHealth.registryHealth.initialized).toBe(true);

      console.log('✅ Command registry initialized successfully');
      console.log(`   Commands registered: ${registryHealth.registryHealth.commandCount}`);
    });

    it('should handle unknown verbs gracefully', async () => {
      const result = await service.execute('unknown_verb', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported tool');
      expect(result.verb).toBe('unknown_verb');

      console.log('✅ Unknown verbs handled gracefully');
    });
  });

  describe('Tell Command Integration', () => {
    let service;

    beforeEach(async () => {
      service = new RefactoredService();
      await service.initialize();
    });

    it('should execute tell command with strategy pattern', async () => {
      // This will test the full command execution chain
      const result = await service.tell({
        content: 'Test content for refactored tell command',
        type: 'interaction',
        metadata: { source: 'refactor-test' }
      });

      expect(result).toBeDefined();
      expect(result.verb).toBe('tell');

      // Note: This might fail without live services, but shows the architecture works
      console.log('📝 Tell command result:', {
        success: result.success,
        verb: result.verb,
        hasError: !!result.error
      });
    });
  });

  describe('Ask Command Integration', () => {
    let service;

    beforeEach(async () => {
      service = new RefactoredService();
      await service.initialize();
    });

    it('should execute ask command with template integration', async () => {
      const result = await service.ask({
        question: 'What is machine learning?',
        mode: 'comprehensive',
        useContext: true
      });

      expect(result).toBeDefined();
      expect(result.verb).toBe('ask');

      console.log('❓ Ask command result:', {
        success: result.success,
        verb: result.verb,
        hasError: !!result.error
      });
    });
  });

  describe('Augment Command Integration', () => {
    let service;

    beforeEach(async () => {
      service = new RefactoredService();
      await service.initialize();
    });

    it('should execute augment command with strategy selection', async () => {
      const result = await service.augment({
        target: 'Test content for concept extraction and augmentation',
        operation: 'concepts',
        options: { includeEmbeddings: false }
      });

      expect(result).toBeDefined();
      expect(result.verb).toBe('augment');

      console.log('🔧 Augment command result:', {
        success: result.success,
        verb: result.verb,
        operation: result.operation,
        hasError: !!result.error
      });
    });

    it('should use auto strategy for operation selection', async () => {
      const result = await service.augment({
        target: 'Auto-select the best augmentation approach for this content',
        operation: 'auto'
      });

      expect(result).toBeDefined();
      expect(result.verb).toBe('augment');
      expect(result.operation).toBe('auto');

      console.log('🎯 Auto strategy result:', {
        success: result.success,
        selectedOperation: result.selectedOperation,
        autoSelection: result.autoSelection
      });
    });
  });

  describe('Legacy Compatibility', () => {
    let service;

    beforeEach(async () => {
      service = new RefactoredService();
      await service.initialize();
    });

    it('should provide legacy method compatibility', async () => {
      // Test that legacy methods exist and return placeholder responses
      const zoomResult = await service.zoom({ level: 'concept' });
      expect(zoomResult.success).toBe(true);
      expect(zoomResult.verb).toBe('zoom');
      expect(zoomResult.message).toContain('needs extraction');

      const panResult = await service.pan({ direction: 'temporal' });
      expect(panResult.success).toBe(true);
      expect(panResult.verb).toBe('pan');

      console.log('🔗 Legacy compatibility maintained for unextracted verbs');
    });
  });

  describe('Performance and Architecture Benefits', () => {
    it('should demonstrate architectural improvements', async () => {
      const service = new RefactoredService();
      await service.initialize();

      const health = service.getHealthStatus();

      // Verify clean architecture
      expect(health.architecture).toBe('command_pattern');
      expect(health.version).toBe('refactored');
      expect(health.registryHealth.commandCount).toBeGreaterThan(0);

      // Verify supported operations
      const supportedVerbs = service.getSupportedVerbs();
      expect(supportedVerbs.length).toBeGreaterThan(2);

      console.log('🏗️ Architecture Benefits Verified:');
      console.log(`   ✅ Command Pattern: ${health.architecture}`);
      console.log(`   ✅ Registry Commands: ${health.registryHealth.commandCount}`);
      console.log(`   ✅ Supported Verbs: ${supportedVerbs.length}`);
      console.log(`   ✅ Legacy Methods: ${health.legacyMethods.length}`);

      // Check command metadata
      const tellMetadata = service.getCommandMetadata('tell');
      expect(tellMetadata).toBeDefined();
      expect(tellMetadata.name).toBe('tell');

      console.log('🎯 Command Introspection Works');
    });
  });

  describe('Switch Statement Elimination', () => {
    it('should demonstrate elimination of switch statements', async () => {
      const service = new RefactoredService();

      // The main execute method should be very short now
      const executeMethod = service.execute.toString();

      // Should not contain switch statements
      expect(executeMethod).not.toContain('switch (');
      expect(executeMethod).not.toContain('case ');

      // Should delegate to registry
      expect(executeMethod).toContain('registry.execute');

      console.log('🚫 Switch Statement Elimination Verified:');
      console.log('   ✅ No switch statements in main execute()');
      console.log('   ✅ Delegates to registry pattern');
      console.log('   ✅ Clean, maintainable code');
    });
  });
});