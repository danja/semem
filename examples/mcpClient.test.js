// Integration test for MCP server using Node.js assert
import assert from 'assert';
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
  // Test: listResources returns expected known ids
  const listed = await rpcRequest('listResources', undefined, 1);
  assert(Array.isArray(listed.result));
  const ids = listed.result.map(r => r.id);
  assert(ids.includes('plan'));
  assert(ids.includes('ontology'));
  assert(ids.includes('decomposeCorpus_js'));

  // Test: readResource returns correct content for ontology
  const ontology = await rpcRequest('readResource', { id: 'ontology' }, 2);
  assert(ontology.result.content.includes('@prefix ragno:'));

  // Test: readResource returns code for pipeline entry
  const pipeline = await rpcRequest('readResource', { id: 'decomposeCorpus_js' }, 3);
  assert(pipeline.result.content.includes('export async function decomposeCorpus'));

  console.log('All MCP integration tests passed!');
})();
