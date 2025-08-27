# Semem, Know Thyself

./del-semem-graph.sh
cd ~/hyperdata/transmissions # my local path
./trans -v md-to-sparqlstore ~/hyperdata/semem/docs

docs/tt.ttl

docs/endpoints.json

scripts/del-semem-graph.sh

scripts/transmissions.sh

node examples/ingestion/SPARQLIngest.js \
  --endpoint "https://localhost:3030/semem/query" \
  --template blog-articles 
