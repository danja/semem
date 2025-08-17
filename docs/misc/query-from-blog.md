

endpoint : https://fuseki.hyperdata.it/danny.ayers.name/query

graph : http://danny.ayers.name

query:
```
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX : <http://purl.org/stuff/transmissions/>

SELECT DISTINCT * WHERE {
     GRAPH ?g {
  ?uri a schema:Article ;
    schema:headline ?title ;
    schema:dateModified ?modified ;
    :slug ?slug ;
       schema:articleBody ?content ;
        :relative ?relative ;
    schema:dateCreated ?created .
}
```


