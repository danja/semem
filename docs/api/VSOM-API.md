# VSOM API Specification

## Base URL
All endpoints are prefixed with `/api/vsom`

## Authentication
All endpoints require authentication via session cookie or API key.

## Error Responses

### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Detailed error message",
    "details": {
      "field": "Specific error about field"
    }
  }
}
```

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Detailed error message"
  }
}
```

## Endpoints

### 1. Create SOM
Create a new SOM instance with the specified configuration.

**Endpoint**: `POST /create`

**Request Body**:
```json
{
  "width": 10,
  "height": 10,
  "inputDim": 128,
  "learningRate": 0.1,
  "neighborhoodRadius": 3.0,
  "topology": "hexagonal",
  "toroidal": false,
  "normalize": true
}
```

**Parameters**:
- `width`: Grid width (number of nodes)
- `height`: Grid height (number of nodes)
- `inputDim`: Dimensionality of input vectors
- `learningRate`: Initial learning rate (0-1)
- `neighborhoodRadius`: Initial neighborhood radius
- `topology`: Grid topology (`"hexagonal"` or `"rectangular"`)
- `toroidal`: Whether the grid wraps around edges (boolean)
- `normalize`: Whether to normalize input vectors (boolean)

**Success Response (201 Created)**:
```json
{
  "somId": "som_12345",
  "status": "initialized",
  "config": {
    "width": 10,
    "height": 10,
    "inputDim": 128,
    "learningRate": 0.1,
    "neighborhoodRadius": 3.0,
    "topology": "hexagonal",
    "toroidal": false,
    "normalize": true
  },
  "createdAt": "2024-06-17T07:00:00Z"
}
```

### 2. Train SOM
Train the SOM with the provided data.

**Endpoint**: `POST /train`

**Request Body**:
```json
{
  "somId": "som_12345",
  "data": [
    {"id": "item1", "vector": [0.1, 0.2, ...], "metadata": {}},
    {"id": "item2", "vector": [0.3, 0.4, ...], "metadata": {}}
  ],
  "epochs": 100,
  "batchSize": 32,
  "learningRateDecay": 0.99,
  "radiusDecay": 0.99
}
```

**Parameters**:
- `somId`: ID of the SOM to train
- `data`: Array of training items with vectors
- `epochs`: Number of training epochs
- `batchSize`: Number of samples per batch
- `learningRateDecay`: Learning rate decay factor (0-1)
- `radiusDecay`: Neighborhood radius decay factor (0-1)

**Success Response (200 OK)**:
```json
{
  "trainingId": "train_12345",
  "status": "started",
  "progress": 0.0,
  "metrics": {
    "quantizationError": 0.0,
    "topographicError": 0.0
  },
  "startedAt": "2024-06-17T07:01:00Z"
}
```

### 3. Get SOM State
Get the current state of a SOM.

**Endpoint**: `GET /:somId/state`

**URL Parameters**:
- `somId`: ID of the SOM

**Query Parameters**:
- `includeWeights`: Include weight vectors in response (boolean, default: false)
- `includeBMUs`: Include best matching units (boolean, default: false)

**Success Response (200 OK)**:
```json
{
  "somId": "som_12345",
  "status": "trained",
  "config": {
    "width": 10,
    "height": 10,
    "inputDim": 128,
    "learningRate": 0.1,
    "neighborhoodRadius": 3.0,
    "topology": "hexagonal",
    "toroidal": false,
    "normalize": true
  },
  "metrics": {
    "quantizationError": 0.45,
    "topographicError": 0.12
  },
  "weights": [[0.1, 0.2, ...], ...],
  "bmus": {
    "item1": {"x": 1, "y": 2, "distance": 0.45},
    "item2": {"x": 3, "y": 4, "distance": 0.38}
  },
  "trainedAt": "2024-06-17T07:30:00Z"
}
```

### 4. Get Feature Maps
Get component planes/feature maps for the SOM.

**Endpoint**: `GET /:somId/feature-maps`

**URL Parameters**:
- `somId`: ID of the SOM

**Query Parameters**:
- `features`: Array of feature indices to include (default: all)
- `normalize`: Whether to normalize values (boolean, default: true)

**Success Response (200 OK)**:
```json
{
  "somId": "som_12345",
  "featureMaps": [
    {
      "featureIndex": 0,
      "featureName": "feature_0",
      "values": [[0.1, 0.2, ...], ...],
      "minValue": 0.0,
      "maxValue": 1.0
    },
    ...
  ]
}
```

### 5. Cluster SOM
Perform clustering on the SOM nodes.

**Endpoint**: `POST /:somId/cluster`

**URL Parameters**:
- `somId`: ID of the SOM

**Request Body**:
```json
{
  "method": "kmeans",
  "params": {
    "k": 5,
    "maxIterations": 100
  }
}
```

**Parameters**:
- `method`: Clustering method (`"kmeans"`, `"hierarchical"`, `"dbscan"`)
- `params`: Method-specific parameters

**Success Response (200 OK)**:
```json
{
  "clusteringId": "cluster_12345",
  "method": "kmeans",
  "clusters": [
    {
      "id": 0,
      "nodes": [{"x": 0, "y": 0}, ...],
      "centroid": [0.1, 0.2, ...],
      "size": 15
    },
    ...
  ],
  "metrics": {
    "silhouetteScore": 0.75,
    "daviesBouldinIndex": 0.45
  }
}
```

## WebSocket Events

### Training Progress
```json
{
  "event": "training_progress",
  "data": {
    "trainingId": "train_12345",
    "epoch": 10,
    "totalEpochs": 100,
    "progress": 0.1,
    "metrics": {
      "quantizationError": 0.65,
      "topologyError": 0.25,
      "learningRate": 0.095,
      "neighborhoodRadius": 2.85
    }
  }
}
```

### Training Complete
```json
{
  "event": "training_complete",
  "data": {
    "trainingId": "train_12345",
    "status": "completed",
    "metrics": {
      "finalQuantizationError": 0.42,
      "finalTopologyError": 0.15,
      "totalTimeSeconds": 42.5
    },
    "completedAt": "2024-06-17T07:45:30Z"
  }
}
```

## Rate Limiting
- 100 requests per minute per client
- 10 concurrent training jobs per user

## Versioning
API version is included in the URL path (e.g., `/api/v1/...`).

## Changelog
- 2024-06-17: Initial version
