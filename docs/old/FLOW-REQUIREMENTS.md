This is a refactoring task.
The job will be to extract the pieces of functionality found in the `examples/beerqa` and `examples/beerqa-wikidata` scripts into the core of the system to make them more available for reuse. This will be achieved by analysing each of the scripts in terms of the components it uses and the operation flow it carries out. Many of the operations will be in place in the core already.

Each component should be wrapped in a class which exposes a method of the general form `operation(input, resources, options)` where `input` is data on which the method should act (if needed), `resources` are references to any additional material needed by the method for carrying out the operation, eg. pointers to SPARQL query templates, and `options` contains low-level configuration parameters, such as numeric relevance limits. The methods should return their output as objects as appropriate, with any params that might be useful later.
The classes will also draw on global configuration options from `.env` and `config/config.json` as is currently the case, with additions as necessary for eg. timeouts for services where a fetch is required.

Locations for some of the material will be as follows :

* `src/aux/wikipedia` - some of the code that is currently in `examples/wikipedia` that is likely to be reused should go in here 
* `src/aux/wikidata` - reusable parts of `examples/beerqa-wikidata/Wikidata*` should go here
* `src/compose/feedback` - components of `examples/beerqa-wikidata` that deal with feedback and question generation should go here 
* `src/compose/workflows` - sequences of operations, such as the 
* `src/compose/sparql` - SPARQL queries and templates (which at run time should be cached) should go in here
* `src/utils` - any utility classes and methods, eg. `ClearGraph.js`
* `src/types` - typescript type definitions for classes and methods

Each of the scripts referred to in `docs/manual/beerqa-feedback.md` should be addressed in turn. A shorter adaptation of each script should be put in places as a vitest integration test under `tests/integration`. 

The goal of the refactoring is to make components suitable for reuse, with intuitive method definitions. This will be demonstrated by creating a set of scripts under `examples/flow` that will carry out exactly the same functions as those of the workflow described in `docs/manual/beerqa-feedback.md` but radically simplified, with the actual operations carried out within the main body of the codebase under `src`.
You should create a document docs/FLOW-PLAN.md containing a plan for for the above may be achieved. This file should also be used to record progress in implementation. A note should be made of any temporary files created during development to help with cleanup later.
