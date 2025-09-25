import rdf from 'rdf-ext';
import SemanticUnit from './SemanticUnit.js';
import Entity from './Entity.js';
import Relationship from './Relationship.js';
import RDFGraphManager from './core/RDFGraphManager.js';
import NamespaceManager from './core/NamespaceManager.js';
import { logger } from '../Utils.js';
import { getPromptManager, PromptContext, PromptOptions } from '../prompts/index.js';
import ParseHelper from '../utils/ParseHelper.js';

/**
 * Decompose text chunks into RDF-based semantic units, entities, and relationships
 * @param {Array<{content: string, source: string}>} textChunks - Text chunks to decompose
 * @param {Object} llmHandler - LLM handler instance for executing prompts
 * @param {Object} [options] - Decomposition options
 * @returns {Promise<{units: SemanticUnit[], entities: Entity[], relationships: Relationship[], dataset: Dataset}>}
 */
export async function decomposeCorpus(textChunks, llmHandler, options = {}) {
  const startTime = Date.now();
  logger.info(`Starting corpus decomposition: ${textChunks.length} chunks`);

  const promptManager = getPromptManager();

  // Ensure we have an LLM handler
  if (!llmHandler) {
    throw new Error('LLM handler is required for corpus decomposition');
  }

  const opts = {
    extractRelationships: options.extractRelationships !== false,
    generateSummaries: options.generateSummaries !== false,
    minEntityConfidence: options.minEntityConfidence,
    maxEntitiesPerUnit: options.maxEntitiesPerUnit || 10,
    model: options.model, // Allow model override
    ...options
  };

  const namespaceManager = new NamespaceManager();
  const rdfManager = new RDFGraphManager({ namespace: namespaceManager });
  const dataset = rdf.dataset();

  const units = [];
  const entitiesMap = new Map();
  const relationships = [];
  const unitEntityConnections = [];

  try {
    for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
      const chunk = textChunks[chunkIndex];
      logger.debug(`Processing chunk ${chunkIndex + 1}/${textChunks.length}`);

      const unitTexts = await extractSemanticUnits(chunk.content, promptManager, llmHandler, opts);

      for (let unitIndex = 0; unitIndex < unitTexts.length; unitIndex++) {
        const unitText = unitTexts[unitIndex];
        const unitId = `unit_${chunkIndex}_${unitIndex}`;

        let summary = '';
        if (opts.generateSummaries && unitText.length > 100) {
          summary = await generateUnitSummary(unitText, promptManager, llmHandler, opts);
        }

        const unit = new SemanticUnit({
          dataset: rdf.dataset(),
          text: unitText,
          summary: summary,
          source: chunk.source,
          position: 0,
          length: unitText.length
        });
        units.push(unit);
        unit.exportToDataset(dataset);

        const unitEntities = await extractEntitiesFromUnit(unitText, promptManager, llmHandler, opts);

        for (const entityData of unitEntities) {
          let entity = entitiesMap.get(entityData.name);
          if (!entity) {
            entity = new Entity({
              name: entityData.name,
              isEntryPoint: entityData.isEntryPoint || false,
              subType: entityData.type || 'general',
              confidence: entityData.confidence || 1.0,
              alternativeLabels: entityData.alternatives || [],
              source: chunk.source
            });
            entitiesMap.set(entityData.name, entity);
            entity.exportToDataset(dataset);
          } else {
            entity.incrementFrequency();
            entity.addSource(chunk.source);
          }
          unit.addEntityMention(entity.getURI(), entityData.relevance || 1.0);
          unitEntityConnections.push({
            unit: unit,
            entity: entity,
            relevance: entityData.relevance || 1.0,
            context: unitText
          });
        }
        logger.debug(`Unit ${unitId}: ${unitEntities.length} entities extracted`);
      }
    }

    if (opts.extractRelationships && entitiesMap.size > 1) {
      logger.info('Phase 2: Extracting relationships between entities...');
      const entityList = Array.from(entitiesMap.values());
      const relationshipData = await extractRelationships(entityList, units, promptManager, llmHandler, opts);

      for (const relData of relationshipData) {
        const sourceEntity = entitiesMap.get(relData.source);
        const targetEntity = entitiesMap.get(relData.target);
        if (sourceEntity && targetEntity) {
          const relationship = new Relationship({
            id: `rel_${relationships.length}`,
            sourceEntity: sourceEntity.getURI(),
            targetEntity: targetEntity.getURI(),
            relationshipType: relData.type || 'related',
            content: relData.content || '',
            weight: relData.weight,
            evidence: relData.evidence || [],
            bidirectional: relData.bidirectional || false
          });
          relationships.push(relationship);
          relationship.exportToDataset(dataset);
        }
      }
      logger.info(`Created ${relationships.length} relationships`);
    }

    await createInterUnitRelationships(units, dataset, rdfManager);

    const processingTime = Date.now() - startTime;
    logger.info(`Corpus decomposition completed in ${processingTime}ms: ${units.length} units, ${entitiesMap.size} entities, ${relationships.length} relationships`);

    return {
      units,
      entities: Array.from(entitiesMap.values()),
      relationships,
      dataset,
      connections: unitEntityConnections,
      statistics: {
        processingTime,
        totalChunks: textChunks.length,
        totalUnits: units.length,
        totalEntities: entitiesMap.size,
        totalRelationships: relationships.length,
        averageEntitiesPerUnit: entitiesMap.size / units.length
      }
    };
  } catch (error) {
    logger.error('Corpus decomposition failed:', error);
    throw error;
  }
}

