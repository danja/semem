# Workflows for manual testing

## Simple Tell/Ask

Go to the workbench and -

* Tell : "there are five sardines"
* Ask : "How many fish are there?"

## SPARQL Ingester

Clear the store :
scripts/del-content-graph.sh
or
scripts/del-docker-graph.sh (for Docker deployment)

Ingest documents :
node utils/SPARQLIngest.js   --endpoint "https://fuseki.hyperdata.it/danny.ayers.name/query"   --template blog-articles   --limit 5   --graph "http://danny.ayers.name/"

**Note**: For Docker deployment, endpoints and configurations need to be updated to target the containerized Fuseki instance at localhost:4050 instead of the production endpoints.

Use ./start.sh to start the servers.

using playwright, go to the workbench UI and select Chunk Documents

Ask the question "What is ADHD?" 

The response should contain specific information supplied in the context from the original document.