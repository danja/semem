# Chunker Requirements 

Markdown will be used as the primary format for text processing in Semem.

Leaving the workflow composition aside for now, the requirements are as follows :

* Format conversion : source material may come from PDF files and HTML documents, to prepare these for chunking utility classes should be built to convert these to markdown. Suitable libraries for Node.js are `@opendocsg/pdf2md` and `html2md` respectively
* Chunking algorithms : paragraph-level chunking is likely to be appropriate, wherever possible using markdown header markup as delimiters (the headers will also be used as `dc:title` properties for the chunks). A maximum character length constant will be defined, and when a natural chunk exceeds this a recursive strategy of splitting at the nearest line break or period near the middle of an oversized block should be applied until the sections fall below the limit. 
* There should be an explicit association between the URI used to identify the source document and the derived chunks. The PROV data model expressed in OWL2 is appropriate. Additionally both the markdown-rendered full text of the source and the individual chunks should be instances of `ragno:Corpuscle` and `ragno:TextElement`. The full text will also be considered a `ragno:Community` with the chunks as `ragno:CommunityElement` instances. Hash-based URIs will be minted to identify all instance data.
* Ingestion will the operation of passing the extracted chunks to the configured SPARQL store using UPDATE queries.

The ZPT and Ragno ontologies with READMEs are available under `vocabs`. Other terms from these or any commonly used vocabularies may be included as appropriate.

Modules for these pieces of functionality will appear under `src/services/document` as single-function modules to enable reuse and exposure over the HTTP API as well as MCP. The primary classes will be:

* `PDFConverter`
* `HTMLConverter`
* `Chunker`
* `Ingester`

The methods will be created in a fashion that will support easy composition later. Each module will have corresponding vitest unit tests under `tests`