A Semantic Web Memory for Intelligent Agents
Danny Ayers – Unaffiliated. Email: danny.ayers@gmail.com
Abstract
Here we provide preliminary result, using Semem, an experimental system designed to allow knowledge representation, augmentation and retrieval using neuro-symbolic AI. We look at the intersection of LLM technologies and those of the Semantic Web. An implementation of  facilities echoing those of the state of the art, open research questions are revealed in determining optimal approaches for given problem solving scenarios. 

A practical drawback of current language models is their limited context window on which to operate. When the aim is to solve real-world problems, this becomes an issue. Supplementing the abilities of a system which can only think within narrow constraints seems worthwhile. Clearly the drawback is their lack of a larger world on which to operate. Can we give it more space?

 Many recent efforts into making the LLM make better use of the world outside has involved using 

The ontology-driven methodology used in the development of this testbed is described, with discussion of the issues raised in evaluating algorithms in this context. The core conceptual model (Ragno) used by Semem is largely derived from that of NodeRAG [], and as a demonstrator the workflow described there is recreated here, with a RDF-based knowledge graph. The approach is extended to incorporate additional algorithms and a novel knowledgebase navigation system, ZPT (“Zoom, Pan, Tilt”). While Semem in itself may be considered a case study in approaching the “LLM plus SemWeb” universe, a general meta-strategy which appeared successful in exploiting the advantages of each world evolved in this work and is presented as the primary contribution.  

evolving
transparency
metrics
Dev methodology
Forage for existing algorithms; modulate to RDF/SPARQL; integrate.
Keywords 
paper template, paper formatting, CEUR-WS 1
1. Introduction
1.1. Motivation
This project was prompted by a set of problems which all related to information persistence.

Various issues have been identified common to the current generation of generative AI systems context window size hallucinations.



* Problem solving is about changing the state of a knowledge system to resolve unknowns
* the state is changed using a Process
* key tools are composition, decomposition and pattern matching
### Philosophy
This comes from wondering about cognition, what can computers, AI achieve? What can I achieve? I'll use *problem solving* as a catch-all for intentional state change.

1. Systems can be described in terms of concepts and relationships between those concepts. *The human way.*
2. Problem solving is mostly about pattern matching. Fitting unknown systems to ones where their behaviour is known.
3. All known agents, animal or artificial, at any given moment in time, have a finite amount of working memory. This acts as boundary on what they can process.
4. Concepts can often be decomposed into smaller units.
5. Groups of associated concepts can be abstracted into meta-concepts.  
6. *_Scale-free thinking for the win!_*
1.2. Problem Statement
Graph RAG Context size
1.3. Contribution Summary
2. Related Work
3. Design Precursors 
3.1. Resource Description Framework

In increasing order of significance: ontologies; versatile, open model; the Web.
4. Development Methodology
4.1. Ontology-Driven Design
The use of ontologies as information models is well-documented in the literature [] . 

5. System Architecture 

5.1. Ragno Ontology
The Ragno ontology is designed to describe knowledge graphs through terms which classify common types of components. It is a specialization of the Simple Knowledge Organisation  System (SKOS). The core of Ragno is based around ten classes, including three high-level terms :
    • ragno:Element - base class for all knowledge graph components (subclass of skos:Concept)
    • ragno:Corpus - a body of knowledge represented as a skos:Collection of elements
    • ragno:Corpuscle - a conceptual subset of a knowledge, also a skos:Collection
The other seven classes offer a degree of specialization. They are a close derivation of the constructs used in NodeRAG, table X gives the correspondences. 
NodeRAG Construct
Description
Function
Ragno Term
Text
Full-text chunks from the original source. It contains rich detailed information, although it integrates a large amount of unrelated semantic information.
Retrievable: Entry points from vector similarity
ragno:TextElement
Semantic Unit
Local summaries that are independent and meaningful events summarized from text chunks. They serve as a middle layer between text chunks and entities, acting as the basic units for graph augmentation and semantic analysis.
Retrievable: Entry points from vector similarity
ragno:Unit
Attribute
Attributes of key entities, derived from relationships and semantic units around important entities.
Retrievable: Entry points from vector similarity
ragno:Attribute
High-Level Element
Insights summarizing graph communities. Encapsulates core information or any high level ideas from a community.
Retrievable: Entry points from vector similarity
ragno:CommunityElement
High Level Overview
Titles or keywords summarizing high level elements.
Non-Retrievable: Entry points from accurate search.
ragno:Attribute
Relationship
Connections between entities represented as nodes. Acts as connector nodes and secondary retrievable nodes.
Retrievable: Non-Entry points
ragno:Relationship
Entity
Named entities such as people, places, or concepts.
Non-Retrievable: Entry points from accurate search.
ragno:Entity

Aside from minor naming differences, certain conceptual changes have been made to better fit the Semantic Web. A notable difference is that the Entity construct was not considered retrievable in NodeRAG. In the context of Linked Data, ideally all resources should be retrievable. 

Relationship as class
5.2. ZPT Ontology
Tilt - axes
5.3. Interfaces


