# Dogalog Chat Endpoint Implementation Plan

## Overview

Add a Dogalog-specific chat endpoint to Semem's MCP HTTP server that enables the Dogalog Prolog audio programming IDE to interact with Semem's LLM and semantic memory capabilities.

**Approach**: Lightweight endpoint layer that reuses 95% of existing infrastructure with minimal risk.

**Key Decisions**:
- ✅ Port 4101 (existing MCP server) - Dogalog configures `http://localhost:4101/dogalog/chat`
- ✅ Stateless (no memory storage) - pure request/response per contract
- ✅ Dogalog-specific prompts - music/audio/Prolog domain knowledge

## Implementation Strategy

### Architecture Pattern
```
Dogalog Client
    ↓
POST /dogalog/chat { prompt, code? }
    ↓
PrologContextBuilder (new utility)
    ↓
SimpleVerbsService.ask() (existing, reused)
    ↓
DogalogResponseParser (new utility)
    ↓
Response { message, codeSuggestion?, querySuggestion? }
```

**New code**: ~200 lines total (2 utilities + 1 endpoint + 2 templates)
**Modified code**: ~70 lines (1 endpoint addition to http-server.js)
**Reused infrastructure**: SimpleVerbsService, AskCommand, SimpleTemplateLoader, LLMHandler

## API Contract (from Dogalog documentation)

### Request
```json
{
  "prompt": "string, required",
  "code": "string, optional (current editor contents)"
}
```

### Response
```json
{
  "message": "string, required",
  "codeSuggestion": "string, optional",
  "querySuggestion": "string, optional"
}
```

### Error Handling
- Always returns HTTP 200 (even for errors)
- Errors returned as: `{ "message": "description of the error" }`

## Files Created

### 1. Dogalog Response Parser Utility
**File**: `src/utils/DogalogResponseParser.js` (~80 lines)

Extracts Prolog code and query suggestions from LLM responses using pattern matching:
- Pattern 1: Labeled blocks (`PROLOG CODE:`, `PROLOG QUERY:`)
- Pattern 2: Generic code fences
- Pattern 3: Heuristic (short code = query, long = program)

### 2. Prolog Context Builder Utility
**File**: `src/mcp/lib/PrologContextBuilder.js` (~40 lines)

Builds Dogalog-aware prompts using the template system:
- Uses SimpleTemplateLoader
- Selects appropriate template based on code presence
- Interpolates variables into templates

### 3. Dogalog Prompt Templates
**Files**:
- `prompts/templates/mcp/dogalog-with-code.md` (~35 lines)
- `prompts/templates/mcp/dogalog-no-code.md` (~30 lines)

Instructs the LLM with:
- Dogalog domain knowledge (euclidean rhythms, MIDI, time predicates)
- Response formatting guidelines (labeled blocks for code/queries)
- Musical/rhythmic context

## Files Modified

### 1. MCP HTTP Server
**File**: `src/mcp/http-server.js`

**Changes**:
- Added imports for DogalogResponseParser and PrologContextBuilder
- Added `/dogalog/chat` endpoint (after line 437)
- Endpoint handles request validation, prompt building, response extraction, error handling
- Uses existing mcpDebugger for logging
- CORS already configured (no changes needed)

## Testing

### Unit Tests
1. `tests/unit/utils/DogalogResponseParser.test.js` (~100 lines)
   - Extract labeled code/query blocks
   - Fallback patterns
   - Heuristic detection
   - Error handling

2. `tests/unit/mcp/PrologContextBuilder.test.js` (~60 lines)
   - Template loading
   - Variable interpolation
   - Error handling

### Integration Test
**File**: `tests/integration/dogalog/dogalog-chat-e2e.integration.test.js` (~120 lines)

Tests:
- Simple prompts
- Prompts with code context
- Code suggestion extraction
- Query suggestion extraction
- Error handling
- CORS headers

### Manual Testing

```bash
# Start servers
./start.sh

# Test basic prompt
curl -X POST http://localhost:4101/dogalog/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is Dogalog?"}'

# Test with code context
curl -X POST http://localhost:4101/dogalog/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add a hi-hat pattern", "code": "kick(T) :- euc(T,4,16,4,0).\nevent(kick,36,1.0,T) :- kick(T)."}'

# Test error handling
curl -X POST http://localhost:4101/dogalog/chat \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Configuration

**No changes required** - uses existing:
- `config/config.json` - LLM providers
- `config/preferences.js` - SPARQL/memory settings
- `.env` - API keys
- Port 4101 - MCP_PORT environment variable

## Deployment

1. Implementation completes → run tests
2. Tests pass → commit to repository
3. Restart servers: `./stop.sh && ./start.sh`
4. Verify endpoint: `curl http://localhost:4101/dogalog/chat`
5. Configure Dogalog: Set AI endpoint to `http://localhost:4101/dogalog/chat`

## Usage from Dogalog

In the Dogalog IDE, configure the AI endpoint:
```
http://localhost:4101/dogalog/chat
```

The endpoint will:
- Accept user prompts and current Prolog code
- Generate music/audio-aware responses
- Extract and return code suggestions when appropriate
- Extract and return query suggestions when appropriate

## Risk Assessment

**Low Risk** ✅
- Isolated new code (utilities + endpoint)
- No modifications to core commands
- No configuration changes
- No database/storage changes
- Stateless (no session management)
- CORS already configured
- Error handling prevents crashes

**Mitigation Strategies**:
- LLM response variability → Labeled blocks + fallback patterns
- Template not found → Graceful fallback in PrologContextBuilder
- Parse failures → Return message without suggestions (graceful degradation)

## Future Enhancements (Out of Scope)

- Memory integration (store Dogalog patterns for learning)
- Multi-turn conversations with session management
- Streaming responses (SSE/WebSockets)
- Prolog syntax validation
- Pattern library (common Dogalog snippets)
- Performance metrics and analytics

## File Summary

**New files** (4 code + 3 tests = 7 total):
1. `src/utils/DogalogResponseParser.js` (~80 lines)
2. `src/mcp/lib/PrologContextBuilder.js` (~40 lines)
3. `prompts/templates/mcp/dogalog-with-code.md` (~35 lines)
4. `prompts/templates/mcp/dogalog-no-code.md` (~30 lines)
5. `tests/unit/utils/DogalogResponseParser.test.js` (~100 lines)
6. `tests/unit/mcp/PrologContextBuilder.test.js` (~60 lines)
7. `tests/integration/dogalog/dogalog-chat-e2e.integration.test.js` (~120 lines)

**Modified files** (1 total):
1. `src/mcp/http-server.js` (+2 imports, +60 lines endpoint)

**Total new code**: ~525 lines (including tests)
**Core implementation**: ~215 lines (excluding tests)
