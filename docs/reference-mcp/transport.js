// Start the server
async function main() {
    const transport = new StdioServerTransport();

    try {
        await server.connect(transport);
        console.error("Graph Knowledge Base MCP Server started successfully");
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.error("Shutting down server...");
    process.exit(0);
});

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
