There is an issue in the code around SPARQL UPDATE calls, this error:

```
[INFO] Adding interaction: 'What's the current state of AI technology?'
[ERROR] SPARQL update error: Error: SPARQL update failed: 500
    at SPARQLStore._executeSparqlUpdate (file:///home/danny/github-danny/hyperdata/packages/semem/src/stores/SPARQLStore.js:55:23)
...
```

Away from the JS, these scripts work fine :

```
misc/scripts/sparql-auth-test.sh
misc/scripts/sparql-upload-test.sh
misc/scripts/ollama-embedding-test.sh
```

The following test (with helper) works fine as well :

```
spec/unit/sparql-endpoint-spec.js
src/utils/SPARQLHelpers.js
```
