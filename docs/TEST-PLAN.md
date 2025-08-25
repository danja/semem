Devise a plan for creating a carefully organised set of unit and integration tests for the project. Because of external dependencies, it has to be possible to run subsets of the whole suite.
There are also at least three sets of tests that need to be managed separately : those for the core code; those for the http API; those for the stdio mcp api; those for the http mcp api; those for the workbench UI
External services include :
* SPARQL store - we do not want mocks for this, any tests should operate against the live store as configured in config.json
* LLM chat completions provider 
* LLM embeddings provider
* Wikipedia
* Wikidata
Other external services may be incorporated later.
Modern ES modules will be used throughout. Vitest will be used for most tests, Playwright for user interface tests. Avoid bringing in any new dependencies.
There are already quite a few tests, these may need reorganising to fit in the new system.
Think hard about how to make this manageable, following best practices.
