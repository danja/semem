import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { z, ZodError } from 'zod';

import SimpleVerbsService from '../mcp/tools/SimpleVerbsService.js';
import { createUnifiedLogger } from '../utils/LoggingConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WORKFLOW_DIR = path.resolve(__dirname);
const PARAMETER_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'any'];
const PLACEHOLDER_REGEX = /\$\{([^}]+)\}/g;
const EXACT_PLACEHOLDER_REGEX = /^\$\{([^}]+)\}$/;

const parameterDefinitionSchema = z.object({
  type: z.enum(PARAMETER_TYPES),
  required: z.boolean().optional().default(false),
  nullable: z.boolean().optional().default(false),
  description: z.string().optional(),
  default: z.any().optional()
}).superRefine((definition, ctx) => {
  if (definition.default === undefined) {
    return;
  }

  if (definition.type === 'any') {
    return;
  }

  if (!matchesParameterType(definition.default, definition.type, definition.nullable)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Default value does not match declared type "${definition.type}"`,
    });
  }
});

const stepSchema = z.object({
  id: z.string().min(1).optional(),
  verb: z.string().min(1, 'Step verb is required'),
  operation: z.string().min(1).optional(),
  args: z.record(z.unknown()).optional().default({}),
  continueOnError: z.boolean().optional(),
  description: z.string().optional()
});

const workflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  parameters: z.record(parameterDefinitionSchema).optional().default({}),
  steps: z.array(stepSchema).min(1, 'Workflow must contain at least one step')
});

const logger = createUnifiedLogger('WorkflowRunner');

function getByPath(obj, pathExpression) {
  if (!pathExpression) return undefined;
  const parts = pathExpression.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function formatValidationIssues(error) {
  if (!(error instanceof ZodError)) {
    return error.message || 'Unknown error';
  }

  return error.issues
    .map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function matchesParameterType(value, expectedType, nullable = false) {
  if (expectedType === 'any') {
    return true;
  }

  if (value === null) {
    return nullable;
  }

  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
}

function createPlaceholderError(expression, metadata = {}) {
  const details = [
    `Missing value for placeholder "${expression}"`,
  ];

  if (metadata.path) {
    details.push(`at ${metadata.path}`);
  }
  if (metadata.stepId) {
    details.push(`step ${metadata.stepId}`);
  }
  if (metadata.workflowName) {
    details.push(`workflow "${metadata.workflowName}"`);
  }
  if (metadata.filePath) {
    details.push(`definition ${metadata.filePath}`);
  }

  const error = new Error(details.join(' - '));
  error.code = 'WORKFLOW_PLACEHOLDER_MISSING';
  return error;
}

function resolveValue(value, context, metadata = {}) {
  if (typeof value !== 'string') {
    return value;
  }

  const exactMatch = value.match(EXACT_PLACEHOLDER_REGEX);
  if (exactMatch) {
    const expression = exactMatch[1].trim();
    const replacement = getByPath(context, expression);

    if (replacement === undefined) {
      throw createPlaceholderError(expression, metadata);
    }

    return replacement;
  }

  const matches = [...value.matchAll(PLACEHOLDER_REGEX)];
  if (matches.length === 0) {
    return value;
  }

  let result = value;
  for (const match of matches) {
    const expression = match[1].trim();
    const replacement = getByPath(context, expression);

    if (replacement === undefined) {
      throw createPlaceholderError(expression, metadata);
    }

    if (typeof replacement === 'object') {
      result = result.replace(match[0], JSON.stringify(replacement));
    } else if (replacement === null) {
      result = result.replace(match[0], 'null');
    } else {
      result = result.replace(match[0], String(replacement));
    }
  }
  return result;
}

function resolveObject(target, context, metadata = {}) {
  if (target === null || target === undefined) {
    return target;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(target)) {
    return target;
  }

  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(target)) {
    return target;
  }

  if (target instanceof Date) {
    return target;
  }

  if (Array.isArray(target)) {
    const resolvedArray = target
      .map((item, index) => resolveObject(item, context, { ...metadata, path: metadata.path ? `${metadata.path}[${index}]` : `[${index}]` }))
      .filter(item => item !== undefined);
    return resolvedArray;
  }
  if (target && typeof target === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(target)) {
      const nextMetadata = metadata.path
        ? { ...metadata, path: `${metadata.path}.${key}` }
        : { ...metadata, path: key };
      const resolvedValue = resolveObject(value, context, nextMetadata);
      if (resolvedValue !== undefined) {
        resolved[key] = resolvedValue;
      }
    }
    return resolved;
  }
  const resolvedValue = resolveValue(target, context, metadata);
  return resolvedValue === undefined ? undefined : resolvedValue;
}

function validateWorkflowDefinition(rawWorkflow, filePath) {
  try {
    const parsed = workflowSchema.parse(rawWorkflow);
    const seenIds = new Set();
    const steps = parsed.steps.map((step, index) => {
      const stepId = step.id ?? `step_${index}`;
      if (seenIds.has(stepId)) {
        throw new Error(`Duplicate step id "${stepId}" detected`);
      }
      seenIds.add(stepId);
      return {
        ...step,
        id: stepId,
        args: step.args ?? {}
      };
    });

    return {
      ...parsed,
      steps,
      __filePath: filePath,
      __validated: true
    };
  } catch (error) {
    const details = formatValidationIssues(error);
    const prefix = filePath ? `Invalid workflow definition (${filePath})` : 'Invalid workflow definition';
    const validationError = new Error(`${prefix}: ${details}`);
    validationError.cause = error;
    throw validationError;
  }
}

function prepareParameters(workflow, params = {}) {
  const definitions = workflow.parameters || {};
  const normalized = { ...params };

  for (const [name, definition] of Object.entries(definitions)) {
    const valueProvided = Object.prototype.hasOwnProperty.call(params, name);
    let value = valueProvided ? params[name] : undefined;

    if (value === undefined) {
      if (definition.required) {
        throw new Error(`Missing required parameter "${name}" for workflow "${workflow.name}"`);
      }
      if (Object.prototype.hasOwnProperty.call(definition, 'default')) {
        value = definition.default;
      }
    }

    if (value !== undefined) {
      if (!matchesParameterType(value, definition.type, definition.nullable)) {
        throw new Error(
          `Parameter "${name}" expected type "${definition.type}"${definition.nullable ? ' (nullable)' : ''} but received ${typeof value}`
        );
      }
      normalized[name] = value;
    }
  }

  return normalized;
}

export class WorkflowRunner {
  constructor(options = {}) {
    this.workflowsDir = options.workflowsDir || DEFAULT_WORKFLOW_DIR;
    this.verbsService = options.verbsService || new SimpleVerbsService();
  }

  async loadWorkflow(name) {
    const filePath = path.join(this.workflowsDir, `${name}.json`);
    const payload = await fs.promises.readFile(filePath, 'utf-8');
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      const parseError = new Error(`Failed to parse workflow JSON (${filePath}): ${error.message}`);
      parseError.cause = error;
      throw parseError;
    }

    return validateWorkflowDefinition(parsed, filePath);
  }

  async runWorkflow(name, params = {}) {
    const workflow = await this.loadWorkflow(name);
    return await this.executeWorkflow(workflow, params);
  }

  async executeWorkflow(workflow, params = {}) {
    const workflowDefinition = workflow?.__validated ? workflow : validateWorkflowDefinition(workflow, workflow.__filePath);
    const normalizedParams = prepareParameters(workflowDefinition, params);

    await this.verbsService.initialize();

    const context = {
      ...normalizedParams,
    };

    const stepResults = {};
    const executionLog = [];

    logger.info('Starting workflow execution', {
      workflow: workflowDefinition.name,
      steps: workflowDefinition.steps.length,
      parameters: Object.keys(normalizedParams)
    });

    for (let index = 0; index < workflowDefinition.steps.length; index++) {
      const step = workflowDefinition.steps[index];
      const stepId = step.id || `step_${index}`;

      logger.debug('Executing workflow step', {
        workflow: workflowDefinition.name,
        step: stepId,
        verb: step.verb,
        operation: step.operation
      });

      const mergedContext = {
        ...context,
        ...stepResults,
      };

      const resolutionMetadata = {
        workflowName: workflowDefinition.name,
        stepId,
        filePath: workflowDefinition.__filePath
      };

      const resolvedArgs = resolveObject(step.args || {}, mergedContext, resolutionMetadata);
      let payload = resolvedArgs;
      if (step.operation) {
        payload = {
          operation: resolveValue(step.operation, mergedContext, resolutionMetadata),
          ...resolvedArgs
        };
      }

      const result = await this.executeVerb(step.verb, payload);

      stepResults[stepId] = result;
      context[`$${stepId}`] = result;

      executionLog.push({
        id: stepId,
        verb: step.verb,
        operation: step.operation,
        args: payload,
        result
      });

      if (result && result.success === false && step.continueOnError !== true) {
        logger.error('Workflow step failed', {
          workflow: workflowDefinition.name,
          step: stepId,
          verb: step.verb,
          error: result.error || 'Unknown error'
        });
        const error = new Error(`Workflow step ${stepId} failed: ${result.error || 'Unknown error'}`);
        error.step = stepId;
        error.result = result;
        throw error;
      }
    }

    logger.info('Completed workflow execution', {
      workflow: workflowDefinition.name,
      steps: executionLog.length
    });

    return {
      success: true,
      workflow: workflowDefinition.name,
      description: workflowDefinition.description,
      results: stepResults,
      log: executionLog
    };
  }

  async executeVerb(verb, args = {}) {
    if (!verb) {
      throw new Error('Workflow step is missing verb');
    }
    if (typeof this.verbsService?.execute === 'function') {
      return await this.verbsService.execute(verb, args);
    }
    const method = this.verbsService[verb];
    if (typeof method === 'function') {
      return await method.call(this.verbsService, args);
    }
    throw new Error(`Verb not supported: ${verb}`);
  }
}

export default WorkflowRunner;
