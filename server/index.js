// =====================================================================
// index.js - Web server entry point.
//   Start:  node index.js      (or: npm run dev  to auto-restart on save)
//   Open:   http://localhost:3000
// =====================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const dao = require('./DAO');
const { mapDbError } = require('./errors');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ---------- Middleware ----------
app.use(express.json());                                   // read JSON request bodies
app.use(express.static(path.join(__dirname, 'public')));   // serve the client (HTML/CSS/JS)

// ---------- API routes ----------

// Health check: proves browser -> server -> MySQL works.
app.get('/api/health', async (req, res) => {
  const info = await dao.testConnection();
  const counts = await dao.query(`
    SELECT 'CUSTOMER' AS tableName, COUNT(*) AS rowCount FROM CUSTOMER
    UNION ALL SELECT 'RESTAURANT',   COUNT(*) FROM RESTAURANT
    UNION ALL SELECT 'ORDER_STATUS', COUNT(*) FROM ORDER_STATUS
    UNION ALL SELECT 'MENU_ITEM',    COUNT(*) FROM MENU_ITEM
    UNION ALL SELECT 'ORDERS',       COUNT(*) FROM ORDERS
    UNION ALL SELECT 'ORDER_ITEM',   COUNT(*) FROM ORDER_ITEM
  `);
  res.json({ status: 'ok', database: info.db, mysqlVersion: info.version, tables: counts });
});

// Feature routes
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/menu-items', require('./routes/menuItems'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/order-statuses', require('./routes/orderStatuses'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/reports', require('./routes/reports'));

// Unknown API URL -> 404 JSON (instead of an HTML error page)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Unknown page -> friendly 404 page with navigation
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---------- Error handler (must be last) ----------
// Any error thrown in a route ends up here, so the server never crashes
// and the browser always receives a JSON message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Invalid user input -> 400 with the validator's message (+ per-field messages)
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message, fields: err.fields });
  }

  // Record not found (e.g. editing a customer ID that does not exist) -> 404
  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: err.message });
  }

  // Request body is not valid JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request data is not valid JSON.' });
  }

  // Request body larger than the limit (100 KB by default)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large.' });
  }

  // Other request-format problems reported by Express (unsupported encoding, etc.)
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // MySQL is not reachable (service stopped, connection lost) -> 503
  if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ER_CON_COUNT_ERROR'].includes(err.code)) {
    console.error(`[database unavailable] ${req.method} ${req.originalUrl}: ${err.code}`);
    return res.status(503).json({ error: 'The database is not available right now. Please try again in a moment.' });
  }

  // MySQL constraint violation (duplicate, foreign key, CHECK, ...) -> 4xx
  const dbError = mapDbError(err);
  if (dbError) {
    console.warn(`[constraint] ${req.method} ${req.originalUrl}: ${dbError.dbCode} ${err.sqlMessage}`);
    return res.status(dbError.status).json({
      error: dbError.message,
      fields: dbError.fields,
      dbCode: dbError.dbCode,
    });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\n`, err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

// ---------- Start ----------
async function start() {
  try {
    const info = await dao.testConnection();
    console.log(`Connected to MySQL ${info.version}, database "${info.db}"`);
  } catch (err) {
    console.error('\nCould not connect to MySQL:', err.code || '', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('-> Check DB_USER / DB_PASSWORD in server/.env');
    if (err.code === 'ER_BAD_DB_ERROR')        console.error('-> Database missing: run database/schema.sql then seed.sql');
    if (err.code === 'ECONNREFUSED')           console.error('-> Is the MySQL80 service running? Check DB_HOST / DB_PORT');
    if (!process.env.DB_PASSWORD)              console.error('-> server/.env not found or DB_PASSWORD empty: copy .env.example to .env');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Addresses other devices on the same Wi-Fi (e.g. a phone) can use
    const lan = Object.values(require('os').networkInterfaces())
      .flat()
      .filter((net) => net && net.family === 'IPv4' && !net.internal)
      .map((net) => `http://${net.address}:${PORT}`);
    if (lan.length) console.log(`On your phone (same Wi-Fi): ${lan.join('  or  ')}`);
  });
}

start();
