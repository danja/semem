The Ask panel needs three more checkboxes, unchecked by default :
* HyDE
* Wikipedia
* Wikidata

The MCP interface will also need extending to include flags for these on Ask calls.

The functionality needed in the backend code has already been tried successfully in :
* examples/document/AskHyde.js
* examples/wikipedia/WikipediaDemo.js
* examples/beerqa-wikidata/WikidataGetResult.js 

However there it was implemented in a very ad hoc fashion, it's very jumbled up. This should be moved into the core code in a systematic fashion, paying attention to structure, respecting existing patterns and following general best practices. In particular there should be no inline SPARQL queries, the code under src/services/sparql/index.js with templates in the sparql dir exist for this purpose.
Create a plan for implementing this functionality, including unit and integration tests on the backend as well as playwright tests on the workbench.