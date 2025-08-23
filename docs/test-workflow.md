Clear the store :
scripts/del-content-graph.sh

Ingest documents :
node examples/ingestion/SPARQLIngest.js   --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query"   --template blog-articles   --limit 5

go to the workbench and select Chunk Documents

Ask the question "What is ADHD?" 

The response should contain reference to an ingested document.