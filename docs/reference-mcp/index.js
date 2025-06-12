#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Create MCP server instance
const server = new McpServer({
    name: "Graph Knowledge Base Server",
    version: "1.0.0",
    instructions: "A server that provides access to graph knowledge base via HTTP APIs"
});

// Graph API configuration
const GRAPH_API_BASE_URL = process.env.GRAPH_API_URL || 'http://localhost:7474';
const GRAPH_API_AUTH = process.env.GRAPH_API_AUTH || '';

// HTTP client helper function
async function makeGraphRequest(endpoint, method = 'GET', data = null) {
    const url = `${GRAPH_API_BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(GRAPH_API_AUTH && { 'Authorization': GRAPH_API_AUTH })
        }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        throw new Error(`Graph API request failed: ${error.message}`);
    }
}
