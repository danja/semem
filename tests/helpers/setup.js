import Config from '../../src/Config.js'
import { initTestGraphs } from './setupSPARQL.js'

export async function setupTests() {
    const config = new Config()
    await config.init()

    // Check if we're running integration tests
    const isIntegration = process.argv.some(arg => arg.includes('integration'))
    if (isIntegration) {
        await initTestGraphs(config)
    }
}
