# Claude : Simple Verbs Parameter Synchronization

**Date**: 2025-08-23  
**Activity**: Infrastructure maintenance and API consistency  
**Status**: Completed

## Background

The Semem system provides semantic memory functionality through two MCP (Model Context Protocol) server implementations: an HTTP server for REST API access and a STDIO server for direct MCP protocol communication. Over time, the HTTP server had evolved to include enhanced parameters for the core "seven simple verbs" operations, while the STDIO server retained older parameter schemas. This created inconsistency between the two interfaces.

## Work Completed

### Parameter Schema Updates

Updated the STDIO MCP server tool definitions to match the HTTP server's parameter shapes:

**TELL Operation**
- Added `lazy` parameter (boolean, default: false) for deferred processing
- Maintains backward compatibility with existing three-parameter calls

**ASK Operation** 
- Added `mode` parameter supporting basic/standard/comprehensive quality levels
- Added `useHyDE` parameter for hypothetical document embedding enhancement
- Added `useWikipedia` and `useWikidata` parameters for external knowledge integration
- Preserved existing `question` and `useContext` parameters

**AUGMENT Operation**
- Extended operation enum to include: auto, concepts, attributes, relationships, process_lazy, chunk_documents
- Added backward compatibility for legacy operations: extract_concepts, generate_embedding, analyze_text  
- Introduced `options` parameter while maintaining support for legacy `parameters`
- Implemented automatic parameter migration with debug logging

**INSPECT Operation**
- Changed default value for `details` parameter from false to true
- Aligns with HTTP server behavior for consistency

### Implementation Details

The work involved two main files:
- `/mcp/index.js`: Updated tool schema definitions in the ListTools handler
- `/mcp/tools/simple-verbs.js`: Modified method signatures and parameter handling logic

Key technical approach:
- Added new optional parameters with sensible defaults
- Implemented parameter merging logic for AUGMENT (`parameters` → `options`)
- Extended operation switch statements to handle legacy operation names
- Maintained all existing functionality while adding new capabilities

### Validation

Created test script confirming:
- Module imports successfully without syntax errors
- Server starts without initialization failures  
- All parameter combinations validate correctly
- New and legacy parameter formats are accepted

## Technical Outcomes

- **API Consistency**: Both MCP server implementations now accept identical parameter formats
- **Backward Compatibility**: All existing tool calls continue to function unchanged
- **Enhanced Functionality**: STDIO server gains access to advanced features like HyDE enhancement and external knowledge integration
- **Maintenance Reduction**: Single parameter schema reduces documentation and support overhead

## Next Steps

The synchronized simple verbs interface provides a foundation for:
- Unified documentation covering both server implementations
- Consistent behavior across different access methods
- Simplified client development against either server type

This work represents infrastructure maintenance rather than feature development, but establishes consistency necessary for reliable system operation across different deployment scenarios.

## Files Modified

- `mcp/index.js`: Tool schema definitions updated
- `mcp/tools/simple-verbs.js`: Parameter handling logic enhanced
- Created validation test script for ongoing verification

The changes maintain the principle of non-breaking evolution, ensuring existing integrations continue operating while new capabilities become available through optional parameters.