// scripts/coverage.js
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function runCoverage() {
    console.log('Running tests with coverage...')

    // Run tests with coverage
    const result = spawnSync('nyc', ['node', 'scripts/run-tests.js'], {
        stdio: 'inherit',
        shell: true
    })

    if (result.status !== 0) {
        console.error('Tests failed')
        process.exit(1)
    }

    // Generate reports
    console.log('\nGenerating coverage reports...')
    spawnSync('nyc', ['report'], {
        stdio: 'inherit',
        shell: true
    })

    // Check coverage thresholds
    const summary = JSON.parse(
        fs.readFileSync(join(__dirname, '../coverage/coverage-summary.json'))
    )

    const thresholds = {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
    }

    let failed = false
    Object.entries(thresholds).forEach(([metric, threshold]) => {
        const actual = summary.total[metric].pct
        if (actual < threshold) {
            console.error(`${metric} coverage (${actual}%) below threshold (${threshold}%)`)
            failed = true
        }
    })

    // Generate badge
    const badge = {
        schemaVersion: 1,
        label: 'coverage',
        message: `${summary.total.lines.pct}%`,
        color: summary.total.lines.pct > 90 ? 'brightgreen' :
            summary.total.lines.pct > 80 ? 'green' :
                summary.total.lines.pct > 70 ? 'yellow' : 'red'
    }

    fs.writeFileSync(
        join(__dirname, '../coverage/badge.json'),
        JSON.stringify(badge, null, 2)
    )

    if (failed) {
        process.exit(1)
    }

    console.log('\nCoverage checks passed!')
}

runCoverage().catch(console.error)