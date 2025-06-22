PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX : <http://purl.org/stuff/transmissions/>

# must be a neater way
INSERT DATA { 
    GRAPH <{{graph}}> {
            <{{uri}}> schema:datePublished "dummy date" 
    } 
}

DELETE { 
    GRAPH <{{graph}}> {
        <{{uri}}> schema:datePublished ?published 
    }
}

INSERT { 
        GRAPH <{{graph}}> {
            <{{uri}}> schema:datePublished "{{published}}" 
        }
}
WHERE  { 
        GRAPH <{{graph}}> {
            <{{uri}}> schema:datePublished ?published 
        }
}
