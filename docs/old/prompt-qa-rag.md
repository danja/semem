Create a comprehensive plan to implement the following :

examples/document/RAG.js which will be a demonstration of naive retrieval aumented generation. A question will be given to the system, an embedding made from the question will be generated and compared using FAISS to find related chunks in the store. This will be used to augment the question.
Begin by creating a progress report examples/document/RAG-PLAN.md
The system should then :

1. Load configuration as in docs/manual/config.md
2. Connect to a SPARQL endpoint for data retrieval using services as in docs/manual/sparql-service.md
3. Load embeddings from the SPARQL store that correspond to document chunks
4. Build a FAISS index for similarity search. Use examples/basic/ArticleSearch.js as a reference for the similarity matching, though RAG.js shouldn't contain any hardcoding.
5. Perform semantic search query using the question over the FAISS index
6. Format the question together with the top 3 matches from the index as context into an enhanced question
7. prepare an LLM as determined by the config, see docs/manual/provider-config.md
8. call the LLM with the augmented question and return the result to the user 