6. Experiments and Evaluation 
Baselines : RAG, GraphRAG
6.1. Algorithms
All data is persisted in a SPARQL store so virtually every algorithm will involve SELECT and/or UPDATE operations at some point. The algorithms fall into three general categories :
    1. Initialization
    2. Augmentation
    3. Direct Retrieval
    4. Augmented Retrieval
    5. ZPT Retrieval

The algorithms supported are here briefly described below in an order that loosely corresponds to a practical workflow. 

Initialization algorithms are involved in setting up a knowledgebase to work on. In a sense these are out-of-band in terms of knowledge engineering, the work is in mechanical preparation of data at a format and syntax level. It should be noted that in this experimental environment, scripts to clear the graphs in use are invaluable for evaluation of operations from scratch, to avoid contamination with artifacts generated in previous experiments.

Most of the augmentation algorithms are derived from those described in the NodeRAG paper []. That takes a layered approach where foundational elements are created from a decomposition of the raw input data, then a sequence of operations is carried out to bring the information into a graph structure of increasing sophistication. Restructured as the Heterograph, as the authors term it, the graph is enriched by detecting latent conceptual features in the data. This approach is mirrored here, projected to the RDF model. As well as the flexibility inherent in the RDF model, various facilities become available at low cost thanks to the SPARQL language. At a low level, complex data searching and filtering can be applied, with regular expression support being very useful in an environment where the lingua franca is plain text. At a higher level, queries can be viewed as a form of logical inference tool whereby the results are the implications of constraint declarations. This again offers an advantage in practice, in that many operations may be defined declaratively and not hardwired into procedural code. This separation of concerns simplifies development and analysis. 

Where augmentation is about maximizing the potential usability of the ingested data, retrieval focuses on actual discovery ... 


6.1.1. Extract, Transform, Load (ETL) 
Most of the information used throughout the system is in the form of text. The Markdown [] format was chosen as a representation which combines the simplicity of plain text while retaining typical structural characteristics of sources. Existing documents that may be of interest are commonly found in PDF (eg. academic papers) and HTML (Web pages) formats so conversion tools were created to extract content from these sources and transform them to Markdown. The Load step is implemented using SPARQL UPDATE statements, with the markdown content appearing as RDF Literals in statements.  Along with the content various pieces of document metadata are stored. For example, here a PDF source document has has the ETL process applied : 

# Document Reference (ragno:Unit)
<http://purl.org/stuff/instance/unit-abcd1234> a ragno:Unit ;
rdfs:label "Research Paper Title" ;
dcterms:created "2025-07-07T13:30:00Z" ;
semem:sourceFile "data/pdfs/research-paper.pdf" ;
ragno:hasTextElement <http://purl.org/stuff/instance/text-abcd1234> .

# Markdown Content (ragno:TextElement)
<http://purl.org/stuff/instance/text-abcd1234> a ragno:TextElement ;
rdfs:label "Research Paper Title markdown" ;
dcterms:created "2025-07-07T13:30:00Z" ;
ragno:content "# Research Paper Content..." ;
dcterms:extent 12470 ;
prov:wasDerivedFrom <http://purl.org/stuff/instance/unit-abcd1234> .

6.1.2. Chunking

Documents ingested as Markdown text are split into smaller chunks 
OLO

6.1.3. Embeddings Generation
---augmentation
6.1.4. Concept Extraction
6.1.5. Graph Decomposition

6.1.6. SOM Generation
---
6.1.7. Graph Analytics

K-Core, Betweenness

6.1.8. Community Detection

6.1.9. HNSW Layering
--- retrierval
6.1.10. Concept Matching
6.1.11. Similarity Search
6.1.12. PageRank
6.1.13. Wikipedia Augmentation
6.1.14. Wikidata Augmentation
6.1.15. Context Construction

7. Discussion 
7.1. A Strategy for Synergy
Fragile logical representation, robust neural reasoning

8. Conclusion 
9. Declaration on Generative AI
10. References
11. Appendices
12. Acknowledgements



12.1. Authors and affiliations
Each author must be defined separately for accurate metadata identification. Multiple authors may share one affiliation. Authors’ names should not be abbreviated; use full first names wherever possible. Include authors’ e-mail addresses whenever possible.
Author names can have some kinds of marks and notes: 
    • affiliation mark: a superscript number following the author’s last name.
The author names and affiliations could be formatted in two ways:
    • Group the authors per affiliation.
    • Use an explicit mark to indicate the affiliations.
12.2. Keywords
Keywords should be separated by commas.
12.3. Various marks in the front matter
The front matter becomes complicated due to various kinds of notes and marks to the title and author names. footnotes are denoted by super scripted Arabic numerals, corresponding author by a Conformal asterisk (*) mark.
12.3.1. Title marks
Marks in the title should be denoted by a star (⋆) mark.
12.3.2. Author marks
Author names can have some kinds of marks and notes:
    • corresponding author mark: a superscript asterisk (∗) after the affiliation mark(s)
    • equal contribution mark: a superscript dagger (†) after the corresponding author mark or the affiliation mark.
