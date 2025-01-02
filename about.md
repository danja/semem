# About

Needs a SPARQL endpoint - like #:tbox

```sh
cd ~/github-danny/hyperdata/packages/tbox/

 docker-compose up -d
```

```sh
cd ~/github-danny/hyperdata/packages/semem

node src/OllamaExample.js
...
 node src/SPARQLExample.js
```

```sh
# ollama pull nomic-embed-text

curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "The sky is blue because of Rayleigh scattering"
}'
```

```sh
npm test -- --filter="SPARQL Endpoint Integration"
```
