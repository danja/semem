Semem : Semantic Web Memory for Intelligent Agents

https://github.com/danja/semem

This is an experimental Node.js toolkit for AI memory management that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It offers knowledge graph retrieval and augmentation algorithms within a conceptual model based on the Ragno (knowledge graph description) and ZPT (knowledge graph navigation) ontologies. 

The intuition is that while LLMs and associated techniques have massively advanced the field of AI and offer considerable utility, the typical approach is missing the elephant in the room : the Web - the biggest known knowledgebase in our universe. Semantic Web technologies offer data integration at a global scale, with tried & tested conceptual models for knowledge representation. There is a lot of low-hanging fruit.

More a heads-up on what I've been playing with recently than a proper announcement. This is an experimental project with no particular finish line.
But I reckon it's reached a form that won't be changing fundamentally in the near future.

---

Semem [1] is an experimental Node.js toolkit for AI memory management that integrates large language models (LLMs) with Semantic Web technologies (RDF/SPARQL). It offers knowledge graph retrieval and augmentation algorithms within a conceptual model based on the Ragno [2] (knowledge graph description) and ZPT [3] (knowledge graph navigation) ontologies. 

The intuition is that while LLMs and associated techniques have massively advanced the field of AI and offer considerable utility, the typical approach is missing the elephant in the room : the Web - the biggest known knowledgebase in our universe. Semantic Web technologies offer data integration at a global scale, with tried & tested conceptual models for knowledge representation. There is a lot of low-hanging fruit.

More a heads-up on what I've been playing with recently than a proper announcement. This is an experimental project with no particular finish line.
But I reckon it's reached a form that won't be changing fundamentally in the near future.

[1] https://github.com/danja/semem
[2] https://github.com/danja/ragno
[3] https://github.com/danja/zpt

Cheers,Danny.
-- 
----
https://danny.ayers.name


make a todo list : 1. refactor the code to use ES modules; 2. add settings for the choice of models and sparql endpoints (defaults should be as found via Config.js) ; integrate the   │
│   SPARQL browser; write a concise HOWTO for the UI replacing docs/manual/gui.md; run tests corresponding to those in docs/PROBES.md against the UI using playwright mcp  