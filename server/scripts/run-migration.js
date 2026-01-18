/**
 * Run database migration
 * 
 * Usage: node scripts/run-migration.js [migration-file]
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'go_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration(migrationFile) {
  const client = await pool.connect();
  
  try {
    console.log(`Running migration: ${migrationFile}`);
    const migrationPath = join(__dirname, '..', '..', 'db', 'migrations', migrationFile);
    const sql = readFileSync(migrationPath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
const migrationFile = process.argv[2] || '004_fix_schema_for_leaderboard.sql';

runMigration(migrationFile)
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
