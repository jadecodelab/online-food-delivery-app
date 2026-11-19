// =====================================================================
// routes/restaurants.js - /api/restaurants
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const { optionalText, escapeLike } = require('../validators');

const router = express.Router();

/**
 * GET /api/restaurants?search=
 * List restaurants (used for the restaurant dropdown and restaurant search).
 * search: optional keyword matched against name or address.
 */
router.get('/', async (req, res) => {
  const search = optionalText(req.query.search, 'Search keyword');

  const where = [];
  const params = [];
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where.push('(RestaurantName LIKE ? OR Address LIKE ?)');
    params.push(pattern, pattern);
  }

  const sql = `
    SELECT RestaurantID, RestaurantName, PhoneNumber, OpenHours, Address
    FROM RESTAURANT
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY RestaurantName`;

  res.json(await dao.query(sql, params));
});

module.exports = router;
