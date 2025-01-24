import { SPARQLHelpers } from '../../src/utils/SPARQLHelpers.js'

export async function setupSPARQLTestEnvironment(config) {
    const endpoints = await config.get('sparqlEndpoints')
    if (!endpoints?.length) throw new Error('No SPARQL endpoints configured')

    const sparqlConfig = endpoints[0]
    const { user, password, urlBase, dataset } = sparqlConfig

    if (!user || !password || !urlBase || !dataset) {
        throw new Error('Invalid SPARQL endpoint configuration')
    }

    const auth = SPARQLHelpers.createAuthHeader(user, password)
    return { baseUrl: urlBase, dataset, auth }
}

export async function initTestGraphs(config) {
    const { baseUrl, dataset, auth } = await setupSPARQLTestEnvironment(config)

    const testGraphs = [
        'test-mem',
        'test-backup-basic',
        'test-backup-advanced',
        'test-memory'
    ]

    for (const graph of testGraphs) {
        const endpoint = `${baseUrl}/${dataset}/update`
        const graphUri = `http://example.org/mcp/${graph}`

        try {
            const query = `
                DROP SILENT GRAPH <${graphUri}>;
                CREATE GRAPH <${graphUri}>
            `

            console.log(`Creating graph ${graphUri} at ${endpoint}`)
            await SPARQLHelpers.executeSPARQLUpdate(endpoint, query, auth)
        } catch (error) {
            console.error(`Failed to create graph ${graph}:`, error)
            throw error
        }
    }
}