12.3.3. Other marks
At times, authors want footnotes which leave no marks in the author names. The note text shall be listed as part of the front matter notes.
13. Sections
You should use the pre-defined styles for sections (Heading 1), subsections (Heading 2), and subsubsections (Heading 3). 
There should be no empty lines before section headings. The template already adds the necessary spacing before them.
14. Paragraphs
Paragraphs should be indented except for the first paragraph after a section, subsection, or subsubsection, which should not. 
The default style for paragraphs is called Normal. First paragraphs should be styled with Normal (non-indented). 
15. Lists
Here is an example of a numbered list:
    6. Item 1
    7. Item 2
    8. Item 3
Here is an example of a bulleted list:
    • Item 1
    • Item 2
    • Item 3
16. Tables
In this section, you can find an example of table styling. Note that captions are placed above tables. It is recommended to add cross references to tables, i.e., please, check Table 1. 
The style of texts within tables should be Normal.
Table 1
Frequency of Special Characters
Non-English or Math
Frequency
Comments
Ø
1 in 1,000
For Swedish names
𝜋
1 in 5
Common in math
$
4 in 5
Used in business
Ψ
1 in 40,000
Unexplained usage
17. Figures
Your figures should contain a caption which describes the figure to the reader. Your figures should also include a description suitable for screen readers, to assist the visually challenged to better understand your work.
Figures should be centered, and their captions should be placed below them.

Figure 1: 1907 Franklin Model D roadster. Photograph by Harris & Ewing, Inc. [Public domain], via Wikimedia Commons. (https://goo.gl/VLCRBB).
18. Equations
An Example of equation

(1)
where ...
An example of the Figure 1, which also uses cross-reference. The style should be switched to Normal.
19. Citations and bibliographies
The references should be formatted according to the following guidelines: 
    • A paginated journal article [2].
    • An enumerated journal article [3].
    • A reference to an entire issue [4].
    • A monograph (whole book) [5].
    • A monograph/whole book in a series (see 2a in spec. document) [6].
    • A divisible-book such as an anthology or compilation [7] followed by the same example, however we only output the series if the volume number is given [8] (so series should not be present since it has no vol. no.).
    • A chapter in a divisible book [9].
    • A chapter in a divisible book in a series [10].
    • A multi-volume work as book [11].
    • An article in a proceedings (of a conference, symposium, workshop for example) (paginated proceedings article) [12].
    • A proceedings article with all possible elements [13].
    • An example of an enumerated proceedings article [14].
    • An informally published work [15].
    • A doctoral dissertation [16].
    • A master’s thesis: [17].
    • An online document / world wide web resource [18, 19].
    • A video game (Case 1) [20] and (Case 2) [21] and [22] and (Case 3). 
    • A patent [23].
    • Work accepted for publication [24]
    • Prolific author [25] and [26]. 
    • Other cites might contain ‘duplicate’ DOI and URLs (some SIAM articles) [27]. 
    • Multi-volume works as books [28] and [29]. 
    • A couple of citations with DOIs: [30, 27]. 
    • Online citations: [31, 18, 32, 33]. 
20. Appendices
Appendices should be added after the references. Note that in the appendix, sections are lettered, not numbered.
Acknowledgements
Identification of funding sources and other support, and thanks to individuals and groups that assisted in the research and the preparation of the work should be included in an acknowledgment section. This section which is placed just before the reference section in your document and should not be numbered.
This Word template was created by Tiago Prince Sales (University of Twente, NL) in collaboration with Manfred Jeusfeld (University of Skövde, SE). It is derived from the template designed by Aleksandr Ometov (Tampere University of Applied Sciences, FI). The template is made available under a Creative Commons License Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
Declaration on Generative AI
Either:
The author(s) have not employed any Generative AI tools.

Or (by using the activity taxonomy in ceur-ws.org/genai-tax.html):
During the preparation of this work, the author(s) used X-GPT-4 and Gramby in order to: Grammar and spelling check. Further, the author(s) used X-AI-IMG for figures 3 and 4 in order to: Generate images. After using these tool(s)/service(s), the author(s) reviewed and edited the content as needed and take(s) full responsibility for the publication’s content. 
https://web.archive.org/web/20200930125419/http://smiy.sourceforge.net/olo/spec/orderedlistontology.html
Spinach https://arxiv.org/abs/2407.11417
Skos https://www.w3.org/2004/02/skos/
References
    [1] Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Kuttler, H., Lewis, M., Yih, ¨ W.-t., Rocktaschel, T., et al. (2020). Retrieval-augmented generation for knowledge-intensive nlp ¨ tasks. Advances in Neural Information Processing Systems, 33:9459–9474.
    [2] Edge et al, From Local to Global: A Graph RAG Approach to Query-Focused Summarization,  arXiv:2404.16130 
    [3] 
    [4] 

    A. Online Resources
The ceur-art template for LibreOffice can be downloaded at https://ceur-ws.org/Vol-XXX/. We no longer support a template for Word.