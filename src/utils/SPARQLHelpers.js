// src/utils/SPARQLHelpers.js
import { Buffer } from 'buffer';

export class SPARQLHelpers {
    static createAuthHeader(username, password) {
        return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }

    static async executeSPARQLQuery(endpoint, query, auth, accept = 'application/json') {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': auth,
                    'Content-Type': 'application/sparql-query',
                    'Accept': accept
                },
                body: query
            });

            if (!response.ok) {
                const errorText = await response.text();
                const errorMessage = this.parseFusekiError(response.status, errorText);
                throw new Error(errorMessage);
            }

            return response;
        } catch (error) {
            if (error.name === 'TypeError') {
                throw new Error(`Connection failed to endpoint: ${endpoint}`);
            }
            throw error;
        }
    }

    static async executeSPARQLUpdate(endpoint, update, auth) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': auth,
                'Content-Type': 'application/sparql-update'
            },
            body: update
        });

        if (!response.ok) {
            throw new Error(`SPARQL update failed: ${response.status}`);
        }

        return response;
    }

    static async uploadTurtle(baseUrl, turtle, auth, graphUri) {
        // Ensure we have the dataset name in the URL
        const uploadUrl = baseUrl.endsWith('/') ? `${baseUrl}data` : `${baseUrl}/data`;
        const url = graphUri ? `${uploadUrl}?graph=${encodeURIComponent(graphUri)}` : uploadUrl;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': auth,
                    'Content-Type': 'text/turtle',
                    'Accept': 'application/json'
                },
                body: turtle
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Turtle upload failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            return {
                success: true,
                counts: {
                    triples: result.tripleCount || 0,
                    quads: result.quadCount || 0,
                    total: result.count || 0
                }
            };
        } catch (error) {
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    static parseFusekiError(status, errorText) {
        switch (status) {
            case 400:
                return `Invalid SPARQL syntax: ${errorText}`;
            case 401:
                return 'Authentication required';
            case 403:
                return 'Access forbidden - check credentials';
            case 404:
                return 'Dataset or endpoint not found';
            case 405:
                return 'Method not allowed - check endpoint URL';
            case 500:
                return `Fuseki server error: ${errorText}`;
            case 503:
                return 'Fuseki server unavailable';
            default:
                return `SPARQL operation failed (${status}): ${errorText}`;
        }
    }
}