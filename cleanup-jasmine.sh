#!/bin/bash
# Script to remove Jasmine files after migration to Vitest

# Remove Jasmine spec files
rm -f tests/unit/Config.spec.js
rm -f tests/unit/ContextWindowManager.spec.js
rm -f tests/unit/MemoryManager.spec.js
rm -f tests/unit/api/APILogger.spec.js
rm -f tests/unit/api/BaseAPI.spec.js
rm -f tests/unit/handlers/CLIHandler.spec.js
rm -f tests/unit/handlers/REPLHandler.spec.js
rm -f tests/unit/http/message-queue.spec.js
rm -f tests/unit/http/WebSocketServer.spec.js
rm -f tests/unit/sparql/SPARQLEndpoint.spec.js

# Remove Jasmine helper files
rm -f tests/helpers/BaseTest.js
rm -f tests/helpers/TestHelper.js
rm -f tests/helpers/setupSPARQL.js
rm -rf tests/helpers/jasmine_examples
rm -f tests/helpers/reporter.js
rm -f tests/helpers/setup.js
rm -f tests/helpers/setupGlobals.js
rm -f tests/helpers/init.js

# Remove Jasmine configuration files
rm -f jasmine.json
rm -f tests/support/jasmine.json

echo "Jasmine files removed. Remember to uninstall Jasmine packages with:"
echo "npm uninstall jasmine jasmine-spec-reporter --save-dev"