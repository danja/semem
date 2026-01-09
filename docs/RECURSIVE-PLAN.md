Read data/pdfs/2512.24601v1.pdf

imagine how this might be applied to the ZPT part of Semem. 

I propose the following:

* a new class in /home/danny/hyperdata/zpt/zpt.ttl zpt:Context which will be a subclass of skos:Concept and zpt:Corpuscle with a property zpt:Content which will be a text representation of an LLM context message

* new operations in the MCP API for `compose` and `decompose`. Given a piece of text such as context content `decompose` will call an llm with a request to separate concepts from the content. The existing extractConcept operation may be needed. `compose` will take input from the memory and any context and formulate it into a reasonable-length combination

This may not be the best approach to apply the ideas from the paper, what do you suggest?

Use this document to record plans and progress.

Plan
- Add zpt:Context and zpt:Content to the ZPT ontology.
- Implement MCP compose/decompose verbs with prompt templates and Ragno decomposition.
- Wire HTTP/STDIO tool registration and docs for the new verbs.

Progress
- Read the RLM paper and drafted the approach in a worklog entry.
- Implemented compose/decompose verbs, schemas, and prompt template in Semem.
