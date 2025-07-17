# Legacy Prompt System Usage

This document lists the modules that are still using legacy prompt systems (`PromptTemplates.js` or `mcp/prompts/registry.js`). These modules should be refactored to use the new unified prompt management system described in `docs/manual/prompt-management.md`.

## Core Modules to Refactor

- **`index.js`**: Exports `PromptTemplates`. This should be updated or removed after the refactoring is complete.
- **`src/core.js`**: Exports `PromptTemplates`. This should also be updated or removed.
- **`src/handlers/LLMHandler.js`**: Directly imports and uses the legacy `PromptTemplates`.
- **`src/ragno/CreateConcepts.js`**: A key module that uses the old `LLMHandler` and is marked as deprecated in favor of `CreateConceptsUnified.js`.
- **`mcp/mcp.js`**: Uses the `promptRegistry`.
- **`mcp/index.js`**: Uses the `promptRegistry`.
- **`mcp/http-only-server.js`**: Uses the `promptRegistry`.
- **`mcp/tools/prompt-tools.js`**: Uses the `promptRegistry`.

## Examples to Update

- **`examples/unified-prompt-demo.js`**: This file demonstrates both the legacy and new systems and should be updated to reflect the new best practices.
