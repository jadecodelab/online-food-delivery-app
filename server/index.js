// =====================================================================
// index.js - Web server entry point.
//   Start:  node index.js      (or: npm run dev  to auto-restart on save)
//   Open:   http://localhost:3000
// =====================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const dao = require('./DAO');

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

// Unknown API URL -> 404 JSON (instead of an HTML error page)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// ---------- Error handler (must be last) ----------
// Any error thrown in a route ends up here, so the server never crashes
// and the browser always receives a JSON message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Invalid user input -> 400 with the validator's message
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
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
  });
}

start();
