import { createInterface } from 'readline'
import chalk from 'chalk'
import BaseAPI from '../common/BaseAPI.js'
import APIRegistry from '../common/APIRegistry.js'

export default class REPLHandler extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.registry = new APIRegistry()
        this.history = []
        this.mode = 'chat'
        this.commands = this.setupCommands()
    }

    setupCommands() {
        return {
            help: {
                desc: 'Show help menu',
                handler: () => this.showHelp()
            },
            mode: {
                desc: 'Switch mode (chat/rdf)',
                handler: (args) => this.switchMode(args[0])
            },
            clear: {
                desc: 'Clear screen',
                handler: () => console.clear()
            },
            history: {
                desc: 'Show command history',
                handler: () => this.showHistory()
            },
            exit: {
                desc: 'Exit REPL',
                handler: () => this.shutdown()
            }
        }
    }

    async initialize() {
        await super.initialize()

        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 100,
            removeHistoryDuplicates: true
        })

        this.rl.on('line', async (line) => {
            if (line.trim()) {
                this.history.push(line)
                await this.processInput(line)
            }
            this.rl.prompt()
        })

        this.rl.on('close', () => {
            this.shutdown()
        })

        console.clear()
        this.showWelcome()
        this.rl.prompt()
    }

    getPrompt() {
        return chalk.cyan(`semem(${this.mode})> `)
    }

    showWelcome() {
        console.log(chalk.green('Welcome to Semem Interactive Shell'))
        console.log(chalk.gray('Type "help" for available commands'))
        console.log()
    }

    showHelp() {
        console.log(chalk.yellow('\nAvailable Commands:'))
        Object.entries(this.commands).forEach(([cmd, info]) => {
            console.log(chalk.cyan(`  ${cmd.padEnd(10)} - ${info.desc}`))
        })
        console.log(chalk.yellow('\nModes:'))
        console.log(chalk.cyan('  chat      - Natural language interactions'))
        console.log(chalk.cyan('  rdf       - RDF/SPARQL queries'))
        console.log()
    }

    showHistory() {
        if (this.history.length === 0) {
            console.log(chalk.gray('No history available'))
            return
        }

        console.log(chalk.yellow('\nCommand History:'))
        this.history.slice(-10).forEach((cmd, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${cmd}`))
        })
        console.log()
    }

    switchMode(newMode) {
        const validModes = ['chat', 'rdf']
        if (!validModes.includes(newMode)) {
            console.log(chalk.red(`Invalid mode. Valid modes: ${validModes.join(', ')}`))
            return
        }

        this.mode = newMode
        this.rl.setPrompt(this.getPrompt())
        console.log(chalk.green(`Switched to ${newMode} mode`))
    }

    async processInput(input) {
        const trimmed = input.trim()
        if (!trimmed) return

        const [command, ...args] = trimmed.split(' ')

        // Check for built-in commands
        if (this.commands[command]) {
            await this.commands[command].handler(args)
            return
        }

        try {
            // Handle mode-specific operations
            switch (this.mode) {
                case 'chat':
                    await this.handleChat(trimmed)
                    break
                case 'rdf':
                    await this.handleRDF(trimmed)
                    break
            }
        } catch (error) {
            console.error(chalk.red('Error:'), error.message)
        }
    }

    async handleChat(input) {
        try {
            const api = this.registry.get('chat')
            const response = await api.executeOperation('chat', {
                prompt: input,
                mode: 'chat'
            })

            // Format and display response
            console.log(chalk.green('\nAssistant:'), response)
            console.log()

            // Store interaction
            const storageApi = this.registry.get('storage')
            await storageApi.storeInteraction({
                prompt: input,
                output: response,
                timestamp: Date.now()
            })
        } catch (error) {
            console.error(chalk.red('Chat error:'), error.message)
        }
    }

    async handleRDF(input) {
        try {
            const api = this.registry.get('storage')
            let response

            if (input.toLowerCase().startsWith('select') ||
                input.toLowerCase().startsWith('ask') ||
                input.toLowerCase().startsWith('construct')) {
                // Query operation
                response = await api.executeOperation('query', {
                    sparql: input
                })
            } else {
                // Update operation
                response = await api.executeOperation('update', {
                    sparql: input
                })
            }

            // Format and display response
            if (Array.isArray(response)) {
                console.log(chalk.yellow('\nResults:'))
                response.forEach(result => {
                    console.log(chalk.gray('-'), result)
                })
            } else {
                console.log(chalk.green('\nOperation completed successfully'))
            }
            console.log()
        } catch (error) {
            console.error(chalk.red('RDF error:'), error.message)
        }
    }

    async shutdown() {
        console.log(chalk.yellow('\nShutting down...'))
        if (this.rl) {
            this.rl.close()
        }
        await super.shutdown()
        process.exit(0)
    }
}