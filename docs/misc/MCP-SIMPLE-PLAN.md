Begin by reviewing the README.md files to understand the following.

The MCP provision has got overcomplicated. To simplify we will start by adding the following implemented as tools and resources as appropriate. Once in place and tested we will trim back the current tooling. 
The basic operations will involve 5 verbs and state.
The state will correspond to the current knowledgebase context in terms of zoom, pan, and tilt.
The verbs will allow a caller to :
* tell - add resources to the system with minimal subsequent processing
* ask - query the system
* augment - run operations such as concept extraction to parts of the knowledgebase that are relevant to the current context
* zoom - provide the level of abstraction at which to work
* pan - the subject domain of interest
* tilt - the filter through which to view the knowledgebase

Examples of latest code for using the SDK are described in examples/document/README.md
There is description of parts of the current MCP setup in examples/mcp/README.md
Existing patterns should be followed, reinvention kept to a minimum.

The new MCP tools and resources should be available through both STDIO and HTTP.

