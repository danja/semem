export class SPARQLHelpers {
    static createAuthHeader(user, password) {
        const credentials = Buffer.from(`${user}:${password}`).toString('base64')
        return `Basic ${credentials}`
    }

    static async executeSPARQLUpdate(endpoint, query, auth) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
                'Authorization': auth
            },
            body: query
        })

        if (!response.ok) {
            throw new Error(`SPARQL update failed: ${response.status}`)
        }

        return response
    }

    static async executeSPARQLQuery(endpoint, query, auth) {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/sparql-results+json',
                'Authorization': auth
            },
            body: query
        })

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status}`)
        }

        return response.json()
    }

    static getDatasetEndpoint(baseUrl, dataset, operation) {
        return `${baseUrl}/${dataset}/${operation}`
    }
}