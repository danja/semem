import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testServer() {
    const client = new Client({ name: "test-client", version: "1.0.0" }, {});
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['index.js']
    });

    try {
        await client.connect(transport);

        // Test initialization
        const initResponse = await client.initialize({});
        console.log("Server capabilities:", initResponse.capabilities);

        // Test tools
        if (initResponse.capabilities.tools) {
            const tools = await client.listTools();
            console.log("Available tools:", tools.tools.map(t => t.name));

            // Test query_nodes tool
            const queryResult = await client.callTool({
                name: "query_nodes",
                arguments: {
                    query: "test query",
                    limit: 5
                }
            });
            console.log("Query result:", queryResult);
        }

        await client.close();
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testServer();
