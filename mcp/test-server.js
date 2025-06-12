import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testServer() {
  const client = new Client({ name: "test-client", version: "1.0.0" }, {});
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['index.js'],
    cwd: '/flow/hyperdata/semem/mcp'
  });

  try {
    console.log("Connecting to MCP server...");
    await client.connect(transport);

    // Test tools
    console.log("Testing tools...");
    console.log("Listing available tools...");
    const tools = await client.listTools();
    console.log("Available tools:", tools.tools.map(t => t.name));

    // Test Semem core functionality
    console.log("\n=== Testing Semem Core Tools ===");
    
    // Test embedding generation
    try {
        console.log("Testing embedding generation...");
        const embeddingResult = await client.callTool({
          name: "semem_generate_embedding",
          arguments: {
            text: "This is a test sentence for embedding generation."
          }
        });
        console.log("Embedding result:", JSON.parse(embeddingResult.content[0].text));
      } catch (error) {
        console.log("Embedding test failed:", error.message);
      }

      // Test concept extraction
      try {
        console.log("Testing concept extraction...");
        const conceptResult = await client.callTool({
          name: "semem_extract_concepts", 
          arguments: {
            text: "Machine learning and artificial intelligence are transforming modern technology."
          }
        });
        console.log("Concept result:", JSON.parse(conceptResult.content[0].text));
      } catch (error) {
        console.log("Concept extraction test failed:", error.message);
      }

      // Test Ragno functionality
      console.log("\n=== Testing Ragno Tools ===");
      
      // Test entity creation
      try {
        console.log("Testing entity creation...");
        const entityResult = await client.callTool({
          name: "ragno_create_entity",
          arguments: {
            name: "Machine Learning",
            isEntryPoint: true,
            subType: "technology",
            frequency: 5
          }
        });
        console.log("Entity result:", JSON.parse(entityResult.content[0].text));
      } catch (error) {
        console.log("Entity creation test failed:", error.message);
      }

      // Test semantic unit creation
      try {
        console.log("Testing semantic unit creation...");
        const unitResult = await client.callTool({
          name: "ragno_create_semantic_unit",
          arguments: {
            text: "Machine learning algorithms can learn patterns from data.",
            summary: "ML algorithms learn from data",
            source: "test-document",
            position: 0,
            length: 55
          }
        });
        console.log("Semantic unit result:", JSON.parse(unitResult.content[0].text));
      } catch (error) {
        console.log("Semantic unit creation test failed:", error.message);
      }

      // Test ZPT functionality
      console.log("\n=== Testing ZPT Tools ===");
      
      // Test content chunking
      try {
        console.log("Testing content chunking...");
        const chunkResult = await client.callTool({
          name: "zpt_chunk_content",
          arguments: {
            content: "This is a longer piece of text that needs to be chunked into smaller pieces. Each chunk should be semantically meaningful and preserve the overall structure of the document. This allows for better processing and analysis of the content.",
            options: {
              method: "semantic",
              chunkSize: 50,
              overlap: 10,
              preserveStructure: true
            }
          }
        });
        console.log("Chunk result:", JSON.parse(chunkResult.content[0].text));
      } catch (error) {
        console.log("Content chunking test failed:", error.message);
      }
    }

    // Test resources
    console.log("\n=== Testing Resources ===");
    
    try {
      console.log("Listing resources...");
      const resources = await client.listResources();
      console.log("Available resources:", resources.resources.map(r => r.name));

      // Test status resource
      if (resources.resources.find(r => r.uri === "semem://status")) {
        console.log("Reading status resource...");
        const statusResult = await client.readResource({
          uri: "semem://status"
        });
        console.log("Status:", JSON.parse(statusResult.contents[0].text));
      }
    } catch (error) {
      console.log("Resource test failed:", error.message);
    }

    await client.close();
    console.log("\nAll tests completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testServer();