echo -e "\nDeleting data from https://fuseki.hyperdata.it/semem..."
curl -X POST https://fuseki.hyperdata.it/semem \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-update" \
  -H "Accept: application/sparql-results+json" \
  --data "DELETE { ?s ?p ?o} WHERE { ?s ?p ?o }"

curl -X POST https://fuseki.hyperdata.it/semem \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-update" \
  -H "Accept: application/sparql-results+json" \
  --data "DELETE {GRAPH ?g {?s ?p ?o}} WHERE {GRAPH ?g {?s ?p ?o}}"
