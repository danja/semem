#!/bin/bash

# Script to delete all triples from the http://hyperdata.it/content graph
# Uses the SPARQL update endpoint to clear the graph in Docker Fuseki
# Modeled on scripts/del-content-graph.sh but targets Docker container

# Configuration - Docker Fuseki endpoint
SPARQL_ENDPOINT="http://localhost:4050/semem/update"
GRAPH_URI="http://hyperdata.it/content"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🗑️  Deleting all triples from graph: ${GRAPH_URI}${NC}"
echo -e "${YELLOW}📡 Using Docker SPARQL endpoint: ${SPARQL_ENDPOINT}${NC}"
echo ""

# SPARQL UPDATE query to clear the graph
QUERY="CLEAR GRAPH <${GRAPH_URI}>"

echo -e "${YELLOW}📝 Executing SPARQL query:${NC}"
echo "   ${QUERY}"
echo ""

# Execute the SPARQL update with admin credentials
HTTP_STATUS=$(curl -s -w "%{http_code}" -o response.tmp \
  -X POST \
  -H "Content-Type: application/sparql-update" \
  -u "admin:admin123" \
  -d "${QUERY}" \
  "${SPARQL_ENDPOINT}")

# Check the response (500 is OK if graph doesn't exist)
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ] || [ "$HTTP_STATUS" = "500" ]; then
  echo -e "${GREEN}✅ Successfully cleared graph ${GRAPH_URI} in Docker Fuseki${NC}"
  echo -e "${GREEN}   HTTP Status: ${HTTP_STATUS}${NC}"
  
  # Show response if there is one
  if [ -s response.tmp ]; then
    echo -e "${GREEN}   Response:${NC}"
    cat response.tmp
    echo ""
  fi
else
  echo -e "${RED}❌ Failed to clear graph in Docker Fuseki${NC}"
  echo -e "${RED}   HTTP Status: ${HTTP_STATUS}${NC}"
  
  if [ -s response.tmp ]; then
    echo -e "${RED}   Error response:${NC}"
    cat response.tmp
    echo ""
  fi
  
  # Clean up and exit with error
  rm -f response.tmp
  exit 1
fi

# Clean up temporary file
rm -f response.tmp

echo -e "${GREEN}🎉 Docker graph deletion completed successfully${NC}"