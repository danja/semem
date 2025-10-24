# Manual Documentation Ingestion Utility Plan

## Objective
Create `utils/IngestManual.js` to recursively walk a directory of markdown files and ingest them into the Semem system via HTTP POST requests to the MCP API server's `/tell` endpoint.

## Key Design Decisions

### 1. CLI Arguments (using native `parseArgs` from `util`)
Following the codebase pattern from `BookmarkIngest.js`, use Node's built-in `parseArgs` instead of yargs:
- `--host` (default: `http://localhost:4101`) - Semem MCP server host URL
- `--dir` (default: `docs/manual`) - Root directory to crawl for .md files
- `--dry-run` / `-d` - Preview files without ingesting
- `--verbose` / `-v` - Enable detailed logging
- `--help` / `-h` - Show help message

### 2. Architecture Pattern
Follow `BookmarkIngest.js` structure but simplified for HTTP client:
- Minimal dependencies - no Config, no SimpleVerbsService (those are server-side)
- Pure HTTP client using native `fetch` or minimal http library
- Recursive directory walking using `fs.promises` and `path`
- Progress reporting with file count and success/error tracking

### 3. HTTP Integration
POST to `/tell` endpoint with payload:
```json
{
  "content": "<markdown file content>",
  "type": "document",
  "metadata": {
    "source": "manual-ingestion",
    "filename": "config.md",
    "filepath": "docs/manual/config.md",
    "format": "markdown",
    "title": "<extracted from first # header>",
    "ingestionDate": "<ISO timestamp>"
  }
}
```

### 4. File Processing Strategy
1. Recursively find all `.md` files in target directory
2. Read each file content
3. Extract title from first `# ` header (if present)
4. Create metadata object with file information
5. POST to `/tell` endpoint
6. Track success/failure for reporting
7. Continue on individual failures (don't abort entire batch)

### 5. Error Handling
- Network errors: Retry with exponential backoff (max 3 attempts)
- File read errors: Log and continue to next file
- API errors: Log response and continue
- Final summary report showing successes/failures

### 6. Features
- **Dry run mode**: List files that would be ingested without making API calls
- **Progress tracking**: Show current file and completion percentage
- **Batch processing**: Process files sequentially to avoid overwhelming the API
- **Summary report**: Total files found, ingested, failed, with error details

## Implementation Steps

1. **Create file structure**: `utils/IngestManual.js` with proper shebang and executable permissions

2. **Implement CLI class**: `ManualIngestCLI` with methods:
   - `parseArguments()` - Parse CLI args
   - `showHelp()` - Display usage instructions
   - `findMarkdownFiles(dir)` - Recursively find .md files
   - `extractTitle(content)` - Get title from markdown
   - `ingestFile(filepath, host)` - POST single file to API
   - `executeIngestion(options)` - Main ingestion logic
   - `run()` - Entry point

3. **Implement file discovery**: Recursive walk using `fs.promises.readdir` with `recursive: true` option (Node 18+) or manual recursion

4. **Implement HTTP client**: Use native `fetch` (Node 18+) with proper error handling and retry logic

5. **Add progress reporting**: Console output showing:
   - Files discovered count
   - Current file being processed
   - Success/failure indicators
   - Final summary statistics

6. **Testing considerations**: Can be tested against running MCP server on localhost:4101

## Implementation Notes

- The user originally requested yargs, but the codebase pattern uses Node's built-in `parseArgs` from `util`
- Following existing patterns in `BookmarkIngest.js` for consistency
- Unlike `BookmarkIngest.js`, this is a pure HTTP client and doesn't need server-side dependencies like Config or SimpleVerbsService
- The MCP API server at `/tell` endpoint will handle chunking, embedding generation, and storage
- The script's responsibility is limited to file discovery and HTTP POSTing

## Testing Strategy

1. Test with dry-run mode first to verify file discovery
2. Test with small subset using --limit flag (if implemented)
3. Test error handling with invalid host
4. Test with full docs/manual directory
5. Verify ingestion by querying the system with ask verb

## Future Enhancements (Not in Scope)

- Batch processing with configurable concurrency
- Resume capability (skip already ingested files)
- Watch mode for continuous ingestion
- Integration with git hooks for automatic ingestion on commits
- Filtering by file modification date
