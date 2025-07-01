The job is to extract the pieces of functionality found in the `examples/beerqa` and `examples/beerqa-wikidata` scripts into the core of the system to make them more available for reuse. This will be achieved by analysing each of the scripts in terms of the components it uses and the operation flow it carries out. Many of the operations will be in place in the core already.

Each component should be wrapped in a class which exposes a method of the general form `operation(input, resources, options)` where `input` is data on which the method should act (if needed), `resources` are references to any additional material needed by the method for carrying out the operation, eg. pointers to SPARQL query templates, and `options` contains low-level configuration parameters, such as `delay` for a fetch call where rate limiting is needed. 

* `src/services/wikipedia`
* `src/services/wikidata`
* `src/feedback`
* `src/workflows`
* `src/sparql`


