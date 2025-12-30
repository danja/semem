import { z } from 'zod';
import { initializeServices, getMemoryManager } from '../../../lib/initialization.js';
import { SafeOperations } from '../../../lib/safe-operations.js';
import { mcpDebugger } from '../../../lib/debug-utils.js';
import {
  ZPTAnalyzeCorpusSchema,
  ZPTGetOptionsSchema,
  ZPTPreviewSchema,
  ZPTToolName,
  ZPTValidateParamsSchema
} from './schemas.js';
import { ZPTNavigationService } from './ZPTNavigationService.js';

export function registerZPTTools(server) {
  mcpDebugger.info('Registering ZPT tools...');

  let service = null;

  function getService(memoryManager, safeOps) {
    if (!service) {
      service = new ZPTNavigationService();
    }
    service.memoryManager = memoryManager;
    service.safeOps = safeOps;
    return service;
  }

  server.tool(
    ZPTToolName.PREVIEW,
    'Get a lightweight preview of a navigation destination.',
    ZPTPreviewSchema,
    async ({ query, zoom, pan }) => {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const svc = getService(memoryManager, safeOps);
      const result = await svc.preview(query, zoom, pan);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    ZPTToolName.GET_SCHEMA,
    'Get the ZPT schema and available dimensions.',
    z.object({}),
    async () => {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const svc = getService(memoryManager, safeOps);
      const result = await svc.getSchema();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    ZPTToolName.VALIDATE_PARAMS,
    'Validate a set of ZPT navigation parameters.',
    ZPTValidateParamsSchema,
    async ({ params }) => {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const svc = getService(memoryManager, safeOps);
      const result = await svc.validateParams(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    ZPTToolName.GET_OPTIONS,
    'Get available options for ZPT navigation.',
    ZPTGetOptionsSchema,
    async ({ context, query }) => {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const svc = getService(memoryManager, safeOps);
      const result = await svc.getOptions(context, query);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    ZPTToolName.ANALYZE_CORPUS,
    'Analyze the corpus for ZPT navigation readiness.',
    ZPTAnalyzeCorpusSchema,
    async ({ analysisType, includeStats }) => {
      await initializeServices();
      const memoryManager = getMemoryManager();
      const safeOps = new SafeOperations(memoryManager);
      const svc = getService(memoryManager, safeOps);
      const result = await svc.analyzeCorpus(analysisType, includeStats);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  mcpDebugger.info('ZPT tools registered successfully.');
}

export { ZPTNavigationService, ZPTToolName };
