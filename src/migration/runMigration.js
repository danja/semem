#!/usr/bin/env node

/**
 * Run data migration script
 * Usage: node src/migration/runMigration.js [--dry-run] [--no-backup]
 */

import DataMigration from './DataMigration.js';
import SPARQLStore from '../stores/SPARQLStore.js';
import logger from 'loglevel';

// Configure logging
logger.setLevel('info');

async function runMigration() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const noBackup = args.includes('--no-backup');
    
    console.log('🚀 Starting Data Migration for ZPT Navigation');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    console.log(`Backup: ${noBackup ? 'DISABLED' : 'ENABLED'}`);
    
    try {
        // Initialize SPARQL store
        const sparqlStore = new SPARQLStore({
            query: 'http://localhost:3030/semem/query',
            update: 'http://localhost:3030/semem/update'
        }, {
            user: 'admin',
            password: 'admin',
            graphName: 'http://hyperdata.it/content'
        });

        // Initialize migration
        const migration = new DataMigration(sparqlStore, {
            dryRun: dryRun,
            enableBackup: !noBackup,
            enableValidation: true,
            batchSize: 50
        });

        // Execute migration
        const result = await migration.migrate();
        
        console.log('✅ Migration completed successfully!');
        console.log('📊 Final statistics:', result.stats);
        
        if (dryRun) {
            console.log('⚠️  This was a dry run - no actual changes were made');
        } else {
            console.log('🎉 Live migration completed - data has been migrated to new graphs');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration().catch(console.error);
}

export default runMigration;