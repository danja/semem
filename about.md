# About

Needs a SPARQL endpoint - like #:tbox

```sh
cd ~/github-danny/hyperdata/packages/tbox/

 docker-compose up -d
```

```sh
cd ~/github-danny/hyperdata/packages/semem

node src/OllamaExample.js

```

---

Needs SPARQL store, endpoint 127.0.0.1:4030

```sh
cd ~/github-danny/hyperdata/packages/tbox
docker-compose up -d

 node src/SPARQLExample.js

```

```sh
cd ~/github-danny/hyperdata/packages/tbox
docker-compose up -d
cd ~/github-danny/hyperdata/packages/semem
node src/OllamaClaudeExample.js

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
npm test -- tests/unit/Config.spec.js
```
