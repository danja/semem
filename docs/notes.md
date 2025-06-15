 lsof -ti:6277 | xargs kill -9 

  fuser -k 6277/tcp 

 lsof -i:6277

   netstat -tulpn | grep 6277

kill -9

claude mcp add playwright npx @playwright/mcp@latest

claude mcp add semem node mcp/index.js

use extract_concepts on "the cat sat on the mat"

semem:semem_extract_concepts (MCP)(text: "the cat sat on the mat")
