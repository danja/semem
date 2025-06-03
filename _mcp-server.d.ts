/**
 * Type definitions for the Semem MCP Server
 */

// Configuration for the MCP server
export interface MCPServerConfig {
  id: string;
  name: string;
  version: string;
  vendor: string;
  protocol_version: string;
}

// Session object for tracking MCP interactions
export interface MCPSession {
  id: string;
  created_at: string;
  calls: MCPCall[];
}

// Record of an MCP method call
export interface MCPCall {
  method: string;
  params: Record<string, any>;
  timestamp: string;
}

// MCP tool definition
export interface MCPTool {
  id: string;
  description: string;
}

// MCP resource definition
export interface MCPResource {
  id: string;
  description: string;
}

// MCP prompt definition
export interface MCPPrompt {
  id: string;
  title: string;
  description: string;
  template: string;
}

// JSON-RPC request format
export interface JSONRPCRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

// JSON-RPC success response
export interface JSONRPCSuccessResponse {
  jsonrpc: string;
  id: string | number;
  result: any;
}

// JSON-RPC error response
export interface JSONRPCErrorResponse {
  jsonrpc: string;
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

// Union type for JSON-RPC responses
export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

// MCP discovery response
export interface MCPDiscovery {
  id: string;
  name: string;
  version: string;
  vendor: string;
  protocol_version: string;
  capabilities: {
    tools: Array<{ id: string }>;
    resources: Array<{ id: string }>;
    prompts: Array<{ id: string }>;
  };
}

// Health check response
export interface HealthCheckResponse {
  status: string;
  version: string;
  uptime: number;
}