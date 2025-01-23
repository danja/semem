#!/bin/bash

# Configuration
BASE_URL="http://localhost:4030"
DATASET="test-mem"
AUTH_HEADER="Basic $(echo -n 'admin:admin123' | base64)"
TEST_GRAPH="http://example.org/test-graph"

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Helper function for testing endpoints
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local content_type=$4
    local accept_type=$5
    local data=$6

    echo -e "\nTesting ${name}..."
    echo "URL: ${url}"
    echo "Method: ${method}"

    response=$(curl -v -s -w "\n%{http_code}" -X $method \
        -H "Authorization: $AUTH_HEADER" \
        ${content_type:+-H "Content-Type: $content_type"} \
        ${accept_type:+-H "Accept: $accept_type"} \
        ${data:+-d "$data"} \
        "$url")

    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    if [ "$status_code" -eq 200 ]; then
        echo -e "${GREEN}Success! Status: $status_code${NC}"
        echo "Response: $response_body"
    else
        echo -e "${RED}Failed! Status: $status_code${NC}"
        echo "Response: $response_body"
    fi
}

# 1. Test SPARQL Query endpoint
test_endpoint "SPARQL Query" "POST" \
    "$BASE_URL/$DATASET" \
    "application/sparql-query" \
    "application/json" \
    "SELECT * WHERE { ?s ?p ?o } LIMIT 1"

# 2. Test SPARQL Update endpoint
test_endpoint "SPARQL Update" "POST" \
    "$BASE_URL/$DATASET" \
    "application/sparql-update" \
    "application/json" \
    "INSERT DATA { GRAPH <$TEST_GRAPH> { <http://example/s> <http://example/p> 'test' } }"

# 3. Test Graph Store Protocol (GET)
test_endpoint "GSP Read" "GET" \
    "$BASE_URL/$DATASET/data?graph=$TEST_GRAPH" \
    "" \
    "text/turtle"

# 4. Test Graph Store Protocol (POST)
test_endpoint "GSP Write" "POST" \
    "$BASE_URL/$DATASET/data?graph=$TEST_GRAPH" \
    "text/turtle" \
    "application/json" \
    "@prefix ex: <http://example.org/> . ex:s ex:p 'test' ."

# 5. Test File Upload endpoint
test_endpoint "File Upload" "POST" \
    "$BASE_URL/$DATASET/upload" \
    "text/turtle" \
    "application/json" \
    "@prefix ex: <http://example.org/> . ex:s ex:p 'test' ."

# Additional useful endpoints
# 6. Test Dataset Info
test_endpoint "Dataset Info" "GET" \
    "$BASE_URL/$DATASET/stats" \
    "" \
    "application/json"

# 7. Test if dataset exists
test_endpoint "Dataset Existence" "GET" \
    "$BASE_URL/$DATASET" \
    "" \
    "application/json"