async function extractSemanticUnits(text, promptManager, llmHandler, options) {
  const context = new PromptContext({
    arguments: { text },
    model: options.model
  });
  const promptOptions = new PromptOptions({ temperature: 0.1 });

  try {
    const result = await promptManager.generatePrompt('decomposition-extract-units', context, promptOptions);
    const response = await llmHandler.generateResponse(result.content, '', {
      model: options.model,
      temperature: 0.1
    });
    const cleanedResponse = ParseHelper.resolveSyntax(response);
    const units = JSON.parse(cleanedResponse);
    return Array.isArray(units) ? units : [text];
  } catch (error) {
    logger.warn('LLM unit extraction failed, using sentence splitting fallback:', error.message);
    return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  }
}

async function generateUnitSummary(unitText, promptManager, llmHandler, options) {
  const context = new PromptContext({
    arguments: { unitText },
    model: options.model
  });
  const promptOptions = new PromptOptions({ temperature: 0.1, maxTokens: 100 });

  try {
    const result = await promptManager.generatePrompt('decomposition-summarize-unit', context, promptOptions);
    const response = await llmHandler.generateResponse(result.content, '', {
      model: options.model,
      temperature: 0.1
    });
    return response.trim();
  } catch (error) {
    logger.warn('Summary generation failed:', error.message);
    return unitText.substring(0, 100) + '...';
  }
}

async function extractEntitiesFromUnit(unitText, promptManager, llmHandler, options) {
  const context = new PromptContext({
    arguments: { unitText },
    model: options.model
  });
  const promptOptions = new PromptOptions({ temperature: 0.1, maxTokens: 500 });

  try {
    const result = await promptManager.generatePrompt('decomposition-extract-entities', context, promptOptions);
    const response = await llmHandler.generateResponse(result.content, '', {
      model: options.model,
      temperature: 0.1
    });
    const cleanedResponse = ParseHelper.resolveSyntax(response);
    const entities = JSON.parse(cleanedResponse);
    return Array.isArray(entities) ? entities.filter(e => e.name && e.name.length > 1 && (e.confidence || 1.0) >= options.minEntityConfidence).slice(0, options.maxEntitiesPerUnit) : [];
  } catch (error) {
    logger.warn('Entity extraction failed, using fallback:', error.message);
    const words = unitText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return words.slice(0, options.maxEntitiesPerUnit).map(name => ({ name, type: 'general', relevance: 0.5, isEntryPoint: false, confidence: 0.5 }));
  }
}

async function extractRelationships(entities, units, promptManager, llmHandler, options) {
  const relationships = [];
  const entityNames = entities.map(e => e.getPreferredLabel() || '').filter(Boolean);

  for (const unit of units) {
    const unitEntityNames = entityNames.filter(name => unit.getContent().toLowerCase().includes(name.toLowerCase()));
    if (unitEntityNames.length < 2) continue;

    const context = new PromptContext({
      arguments: {
        entityNames: JSON.stringify(unitEntityNames),
        unitText: unit.getContent()
      },
      model: options.model
    });
    const promptOptions = new PromptOptions({ temperature: 0.1, maxTokens: 300 });

    try {
      const result = await promptManager.generatePrompt('decomposition-extract-relationships', context, promptOptions);
      const response = await llmHandler.generateResponse(result.content, '', {
        model: options.model,
        temperature: 0.1
      });
      const cleanedResponse = ParseHelper.resolveSyntax(response);
      const unitRelationships = JSON.parse(cleanedResponse);

      if (Array.isArray(unitRelationships)) {
        for (const rel of unitRelationships) {
          if (rel.source && rel.target && rel.source !== rel.target) {
            relationships.push({ ...rel, evidence: [unit.getURI()], bidirectional: rel.bidirectional || false });
          }
        }
      }
    } catch (error) {
      logger.warn(`Relationship extraction failed for unit: ${error.message}`);
    }
  }
  return relationships;
}

async function createInterUnitRelationships(units, dataset, rdfManager) {
  logger.debug('Creating inter-unit relationships...');
  for (let i = 0; i < units.length - 1; i++) {
    const currentUnit = units[i];
    const nextUnit = units[i + 1];
    const relationship = new Relationship({
      id: `unit_rel_${i}`,
      sourceEntity: currentUnit.getURI(),
      targetEntity: nextUnit.getURI(),
      relationshipType: 'follows',
      content: 'Sequential narrative flow',
      weight: 0.3,
      bidirectional: false
    });
    relationship.exportToDataset(dataset);
  }
  logger.debug(`Created ${units.length - 1} inter-unit relationships`);
}
