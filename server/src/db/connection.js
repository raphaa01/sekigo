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
    client.release();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }

  return pool;
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
