// Static resource for graph schema
server.resource(
    "graph-schema",
    "schema://graph/model",
    async (uri) => {
        try {
            const result = await makeGraphRequest('/api/v1/schema');
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify(result, null, 2),
                        mimeType: "application/json"
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: `Error retrieving schema: ${error.message}`,
                        mimeType: "text/plain"
                    }
                ]
            };
        }
    }
);
