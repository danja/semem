#!/bin/bash

echo -e "\nAdding test data..."
curl -v POST http://localhost:4030/test-mem \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-update" \
  --data "INSERT DATA { <http://example/s> <http://example/p> <http://example/o> }"

echo -e "\nQuerying..."
curl -v GET http://localhost:4030/test-mem \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  --data "SELECT * WHERE { ?s ?p ?o }"


echo -e "\nQuerying data (SELECT)..."
curl -v POST http://localhost:4030/test-mem \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  --data "SELECT * WHERE { ?s ?p ?o }"




####################################
echo "Waiting for Fuseki to be ready..."
until curl -s http://localhost:4030/$/ping > /dev/null; do
    echo "Waiting for Fuseki..."
    sleep 2
done
echo "Fuseki is up!"

# Check datasets
echo "Checking datasets..."
curl -X GET http://localhost:4030/$/datasets \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" && echo -e "\nDataset check - It works!"

echo -e "\nAdding test data..."
curl -X POST http://localhost:4030/ds \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-update" \
  --data "INSERT DATA { <http://example/s> <http://example/p> <http://example/o> }" && echo "Insert - It works!"

echo -e "\nQuerying data (SELECT)..."
curl -X POST http://localhost:4030/ds \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: application/sparql-results+json" \
  --data "SELECT * WHERE { ?s ?p ?o }" && echo "Select - It works!"

echo -e "\nQuerying data (CONSTRUCT)..."
curl -X POST http://localhost:4030/ds \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: application/sparql-query" \
  -H "Accept: text/turtle" \
  --data "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }" && echo "Construct - It works!"