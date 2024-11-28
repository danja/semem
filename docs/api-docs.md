# Remote Storage API Documentation

## Base URL
`https://your-api-endpoint/memory`

## Endpoints

### GET /memory
Retrieves all stored memories.

```http
GET /memory
Authorization: Bearer <your-api-key>
```

Response:
```javascript
{
  "shortTermMemory": [
    {
      "id": "uuid",
      "prompt": "string",
      "output": "string",
      "embedding": [number],
      "timestamp": number,
      "accessCount": number,
      "concepts": [string],
      "decayFactor": number
    }
  ],
  "longTermMemory": [/* similar structure */]
}
```

### POST /memory
Stores new memory state.

```http
POST /memory
Authorization: Bearer <your-api-key>
Content-Type: application/json

{
  "shortTermMemory": [...],
  "longTermMemory": [...]
}
```

### Error Responses
- 401: Unauthorized
- 403: Forbidden
- 500: Internal Server Error
