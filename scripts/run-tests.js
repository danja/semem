import Jasmine from 'jasmine'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Config from '../src/Config.js'
import { initTestGraphs } from '../tests/helpers/setupSPARQL.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runTests() {
    try {
        console.log('Initializing configuration...')
        const config = new Config()
        await config.init()

        // Only initialize SPARQL for integration tests
        const testPath = process.argv[2] || ''
        if (testPath.includes('integration')) {
            console.log('Initializing test environment...')
            await initTestGraphs(config)
        }

        console.log('Running tests...')
        const jasmine = new Jasmine({
            projectBaseDir: join(__dirname, '..')
        })

        const configPath = join(__dirname, '..', 'jasmine.json')
        console.log('Loading config from:', configPath)

        jasmine.loadConfigFile(configPath)
        jasmine.exitOnCompletion = false

        try {
            const failures = await jasmine.execute([testPath])
            process.exit(failures ? 1 : 0)
        } catch (error) {
            console.error('Test execution failed:', error)
            process.exit(1)
        }
    } catch (error) {
        console.error('Test setup failed:', error)
        process.exit(1)
    }
}

runTests().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})