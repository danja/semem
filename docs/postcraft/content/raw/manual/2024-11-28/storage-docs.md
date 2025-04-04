# Storage System Documentation

## BaseStorage (storage.js)
Abstract base class defining the storage interface. All storage implementations must extend this class.

### Methods
- `loadHistory()`: Async method that retrieves stored memory interactions
- `saveMemoryToHistory(memoryStore)`: Async method that persists current memory state

### Key Features
- Abstract interface ensuring consistency across implementations
- Async/await pattern for I/O operations
- Error handling requirements for implementations

## InMemoryStorage (inMemoryStorage.js)
RAM-based storage implementation for development and testing.

### Features
- Fast access and retrieval
- No persistence between restarts
- Ideal for testing and prototyping

### Implementation Details
- Uses JavaScript objects for storage
- Maintains separate short-term and long-term memory arrays
- Handles data structure conversions

## JSONStorage (jsonStorage.js)
File-based storage implementation using JSON format.

### Features
- Persistent storage between application restarts
- Human-readable storage format
- File-based backup capability

### Implementation Details
- Asynchronous file operations
- Automatic file creation if not exists
- Error handling for file operations
- JSON serialization/deserialization

## RemoteStorage (remoteStorage.js)
Network-based storage implementation for distributed systems.

### Features
- RESTful API integration
- Authentication support
- Timeout handling
- Retry logic

### Implementation Details
- HTTP/HTTPS protocols
- Bearer token authentication
- Configurable endpoints
- Network error handling
