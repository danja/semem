// src/utils/FusekiDiscovery.js
export class FusekiDiscovery {
    constructor(baseUrl, credentials) {
        this.baseUrl = baseUrl;
        this.auth = Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64');
    }

    async discoverEndpoints(dataset) {
        const endpoints = {
            base: `${this.baseUrl}/${dataset}`,
            query: null,
            update: null,
            gsp: null,
            upload: null
        };

        try {
            // Test SPARQL endpoints
            const sparqlTest = await this.testSparqlEndpoint(`${endpoints.base}`);
            if (sparqlTest) {
                endpoints.query = endpoints.base;
                endpoints.update = endpoints.base;
            }

            // Test GSP endpoints
            const gspTest = await this.testGSPEndpoint(`${endpoints.base}/data`);
            if (gspTest) {
                endpoints.gsp = `${endpoints.base}/data`;
            }

            // Test upload endpoint
            const uploadTest = await this.testUploadEndpoint(`${endpoints.base}/upload`);
            if (uploadTest) {
                endpoints.upload = `${endpoints.base}/upload`;
            }

            return {
                success: true,
                endpoints: this.cleanEndpoints(endpoints)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                endpoints: null
            };
        }
    }

    async testSparqlEndpoint(url) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: 'ASK { ?s ?p ?o }'
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async testGSPEndpoint(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Accept': 'text/turtle'
                }
            });
            return response.ok || response.status === 404; // 404 is ok, might mean empty graph
        } catch {
            return false;
        }
    }

    async testUploadEndpoint(url) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Content-Type': 'text/turtle'
                },
                body: '@prefix test: <http://test.org/> .'
            });
            return response.ok || response.status === 400; // 400 is ok, might mean invalid turtle
        } catch {
            return false;
        }
    }

    cleanEndpoints(endpoints) {
        return Object.fromEntries(
            Object.entries(endpoints).filter(([_, value]) => value !== null)
        );
    }
}

// Usage example:
/*
const discovery = new FusekiDiscovery('http://localhost:4030', {
    user: 'admin',
    password: 'admin123'
});

const endpoints = await discovery.discoverEndpoints('test-mem');
console.log(endpoints);
*/
