/**
 * LabelStrategy - Generate keyword-based labels for unlabeled entities
 *
 * Finds entities with content but no labels and generates rdfs:label and skos:prefLabel
 * using keyword extraction from content.
 */

import { BaseStrategy } from '../BaseStrategy.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateLabel } from '../../../../../utils/KeywordExtractor.js';
import { createUnifiedLogger } from '../../../../../utils/LoggingConfig.js';

const logger = createUnifiedLogger('LabelStrategy');
const __dirname = dirname(fileURLToPath(import.meta.url));

export class LabelStrategy extends BaseStrategy {
  constructor() {
    super('label');
    this.description = 'Generate keyword-based labels for unlabeled entities';
    this.supportedParameters = ['limit', 'keywordCount', 'dryRun'];
  }

  /**
   * Load SPARQL query from file
   * @param {string} filename - Query filename
   * @returns {string} Query template
   */
  loadQuery(filename) {
    const queryPath = join(__dirname, '../../../../../../sparql/queries', filename);
    return readFileSync(queryPath, 'utf8');
  }

  /**
   * Load SPARQL update template from file
   * @param {string} filename - Update template filename
   * @returns {string} Update template
   */
  loadUpdate(filename) {
    const updatePath = join(__dirname, '../../../../../../sparql/updates', filename);
    return readFileSync(updatePath, 'utf8');
  }

  /**
   * Substitute variables in template
   * @param {string} template - Template string
   * @param {Object} variables - Variable substitutions
   * @returns {string} Processed string
   */
  substituteVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replaceAll(placeholder, value);
    }
    return result;
  }

  /**
   * Escape string for SPARQL
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeSparql(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Execute label generation strategy
   * @param {Object} params - Strategy parameters
   * @param {string} params.target - 'all' for all unlabeled entities
   * @param {Object} params.options - Additional options
   * @param {number} params.options.limit - Maximum entities to process (default: 100)
   * @param {number} params.options.keywordCount - Keywords per label (default: 5)
   * @param {boolean} params.options.dryRun - Preview only, don't update (default: false)
   * @param {Object} context - Execution context with services
   * @returns {Promise<Object>} Strategy result
   */
  async execute(params, context) {
    const { target, options = {} } = params;
    const { memoryManager } = context;

    const limit = options.limit || 100;
    const keywordCount = options.keywordCount || 5;
    const dryRun = options.dryRun || false;

    try {
      this.logOperation('info', 'Starting label generation for unlabeled entities', {
        limit,
        keywordCount,
        dryRun
      });

      // Get graph name from memory manager's store
      const graphName = memoryManager?.store?.graphName || 'http://hyperdata.it/content';

      // Load and execute query to find unlabeled entities
      const queryTemplate = this.loadQuery('find-unlabeled-elements.sparql');
      const query = this.substituteVariables(queryTemplate, {
        graphURI: graphName,
        limit: limit.toString()
      });

      logger.debug('Executing query to find unlabeled entities');
      logger.debug(`Query:\n${query.substring(0, 500)}`);
      const result = await memoryManager.store.executeSparqlQuery(query);

      const entities = result.results.bindings.map(binding => ({
        uri: binding.entity?.value,
        type: binding.type?.value,
        content: binding.content?.value
      }));

      if (entities.length === 0) {
        this.logOperation('info', 'No unlabeled entities found');
        return this.createSuccessResponse({
          processed: 0,
          found: 0,
          message: 'No unlabeled entities found',
          augmentationType: 'label'
        });
      }

      this.logOperation('info', `Found ${entities.length} unlabeled entities`, {
        count: entities.length
      });

      // Load update template
      const updateTemplate = this.loadUpdate('add-labels.sparql');

      const processed = [];
      const failed = [];

      // Process each entity
      for (const entity of entities) {
        try {
          // Generate label from content using keyword extraction
          const label = generateLabel(entity.content, keywordCount);

          if (dryRun) {
            logger.info(`[DRY RUN] Would label ${entity.uri} as: "${label}"`);
            processed.push({
              uri: entity.uri,
              label,
              dryRun: true
            });
            continue;
          }

          // Create and execute update query
          const update = this.substituteVariables(updateTemplate, {
            graphURI: graphName,
            entityURI: entity.uri,
            label: this.escapeSparql(label)
          });

          await memoryManager.store.executeSparqlUpdate(update);

          logger.debug(`Labeled ${entity.uri} as: "${label}"`);
          processed.push({
            uri: entity.uri,
            label
          });

        } catch (error) {
          logger.error(`Failed to label ${entity.uri}: ${error.message}`);
          failed.push({
            uri: entity.uri,
            error: error.message
          });
        }
      }

      this.logOperation('info', 'Label generation complete', {
        found: entities.length,
        processed: processed.length,
        failed: failed.length,
        dryRun
      });

      return this.createSuccessResponse({
        found: entities.length,
        processed: processed.length,
        failed: failed.length,
        processedEntities: processed.slice(0, 10), // First 10 for preview
        failedEntities: failed,
        dryRun,
        message: dryRun
          ? `Would label ${processed.length} entities`
          : `Successfully labeled ${processed.length} of ${entities.length} entities`,
        augmentationType: 'label'
      });

    } catch (error) {
      return this.handleError(error, 'generate labels', {
        limit,
        keywordCount,
        dryRun
      });
    }
  }
}

export default LabelStrategy;
