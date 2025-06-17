# Types Module

The Types module provides comprehensive TypeScript type definitions and schema validation for the Semem semantic memory system. It ensures type safety across all components and provides runtime validation for data integrity.

## Architecture

### Core Type Definitions

#### Memory Types (`MemoryTypes.js` / `MemoryTypes.ts`)
- **Memory Item**: Core memory storage structure
- **Memory Metadata**: Contextual information and provenance
- **Memory Query**: Search and retrieval parameters
- **Memory Response**: Query result structures
- **Memory Statistics**: Analytics and metrics types

#### Core Types (`core.d.ts`)
- **System Configuration**: Application-wide configuration schema
- **Service Interfaces**: Abstract service contracts
- **Event Types**: System event definitions
- **Error Types**: Structured error handling
- **Lifecycle Types**: Component initialization and cleanup

#### API Types (`api.ts`)
- **Request/Response**: HTTP API contract definitions
- **Authentication**: User and service authentication types
- **Authorization**: Permission and access control types
- **Validation**: Input validation and sanitization schemas
- **Middleware**: Request processing pipeline types

#### Ragno Types (`ragno.d.ts`)
- **Knowledge Graph**: Entity and relationship definitions
- **Graph Analytics**: Community detection and centrality types
- **Search Types**: Multi-modal search parameter definitions
- **Embedding Types**: Vector embedding and similarity types
- **RDF Types**: Semantic web and SPARQL integration

#### ZPT Types (`zpt.d.ts`)
- **Zero-Point Transformation**: Advanced query processing types
- **Parameter Types**: Query parameter normalization
- **Selection Types**: Content selection and filtering
- **Transform Types**: Data transformation pipeline definitions

### Schema Validation

#### MCP Schema (`mcp-schema.json` / `mcp-schema.ts`)
- **Model Context Protocol**: LLM communication protocol definitions
- **Message Types**: Inter-model communication formats
- **Context Types**: Shared context and state management
- **Protocol Validation**: Runtime protocol compliance checking

## Type Definitions

### Memory System Types

#### Core Memory Item
```typescript
interface MemoryItem {
  id: string;
  prompt: string;
  response: string;
  embedding?: number[];
  concepts?: string[];
  metadata: MemoryMetadata;
  created: Date;
  updated: Date;
  accessCount: number;
  lastAccessed: Date;
}

interface MemoryMetadata {
  source: MemorySource;
  confidence: number;
  context?: ContextInfo;
  tags?: string[];
  relationships?: RelationshipInfo[];
  provenance?: ProvenanceInfo;
  quality?: QualityMetrics;
}

type MemorySource = 'user-input' | 'system-generated' | 'external-import' | 'llm-conversation';

interface ContextInfo {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  applicationContext?: Record<string, any>;
}
```

#### Search and Query Types
```typescript
interface MemoryQuery {
  query?: string;
  embedding?: number[];
  filters?: QueryFilters;
  limit?: number;
  offset?: number;
  threshold?: number;
  sortBy?: SortCriteria[];
  includeMetadata?: boolean;
  includeEmbeddings?: boolean;
}

interface QueryFilters {
  concepts?: StringFilter;
  source?: MemorySource[];
  dateRange?: DateRangeFilter;
  confidence?: NumberRangeFilter;
  tags?: StringFilter;
  metadata?: MetadataFilter;
}

interface SearchResult<T = MemoryItem> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  aggregations?: SearchAggregations;
  timing?: SearchTiming;
}
```

### Knowledge Graph Types

#### Entity and Relationship Definitions
```typescript
interface Entity {
  id: string;
  uri: string;
  name: string;
  type: EntityType;
  subType?: string;
  isEntryPoint: boolean;
  properties: EntityProperties;
  relationships: RelationshipReference[];
  metadata: EntityMetadata;
  embedding?: number[];
  created: Date;
  updated: Date;
}

interface Relationship {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  properties: RelationshipProperties;
  confidence: number;
  bidirectional: boolean;
  metadata: RelationshipMetadata;
  created: Date;
}

type EntityType = 'concept' | 'person' | 'organization' | 'location' | 'event' | 'artifact' | 'abstract';
type RelationshipType = 'relatedTo' | 'subClassOf' | 'instanceOf' | 'partOf' | 'locatedIn' | 'causedBy' | 'similarTo';
```

#### Graph Analytics Types
```typescript
interface CommunityDetectionResult {
  communities: Community[];
  modularity: number;
  algorithm: CommunityAlgorithm;
  parameters: CommunityParameters;
  timing: AnalyticsTiming;
}

interface Community {
  id: string;
  entities: string[];
  relationships: string[];
  size: number;
  density: number;
  conductance: number;
  centrality: CentralityMetrics;
  description?: string;
}

interface CentralityMetrics {
  pagerank: Record<string, number>;
  betweenness: Record<string, number>;
  closeness: Record<string, number>;
  eigenvector: Record<string, number>;
}
```

### API and Service Types

#### Service Configuration
```typescript
interface ServiceConfig {
  name: string;
  version: string;
  enabled: boolean;
  dependencies: string[];
  configuration: ServiceOptions;
  healthCheck: HealthCheckConfig;
  metrics: MetricsConfig;
}

interface APIEndpoint {
  path: string;
  method: HTTPMethod;
  handler: RequestHandler;
  middleware: Middleware[];
  validation: ValidationSchema;
  authentication: AuthenticationRequirement;
  rateLimit: RateLimitConfig;
  documentation: EndpointDocumentation;
}

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
```

