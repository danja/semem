# Semem HTTP JSON API

## Overview
RESTful API providing JSON-based access to Semem's functionality. Features include chat completion, memory storage/retrieval, and system monitoring.

## Quick Start
```javascript
// Initialize client
const client = new SememClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: 'your-api-key'
});

// Basic chat
const response = await client.chat({
  prompt: "What is semantic memory?",
  model: "qwen2:1.5b"
});
```

## Endpoints

### Chat Operations
```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "prompt": "Hello, how are you?",
  "model": "qwen2:1.5b",
  "options": {
    "temperature": 0.7
  }
}
```

### Storage Operations
```http
POST /api/store
Content-Type: application/json
Authorization: Bearer <token>

{
  "content": "Information to store",
  "format": "text",
  "metadata": {
    "timestamp": "2025-01-13T19:39:38.327Z",
    "tags": ["example", "documentation"]
  }
}
```

### Query Operations
```http
GET /api/query?text=search+term&limit=10
Authorization: Bearer <token>

POST /api/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "sparql": "SELECT * WHERE { ?s ?p ?o } LIMIT 5"
}
```

### Metrics Endpoint
```http
GET /api/metrics
Authorization: Bearer <token>

GET /api/metrics?format=json&detail=high
Authorization: Bearer <token>
```

## Authentication
The API uses Bearer token authentication:
```http
Authorization: Bearer your-api-key-here
```

## Error Handling
Errors follow standard HTTP status codes with JSON responses:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameter",
    "details": {
      "field": "prompt",
      "issue": "required"
    }
  }
}
```

## Rate Limiting
- 100 requests per minute per API key
- Headers include rate limit information:
  ```http
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1673647423
  ```

## Streaming
Supports Server-Sent Events for real-time updates:
```javascript
const eventSource = new EventSource('/api/chat/stream?token=api-key');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.response);
};
```

## Client Libraries
JavaScript client example:
```javascript
import { SememClient } from 'semem';

const client = new SememClient({
  baseUrl: 'http://localhost:3000/api',
  apiKey: process.env.SEMEM_API_KEY
});

// Chat completion
const response = await client.chat({
  prompt: "What is semantic memory?",
  model: "qwen2:1.5b"
});

// Store data
await client.store({
  content: "Important information",
  format: "text"
});

// Query data
const results = await client.query({
  text: "search term",
  limit: 10
});
```