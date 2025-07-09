Create a module src/ragno/TextToCorpuscle.js with a method which will receive a question as argument and create a corpuscle for it and populate the associated constructs in the SPARQL store. The system should :

1. Mint a URI to identify the question using src/utils/URIMinter.js
2. Create a ragno:Corpuscle for the question using the identifier, with associated metadata. This will point to a ragno:TextElement containing the question text. Use the system described in docs/manual/sparql-service.md to achieve this
3. create an embedding for the question following the pattern in examples/document/MakeEmbeddings.js 
4. Extract concepts from the question following the pattern in examples/document/ExtractConcepts.js
5. return the URI of the created corpuscle 

Also create examples/document/ConsumeQuestion.js which will at as a manual test for src/ragno/TextToCorpuscle.js taking a question as argument, create the corpuscle and then run a query using the system in docs/manual/sparql-service.md to return the details of the corpuscle.