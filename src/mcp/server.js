// MCP Server: JSON-RPC 2.0 implementation for Semem memory/resource management
import http from 'http';
import Ajv from 'ajv';
import fs from 'fs/promises';
import path from 'path';
import { LATEST_PROTOCOL_VERSION } from '../types/mcp-schema.js';

// Load MCP JSON Schema
const schemaPath = path.resolve('src/types/mcp-schema.json');
const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const PORT = process.env.MCP_PORT || 4100;

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function handleJSONRPC(req, res, body) {
  let msg;
  try {
    msg = JSON.parse(body);
  } catch (e) {
    return send(res, 400, { error: 'Invalid JSON' });
  }
  if (!validate(msg)) {
    return send(res, 400, { error: 'Schema validation failed', details: validate.errors });
  }

  // Resource registry: map resource IDs to files
  // MCP resource registry: advertise all available Ragno/Semem facilities
  const resources = {
    // Core documentation
    plan: {
      id: 'plan', type: 'text', path: 'docs/ragno/PLAN.md', title: 'Ragno Implementation Plan' },
    progress: {
      id: 'progress', type: 'text', path: 'docs/ragno/PLAN-progress.md', title: 'Ragno Implementation Progress Log' },
    readme: {
      id: 'readme', type: 'text', path: 'docs/ragno/README.md', title: 'Ragno README' },
    // Ontology and reference
    ontology: {
      id: 'ontology', type: 'ontology', path: 'docs/ragno/ragno.ttl', title: 'Ragno Ontology (Turtle)'
    },
    noderag_terms: {
      id: 'noderag_terms', type: 'text', path: 'docs/ragno/noderag-terms.md', title: 'NodeRAG Terms Reference' },
    namespace: {
      id: 'namespace', type: 'text', path: 'docs/ragno/namespace.md', title: 'Ragno Namespace Reference' },
    ragno_algorithms: {
      id: 'ragno_algorithms', type: 'text', path: 'docs/ragno/ragno-algorithms.md', title: 'Ragno Algorithms' },
    ragno_index: {
      id: 'ragno_index', type: 'text', path: 'docs/ragno/ragno-index.md', title: 'Ragno Index' },
    ragno_reference: {
      id: 'ragno_reference', type: 'text', path: 'docs/ragno/ragno-reference.md', title: 'Ragno Reference' },
    ragno_sparql: {
      id: 'ragno_sparql', type: 'text', path: 'docs/ragno/ragno-sparql.md', title: 'Ragno SPARQL Templates' },
    // Config and example data
    ragno_config: {
      id: 'ragno_config', type: 'config', path: 'docs/ragno/ragno-config.json', title: 'Ragno Pipeline Config' },
    ragno_example_ttl: {
      id: 'ragno_example_ttl', type: 'ontology', path: 'docs/ragno/ragno-example.ttl', title: 'Ragno Example (Turtle)'
    },
    decompose_corpus_py: {
      id: 'decompose_corpus_py', type: 'code', path: 'docs/ragno/decompose_corpus.py', title: 'Python: Decompose Corpus Example' },
    // Pipeline code modules
    decomposeCorpus_js: {
      id: 'decomposeCorpus_js', type: 'code', path: 'src/ragno/decomposeCorpus.js', title: 'JS: decomposeCorpus (pipeline entry)'
    },
    augmentWithAttributes_js: {
      id: 'augmentWithAttributes_js', type: 'code', path: 'src/ragno/augmentWithAttributes.js', title: 'JS: augmentWithAttributes (attribute augmentation)'
    },
    aggregateCommunities_js: {
      id: 'aggregateCommunities_js', type: 'code', path: 'src/ragno/aggregateCommunities.js', title: 'JS: aggregateCommunities (community detection)'
    },
    enrichWithEmbeddings_js: {
      id: 'enrichWithEmbeddings_js', type: 'code', path: 'src/ragno/enrichWithEmbeddings.js', title: 'JS: enrichWithEmbeddings (enrichment)'
    },
    exportAttributesToSPARQL_js: {
      id: 'exportAttributesToSPARQL_js', type: 'code', path: 'src/ragno/exportAttributesToSPARQL.js', title: 'JS: exportAttributesToSPARQL'
    },
    exportCommunityAttributesToSPARQL_js: {
      id: 'exportCommunityAttributesToSPARQL_js', type: 'code', path: 'src/ragno/exportCommunityAttributesToSPARQL.js', title: 'JS: exportCommunityAttributesToSPARQL'
    },
    exportSimilarityLinksToSPARQL_js: {
      id: 'exportSimilarityLinksToSPARQL_js', type: 'code', path: 'src/ragno/exportSimilarityLinksToSPARQL.js', title: 'JS: exportSimilarityLinksToSPARQL'
    },
    // Data models
    Attribute_js: {
      id: 'Attribute_js', type: 'code', path: 'src/ragno/Attribute.js', title: 'JS: Attribute Model' },
    Entity_js: {
      id: 'Entity_js', type: 'code', path: 'src/ragno/Entity.js', title: 'JS: Entity Model' },
    Relationship_js: {
      id: 'Relationship_js', type: 'code', path: 'src/ragno/Relationship.js', title: 'JS: Relationship Model' },
    SemanticUnit_js: {
      id: 'SemanticUnit_js', type: 'code', path: 'src/ragno/SemanticUnit.js', title: 'JS: SemanticUnit Model' }
  };

  // List all available resource metadata
  if (msg.method === 'listResources') {
    const result = Object.values(resources).map(r => ({
      id: r.id,
      type: r.type,
      title: r.title
    }));
    // Validate outgoing response (MCP schema expects JSON-RPC response)
    const response = { jsonrpc: '2.0', id: msg.id, result };
    if (!validate(response)) {
      return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
    }
    return send(res, 200, response);
  }

  // Read a specific resource by id
  if (msg.method === 'readResource') {
    const { id } = msg.params || {};
    const resource = resources[id];
    if (!resource) {
      return send(res, 404, { error: 'Resource not found', id: msg.id });
    }
    try {
      const content = await fs.readFile(resource.path, 'utf-8');
      const result = {
        id: resource.id,
        type: resource.type,
        title: resource.title,
        content
      };
      const response = { jsonrpc: '2.0', id: msg.id, result };
      if (!validate(response)) {
        return send(res, 500, { error: 'Outgoing schema validation failed', details: validate.errors });
      }
      return send(res, 200, response);
    } catch (e) {
      return send(res, 500, { error: 'Failed to read resource', details: e.message });
    }
  }

  // ... add more methods as needed
  send(res, 404, { error: 'Method not found', id: msg.id });
}


const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    send(res, 405, { error: 'Only POST supported' });
    return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => handleJSONRPC(req, res, body));
});

server.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}/ (protocol ${LATEST_PROTOCOL_VERSION})`);
});
