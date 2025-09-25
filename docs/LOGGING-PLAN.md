# Logging Consolidation Plan

## Objective
Consolidate logging functionality across the codebase to use the centralized logging setup in `src/utils/LoggingConfig.js`. Eliminate redundant logging implementations and ensure consistency.

## Current State
Logging is implemented in various ways across the codebase:
- **`src/utils/LoggingConfig.js`**: Provides a centralized, STDIO-aware logging setup using `loglevel`.
- **Direct `console.log` Statements**: Found in multiple files, especially in `SearchService.js` and frontend scripts.
- **Custom Logger Implementations**: Some files define their own logging utilities.

## Plan

### 1. Standardize Logging
- Replace all direct `console.log` statements with `createUnifiedLogger` from `LoggingConfig.js`.
- Use component-specific loggers for better traceability (e.g., `search`, `embedding`, `server`).

### 2. Remove Redundant Implementations
- Identify and remove custom logging utilities (e.g., `src/Utils.js` logger).
- Ensure all modules use the centralized logging setup.

### 3. Configure Component Loggers
- Use `configureLogging` to create loggers for major components:
  - `search`
  - `embedding`
  - `server`
  - `memory`
  - `api`

### 4. Validate Changes
- Test the application to ensure logs are correctly written to files and console output is suppressed in STDIO mode.
- Verify that no direct `console.log` statements remain.

## Deliverables
1. Refactored codebase with unified logging.
2. Updated documentation in `README.md` to describe the logging setup.
3. Removal of redundant logging utilities.

## Timeline
- **Day 1**: Analyze and replace direct `console.log` statements.
- **Day 2**: Remove redundant logging utilities.
- **Day 3**: Configure component-specific loggers.
- **Day 4**: Validate and document changes.

## Validation and Documentation

### Validation
- Verified that all direct `console.log` statements have been replaced with `createUnifiedLogger`.
- Confirmed that redundant logging utilities, such as the custom logger in `src/Utils.js`, have been removed.
- Tested the application to ensure logs are correctly written to files and console output is suppressed in STDIO mode.
- Ensured that component-specific loggers (e.g., `search`, `embedding`, `server`) are functioning as expected.

### Documentation
- Updated `README.md` to include a section on the centralized logging setup:
  - Describes how to use `createUnifiedLogger`.
  - Provides examples of creating component-specific loggers.
  - Explains the STDIO-aware logging configuration.

### Outcome
The logging consolidation has been successfully implemented. The codebase now uses a unified logging setup, ensuring consistency and maintainability.