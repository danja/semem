import logger from 'loglevel'

/**
 * SPARQLExecute module handles low-level SPARQL endpoint interactions
 * Responsible for query execution, updates, and transaction management
 */
export class SPARQLExecute {
    constructor(endpoint, credentials, graphName) {
        // Robust endpoint handling: allow string or object
        if (typeof endpoint === 'string') {
            this.endpoint = {
                query: endpoint,
                update: endpoint
            }
        } else if (endpoint && typeof endpoint === 'object') {
            this.endpoint = {
                query: endpoint.query || endpoint.update,
                update: endpoint.update || endpoint.query
            }
        } else {
            throw new Error('SPARQLExecute: endpoint must be a string or object with query/update URLs')
        }

        // Validate endpoints
        if (!this.endpoint.query || !this.endpoint.update) {
            throw new Error(`SPARQLExecute: Both query and update endpoints must be defined. Got: ${JSON.stringify(this.endpoint)}`)
        }

        this.credentials = {
            user: credentials?.user || 'admin',
            password: credentials?.password || 'admin'
        }

        this.graphName = graphName || 'http://tensegrity.it/semem/content'
        this.inTransaction = false
        this.transactionId = null
    }

    /**
     * Execute a SPARQL query against the endpoint
     * @param {string} query - SPARQL query string
     * @param {string} endpoint - Query endpoint URL
     * @returns {Object} Query results as JSON
     */
    async executeSparqlQuery(query, endpoint = null) {
        const targetEndpoint = endpoint || this.endpoint.query
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')

        try {
            logger.debug('[SPARQL QUERY]', targetEndpoint)

            // Ensure fetch is available
            if (typeof fetch === 'undefined') {
                throw new Error('fetch is not available in this environment')
            }

            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: query,
                credentials: 'include'
            })

            if (!response) {
                throw new Error('fetch returned null/undefined response')
            }

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL QUERY FAIL]', { endpoint: targetEndpoint, query, status: response.status, errorText })
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
            }

            const json = await response.json()
            logger.debug('[SPARQL QUERY SUCCESS]', targetEndpoint)
            return json
        } catch (error) {
            logger.error('SPARQL query error:', { endpoint: targetEndpoint, query, error: error.message })
            throw error
        }
    }

    /**
     * Execute a SPARQL update against the endpoint
     * @param {string} update - SPARQL update string
     * @param {string} endpoint - Update endpoint URL
     * @returns {Response} Fetch response
     */
    async executeSparqlUpdate(update, endpoint = null) {
        const targetEndpoint = endpoint || this.endpoint.update
        const auth = Buffer.from(`${this.credentials.user}:${this.credentials.password}`).toString('base64')

        try {
            logger.debug('[SPARQL UPDATE]', targetEndpoint)

            // Ensure fetch is available
            if (typeof fetch === 'undefined') {
                throw new Error('fetch is not available in this environment')
            }

            const response = await fetch(targetEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/sparql-update',
                    'Accept': 'application/json'
                },
                body: update,
                credentials: 'include'
            })

            if (!response) {
                throw new Error('fetch returned null/undefined response')
            }

            if (!response.ok) {
                const errorText = await response.text()
                logger.error('[SPARQL UPDATE FAIL]', { endpoint: targetEndpoint, update, status: response.status, errorText })
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
            }

            logger.debug('[SPARQL UPDATE SUCCESS]', targetEndpoint)
            return response
        } catch (error) {
            logger.error('SPARQL update error:', { endpoint: targetEndpoint, update, error: error.message })
            throw error
        }
    }

    /**
     * Begin a transaction by creating a backup of the current graph
     */
    async beginTransaction() {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress')
        }

        this.transactionId = this.generateTransactionId()
        this.inTransaction = true

        const backupQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            COPY GRAPH <${this.graphName}> TO GRAPH <${this.graphName}.backup>
        `
        await this.executeSparqlUpdate(backupQuery)
    }

    /**
     * Commit a transaction by dropping the backup graph
     */
    async commitTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress')
        }

        try {
            const dropBackup = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                DROP SILENT GRAPH <${this.graphName}.backup>
            `
            await this.executeSparqlUpdate(dropBackup)
        } finally {
            this.inTransaction = false
            this.transactionId = null
        }
    }

    /**
     * Rollback a transaction by restoring from the backup graph
     */
    async rollbackTransaction() {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress')
        }

        try {
            const restoreQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                DROP SILENT GRAPH <${this.graphName}> ;
                MOVE GRAPH <${this.graphName}.backup> TO GRAPH <${this.graphName}>
            `
            await this.executeSparqlUpdate(restoreQuery)
        } finally {
            this.inTransaction = false
            this.transactionId = null
        }
    }

    /**
     * Check if currently in a transaction
     * @returns {boolean}
     */
    isInTransaction() {
        return this.inTransaction
    }

    /**
     * Get the current graph name
     * @returns {string}
     */
    getGraphName() {
        return this.graphName
    }

    /**
     * Get the endpoint configuration
     * @returns {Object}
     */
    getEndpoint() {
        return { ...this.endpoint }
    }

    /**
     * Verify SPARQL endpoint connectivity
     */
    async verify() {
        const testQuery = `ASK WHERE { ?s ?p ?o }`;
        await this.executeSparqlQuery(testQuery);
    }

    /**
     * Generate a unique transaction ID
     * @returns {string}
     */
    generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
        return `tx_${timestamp}_${random}`;
    }

    /**
     * Dispose of resources and cleanup
     */
    async dispose() {
        if (this.inTransaction) {
            await this.rollbackTransaction();
        }
        logger.info('SPARQLExecute disposed');
    }
}

export default SPARQLExecute