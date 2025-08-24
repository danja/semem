Clear the store :
scripts/del-content-graph.sh

Ingest documents :
node examples/ingestion/SPARQLIngest.js   --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query"   --template blog-articles   --limit 5

Use ./start.sh to start the servers.

using playwright, go to the workbench UI and select Chunk Documents

Ask the question "What is ADHD?" 

The response should contain specific information supplied in the context from the original document.