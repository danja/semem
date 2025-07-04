import APIRegistry from './APIRegistry.js'
import SPARQLHelpers from '../../services/sparql/SPARQLHelper.js'

export default class RDFParser {
    constructor(config = {}) {
        this.registry = new APIRegistry()
        this.prefixes = {
            semem: 'http://purl.org/stuff/semem/',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            qb: 'http://purl.org/linked-data/cube#',
            skos: 'http://www.w3.org/2004/02/skos/core#',
            ...config.prefixes
        }
    }

    parse(input) {
        const lines = input.trim().split('\n')
        const commands = []
        let currentCommand = ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue

            if (trimmed.endsWith(';')) {
                currentCommand += ' ' + trimmed.slice(0, -1)
                commands.push(currentCommand.trim())
                currentCommand = ''
            } else {
                currentCommand += ' ' + trimmed
            }
        }

        if (currentCommand) {
            commands.push(currentCommand.trim())
        }

        return commands.map(cmd => this.parseCommand(cmd))
    }

    parseCommand(command) {
        const tokens = command.split(' ')
        const action = tokens[0].toLowerCase()

        switch (action) {
            case 'store':
                return this.parseStoreCommand(tokens.slice(1))
            case 'query':
                return this.parseQueryCommand(tokens.slice(1))
            case 'update':
                return this.parseUpdateCommand(tokens.slice(1))
            case 'define':
                return this.parseDefineCommand(tokens.slice(1))
            default:
                throw new Error(`Unknown command: ${action}`)
        }
    }

    parseStoreCommand(tokens) {
        const options = this.parseOptions(tokens)
        const data = options.data || tokens.join(' ')

        return {
            type: 'store',
            data: this.expandPrefixes(data),
            format: options.format || 'turtle',
            graph: options.graph
        }
    }

    parseQueryCommand(tokens) {
        const options = this.parseOptions(tokens)
        let query = options.query || tokens.join(' ')

        // Handle simplified query syntax
        if (!query.toLowerCase().startsWith('select') &&
            !query.toLowerCase().startsWith('ask') &&
            !query.toLowerCase().startsWith('construct')) {
            query = this.buildSimpleQuery(query, options)
        }

        return {
            type: 'query',
            query: this.expandPrefixes(query),
            format: options.format || 'json'
        }
    }

    parseUpdateCommand(tokens) {
        const options = this.parseOptions(tokens)
        let update = options.update || tokens.join(' ')

        // Handle simplified update syntax
        if (!update.toLowerCase().startsWith('insert') &&
            !update.toLowerCase().startsWith('delete')) {
            update = this.buildSimpleUpdate(update, options)
        }

        return {
            type: 'update',
            update: this.expandPrefixes(update),
            graph: options.graph
        }
    }

    parseDefineCommand(tokens) {
        const name = tokens[0]
        const value = tokens.slice(1).join(' ')

        if (name && value) {
            this.prefixes[name] = value.replace(/[<>]/g, '')
        }

        return {
            type: 'define',
            prefix: name,
            uri: value
        }
    }

    parseOptions(tokens) {
        const options = {}
        let i = 0

        while (i < tokens.length) {
            if (tokens[i].startsWith('--')) {
                const key = tokens[i].slice(2)
                i++
                if (i < tokens.length && !tokens[i].startsWith('--')) {
                    options[key] = tokens[i]
                    i++
                } else {
                    options[key] = true
                }
            } else {
                i++
            }
        }

        return options
    }

    buildSimpleQuery(text, options) {
        const vars = options.vars?.split(',') || ['s', 'p', 'o']
        const limit = options.limit || 10
        const offset = options.offset || 0

        return `
            SELECT ${vars.map(v => `?${v}`).join(' ')}
            ${options.graph ? `FROM <${options.graph}>` : ''}
            WHERE {
                ${text.includes(' ') ? text : `?s ?p ?o . FILTER(regex(str(?o), "${text}", "i"))`}
            }
            LIMIT ${limit}
            OFFSET ${offset}
        `
    }

    buildSimpleUpdate(text, options) {
        const [subject, predicate, object] = text.split(' ')
        const graph = options.graph ? `GRAPH <${options.graph}>` : ''

        return `
            INSERT DATA {
                ${graph} {
                    ${this.expandPrefixes(`${subject} ${predicate} ${object}`)}
                }
            }
        `
    }

    expandPrefixes(text) {
        let expanded = text
        for (const [prefix, uri] of Object.entries(this.prefixes)) {
            const regex = new RegExp(`${prefix}:([\\w-]+)`, 'g')
            expanded = expanded.replace(regex, `<${uri}$1>`)
        }
        return expanded
    }

    async execute(commands) {
        const results = []
        const api = this.registry.get('storage')

        for (const command of commands) {
            try {
                switch (command.type) {
                    case 'store':
                        results.push(await api.storeInteraction({
                            content: command.data,
                            format: command.format,
                            graph: command.graph
                        }))
                        break

                    case 'query':
                        results.push(await api.executeOperation('query', {
                            sparql: command.query,
                            format: command.format
                        }))
                        break

                    case 'update':
                        results.push(await api.executeOperation('update', {
                            sparql: command.update,
                            graph: command.graph
                        }))
                        break

                    case 'define':
                        results.push({
                            success: true,
                            prefix: command.prefix,
                            uri: command.uri
                        })
                        break
                }
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    command
                })
            }
        }

        return results
    }
}