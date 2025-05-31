| Abbr. | NodeRAG | Description | Function | Ragno |
|-------|-----------|-------------|----------|---------|
| T | Text | Full-text chunks from the original source. It contains rich detailed information, although it integrates a large amount of unrelated semantic information. | Retrievable: Entry points from vector similarity | ragno:TextElement |
| S | Semantic Unit | Local summaries that are independent and meaningful events summarized from text chunks. They serve as a middle layer between text chunks and entities, acting as the basic units for graph augmentation and semantic analysis. | Retrievable: Entry points from vector similarity | ragno:Unit |
| A | Attribute | Attributes of key entities, derived from relationships and semantic units around important entities. | Retrievable: Entry points from vector similarity | ragno:Attribute |
| H | High-Level Element | Insights summarizing graph communities. Encapsulates core information or any high level ideas from a community. | Retrievable: Entry points from vector similarity | ragno:CommunityElement |
| O | High Level Overview | Titles or keywords summarizing high level elements. | Non-Retrievable: Entry points from accurate search. | ragno:Attribute |
| R | Relationship | Connections between entities represented as nodes. Acts as connector nodes and secondary retrievable nodes. | Retrievable: Non-Entry points | ragno:Relationship |
| N | Entity | Named entities such as people, places, or concepts. | Non-Retrievable: Entry points from accurate search. | ragno:Entity |