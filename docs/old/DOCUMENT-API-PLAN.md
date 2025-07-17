# Document API Implementation Plan

**Status**: In Progress  
**Started**: 2025-07-03  
**Target Completion**: 2025-07-06

## Overview
Create a comprehensive HTTP API for the existing document processing services (PDFConverter, HTMLConverter, Chunker, Ingester) with full test coverage and progress tracking.

## Existing Document Services Analysis

### Available Services (Ready for HTTP Exposure)
- **PDFConverter.js** - PDF to markdown conversion using `@opendocsg/pdf2md`
- **HTMLConverter.js** - HTML to markdown conversion 
- **Chunker.js** - Document chunking with Ragno ontology compliance
- **Ingester.js** - SPARQL store ingestion with provenance tracking

### Current API Pattern Analysis
- **Base Pattern**: All APIs extend `BaseAPI` class
- **Registry Integration**: APIs registered in `APIRegistry` with dependency injection
- **Route Pattern**: Express routes with `authenticateRequest` middleware
- **Handler Pattern**: `this.createHandler(api-name, operation)` pattern
- **Existing APIs**: MemoryAPI, ChatAPI, SearchAPI, RagnoAPI, ZptAPI, VSOMAPI, etc.

## Phase 1: Core API Implementation (2-3 days)

### 1.1 Create DocumentAPI Feature Class ✅ STARTED
- **File**: `src/api/features/DocumentAPI.js`
- **Pattern**: Follow existing API patterns (MemoryAPI, ChatAPI, etc.)
- **Dependencies**: Import document services from `src/services/document/`
- **Operations**: upload, convert, chunk, ingest, list, delete, status

### 1.2 Add File Upload Middleware
- **Package**: Install `multer` for multipart/form-data handling
- **Config**: Set up file size limits, allowed types (PDF, HTML, TXT)
- **Storage**: Temporary file storage with cleanup
- **Validation**: File type, size, content validation

### 1.3 HTTP Route Integration
- **File**: `src/servers/api-server.js`
- **Routes**: Add DocumentAPI to existing route setup pattern
- **Endpoints**:
  - `POST /api/documents/upload` - File upload with conversion
  - `POST /api/documents/convert` - Convert existing document
  - `POST /api/documents/chunk` - Chunk document into semantic units
  - `POST /api/documents/ingest` - Store chunks in SPARQL
  - `GET /api/documents` - List processed documents
  - `GET /api/documents/:id` - Get document details
  - `DELETE /api/documents/:id` - Delete document and chunks

### 1.4 Registry Integration
- **Pattern**: Follow existing API registration in `api-server.js`
- **Dependencies**: Initialize document services in API context
- **Error Handling**: Consistent error patterns with other APIs

## Phase 2: Unit Tests (1-2 days)

### 2.1 DocumentAPI Unit Tests
- **File**: `tests/unit/api/features/DocumentAPI.test.js`
- **Pattern**: Follow existing API test patterns (`WikidataAPI.test.js`)
- **Coverage**: All operations, error cases, validation
- **Mocks**: Mock document services, SPARQL store, file system

### 2.2 Document Service Tests Enhancement
- **Files**: Enhance existing tests in `tests/unit/services/document/`
- **Missing**: `PDFConverter.test.js`, `Ingester.test.js`
- **Coverage**: Error handling, edge cases, validation

### 2.3 Route Handler Tests
- **File**: `tests/unit/api/routes/DocumentRoutes.test.js`
- **Pattern**: Mock HTTP requests/responses
- **Coverage**: Authentication, authorization, parameter validation

## Phase 3: Integration Tests (1-2 days)

### 3.1 End-to-End API Tests
- **File**: `tests/integration/api/DocumentAPI.integration.test.js`
- **Pattern**: Follow existing integration test structure
- **Setup**: Test server, mock SPARQL endpoint, test files
- **Scenarios**: Complete document processing workflows

### 3.2 File Upload Integration
- **Tests**: Real file uploads, conversion, storage
- **Files**: Test PDF, HTML documents in `tests/fixtures/`
- **Validation**: Full pipeline from upload to SPARQL storage

### 3.3 SPARQL Integration Tests
- **File**: `tests/integration/document/SPARQLIngestion.test.js`
- **Coverage**: Document storage, retrieval, deletion
- **Dependencies**: Mock or test SPARQL endpoint

## Phase 4: Documentation & Progress Tracking (1 day)

### 4.1 API Documentation
- **File**: `docs/manual/document-api.md`
- **Content**: Endpoint documentation, examples, schemas
- **Integration**: Add to main API documentation

### 4.2 Progress Documentation
- **File**: `docs/DOCUMENT-API-PLAN.md` (this file)
- **Updates**: Regular progress reports during implementation
- **Format**: Date-stamped entries with completed tasks

