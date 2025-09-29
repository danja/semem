/**
 * ProjectContextCommand - Manage project contexts
 *
 * Handles project-specific context creation, switching, and management.
 */

import { BaseVerbCommand } from './BaseVerbCommand.js';
import { ProjectContextSchema } from '../../VerbSchemas.js';
import { logOperation } from '../../VerbsLogger.js';

export class ProjectContextCommand extends BaseVerbCommand {
  constructor() {
    super('project_context');
    this.schema = ProjectContextSchema;
  }

  /**
   * Execute project context command
   * @param {Object} params - Command parameters
   * @param {string} params.projectId - Project identifier
   * @param {string} params.action - Action to perform (create, switch, list, archive)
   * @param {Object} params.metadata - Project metadata
   * @returns {Promise<Object>} Command result
   */
  async execute(params) {
    const validatedParams = this.validateParameters(params);
    const { projectId, action = 'switch', metadata = {} } = validatedParams;

    try {
      this.logOperation('debug', 'Simple Verb: project_context', {
        projectId,
        action,
        hasMetadata: Object.keys(metadata).length > 0
      });

      let result;

      switch (action) {
        case 'create':
          result = await this.memoryDomainManager.createDomain('project', projectId, {
            name: metadata.name,
            description: metadata.description,
            tags: metadata.tags
          });
          break;

        case 'switch':
          const currentDomains = this.stateManager.getState().pan?.domains || [];
          const projectDomain = `project:${projectId}`;

          if (!currentDomains.includes(projectDomain)) {
            result = await this.memoryDomainManager.switchDomain(
              currentDomains,
              [...currentDomains, projectDomain]
            );
          } else {
            result = { success: true, message: 'Already in project context', projectId };
          }
          break;

        case 'list':
          // List all project domains (placeholder - would query SPARQL)
          result = { success: true, projects: [], message: 'Project listing not implemented' };
          break;

        case 'archive':
          result = await this.memoryDomainManager.fadeContext(`project:${projectId}`, 0.05);
          break;

        default:
          throw new Error(`Unknown project context action: ${action}`);
      }

      // Update pan state if switching contexts
      if (action === 'switch' && result.success) {
        const newDomains = this.stateManager.getState().pan?.domains || [];
        result = await this.memoryDomainManager.switchDomain(
          this.stateManager.getState().pan?.domains || [],
          newDomains
        );
      }

      return this.createSuccessResponse({
        projectId,
        action,
        metadata,
        result,
        zptState: this.stateManager.getState()
      });

    } catch (error) {
      return this.handleError(error, 'project context operation', {
        projectId,
        action,
        metadata
      });
    }
  }
}

export default ProjectContextCommand;