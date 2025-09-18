npx vitest run tests/integration/sparql/enhanced-sparql-core.test.js --reporter=verbose

node src/frontend/vsom-standalone/server.js

PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT * WHERE {
  graph ?g{
    ?sub ?pred ?obj ;
    ?p2 ?o2 .
  FILTER (regex(str(?obj), "wormalade", "i"))
  } .
} 

src/ragno/Entity.js)
 static generateURI(name, baseURI = 'http://example.org/ragno/') {

The SPARQL store is still empty, which means the data is only in the memory store, not persisted to SPARQL. This explains why the VSOM can't find corpus communities - it's
  trying to query SPARQL but the data isn't there.

  The issue is that the system architecture notes state "The memory and json storage backends are being phased out, sparql storage should be used throughout", but the API is still
   using memory storage.

Figure out how best to move the API from using memory storage to data persisted in the SPARQL store. This has to be done following best practices. A list should be made of any code that still uses in-memory or JSON storage. This code will subsequently removed, so ensure all bases are covered.
Save the plan and keep progress reports in docs/MORE-SPARQL.md

now do calls to the server, a Tell "wormalade is marmalade made from worms" followed by an Ask "what is wormalade?" 

## General

* use src/utils logger not console
* mcp server should be logging to file under logs/ using the logger library and only logs of the last 3 runs should be kept
* workbench console - replace json with words, add more logging
* fix tests
* revisit docs/PROBES.md
* add github mit logos
* throttling for API calls - working on server?
* update Claude.md incorporate tips from https://diwank.space/field-notes-from-shipping-real-code-with-claude
* check FAISS is being used on concepts (with backlinks)
* danbri frontend
* Italian version?
* migrate webpack to vite
* do something with VSOM

## Cleanup

* refactor files > 1000 lines mcp/tools/simple-verbs.js src/frontend/workbench/public/js/workbench.js
* redundant ask/tell in api server
* got both src/prompts/TemplateLoader.js and mcp/lib/PromptTemplateLoader.js - the former is newer
* SimpleVerbsService is probably redundant
* mcp/lib/PromptSynthesis.js contains prompt
* hardcoded query in src/zpt/parameters/FilterBuilder.js 
* hardcoded prompt in mcp/http-server.js plus does not contain any relevant information about Matisse. Therefore, I cannot answer the question
* string matching on result types in src/zpt/selection/CorpuscleSelector.js
* refactor src/connectors
* clean src/frontend/_*
* move prompts to src/
* move mcp to src/
* Config.js - remove refs to tbox, .env should handle

Can you create utils/SPARQLIngestRemote.js which will carry out the same operation as utils/SPARQLIngest.js but against a remote Semem install. For now the credentials will be the same. The Semem endpoints are at MCP : https://mcp.tensegrity.it/ API : https://api.tensegrity.it/ Fuseki : https://semem-fuseki.tensegrity.it/ Workbench : https://semem.tensegrity.it/

The data to ingest is in two stores, one with endpoint https://fuseki.hyperdata.it/hyperdata.it/query graph http://danny.ayers.name/ the other endpoint https://fuseki.hyperdata.it/danny.ayers.name/query graph http://hyperdata.it/content

node utils/SPARQLIngestRemote.js --source hyperdata.it_danny --template blog-articles --limit 1000

node utils/SPARQLIngestRemote.js --source danny.ayers.name_content --template blog-articles --limit 5

node utils/SPARQLIngestDocker.js --source danny.ayers.name_content --template blog-articles --limit 5

claude mcp add playwright npx '@playwright/mcp@latest'
 
# MANUAL
cd ~/hyperdata/transmissions # my local path
./scripts/del-hyperdata.sh
./trans md-to-sparqlstore ~/hyperdata/semem/docs
./trans sparqlstore-to-html  ~/hyperdata/semem/docs
# on server
node utils/SPARQLIngestDocker.js --source hyperdata.it_danny --template blog-articles --limit 1000