### 4.3 Example Usage
- **File**: `examples/document-api/`
- **Scripts**: CLI examples, API usage examples
- **Integration**: Link with existing document-qa pipeline

## Implementation Details

### API Endpoint Specifications

```javascript
// POST /api/documents/upload
{
  "file": "<multipart-file>",
  "options": {
    "chunk": true,
    "ingest": true,
    "namespace": "http://example.org/documents/"
  }
}

// Response
{
  "documentId": "uuid",
  "filename": "document.pdf",
  "status": "processed",
  "chunks": 42,
  "processing_time": 1.5
}
```

### Error Handling Pattern
- **Validation Errors**: 400 with detailed field errors
- **Processing Errors**: 422 with processing stage info
- **Server Errors**: 500 with safe error messages
- **File Errors**: 413 for size limits, 415 for type errors

### Security Considerations
- **File Type Validation**: Strict MIME type checking
- **Size Limits**: Configurable file size limits
- **Path Traversal**: Secure file naming and storage
- **Authentication**: API key validation for all endpoints

### Performance Optimizations
- **Streaming**: Stream large files instead of loading to memory
- **Background Processing**: Async processing for large documents
- **Progress Tracking**: WebSocket or polling for processing status
- **Caching**: Cache conversion results

## Testing Strategy

### Unit Test Coverage
- **DocumentAPI**: 95%+ line coverage
- **Route Handlers**: 100% endpoint coverage
- **Error Paths**: All error conditions tested
- **Validation**: All input validation scenarios

### Integration Test Scenarios
1. **Happy Path**: Upload → Convert → Chunk → Ingest
2. **Error Recovery**: Failed conversions, SPARQL errors
3. **Large Files**: Performance and memory usage
4. **Concurrent Uploads**: Multiple file processing
5. **Authentication**: Valid/invalid API keys

### Test Data
- **Sample Files**: PDF, HTML, TXT test documents
- **Edge Cases**: Empty files, corrupt files, huge files
- **Mock Services**: SPARQL store, LLM services
- **Performance**: Timing and memory usage validation

## Dependencies & Prerequisites

### New Dependencies
- `multer`: File upload handling
- `mime-types`: MIME type validation
- `tmp`: Temporary file management

### Configuration Updates
- File upload limits in config
- Document storage paths
- API rate limiting for uploads

### Infrastructure Requirements
- SPARQL endpoint availability
- File system permissions
- Sufficient disk space for temporary files

---

## Progress Log

### 2025-07-03 - Project Kickoff
- ✅ **Analysis Complete**: Researched existing codebase architecture
- ✅ **Plan Created**: Comprehensive implementation plan documented
- ✅ **Todo List**: Created task tracking for implementation phases
- ✅ **DocumentAPI Created**: Implemented complete DocumentAPI.js feature class
- ✅ **Dependencies Added**: Installed multer, mime-types, tmp packages
- ✅ **Routes Integrated**: Added all HTTP endpoints to api-server.js
- ✅ **Middleware Setup**: Configured multer for file uploads
- ✅ **Service Discovery**: Added to API service discovery endpoint

**Phase 1 COMPLETE**: Core API implementation finished

**Current Status**: 
- ✅ DocumentAPI feature class with all operations (upload, convert, chunk, ingest, list, get, delete, status)
- ✅ File upload middleware with validation and size limits
- ✅ HTTP routes: POST /api/documents/upload, /convert, /chunk, /ingest, GET /documents, etc.
- ✅ Error handling and logging integration
- ✅ Service discovery integration

**Unit Tests COMPLETE**: 
- ✅ **39 Tests Created**: Comprehensive unit test suite for DocumentAPI
- ✅ **100% Method Coverage**: All operations tested (upload, convert, chunk, ingest, list, get, delete, status)
- ✅ **Error Handling**: All error paths and edge cases covered
- ✅ **File Validation**: File size, type, and content validation tested
- ✅ **Parameter Validation**: Input validation and sanitization tested
- ✅ **Resource Cleanup**: Dispose method and temp file cleanup tested

**Test Results**: All 39 unit tests passing
- Initialization tests: 3/3 ✅
- Operation execution tests: 3/3 ✅  
- Upload document tests: 4/4 ✅
- Convert document tests: 6/6 ✅
- Chunk document tests: 3/3 ✅
- Ingest document tests: 3/3 ✅
- List/Get/Delete tests: 9/9 ✅
- Validation tests: 6/6 ✅
- Cleanup tests: 2/2 ✅

**Next Steps**: 
1. Create integration tests for HTTP endpoints
2. Test actual file upload functionality
3. Create API documentation and examples