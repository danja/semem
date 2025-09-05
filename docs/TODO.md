* add links to workbench
* throttling for API calls - working on server?
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

Can you create utils/SPARQLIngestRemote.js which will carry out the same operation as utils/SPARQLIngest.js but against a remote Semem install. For now the credentials will be the same. The Semem endpoints are at MCP : https://mcp.tensegrity.it/ API : https://api.tensegrity.it/ Fuseki : https://semem-fuseki.tensegrity.it/ Workbench : https://semem.tensegrity.it/

The data to ingest is in two stores, one with endpoint https://fuseki.hyperdata.it/hyperdata.it/query graph http://danny.ayers.name/ the other endpoint https://fuseki.hyperdata.it/danny.ayers.name/query graph http://hyperdata.it/content

node utils/SPARQLIngestRemote.js --source hyperdata.it_danny --template blog-articles --limit 1000

node utils/SPARQLIngestRemote.js --source danny.ayers.name_content --template blog-articles --limit 5

node utils/SPARQLIngestDocker.js --source danny.ayers.name_content --template blog-articles --limit 5
node utils/SPARQLIngestDocker.js --source hyperdata.it_danny --template blog-articles --limit 5
 


