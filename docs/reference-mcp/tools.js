// Tool for querying nodes
server.tool(
    "query_nodes",
    {
        query: z.string().describe("Search query for nodes"),
        nodeType: z.string().optional().describe("Type of nodes to search"),
        limit: z.number().optional().default(10).describe("Maximum number of results")
    },
    async ({ query, nodeType, limit }) => {
        try {
            const endpoint = `/api/v1/nodes/search`;
            const requestData = {
                query,
                type: nodeType,
                limit
            };

            const result = await makeGraphRequest(endpoint, 'POST', requestData);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error querying nodes: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
);

// Tool for querying relationships
server.tool(
    "query_relationships",
    {
        sourceNode: z.string().describe("Source node identifier"),
        relationshipType: z.string().optional().describe("Type of relationship"),
        direction: z.enum(['incoming', 'outgoing', 'both']).default('both')
    },
    async ({ sourceNode, relationshipType, direction }) => {
        try {
            const endpoint = `/api/v1/relationships`;
            const params = new URLSearchParams({
                source: sourceNode,
                direction,
                ...(relationshipType && { type: relationshipType })
            });

            const result = await makeGraphRequest(`${endpoint}?${params}`);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error querying relationships: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
);
