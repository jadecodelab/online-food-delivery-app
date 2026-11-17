// =====================================================================
// DAO.js - Data Access Object: the only file that talks to MySQL.
//
// Uses a connection POOL: a small set of open connections that are
// reused by every request, instead of opening a new connection each time.
//
// All queries go through query(sql, params), which uses prepared
// statements ("?" placeholders). User input is sent separately from the
// SQL text, so it can never change the SQL itself (prevents SQL injection).
// =====================================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_delivery',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // return DATETIME as 'YYYY-MM-DD HH:MM:SS' text
  decimalNumbers: true,   // return DECIMAL (prices) as JS numbers
});

/**
 * Run one parameterized SQL statement.
 * @param {string} sql     SQL text with ? placeholders
 * @param {Array}  params  values for the placeholders, in order
 * @returns rows for SELECT, or a result object (insertId, affectedRows) for INSERT/UPDATE
 */
async function query(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Get a dedicated connection for a TRANSACTION (several statements that
 * must all succeed or all be undone, e.g. inserting an order + its items).
 * Caller must call connection.release() when finished.
 */
async function getConnection() {
  return pool.getConnection();
}

/** Check the database is reachable (used at startup). */
async function testConnection() {
  const rows = await query('SELECT DATABASE() AS db, VERSION() AS version');
  return rows[0];
}

module.exports = { query, getConnection, testConnection, pool };
