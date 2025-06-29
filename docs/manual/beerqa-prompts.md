The BeerQA paper trains a model for domain-independent question answering. The idea here is to see how far we can get using a non-specialized model augmented with Semem facilities. The training data will be used to provide examplars of the data structures required in the knowledgebase - direct and generated using the augmentation tools.  This is a kind of meta-level training, out of band for the LLMs (though LLMs will be used internally).
Using the pattern established, it will be applied to questions from the BeerQA test data.



Two classes are required to fulfil the roles of an initial Wikipedia search result ingester and a data augmenter.
The first, in src/aux/wikipedia/Search.js will include two primary methods, search(query, options) and ingest(searchObject).
 Search will use a fetch call to the Wikipedia API of the the form :
`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=queryText`
This call should return page titles, snippets of text, and other metadata relating to the search query. The options field will contain just one field `delay`, a value in milliseconds which will be used to act as a rate limiter. Its default value should be 100. The search(queryText, options) method will return the JSON object as returned by Wikipedia together with the initial query. Using the pattern of examples/beerqa/BeerETLDemo.js and examples/beerqa/BeerETL.js create RDF objects corresponding to the pages list which will be instances of ragno:Unit. The titles with corresponding page URIs will act as instances of ragno:Entity with the text snippets as instances of ragno:TextElement associated with them with a provenance field. These will be posted to the SPARQL store.
The second class, in src/aux/wikipedia/UnitsToCorpuscles.js will do a SPARQL query to list ragno:Unit instances that are not yet associated with a ragno:Corpuscle. For each of the Units, an instance of ragno:Corpuscle will be created together with a ragno:Relationship associating the Unit with the Corpuscle. An embedding will be created from the text snippet and stored as a ragno:Attribute of the ragno:Corpuscle.     

Create examples/beerqa/AugmentQuestion.js which will operate on a question that was placed in the store by examples/beerqa/BeerTestQuestions.js . For now just get the first question found. An embedding will be created of the question text and associated with the question's corpuscle. The Extract Concepts operation will also be applied to the question and the results saved back to the corpuscle.  

Create examples/beerqa/QuestionResearch.js which will do a SPARQL query to retrieve the question corpuscle. Each extracted concept will then be passed to src/aux/wikipedia/Search.js and src/aux/wikipedia/UnitsToCorpuscles.js to augment the store.

If no concepts are found then the Hyde algorithm should be run to generate a hypothetical answer to the question Then extract concepts should be applied to the hypothetical as a substitue. If no concepts are found, repeat the process at most twice more. If concepts are still not found then report failure for this stage. 

--- limit reached

We should now be able to do a similarity search between the initial question corpuscle and the corpuscles generated from the search result snippets, as well as matching of extracte concepts. From this the URIs of related Wikipedia pages should be available. These should be added to the question corpuscle with the property ragno:maybeRelated . Implement the functionality of this stage in examples/beerqa/DiscoverTargets.js

Next we need examples/wikipedia/IngestPages.js which will query for the ragno:maybeRelated page URIs for the given question. This will do a fetch on the URIs and send the results through src/aux/markup/HTML2MD.js The existing corpuscles with the URIs will have statements added to associate them with new ragno:TextElement instances, which will be the markdown version of the Wikipedia pages. Embeddings will be created of the Wikipedia content and associated with the corpuscle.

Now ZPT tools will be used to navigate to corpuscles with the best chance of answering the question. Operations here will be implemented in examples/beerqa/Navigate.js . These corpuscles will be associated with the question corpuscle by means of ragno:Relationship entities added to the store.

Finally src/ContextManager.js will be used to combine the question corpuscle with augmentation from the related corpuscles, formulated as a question and passed to the configured LLM for completion, with the final result passed back to the user. This will happen in examples/beerqa/GetResult.js 

// maybe later : src/ragno/decomposeCorpus.js




