Create the scripts below based on the relevant parts of the modules in `src/services/document` 

### examples/document/LoadPDFs.js

This should load PDF files from a directory, convert them to markdown, store these and load them into a SPARQL store. 

It should support the following options:

* `--docs` - source pattern for documents, default `../../data/pdfs/*.pdf`
* `--cache` - cache dir for markdown documents, `../../data/cache`
* `--limit` - limit number of documents to process, default = 0, no limit 
* `--graph` - target graph in which to place the data, default from config, see `docs/manual/config.md` 

Copies of the markdown rendering will be saved in the cache dir and the content also pushed to the configured SPARQL store as shown below, using the utilities in `src/services/sparql`.

A utility will be created to generate URIs, `src/utils/URIMinter.js`. This will contain a single static method, `mintURI(URIBase='http://purl.org/stuff/instance/', slug=`semem`,content=null)`. If a value for `content` is provided, it will be used to generate a hash-based URI using content. Otherwise, a random URI will be generated.


#### Document Reference

```turtle
<http://purl.org/stuff/instance/unit-abcd1234> a ragno:Unit ;
    rdfs:label "eLife Research Paper" ;
    dcterms:created "2025-07-02T19:30:00Z" ;
    semem:sourceFile "../../data/pdfs/elife-52614-v1.pdf" ;
    ragno:hasTextElement <http://purl.org/stuff/instance/text-abcd1234> .
```

### Markdown Content
```turtle
<http://purl.org/stuff/instance/text-abcd1234> a ragno:TextElement ;
    rdfs:label "eLife Research Paper markdown" ;
    dcterms:created "2025-07-02T19:30:00Z" ;
    ragno:hasContent "Research in computational biology..." ;
    ragno:size 12470 ;
    prov:wasDerivedFrom <http://purl.org/stuff/instance/unit-abcd1234> .
```

Can you modify `examples/document/LoadPDFs.js` slightly to to a check before loading each document to make sure it's not already been loaded. Use the SPARQL tools under `src/services/sparql` together with a template created in `sparql/templates`.