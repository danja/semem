# Semem API Documentation

This directory contains documentation for the Semem (Semantic Memory) API system.

## Contents

- [API Plan](./api-plan.md) - Strategic plan for exposing APIs from the Semem library
- [OpenAPI Specification](./openapi-spec.yaml) - OpenAPI 3.0 specification of the proposed REST API
- [Implementation Status](./implementation-status.md) - Current status of API implementation

## Overview

Semem provides a set of APIs for managing semantic memory, generating chat responses with context, and performing semantic search. The API is designed to be:

- **Consistent**: Follow RESTful principles with consistent naming and patterns
- **Secure**: Include authentication, rate limiting, and input validation
- **Performant**: Optimize for low latency and efficient batch operations
- **Extensible**: Support multiple LLM providers and storage backends

## Key API Categories

1. **Memory Management** - Store and retrieve semantic memories
2. **Chat and Completion** - Generate responses with contextual memory
3. **Semantic Search** - Perform vector-based content search

## Getting Started

To interact with the Semem API:

1. Review the [API Plan](./api-plan.md) to understand the overall architecture
2. Examine the [OpenAPI Specification](./openapi-spec.yaml) for detailed endpoint information
3. Build your integration using the provided examples and guidelines

## Implementation Examples

The API can be used in three primary ways:

1. **HTTP REST API** - Interact with a deployed Semem server via HTTP requests
2. **JavaScript SDK** - Use a client library wrapper for the HTTP API
3. **Node.js Module** - Use the core classes directly in your Node.js application

See the [API Plan](./api-plan.md) for concrete code examples of each approach.

## Current Status

The Semem API has been implemented following the specifications in this documentation. For details on the current implementation status, see the [Implementation Status](./implementation-status.md) document.

## Next Steps

The API implementation will continue to evolve. Upcoming improvements include:

- Complete integration test suite
- Performance optimization for high-load scenarios
- Interactive API explorer with Swagger UI
- Client SDK for multiple languages (JavaScript, Python, Go)
- Detailed integration guides for common use cases
- API versioning and migration guidelines