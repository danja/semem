import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'
import log from 'loglevel'
import APIRegistry from '../common/APIRegistry.js'
import BaseAPI from '../common/BaseAPI.js'

export default class CLIHandler extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.registry = new APIRegistry()
        this.setupCommands()
    }

    setupCommands() {
        this.yargs = yargs(hideBin(process.argv))
            .command('chat', 'Chat with the system', {
                prompt: {
                    alias: 'p',
                    type: 'string',
                    demandOption: true,
                    describe: 'Input prompt'
                },
                model: {
                    alias: 'm',
                    type: 'string',
                    default: 'qwen2:1.5b',
                    describe: 'Model to use'
                }
            })
            .command('store', 'Store data', {
                data: {
                    alias: 'd',
                    type: 'string',
                    demandOption: true,
                    describe: 'Data to store'
                },
                format: {
                    alias: 'f',
                    choices: ['text', 'turtle'],
                    default: 'text'
                }
            })
            .command('query', 'Query stored data', {
                query: {
                    alias: 'q',
                    type: 'string',
                    demandOption: true,
                    describe: 'Search query'
                },
                limit: {
                    alias: 'l',
                    type: 'number',
                    default: 10
                }
            })
            .command('metrics', 'Show system metrics', {
                format: {
                    choices: ['text', 'json'],
                    default: 'text'
                }
            })
            .option('color', {
                type: 'boolean',
                default: true,
                describe: 'Colorize output'
            })
            .option('verbose', {
                alias: 'v',
                type: 'boolean',
                describe: 'Run with verbose logging'
            })
            .help()
            .alias('h', 'help')
    }

    async initialize() {
        await super.initialize()

        // Set up logging based on verbosity
        if (this.yargs.argv.verbose) {
            log.setLevel('debug')
        }

        process.on('SIGINT', async () => {
            await this.shutdown()
            process.exit(0)
        })
    }

    async executeOperation(command, args) {
        try {
            switch (command) {
                case 'chat':
                    return this.handleChat(args)
                case 'store':
                    return this.handleStore(args)
                case 'query':
                    return this.handleQuery(args)
                case 'metrics':
                    return this.handleMetrics(args)
                default:
                    throw new Error(`Unknown command: ${command}`)
            }
        } catch (error) {
            this.logger.error('Operation failed:', error)
            this.formatOutput({
                success: false,
                error: error.message
            }, args)
        }
    }

    async handleChat({ prompt, model }) {
        const api = this.registry.get('chat')
        const response = await api.executeOperation('chat', {
            prompt,
            model
        })

        return this.formatOutput({
            success: true,
            data: response
        })
    }

    async handleStore({ data, format }) {
        const api = this.registry.get('storage')
        const stored = await api.storeInteraction({
            content: data,
            format,
            timestamp: Date.now()
        })

        return this.formatOutput({
            success: true,
            data: stored
        })
    }

    async handleQuery({ query, limit }) {
        const api = this.registry.get('storage')
        const results = await api.retrieveInteractions({
            text: query,
            limit
        })

        return this.formatOutput({
            success: true,
            data: results
        })
    }

    async handleMetrics({ format }) {
        const metrics = await this.getMetrics()
        return this.formatOutput({
            success: true,
            data: metrics
        }, { format })
    }

    formatOutput(result, { format = 'text', color = true } = {}) {
        const c = color ? chalk : (text => text)

        if (format === 'json') {
            return console.log(JSON.stringify(result, null, 2))
        }

        if (!result.success) {
            return console.error(c.red(`Error: ${result.error}`))
        }

        if (Array.isArray(result.data)) {
            result.data.forEach(item => {
                console.log(c.cyan('---'))
                Object.entries(item).forEach(([key, value]) => {
                    console.log(c.yellow(`${key}:`), value)
                })
            })
            return
        }

        if (typeof result.data === 'object') {
            Object.entries(result.data).forEach(([key, value]) => {
                console.log(c.yellow(`${key}:`), value)
            })
            return
        }

        console.log(result.data)
    }

    async run() {
        await this.initialize()
        const argv = await this.yargs.argv
        const command = argv._[0]

        if (!command) {
            this.yargs.showHelp()
            process.exit(1)
        }

        await this.executeOperation(command, argv)
    }
}
