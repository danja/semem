Using `examples/basic/MemoryEmbeddingSPARQL.js` as reference for which modules to use, create `examples/document/MakeEmbeddings.js` which will carry out the following operations :

* run a SPARQL query that will select all the `ragno:TextElement` instances in the store that do not have embeddings associated with them (use `ragno:embedding` property). Use a query saved under `sparql/queries`, managed by the tools in `src/services/sparql` 
* create embeddings for each of these and save to the store using a template in `sparql/templates`