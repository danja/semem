#!/bin/sh

curl -X POST \
  -H "Authorization: Basic $(echo -n 'invalid:credentials' | base64)" \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/json" \
  --data 'SELECT * WHERE { ?s ?p ?o } LIMIT 1' \
  'http://localhost:4030/test/query'