/**
 * Database Connection Module
 * 
 * Handles PostgreSQL database connection and provides query helpers.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 */
export async function initDatabase() {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'go_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('Database connection established');
    
    // Run migration automatically on startup
    try {
      await runMigrationIfNeeded(client);
    } catch (migrationError) {
      console.warn('Migration warning (non-fatal):', migrationError.message);
      // Continue even if migration fails
    }
    
    client.release();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }

  return pool;
}

/**
 * Run migration if needed
 */
async function runMigrationIfNeeded(client) {
  // Check if board_size column exists in ratings
  const checkResult = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'ratings' AND column_name = 'board_size'
  `);
  
  if (checkResult.rows.length > 0) {
    console.log('✅ Database schema is up to date (board_size exists)');
    return;
  }
  
  console.log('🔄 Running database migration to add board_size support...');
  
  // Read and execute migration
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  const migrationPath = join(__dirname, '..', '..', '..', '..', 'db', 'migrations', '004_fix_schema_for_leaderboard.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Get database pool instance
 * @returns {Pool} PostgreSQL pool
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
  const pool = getPool();
  return await pool.query(text, params);
}

// Export pool as db for convenience
export const db = {
  query,
  getPool
};
