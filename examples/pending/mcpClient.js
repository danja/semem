// Simple MCP client for testing MCP server facilities
import http from 'http';

const MCP_URL = 'http://localhost:4100/';

function rpcRequest(method, params = undefined, id = 1) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ jsonrpc: '2.0', method, params, id });
    const req = http.request(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  // List all available facilities
  const listed = await rpcRequest('listResources', undefined, 1);
  console.log('Available resources:', listed.result);

  // Read the Ragno ontology
  const ontology = await rpcRequest('readResource', { id: 'ontology' }, 2);
  console.log('\nRagno ontology (truncated):\n', ontology.result.content.slice(0, 300), '...');

  // Read the pipeline entry JS
  const pipeline = await rpcRequest('readResource', { id: 'decomposeCorpus_js' }, 3);
  console.log('\nPipeline code (truncated):\n', pipeline.result.content.slice(0, 300), '...');
})();