#### Request/Response Types
```typescript
interface APIRequest<T = any> {
  path: string;
  method: HTTPMethod;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
  body: T;
  user?: AuthenticatedUser;
  session?: SessionInfo;
  requestId: string;
  timestamp: Date;
}

interface APIResponse<T = any> {
  data?: T;
  error?: APIError;
  metadata: ResponseMetadata;
  pagination?: PaginationInfo;
  timing: ResponseTiming;
}

interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  requestId: string;
  timestamp: Date;
}
```

### Embedding and Vector Types

#### Embedding Definitions
```typescript
interface EmbeddingVector {
  id: string;
  vector: number[];
  dimension: number;
  model: string;
  normalization: NormalizationType;
  metadata: EmbeddingMetadata;
  created: Date;
}

interface EmbeddingMetadata {
  sourceText: string;
  sourceLength: number;
  tokenCount?: number;
  quality: EmbeddingQuality;
  generationTime: number;
  modelVersion: string;
}

interface SimilarityResult {
  id: string;
  similarity: number;
  distance: number;
  metadata?: Record<string, any>;
}

type NormalizationType = 'none' | 'l2' | 'max' | 'min-max';
type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan' | 'dot-product';
```

### Validation Schemas

#### Runtime Validation
```typescript
interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, ValidationProperty>;
  required?: string[];
  additionalProperties?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: ValidationSchema;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  transformedData?: any;
}

interface ValidationError {
  path: string;
  message: string;
  value: any;
  schema: ValidationSchema;
}
```

## Usage Patterns

### Type-Safe Service Implementation
```typescript
// Service implementation with strict typing
class MemoryService implements IMemoryService {
  async store(item: CreateMemoryRequest): Promise<MemoryItem> {
    const validated = await this.validator.validate(item, CreateMemorySchema);
    if (!validated.valid) {
      throw new ValidationError('Invalid memory item', validated.errors);
    }
    
    return this.storage.store(validated.data);
  }
  
  async search(query: MemoryQuery): Promise<SearchResult<MemoryItem>> {
    const validated = await this.validator.validate(query, MemoryQuerySchema);
    return this.storage.search(validated.data);
  }
}
```

### Runtime Type Checking
```typescript
// Runtime validation with type guards
function isMemoryItem(obj: unknown): obj is MemoryItem {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'prompt' in obj &&
    'response' in obj &&
    'metadata' in obj
  );
}

function validateMemoryItem(data: unknown): MemoryItem {
  if (!isMemoryItem(data)) {
    throw new TypeError('Invalid memory item structure');
  }
  
  // Additional validation logic
  if (!data.id || typeof data.id !== 'string') {
    throw new TypeError('Memory item must have a valid string ID');
  }
  
  return data;
}
```

### Schema-Based Validation
```typescript
// Zod schema for runtime validation
import { z } from 'zod';

const MemoryItemSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().min(1).max(10000),
  response: z.string().min(1).max(50000),
  embedding: z.array(z.number()).optional(),
  concepts: z.array(z.string()).optional(),
  metadata: z.object({
    source: z.enum(['user-input', 'system-generated', 'external-import']),
    confidence: z.number().min(0).max(1),
    context: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional()
  }),
  created: z.date(),
  updated: z.date(),
  accessCount: z.number().min(0),
  lastAccessed: z.date()
});

type MemoryItem = z.infer<typeof MemoryItemSchema>;

// Runtime validation
function validateMemoryItem(data: unknown): MemoryItem {
  return MemoryItemSchema.parse(data);
}
```

## Development Benefits

### Type Safety
- **Compile-time Checking**: Catch type errors during development
- **IntelliSense Support**: Rich IDE autocompletion and documentation
- **Refactoring Safety**: Automated refactoring with type awareness
- **API Contract Enforcement**: Ensure API compatibility across versions

### Documentation Generation
- **Automatic Documentation**: Generate API docs from type definitions
- **Schema Validation**: Runtime validation from type definitions
- **Example Generation**: Create usage examples from types
- **Integration Testing**: Type-driven test generation

### Code Quality
- **Consistent Interfaces**: Enforce uniform data structures
- **Error Prevention**: Reduce runtime type errors
- **Code Clarity**: Self-documenting code through types
- **Team Collaboration**: Shared understanding of data structures

## Migration and Versioning

### Schema Evolution
```typescript
// Versioned schemas for backward compatibility
interface MemoryItemV1 {
  id: string;
  prompt: string;
  response: string;
  metadata: MemoryMetadataV1;
}

interface MemoryItemV2 extends MemoryItemV1 {
  embedding?: number[];
  concepts?: string[];
  metadata: MemoryMetadataV2;
}

// Migration functions
function migrateMemoryItemV1ToV2(item: MemoryItemV1): MemoryItemV2 {
  return {
    ...item,
    metadata: migrateMetadataV1ToV2(item.metadata)
  };
}
```

### Type Compatibility
```typescript
// Type compatibility checking
type IsCompatible<T, U> = T extends U ? true : false;
type V1ToV2Compatible = IsCompatible<MemoryItemV1, MemoryItemV2>; // false
type V2ToV1Compatible = IsCompatible<MemoryItemV2, MemoryItemV1>; // true (with optional fields)
```