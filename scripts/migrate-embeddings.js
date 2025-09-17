#!/usr/bin/env node

/**
 * Embedding Migration Script
 *
 * Cleans up invalid embedding dimensions to fix FAISS index synchronization
 *
 * Usage:
 *   npm run migrate-embeddings           # Run migration
 *   npm run migrate-embeddings --dry-run # Analyze only, don't modify
 *   node scripts/migrate-embeddings.js  # Direct execution
 */

import { runMigration } from '../src/utils/EmbeddingMigration.js';

async function main() {
    const args = process.argv.slice(2);

    const options = {
        dryRun: args.includes('--dry-run'),
        persistResults: !args.includes('--no-persist')
    };

    console.log('🔧 Embedding Migration Script');
    console.log('==============================\n');

    try {
        const stats = await runMigration(options);

        if (stats.removedItems > 0) {
            console.log(`\n✅ Migration completed: ${stats.removedItems} invalid items cleaned up`);
        } else {
            console.log('\n✅ No migration needed - all embeddings are valid');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();