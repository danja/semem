 PREFIX schema: <http://schema.org/> 
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> 
        PREFIX : <http://purl.org/stuff/transmissions/> 
         
        # must be a neater way 
        INSERT DATA {  
                 GRAPH <http://danny.ayers.name/content> { 
            <http://danny.ayers.name/tests/applications/example.org/content/raw/a> schema:datePublished "dummy date" }  
        } 
         
        DELETE {  
                 GRAPH <http://danny.ayers.name/content> { 
            <http://danny.ayers.name/tests/applications/example.org/content/raw/a> schema:datePublished ?published  
            } 
            } 
         
        INSERT {  
                 GRAPH <http://danny.ayers.name/content> { 
            <http://danny.ayers.name/tests/applications/example.org/content/raw/a> schema:datePublished "2025-05-15T11:00:26.065Z"  
            } 
        } 
        WHERE  {  
                 GRAPH <http://danny.ayers.name/content> { 
                    <http://danny.ayers.name/tests/applications/example.org/content/raw/a> schema:datePublished ?published  
                    } 
        },