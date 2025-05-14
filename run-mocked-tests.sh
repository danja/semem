#!/bin/bash
# Script to run only tests that use mocks (no external dependencies)

echo "Running only tests with mocks that don't require external services..."
echo "These tests will pass regardless of whether Fuseki, Ollama, etc. are running."

# Find and run all .vitest.js files in the unit tests directory
find tests/unit -name "*.vitest.js" | xargs npx vitest run "$@"