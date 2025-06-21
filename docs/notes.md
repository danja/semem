 lsof -ti:6277 | xargs kill -9 

  fuser -k 6277/tcp 

 lsof -i:6277

   netstat -tulpn | grep 6277

  netstat -tulpn | grep 9000

kill -9 [id]

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
