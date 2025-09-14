time to migrate - can you create src/connectors/GroqConnector.js following the pattern of src/connectors/MistralConnector.js with the endpoint URL https://api.groq.com/openai/v1/chat/completions together with anything else that needs to be updated then modify config/config.json  to make the default chat provider Groq using model llama-3.1-8b-instant

  INTEGRATION_TESTS=true npx vitest run tests/integration/llm/ChatAPIIntegration.test.js --reporter=verbose 
* fix tests
* add github mit logos
* throttling for API calls - working on server?
* interactions aren't being stored - default should be yes
* update Claude.md incorporate tips from https://diwank.space/field-notes-from-shipping-real-code-with-claude
* check FAISS is being used on concepts (with backlinks)
* clean src/frontend/_*
* move prompts to src/
* move mcp to src/
* use src/utils logger not console
* danbri frontend
* console - replace json with words, add more logging
* ingest via workbench
* Config.js - remove refs to tbox, .env should handle
* Italian version?
* hardcoded query in src/zpt/parameters/FilterBuilder.js 
* hardcoded prompt in mcp/http-server.js plus does not contain any relevant information about Matisse. Therefore, I cannot answer the question
* string matching on result types in src/zpt/selection/CorpuscleSelector.js
* migrate webpack to vite
* refactor files > 1000 lines mcp/tools/simple-verbs.js src/frontend/workbench/public/js/workbench.js
* do something with VSOM

Can you create utils/SPARQLIngestRemote.js which will carry out the same operation as utils/SPARQLIngest.js but against a remote Semem install. For now the credentials will be the same. The Semem endpoints are at MCP : https://mcp.tensegrity.it/ API : https://api.tensegrity.it/ Fuseki : https://semem-fuseki.tensegrity.it/ Workbench : https://semem.tensegrity.it/

The data to ingest is in two stores, one with endpoint https://fuseki.hyperdata.it/hyperdata.it/query graph http://danny.ayers.name/ the other endpoint https://fuseki.hyperdata.it/danny.ayers.name/query graph http://hyperdata.it/content

node utils/SPARQLIngestRemote.js --source hyperdata.it_danny --template blog-articles --limit 1000

node utils/SPARQLIngestRemote.js --source danny.ayers.name_content --template blog-articles --limit 5

node utils/SPARQLIngestDocker.js --source danny.ayers.name_content --template blog-articles --limit 5


 
# MANUAL
cd ~/hyperdata/transmissions # my local path
./scripts/del-hyperdata.sh
./trans md-to-sparqlstore ~/hyperdata/semem/docs
./trans sparqlstore-to-html  ~/hyperdata/semem/docs
# on server
node utils/SPARQLIngestDocker.js --source hyperdata.it_danny --template blog-articles --limit 1000

