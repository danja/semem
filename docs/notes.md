 lsof -ti:6277 | xargs kill -9 

  fuser -k 6277/tcp 

 lsof -i:6277

   netstat -tulpn | grep 6277

kill -9

claude mcp add playwright npx @playwright/mcp@latest

claude mcp add semem node mcp/index.js

use extract_concepts on "the cat sat on the mat"

semem:semem_extract_concepts (MCP)(text: "the cat sat on the mat")

Can you write tests for the following : api-server.js  server-manager.js  start-all.js  ui-server.js
These need to be moved to src/servers without breaking anything. Note the existence of start.sh and stop.sh


There is a problem with the Semem mcp server, it seems like parameters aren't reaching the tool handlers. This may require MCP protocol-level debugging or potentially updating the tool registration format. Please read the docs  docs/mcp/debug-tips.md and docs/mcp/claude-plus-inspector.md and make a plan for debugging the system.