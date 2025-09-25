# Tell/Ask Workflow Status

## Overview
The Tell/Ask workflow is tested using the `tell-ask-stdio-e2e.integration.test.js` file. This workflow involves storing facts and querying them using the MCP server's STDIO interface.

## Workflow Steps
1. **Initialization**:
   - The MCP server is initialized with a protocol version and client information.
   - Method: `initialize`
   - Key Parameters:
     - `protocolVersion`: Specifies the version of the protocol being used.
     - `capabilities`: Describes the capabilities of the client.
     - `clientInfo`: Metadata about the client (e.g., name, version).

2. **Tell Operation**:
   - A fact is stored in the MCP system.
   - Method: `tools/call` with operation `tell`
   - Key Parameters:
     - `name`: Set to `tell`.
     - `arguments`: Contains the `content` (fact) to be stored.
   - Expected Behavior:
     - The fact is processed and stored in the knowledge graph or memory.
     - A response is returned confirming the operation.

3. **Ask Operation**:
   - A question is queried against the stored fact.
   - Method: `tools/call` with operation `ask`
   - Key Parameters:
     - `name`: Set to `ask`.
     - `arguments`: Contains the `question` to be queried.
   - Expected Behavior:
     - The system retrieves relevant information based on the stored fact.
     - A response is returned containing the answer.

4. **Validation**:
   - Responses for `initialize`, `tell`, and `ask` are validated.
   - Ensures STDIO output is clean JSON without pollution.
   - Key Checks:
     - `initialize` response includes `protocolVersion`.
     - `tell` response confirms the fact was stored.
     - `ask` response contains the expected answer.

## Key Files and Components
- **`mcp/index.js`**:
  - Entry point for the MCP server, handling the STDIO interface.
  - Processes `initialize`, `tell`, and `ask` methods.
  - Potential Issues:
    - Incorrect routing of `tell` or `ask` methods.
    - Missing or invalid responses.

- **`tools/call`**:
  - Method used to invoke the `tell` and `ask` operations.
  - Potential Issues:
    - Incorrect parameter handling.
    - Failure to invoke the correct service.

- **`ServiceManager`**:
  - Manages services for the Tell/Ask operations.
  - Potential Issues:
    - Misconfigured services.
    - Errors in service initialization or execution.

- **`config.js`**:
  - Provides configuration for the MCP server, including protocol version and other settings.
  - Potential Issues:
    - Missing or incorrect configuration values.

- **Tell and Ask Handlers**:
  - Specific handlers for processing the `tell` and `ask` operations.
  - Potential Issues:
    - Logic errors in processing the operations.
    - Failure to interact with the knowledge graph or memory.

## Data Created
- **Facts**:
  - Stored in the MCP system during the `tell` operation.
  - Potential Issues:
    - Facts not being stored persistently.
    - Data inconsistencies between memory and SPARQL storage.

- **Responses**:
  - Generated for each operation (`initialize`, `tell`, `ask`) and returned as JSON.
  - Potential Issues:
    - Missing or malformed responses.
    - Responses not adhering to the JSON-RPC protocol.

## Architecture
- **STDIO Interface**:
  - The MCP server communicates via STDIO, processing JSON-RPC messages.
  - Potential Issues:
    - STDIO pollution (non-JSON data in stdout).
    - Timeout or deadlock during communication.

- **Handlers**:
  - Each operation (`tell`, `ask`) is handled by specific components.
  - Potential Issues:
    - Handlers not being invoked correctly.
    - Errors in handler logic.

- **Validation**:
  - Ensures clean protocol communication and correct data handling.
  - Potential Issues:
    - Validation logic not covering edge cases.
    - Insufficient logging for debugging.

## Debugging Checklist
1. **STDIO Output**:
   - Check for non-JSON data in stdout.
   - Ensure stderr logging is minimal and relevant.

2. **ServiceManager**:
   - Verify that all required services are initialized correctly.
   - Check for errors in service execution.

3. **Tell/Ask Handlers**:
   - Ensure the `tell` handler stores facts persistently.
   - Verify that the `ask` handler retrieves the correct data.

4. **Configuration**:
   - Confirm that `config.js` contains valid values for all required settings.
   - Check for environment-specific overrides (e.g., `.env` file).

5. **Integration Tests**:
   - Run the `tell-ask-stdio-e2e.integration.test.js` file with verbose logging.
   - Analyze the test output for errors or unexpected behavior.

## Notes
- The `tell-ask-stdio-e2e.integration.test.js` file ensures that the workflow is functional and adheres to the protocol.
- Future improvements may include additional validation and support for more complex queries.
- Use this document as a reference for tracing and debugging issues in the Tell/Ask workflow.