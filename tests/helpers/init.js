import Config from '../../src/Config.js'

export async function initializeTestEnv() {
    const config = new Config()
    await config.init()

    global.testConfig = config

    // Add any other global test setup here
    global.baseTestTimeout = 10000 // 10 second timeout for tests
}

// Run initialization
initializeTestEnv().catch(console.error)
