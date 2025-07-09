 The UI (mostly under src/frontend) is set up to have a tab showing the application of the vsom algorithm. It doesn't yet show anything. Now 
   


 lsof -ti:6277 | xargs kill -9 

  fuser -k 6277/tcp 

 lsof -i:6277

   netstat -tulpn | grep 6277

  netstat -tulpn | grep 3000

 lsof -i:3000

kill -9 [pid]

killall webpack

claude mcp add playwright npx @playwright/mcp@latest

claude mcp add semem node mcp/index.js

claude mcp add semem npx semem-mcp
※ Tip: Run claude --debug to see logs inline, or view log files in                                                                                                            │
│   /home/danny/.cache/claude-cli-nodejs/-flow-hyperdata-semem   

use extract_concepts on "the cat sat on the mat"

semem:semem_extract_concepts (MCP)(text: "the cat sat on the mat")

  To Fix This:

  Either change line 13 in embedding-creator.js:
  let graphName = 'http://danny.ayers.name/content'; // Match SearchService

  Or change line 29 in UIServer.js:
  this.graphName = options.graphName || 'http://hyperdata.it/content'; // Match embedding-creator


examples/mcp/ZPTAdvancedFiltering.js

Executing SPARQL UPDATE: http://localhost:3030/semem/update
SPARQL UPDATE completed successfully (179ms)
✅ Successfully stored concept data in SPARQL store
   ✅ Successfully processed with 19 concept corpuscles
   📝 Concepts: leather, crafting, armor, books, item frames...

📊 Enhanced Concept Extraction Summary:
   ✅ Successfully processed: 194 TextElements
   ❌ Failed: 0 TextElements
   🧠 Total concepts extracted: 5943
   📦 Total corpuscles created: 6137
   🔗 Collection corpuscles: 194
   🎯 Graph: http://tensegrity.it/semem

🎉 ENHANCED CONCEPT EXTRACTION COMPLETED!
======================================================================
📊 Additional Statistics:
   🔗 Individual concept corpuscles: 5943
   📦 Collection corpuscles: 194
   🧠 Average concepts per TextElement: 30.63

📝 Sample Results:
   1. e4e5c93c523b84d8_2_b08db61af1d9848b: 30 concepts
      Concepts: knowledge extraction, text collections, news articles...
   2. e4e5c93c523b84d8_3_ed398e95908eb0f4: 14 concepts
      Concepts: retriever model, Ingerophrynus gollum, question answering model...
   3. e4e5c93c523b84d8_4_a203d2239c7aa3ac: 21 concepts
      Concepts: unified version of the English Wikipedia, statistical shortcuts, BeerQA...

      can you follow the route through which examples/document/ExtractConcepts.js uses prompts and refactor it to use the prompt management system. Create an integration test using sample data, use the system configuration as loaded as in ExtractConcepts.js test it before and after refactoring
