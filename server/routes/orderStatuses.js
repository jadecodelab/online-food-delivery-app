// =====================================================================
// routes/orderStatuses.js - /api/order-statuses
// =====================================================================
const express = require('express');
const dao = require('../DAO');

const router = express.Router();

/**
 * GET /api/order-statuses
 * All allowed statuses from the ORDER_STATUS lookup table
 * (fills the Status dropdowns, so the UI never hard-codes them).
 */
router.get('/', async (req, res) => {
  res.json(await dao.query('SELECT StatusID, StatusName FROM ORDER_STATUS ORDER BY StatusID'));
});

module.exports = router;
