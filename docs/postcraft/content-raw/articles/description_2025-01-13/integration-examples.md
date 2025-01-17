# Semem Access Mode Integration Examples

## CLI with HTTP API
```javascript
// Script combining CLI and HTTP access
import { CLIHandler } from 'semem/cli';
import { SememClient } from 'semem/client';

const cli = new CLIHandler();
const httpClient = new SememClient({
  baseUrl: 'http://localhost:3000/api'
});

// Use CLI for local operations, HTTP for remote
async function hybridOperation() {
  // Local processing via CLI
  const localData = await cli.executeOperation('query', {
    text: 'local search'
  });

  // Remote processing via HTTP
  const remoteData = await httpClient.query({
    text: 'remote search'
  });

  // Combine results
  return [...localData, ...remoteData];
}
```

## REPL with Forms
```javascript
// REPL command that generates web form
semem> /export-form "SELECT * WHERE { ?s ?p ?o }"

// Generates HTML
<form action="/api/query" method="POST">
  <input type="hidden" name="query" 
    value="SELECT * WHERE { ?s ?p ?o }">
  <button type="submit">Execute Query</button>
</form>
```

## RDF DSL with HTTP API
```turtle
# DSL script using HTTP endpoint
@endpoint <http://localhost:3000/api>

query --remote {
  SELECT ?s ?p ?o 
  WHERE { ?s ?p ?o }
}

store --endpoint <http://remote/store> {
  _:m1 a mcp:Memory ;
    mcp:data "Test data" .
}
```

## Cross-Mode Data Flow
```javascript
// Combined workflow
async function integratedWorkflow() {
  // 1. CLI stores data
  await cli.store('input.ttl');

  // 2. HTTP API processes
  const processed = await httpClient.process({
    graphUri: 'http://example.org/data'
  });

  // 3. RDF DSL queries
  const dslResult = await rdfClient.query(`
    SELECT ?result 
    WHERE { ?s mcp:status "processed" }
  `);

  // 4. Update Forms UI
  await formsClient.updateView(dslResult);
}
```