import chalk from 'chalk'

// Force color mode
process.env.FORCE_COLOR = '1'
chalk.level = 1

console.log('=== Color Test ===')
console.log(chalk.red('RED text'))
console.log(chalk.green('GREEN text'))
console.log(chalk.blue('BLUE text'))
console.log(chalk.yellow('YELLOW text'))
console.log(chalk.cyan('CYAN text'))
console.log(chalk.magenta('MAGENTA text'))
console.log(chalk.bold('BOLD text'))
console.log(chalk.red.bold('RED BOLD text'))
console.log(chalk.green.bold('GREEN BOLD text'))

console.log('\n=== Formatted Example ===')
console.log(chalk.cyan.bold('🔬 Starting HyDE Algorithm Demo'))
console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
console.log(chalk.green(`   ✓ Using chat provider: ${chalk.bold('mistral')} with model: ${chalk.bold('mistral-small-latest')}`))
console.log(chalk.blue.bold(`   📊 Query Results:`))
console.log(chalk.magenta.bold(`   💭 Generated Hypotheses:`))
console.log(chalk.cyan(`      Hypothesis 1 (confidence: ${chalk.bold('0.841')}):`))
console.log(chalk.white(`      "Renewable energy sources offer significant environmental and economic benefits..."`))